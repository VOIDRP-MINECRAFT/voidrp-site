<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { authState } from '../../stores/authStore'
import { serverState, fetchServers } from '../../stores/serverStore'
import { confirmDialog } from '../../composables/useConfirm'
import { toastSuccess, toastError } from '../../services/toast'
import {
  getPermissionCatalog,
  listRoles,
  createRole,
  updateRole,
  deleteRole,
  reorderRoles,
  addRoleMember,
  removeRoleMember,
} from '../../services/adminModeratorsApi'

const token = () => authState.accessToken
const PALETTE = ['#1abc9c', '#2ecc71', '#3498db', '#9b59b6', '#e91e63', '#f1c40f',
  '#e67e22', '#e74c3c', '#95a5a6', '#607d8b', '#11806a', '#206694']
const TEMPLATES = [
  { name: 'Модератор', color: '#3498db', perms: ['dashboard.view', 'monitoring.view', 'players.online.view', 'punishments.view', 'punishments.manage', 'feedback.view', 'mod_suggestions.view'] },
  { name: 'Хелпер', color: '#2ecc71', perms: ['dashboard.view', 'players.online.view', 'feedback.view', 'mod_suggestions.view'] },
  { name: 'Контент', color: '#e67e22', perms: ['dashboard.view', 'news.updates.view', 'news.updates.manage', 'news.media.view', 'news.media.manage'] },
]

const roles = ref([])
const me = ref(null)
const catalog = ref([])
const loading = ref(true)
const selectedId = ref(null)
const tab = ref('main')
const draft = ref(null)
const saving = ref(false)
const permQuery = ref('')
const memberName = ref('')
const memberBusy = ref(false)

const servers = computed(() => [...serverState.list].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)))
const serverName = (slug) => servers.value.find((s) => s.slug === slug)?.name || slug
const selected = computed(() => roles.value.find((r) => r.id === selectedId.value) || null)
// Роли (с правами, по старшинству) и значки (без прав — просто подпись о человеке).
const realRoles = computed(() => roles.value.filter((r) => !r.is_badge))
const badges = computed(() => roles.value.filter((r) => r.is_badge))
const isBadge = computed(() => !!selected.value?.is_badge)
// К каким ролям можно привязать значок: свои роли и те, которыми управляешь.
const ownerOptions = computed(() => realRoles.value.filter((r) => r.mine || r.editable))
const ownerRole = computed(() => roles.value.find((r) => r.id === draft.value?.owner_role_id) || selected.value?.owner_role || null)
const readOnly = computed(() => !selected.value?.editable)
const catalogByKey = computed(() => Object.fromEntries(catalog.value.flatMap((g) => g.permissions).map((p) => [p.key, p])))

// ── What the viewer may give (the API checks the same) ──────────────────────
const user = computed(() => authState.user || {})
function holds(key, slugs) {
  const u = user.value
  if (u.is_admin) return true
  if ((u.permissions || []).includes(key)) return true
  if (!slugs) return false
  return slugs.length > 0 && slugs.every((s) => (u.server_permissions?.[s] || []).includes(key))
}
function canGive(key) {
  if (!draft.value) return false
  const scoped = draft.value.servers !== null
  if (scoped && catalogByKey.value[key]?.scope !== 'server') return false
  if (user.value.is_admin) return true
  const admin = user.value.administered_servers || []
  if (scoped && draft.value.servers.every((s) => admin.includes(s))) return true
  return holds(key, draft.value.servers)
}
// Роли правит roles.manage (и админы своих серверов), значки — badges.manage по серверам.
const scopeKey = computed(() => (isBadge.value ? 'badges.manage' : 'roles.manage'))
const holdsAll = (key) => user.value.is_admin || (user.value.permissions || []).includes(key)
const canUseAllServers = computed(() => holdsAll(scopeKey.value))
function serversFor(key) {
  if (holdsAll(key)) return servers.value
  const admin = user.value.administered_servers || []
  const sp = user.value.server_permissions || {}
  if (key === 'badges.manage') return servers.value.filter((s) => (sp[s.slug] || []).includes(key))
  return servers.value.filter((s) => admin.includes(s.slug) || Object.keys(sp).includes(s.slug))
}
const pickableServers = computed(() => serversFor(scopeKey.value))
const canCreate = computed(() => me.value?.can_manage_roles)
const canCreateBadge = computed(() => me.value?.can_manage_badges)

// ── Loading & selection ─────────────────────────────────────────────────────
function snapshot(role) {
  return role ? { name: role.name, color: role.color, servers: role.servers ? [...role.servers].sort() : null, permissions: [...role.permissions], owner_role_id: role.owner_role?.id || null } : null
}
const dirty = computed(() => draft.value && selected.value && JSON.stringify(snapshot({ ...draft.value, permissions: [...draft.value.permissions].sort() })) !== JSON.stringify(snapshot({ ...selected.value, permissions: [...selected.value.permissions].sort() })))

async function load(keep = true) {
  loading.value = !roles.value.length
  try {
    const [cat, res] = await Promise.all([getPermissionCatalog(token()), listRoles(token()), fetchServers()])
    catalog.value = cat.catalog || []
    roles.value = res.items || []
    me.value = res.me
    if (!keep || !roles.value.some((r) => r.id === selectedId.value)) select(roles.value[0]?.id || null, true)
  } catch (e) {
    toastError(e?.message || 'Не удалось загрузить роли')
  } finally {
    loading.value = false
  }
}

async function select(id, force = false) {
  if (!force && dirty.value) {
    const ok = await confirmDialog({ title: 'Несохранённые изменения', message: 'Уйти от этой роли и потерять правки?', confirmLabel: 'Уйти', danger: true })
    if (!ok) return
  }
  selectedId.value = id
  draft.value = snapshot(roles.value.find((r) => r.id === id))
  memberName.value = ''
  if (roles.value.find((r) => r.id === id)?.is_badge && tab.value === 'perms') tab.value = 'main'
}
function reset() { draft.value = snapshot(selected.value) }

// ── Create / save / delete ──────────────────────────────────────────────────
async function create(tpl = null, badge = false) {
  const key = badge ? 'badges.manage' : 'roles.manage'
  const scope = holdsAll(key) ? null : serversFor(key).slice(0, 1).map((s) => s.slug)
  const body = {
    name: tpl?.name || (badge ? 'Новый значок' : 'Новая роль'),
    color: tpl?.color || (badge ? '#f1c40f' : '#99aab5'),
    servers: scope,
    permissions: tpl ? tpl.perms.filter((k) => scope === null || catalogByKey.value[k]?.scope === 'server') : [],
    badge,
  }
  try {
    const role = await createRole(token(), body)
    await load()
    await select(role.id, true)
    tab.value = tpl ? 'perms' : 'main'
    toastSuccess(badge ? `Значок «${role.name}» создан` : `Роль «${role.name}» создана — внизу списка`)
  } catch (e) {
    toastError(e?.message || 'Не удалось создать роль')
  }
}

async function save() {
  if (!draft.value.name.trim()) { toastError('У роли должно быть название'); return }
  saving.value = true
  try {
    const body = { ...draft.value, name: draft.value.name.trim(), badge: isBadge.value }
    if (body.servers !== null) body.permissions = body.permissions.filter((k) => catalogByKey.value[k]?.scope === 'server')
    await updateRole(token(), selected.value.id, body)
    await load()
    draft.value = snapshot(selected.value)
    toastSuccess('Роль сохранена')
  } catch (e) {
    toastError(e?.message || 'Не удалось сохранить')
  } finally {
    saving.value = false
  }
}

async function remove() {
  const r = selected.value
  const ok = await confirmDialog({
    title: r.is_badge ? `Удалить значок «${r.name}»?` : `Удалить роль «${r.name}»?`,
    message: r.is_badge ? 'Значок пропадёт у всех, у кого он есть.' : (r.members.length ? `У ${r.members.length} чел. пропадут права этой роли. Отменить нельзя.` : 'Отменить нельзя.'),
    confirmLabel: 'Удалить', danger: true,
  })
  if (!ok) return
  try {
    await deleteRole(token(), r.id)
    toastSuccess(r.is_badge ? 'Значок удалён' : 'Роль удалена')
    await load(false)
  } catch (e) {
    toastError(e?.message || 'Не удалось удалить')
  }
}

// ── Scope & permissions ─────────────────────────────────────────────────────
function setScope(all) {
  if (readOnly.value) return
  if (all) draft.value.servers = null
  else if (draft.value.servers === null) draft.value.servers = pickableServers.value.slice(0, 1).map((s) => s.slug)
}
function toggleServer(slug) {
  if (readOnly.value) return
  const set = new Set(draft.value.servers || [])
  if (set.has(slug)) { if (set.size === 1) return; set.delete(slug) } else set.add(slug)
  draft.value.servers = servers.value.map((s) => s.slug).filter((s) => set.has(s))
}
const hasPerm = (key) => draft.value?.permissions.includes(key)
function togglePerm(key) {
  if (readOnly.value || !canGive(key)) return
  const set = new Set(draft.value.permissions)
  if (set.has(key)) set.delete(key); else set.add(key)
  draft.value.permissions = [...set]
}
const shownGroups = computed(() => {
  const q = permQuery.value.trim().toLowerCase()
  return catalog.value
    .map((g) => ({ ...g, permissions: g.permissions.filter((p) => !q || p.label.toLowerCase().includes(q) || p.key.includes(q)) }))
    .filter((g) => g.permissions.length)
})
const givenCount = computed(() => draft.value?.permissions.filter((k) => draft.value.servers === null || catalogByKey.value[k]?.scope === 'server').length || 0)
// A server-bound role cannot carry platform keys; they stay listed, greyed out.
watch(() => draft.value?.servers, (v) => {
  if (v && draft.value && !readOnly.value) draft.value.permissions = draft.value.permissions.filter((k) => catalogByKey.value[k]?.scope === 'server')
})

// ── Members ─────────────────────────────────────────────────────────────────
async function addMember() {
  const name = memberName.value.trim()
  if (!name) return
  memberBusy.value = true
  try {
    await addRoleMember(token(), selected.value.id, name)
    memberName.value = ''
    await load()
    toastSuccess(`${name} получил роль «${selected.value.name}»`)
  } catch (e) {
    toastError(e?.message || 'Не удалось выдать роль')
  } finally {
    memberBusy.value = false
  }
}
async function dropMember(m) {
  try {
    await removeRoleMember(token(), selected.value.id, m.id)
    await load()
    toastSuccess(`С ${m.site_login} снята роль`)
  } catch (e) {
    toastError(e?.message || 'Не удалось снять роль')
  }
}

// ── Drag to reorder (higher = more senior) ──────────────────────────────────
const dragId = ref(null)
const overId = ref(null)
const canDrag = (r) => !r.is_badge && (me.value?.platform_admin || r.editable)
function onDragStart(r, e) { dragId.value = r.id; e.dataTransfer.effectAllowed = 'move' }
async function onDrop(target) {
  const from = dragId.value
  dragId.value = null
  overId.value = null
  if (!from || from === target.id) return
  if (target.is_badge) return
  const ids = realRoles.value.map((r) => r.id).filter((id) => id !== from)
  ids.splice(ids.indexOf(target.id), 0, from)
  const before = roles.value
  roles.value = [...ids.map((id) => before.find((r) => r.id === id)), ...badges.value]
  try {
    const res = await reorderRoles(token(), ids)
    roles.value = res.items
  } catch (e) {
    roles.value = before
    toastError(e?.message || 'Не удалось изменить порядок')
  }
}

onMounted(() => load(false))
</script>

<template>
  <div class="adm-page">
    <div class="adm-page__head">
      <div>
        <h1 class="adm-title">Роли</h1>
        <p class="adm-sub">Наборы прав, которые выдаются людям одной кнопкой. Выше в списке — старше.</p>
      </div>
      <div class="adm-head-actions">
        <RouterLink v-if="me?.can_staff" to="/admin/moderators" class="adm-btn">Сотрудники</RouterLink>
        <button v-if="canCreateBadge" class="adm-btn" @click="create(null, true)">Создать значок</button>
        <button v-if="canCreate" class="adm-btn adm-btn--acc" @click="create()">Создать роль</button>
      </div>
    </div>

    <div v-if="loading" class="rl-layout">
      <div class="adm-skel" style="height: 320px" />
      <div class="adm-skel" style="height: 420px" />
    </div>

    <!-- Пусто -->
    <div v-else-if="!roles.length" class="adm-card rl-empty">
      <div class="rl-empty__badges">
        <span v-for="t in TEMPLATES" :key="t.name" class="rl-pill" :style="{ '--rc': t.color }"><i />{{ t.name }}</span>
      </div>
      <div class="adm-empty__title">Ролей пока нет</div>
      <p class="adm-empty__sub">
        Роль — это набор прав с названием и цветом. Выдаёшь её человеку, и он сразу получает всё, что в ней отмечено.
        Поменял права роли — они поменялись у всех, у кого она есть.
      </p>
      <div v-if="canCreate" class="rl-empty__actions">
        <button v-for="t in TEMPLATES" :key="t.name" class="adm-btn" @click="create(t)">Создать «{{ t.name }}»</button>
        <button class="adm-btn adm-btn--acc" @click="create()">Пустая роль</button>
      </div>
    </div>

    <div v-else class="rl-layout">
      <!-- Список ролей -->
      <aside class="adm-card rl-list">
        <div class="rl-list__head">
          <span class="adm-label" style="margin: 0">Роли — {{ realRoles.length }}</span>
        </div>
        <p v-if="!realRoles.length" class="rl-list__empty">Ролей, которые ты можешь выдавать, нет.</p>
        <ul>
          <li
            v-for="r in realRoles"
            :key="r.id"
            class="rl-item"
            :class="{ 'rl-item--on': r.id === selectedId, 'rl-item--over': overId === r.id && dragId && dragId !== r.id, 'rl-item--dragging': dragId === r.id }"
            :style="{ '--rc': r.color }"
            :draggable="canDrag(r)"
            @click="select(r.id)"
            @dragstart="onDragStart(r, $event)"
            @dragend="dragId = null; overId = null"
            @dragover.prevent="overId = r.id"
            @drop.prevent="onDrop(r)"
          >
            <span class="rl-item__grip" :class="{ 'rl-item__grip--off': !canDrag(r) }" aria-hidden="true">
              <svg viewBox="0 0 10 16" fill="currentColor"><circle cx="2.5" cy="3" r="1.3"/><circle cx="7.5" cy="3" r="1.3"/><circle cx="2.5" cy="8" r="1.3"/><circle cx="7.5" cy="8" r="1.3"/><circle cx="2.5" cy="13" r="1.3"/><circle cx="7.5" cy="13" r="1.3"/></svg>
            </span>
            <span class="rl-item__dot" />
            <span class="rl-item__main">
              <span class="rl-item__name">{{ r.name }}</span>
              <span class="rl-item__meta">{{ r.servers ? r.servers.map(serverName).join(', ') : 'все серверы' }}</span>
            </span>
            <span class="rl-item__count adm-num" :title="`Участников: ${r.members.length}`">{{ r.members.length }}</span>
            <svg v-if="!r.editable" class="rl-item__lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>
          </li>
        </ul>
        <template v-if="badges.length">
          <div class="rl-list__head rl-list__head--badges">
            <span class="adm-label" style="margin: 0">Значки — {{ badges.length }}</span>
          </div>
          <ul>
            <li
              v-for="r in badges" :key="r.id" class="rl-item rl-item--badge"
              :class="{ 'rl-item--on': r.id === selectedId }" :style="{ '--rc': r.color }" @click="select(r.id)"
            >
              <span class="rl-item__grip rl-item__grip--off" aria-hidden="true" />
              <span class="rl-item__tag">#</span>
              <span class="rl-item__main">
                <span class="rl-item__name">{{ r.name }}</span>
                <span class="rl-item__meta">{{ r.owner_role ? `значок роли «${r.owner_role.name}»` : 'значок · без прав' }}</span>
              </span>
              <span class="rl-item__count adm-num">{{ r.members.length }}</span>
              <svg v-if="!r.editable" class="rl-item__lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>
            </li>
          </ul>
        </template>
        <p class="rl-list__hint">Перетащи роль, чтобы поменять старшинство: выданные права от порядка не зависят, но менять и выдавать можно только роли ниже своей.</p>
      </aside>

      <!-- Редактор -->
      <section v-if="selected && draft" class="adm-card rl-editor" :style="{ '--rc': draft.color }">
        <header class="rl-editor__head">
          <div class="rl-editor__title">
            <span class="rl-editor__swatch" />
            <div>
              <div class="rl-editor__name">{{ draft.name || 'Без названия' }}</div>
              <div class="rl-editor__sub">
                {{ selected.members.length }} {{ selected.members.length === 1 ? 'участник' : 'участников' }} ·
                <template v-if="isBadge">значок, без прав ·</template>
                <template v-else>{{ givenCount }} {{ givenCount === 1 ? 'право' : 'прав' }} ·</template>
                {{ draft.servers ? draft.servers.map(serverName).join(', ') : 'все серверы' }}
              </div>
            </div>
          </div>
          <div class="adm-tabs">
            <button class="adm-tab" :class="{ 'adm-tab--active': tab === 'main' }" @click="tab = 'main'">Основное</button>
            <button v-if="!isBadge" class="adm-tab" :class="{ 'adm-tab--active': tab === 'perms' }" @click="tab = 'perms'">Права</button>
            <button class="adm-tab" :class="{ 'adm-tab--active': tab === 'members' }" @click="tab = 'members'">Участники · {{ selected.members.length }}</button>
          </div>
        </header>

        <div v-if="readOnly" class="rl-lockbar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>
          Только просмотр: эта роль не ниже твоей или даёт права, которых у тебя нет.
        </div>

        <!-- Основное -->
        <div v-if="tab === 'main'" class="rl-pane rl-main">
          <label class="adm-field">
            <span>Название</span>
            <input v-model="draft.name" class="adm-input" maxlength="48" :disabled="readOnly" placeholder="например, Модератор Origins" />
          </label>

          <div v-if="isBadge" class="rl-badgenote">
            Значок — подпись о человеке, как шуточные роли в Discord. Прав не даёт, на старшинство не влияет.
            Выдаётся сотрудникам; себе тоже можно. Создают и выдают — права «Значки» в «Сотрудниках».
          </div>
          <div class="adm-field">
            <span>Цвет</span>
            <div class="rl-colors">
              <button
                v-for="c in PALETTE" :key="c" type="button" class="rl-color"
                :class="{ 'rl-color--on': draft.color === c }" :style="{ background: c }" :disabled="readOnly"
                :aria-label="c" @click="draft.color = c"
              />
              <label class="rl-color rl-color--custom" :class="{ 'rl-color--on': !PALETTE.includes(draft.color) }" title="Свой цвет">
                <input v-model="draft.color" type="color" :disabled="readOnly" />
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 5v14M5 12h14"/></svg>
              </label>
            </div>
          </div>

          <label v-if="isBadge" class="adm-field">
            <span>Принадлежит роли</span>
            <select v-model="draft.owner_role_id" class="adm-select" :disabled="readOnly">
              <option :value="null">— не привязан —</option>
              <option v-if="ownerRole && !ownerOptions.some((r) => r.id === ownerRole.id)" :value="ownerRole.id">{{ ownerRole.name }}</option>
              <option v-for="r in ownerOptions" :key="r.id" :value="r.id">{{ r.name }}</option>
            </select>
            <small class="rl-note">{{ draft.owner_role_id ? 'Участники роли выдают этот значок (себе и тем, кто ниже) и правят его; серверы — как у роли.' : 'Не привязан — выдают по правам «Значки» на выбранных серверах.' }}</small>
          </label>
          <div v-if="!(isBadge && draft.owner_role_id)" class="adm-field">
            <span>{{ isBadge ? 'Чей значок' : 'Где действует' }}</span>
            <div class="rl-scope">
              <button type="button" class="rl-scope__opt" :class="{ 'rl-scope__opt--on': draft.servers === null }" :disabled="readOnly || !canUseAllServers" @click="setScope(true)">
                <b>{{ isBadge ? 'Общий' : 'На всех серверах' }}</b>
                <small>{{ isBadge ? 'выдают те, кто выдаёт роли на всей платформе' : 'и права платформы: сайт, лаунчер, аккаунты' }}</small>
              </button>
              <button type="button" class="rl-scope__opt" :class="{ 'rl-scope__opt--on': draft.servers !== null }" :disabled="readOnly" @click="setScope(false)">
                <b>{{ isBadge ? 'Для серверов' : 'На выбранных серверах' }}</b>
                <small>{{ isBadge ? 'выдают и правят админы этих серверов' : 'только права серверов — там, где отмечено' }}</small>
              </button>
            </div>
            <div v-if="draft.servers !== null" class="rl-servers">
              <button
                v-for="s in servers" :key="s.slug" type="button" class="rl-server"
                :class="{ 'rl-server--on': draft.servers.includes(s.slug) }"
                :disabled="readOnly || !pickableServers.some((p) => p.slug === s.slug)"
                @click="toggleServer(s.slug)"
              >{{ s.name }}</button>
            </div>
          </div>

          <div class="rl-preview">
            <span class="adm-label" style="margin: 0 0 0.55rem">Как это выглядит</span>
            <div class="rl-preview__row">
              <span class="adm-avatar rl-preview__ava">M</span>
              <span class="rl-preview__nick">mironoouv</span>
              <span class="rl-pill" :class="{ 'rl-pill--badge': isBadge }" :style="{ '--rc': draft.color }"><i />{{ draft.name || 'Роль' }}</span>
            </div>
          </div>

          <div v-if="!readOnly" class="rl-danger">
            <div>
              <b>{{ isBadge ? 'Удалить значок' : 'Удалить роль' }}</b>
              <small>{{ isBadge ? 'Значок пропадёт у всех, у кого он есть.' : 'Права этой роли пропадут у всех участников.' }}</small>
            </div>
            <button class="adm-btn adm-btn--danger adm-btn--sm" @click="remove">Удалить</button>
          </div>
        </div>

        <!-- Права -->
        <div v-else-if="tab === 'perms' && !isBadge" class="rl-pane">
          <div class="rl-perms-bar">
            <input v-model="permQuery" class="adm-input rl-search" placeholder="Поиск прав…" />
            <span v-if="draft.servers !== null" class="rl-note">Роль отдельных серверов: права «платформы» в неё не входят.</span>
          </div>
          <div class="rl-groups">
            <section v-for="g in shownGroups" :key="g.group" class="rl-group">
              <div class="adm-label rl-group__title">{{ g.group }}</div>
              <button
                v-for="p in g.permissions" :key="p.key" type="button" class="rl-perm"
                :class="{ 'rl-perm--on': hasPerm(p.key), 'rl-perm--off': !canGive(p.key) }"
                :disabled="readOnly || !canGive(p.key)"
                :title="!canGive(p.key) ? (draft.servers !== null && p.scope !== 'server' ? 'Право платформы — только для роли на всех серверах' : 'У тебя нет этого права — выдать его нельзя') : ''"
                @click="togglePerm(p.key)"
              >
                <span class="rl-perm__label">
                  {{ p.label }}
                  <span v-if="p.scope !== 'server'" class="rl-perm__tag">платформа</span>
                  <span v-if="p.sensitive" class="rl-perm__warn" title="Чувствительное право">•</span>
                </span>
                <span class="rl-switch" :class="{ 'rl-switch--on': hasPerm(p.key) }"><i /></span>
              </button>
            </section>
            <div v-if="!shownGroups.length" class="rl-note">Ничего не нашлось.</div>
          </div>
        </div>

        <!-- Участники -->
        <div v-else class="rl-pane">
          <form v-if="selected.assignable" class="rl-add" @submit.prevent="addMember">
            <input v-model="memberName" class="adm-input" placeholder="Ник на сайте" autocomplete="off" />
            <button class="adm-btn adm-btn--acc" :disabled="memberBusy || !memberName.trim()">{{ isBadge ? 'Выдать значок' : 'Выдать роль' }}</button>
          </form>
          <div v-if="!selected.members.length" class="rl-note rl-note--pad">{{ isBadge ? 'Значок пока ни у кого нет.' : 'Роль пока никому не выдана.' }}</div>
          <ul v-else class="rl-members">
            <li v-for="m in selected.members" :key="m.id" class="rl-member">
              <span class="adm-avatar rl-member__ava">{{ m.site_login.charAt(0).toUpperCase() }}</span>
              <span class="rl-member__name">{{ m.site_login }}</span>
              <button v-if="selected.assignable" class="rl-member__drop" title="Снять роль" @click="dropMember(m)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 6l12 12M18 6L6 18"/></svg>
              </button>
            </li>
          </ul>
        </div>

        <!-- Панель несохранённых изменений, как в Discord -->
        <transition name="rl-bar">
          <div v-if="dirty && !readOnly" class="rl-savebar">
            <span>Есть несохранённые изменения</span>
            <div>
              <button class="adm-btn adm-btn--ghost adm-btn--sm" :disabled="saving" @click="reset">Сбросить</button>
              <button class="adm-btn adm-btn--ok adm-btn--sm" :disabled="saving" @click="save">{{ saving ? 'Сохраняем…' : 'Сохранить' }}</button>
            </div>
          </div>
        </transition>
      </section>
    </div>
  </div>
</template>

<style scoped>
.rl-layout { display: grid; grid-template-columns: minmax(250px, 300px) 1fr; gap: 1rem; align-items: start; }
@media (max-width: 900px) { .rl-layout { grid-template-columns: 1fr; } }

/* список */
.rl-list { padding: 0.8rem 0.55rem 0.7rem; position: sticky; top: 1rem; }
.rl-list__head { padding: 0.1rem 0.55rem 0.55rem; }
.rl-list ul { display: flex; flex-direction: column; gap: 2px; }
.rl-item {
  display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.55rem 0.5rem 0.3rem;
  border-radius: 9px; cursor: pointer; position: relative; user-select: none;
  transition: background-color 0.12s;
}
.rl-item:hover { background: rgba(148, 163, 184, 0.06); }
.rl-item--on { background: color-mix(in srgb, var(--rc) 14%, transparent); }
.rl-item--on::before { content: ''; position: absolute; left: 0; top: 22%; bottom: 22%; width: 3px; border-radius: 3px; background: var(--rc); }
.rl-item--over { box-shadow: inset 0 2px 0 var(--rc); }
.rl-item--dragging { opacity: 0.45; }
.rl-item__grip { width: 0.6rem; color: var(--adm-faint); flex-shrink: 0; cursor: grab; display: flex; }
.rl-item__grip svg { width: 100%; }
.rl-item__grip--off { visibility: hidden; }
.rl-item__dot { width: 0.7rem; height: 0.7rem; border-radius: 50%; background: var(--rc); flex-shrink: 0; box-shadow: 0 0 0 3px color-mix(in srgb, var(--rc) 22%, transparent); }
.rl-item__main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.rl-item__name { font-size: 0.84rem; font-weight: 700; color: var(--adm-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rl-item__meta { font-size: 0.68rem; color: var(--adm-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rl-item__count { font-size: 0.7rem; color: var(--adm-mut); background: rgba(148, 163, 184, 0.08); border-radius: 999px; padding: 0.05rem 0.45rem; }
.rl-item__lock { width: 0.8rem; height: 0.8rem; color: var(--adm-dim); flex-shrink: 0; }
.rl-list__empty { margin: 0 0.55rem 0.3rem; font-size: 0.74rem; color: var(--adm-dim); }
.rl-list__head--badges { margin-top: 0.8rem; padding-top: 0.75rem; border-top: 1px solid var(--adm-line); }
.rl-item__tag { width: 0.7rem; text-align: center; font-weight: 800; color: var(--rc); flex-shrink: 0; }
.rl-pill--badge { border-style: dashed; background: transparent; }
.rl-pill--badge i { display: none; }
.rl-badgenote { padding: 0.65rem 0.85rem; border-radius: 10px; font-size: 0.78rem; line-height: 1.5; color: var(--adm-mut); background: color-mix(in srgb, var(--rc) 9%, transparent); border: 1px dashed color-mix(in srgb, var(--rc) 45%, transparent); }
.rl-list__hint { margin: 0.75rem 0.55rem 0; font-size: 0.7rem; line-height: 1.45; color: var(--adm-dim); }

/* редактор */
.rl-editor { padding: 0; overflow: hidden; position: relative; }
.rl-editor__head {
  display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;
  padding: 1rem 1.2rem; border-bottom: 1px solid var(--adm-line);
  background: linear-gradient(90deg, color-mix(in srgb, var(--rc) 12%, transparent), transparent 60%);
}
.rl-editor__title { display: flex; align-items: center; gap: 0.75rem; min-width: 0; }
.rl-editor__swatch { width: 2.2rem; height: 2.2rem; border-radius: 11px; background: var(--rc); flex-shrink: 0; box-shadow: 0 6px 18px -6px var(--rc); }
.rl-editor__name { font-size: 1.05rem; font-weight: 800; color: var(--rc); line-height: 1.2; overflow-wrap: anywhere; }
.rl-editor__sub { font-size: 0.72rem; color: var(--adm-dim); margin-top: 0.15rem; }
.rl-lockbar {
  display: flex; align-items: center; gap: 0.5rem; margin: 0.9rem 1.2rem 0; padding: 0.55rem 0.8rem;
  border-radius: 9px; font-size: 0.76rem; color: var(--adm-mut); background: rgba(148, 163, 184, 0.06);
}
.rl-lockbar svg { width: 0.9rem; height: 0.9rem; flex-shrink: 0; }
.rl-pane { padding: 1.1rem 1.2rem 5rem; }
.rl-main { display: flex; flex-direction: column; gap: 1.2rem; max-width: 640px; }

.rl-colors { display: flex; flex-wrap: wrap; gap: 0.45rem; margin-top: 0.35rem; }
.rl-color {
  width: 2rem; height: 2rem; border-radius: 8px; border: 2px solid transparent; cursor: pointer;
  transition: transform 0.1s; position: relative;
}
.rl-color:hover:not(:disabled) { transform: translateY(-1px); }
.rl-color--on { border-color: var(--adm-text); box-shadow: 0 0 0 2px var(--adm-card) inset; }
.rl-color--custom { display: flex; align-items: center; justify-content: center; background: rgba(148, 163, 184, 0.08); color: var(--adm-mut); overflow: hidden; }
.rl-color--custom svg { width: 0.9rem; height: 0.9rem; pointer-events: none; }
.rl-color--custom input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }

.rl-scope { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 0.5rem; margin-top: 0.35rem; }
.rl-scope__opt {
  display: flex; flex-direction: column; gap: 0.15rem; text-align: left; padding: 0.7rem 0.85rem;
  border-radius: 10px; border: 1px solid var(--adm-line-strong); background: transparent; cursor: pointer; color: var(--adm-mut);
}
.rl-scope__opt b { font-size: 0.82rem; color: var(--adm-text); }
.rl-scope__opt small { font-size: 0.7rem; color: var(--adm-dim); }
.rl-scope__opt--on { border-color: var(--rc); background: color-mix(in srgb, var(--rc) 10%, transparent); }
.rl-scope__opt:disabled { cursor: not-allowed; opacity: 0.5; }
.rl-servers { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.6rem; }
.rl-server {
  font-size: 0.74rem; font-weight: 600; padding: 0.3rem 0.7rem; border-radius: 999px; cursor: pointer;
  border: 1px solid var(--adm-line-strong); background: transparent; color: var(--adm-mut);
}
.rl-server--on { background: color-mix(in srgb, var(--rc) 18%, transparent); border-color: var(--rc); color: var(--adm-text); }
.rl-server:disabled { opacity: 0.4; cursor: not-allowed; }

.rl-pill {
  display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.15rem 0.55rem 0.15rem 0.45rem;
  border-radius: 999px; font-size: 0.72rem; font-weight: 700; color: var(--adm-text);
  background: color-mix(in srgb, var(--rc) 16%, transparent); border: 1px solid color-mix(in srgb, var(--rc) 45%, transparent);
}
.rl-pill i { width: 0.5rem; height: 0.5rem; border-radius: 50%; background: var(--rc); }
.rl-preview { padding: 0.9rem 1rem; border-radius: 11px; background: var(--adm-bg-soft); border: 1px solid var(--adm-line); }
.rl-preview__row { display: flex; align-items: center; gap: 0.55rem; flex-wrap: wrap; }
.rl-preview__ava { width: 1.9rem; height: 1.9rem; font-size: 0.75rem; }
.rl-preview__nick { font-weight: 800; color: var(--rc); }

.rl-danger {
  display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.8rem 1rem;
  border-radius: 11px; border: 1px solid rgba(248, 113, 113, 0.25);
}
.rl-danger b { display: block; font-size: 0.82rem; color: var(--adm-text); }
.rl-danger small { font-size: 0.72rem; color: var(--adm-dim); }

.rl-perms-bar { display: flex; align-items: center; gap: 0.8rem; flex-wrap: wrap; margin-bottom: 1rem; }
.rl-search { max-width: 280px; }
.rl-note { font-size: 0.74rem; color: var(--adm-dim); }
.rl-note--pad { padding: 0.5rem 0; }
.rl-groups { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.1rem 1.6rem; }
.rl-group__title { margin-bottom: 0.3rem; }
.rl-perm {
  display: flex; align-items: center; justify-content: space-between; gap: 0.8rem; width: 100%;
  padding: 0.45rem 0.5rem; border-radius: 8px; border: none; background: transparent; cursor: pointer; text-align: left;
  font-size: 0.8rem; font-weight: 600; color: var(--adm-mut); transition: background-color 0.12s;
}
.rl-perm:hover:not(:disabled) { background: rgba(148, 163, 184, 0.055); }
.rl-perm--on { color: var(--adm-text); }
.rl-perm--off { opacity: 0.42; cursor: not-allowed; }
.rl-perm:disabled { cursor: default; }
.rl-perm__label { line-height: 1.35; min-width: 0; }
.rl-perm__tag { display: inline-block; margin-left: 0.3rem; padding: 0 0.35rem; font-size: 0.62rem; border-radius: 999px; border: 1px solid var(--adm-line-strong); color: var(--adm-dim); }
.rl-perm__warn { color: var(--adm-warn); margin-left: 0.2rem; }
.rl-switch { width: 2.1rem; height: 1.2rem; border-radius: 999px; background: rgba(148, 163, 184, 0.22); position: relative; flex-shrink: 0; transition: background-color 0.15s; }
.rl-switch i { position: absolute; top: 0.15rem; left: 0.15rem; width: 0.9rem; height: 0.9rem; border-radius: 50%; background: #fff; transition: transform 0.15s; }
.rl-switch--on { background: var(--rc); }
.rl-switch--on i { transform: translateX(0.9rem); }

.rl-add { display: flex; gap: 0.5rem; max-width: 420px; margin-bottom: 1rem; }
.rl-members { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0.4rem; }
.rl-member { display: flex; align-items: center; gap: 0.55rem; padding: 0.45rem 0.55rem; border-radius: 9px; background: var(--adm-bg-soft); border: 1px solid var(--adm-line); }
.rl-member__ava { width: 1.7rem; height: 1.7rem; font-size: 0.7rem; }
.rl-member__name { flex: 1; font-weight: 700; color: var(--adm-text); font-size: 0.82rem; overflow: hidden; text-overflow: ellipsis; }
.rl-member__drop { display: flex; padding: 0.25rem; border-radius: 6px; border: none; background: transparent; color: var(--adm-dim); cursor: pointer; }
.rl-member__drop:hover { color: var(--adm-err); background: rgba(248, 113, 113, 0.1); }
.rl-member__drop svg { width: 0.8rem; height: 0.8rem; }

.rl-savebar {
  position: absolute; left: 1rem; right: 1rem; bottom: 1rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem;
  padding: 0.6rem 0.7rem 0.6rem 1rem; border-radius: 11px; background: #05070d; border: 1px solid var(--adm-line-strong);
  box-shadow: 0 12px 30px -10px rgba(0, 0, 0, 0.7); font-size: 0.8rem; font-weight: 700; color: var(--adm-text);
}
.rl-savebar > div { display: flex; gap: 0.4rem; }
.rl-bar-enter-active, .rl-bar-leave-active { transition: transform 0.18s, opacity 0.18s; }
.rl-bar-enter-from, .rl-bar-leave-to { transform: translateY(0.6rem); opacity: 0; }

.rl-empty { padding: 2.2rem 1.5rem; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 0.6rem; }
.rl-empty__badges { display: flex; gap: 0.4rem; margin-bottom: 0.4rem; }
.rl-empty .adm-empty__sub { max-width: 520px; line-height: 1.55; }
.rl-empty__actions { display: flex; gap: 0.5rem; flex-wrap: wrap; justify-content: center; margin-top: 0.6rem; }
</style>
