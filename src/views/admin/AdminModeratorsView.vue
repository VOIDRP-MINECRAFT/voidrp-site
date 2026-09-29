<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { authState } from '../../stores/authStore'
import { serverState, fetchServers } from '../../stores/serverStore'
import { confirmDialog } from '../../composables/useConfirm'
import { toastSuccess, toastError } from '../../services/toast'
import {
  getPermissionCatalog,
  listModerators,
  assignModerator,
  updateModerator,
  revokeModerator,
  appointAdmin,
  setAdminServers,
  removeAdmin,
} from '../../services/adminModeratorsApi'

const token = () => authState.accessToken
// Who the viewer is, as the API sees it (from the staff list): owner, platform admin,
// admin of some servers, or someone who may only hand out roles.
const me = ref(null)
const isOwner = computed(() => !!me.value?.owner)
const isPlatform = computed(() => !!me.value?.platform_admin)
const canPersonal = computed(() => isPlatform.value || (me.value?.admin_servers || []).length > 0)
const ROLE = {
  owner: { label: 'Владелец', cls: 'adm-badge--acc' },
  admin: { label: 'Админ платформы', cls: 'adm-badge--warn' },
  server_admin: { label: 'Админ сервера', cls: 'adm-badge--info' },
  moderator: { label: 'Сотрудник', cls: '' },
}
const fmtDate = (v) => (v ? new Date(v).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '')

// ── Назначение админа: всей платформы (только владелец) или отдельных серверов ──
// adminDlg: null | { user: row|null, name, scope: 'platform'|'servers', servers: Set }
const adminDlg = ref(null)
const adminBusy = ref(false)
function openAdmin(row = null) {
  adminDlg.value = {
    user: row,
    name: row?.site_login || '',
    scope: 'servers',
    servers: new Set(row?.admin_servers || []),
  }
}
function toggleAdminServer(slug) {
  const set = new Set(adminDlg.value.servers)
  if (set.has(slug)) set.delete(slug); else set.add(slug)
  adminDlg.value = { ...adminDlg.value, servers: set }
}
async function submitAdmin() {
  const d = adminDlg.value
  const name = d.name.trim()
  if (!name) { toastError('Укажите ник пользователя'); return }
  const slugs = servers.value.map((x) => x.slug).filter((x) => d.servers.has(x))
  if (d.scope === 'servers' && !slugs.length && !d.user?.admin_servers?.length) { toastError('Отметьте хотя бы один сервер'); return }
  const names = slugs.map((x) => servers.value.find((v) => v.slug === x)?.name || x).join(', ')
  const ok = await confirmDialog(d.scope === 'platform'
    ? { title: `Сделать «${name}» админом платформы?`, message: 'Все права на всех серверах, сайте и в лаунчере, управление сотрудниками и ролями. Снять его сможешь только ты.', confirmLabel: 'Сделать админом', danger: true }
    : slugs.length
      ? { title: `Админ серверов: ${names}`, message: `«${name}» получит все права этих серверов и сможет управлять их сотрудниками и ролями. Другие серверы и платформа ему недоступны.`, confirmLabel: 'Назначить', danger: true }
      : { title: `Снять «${name}» с админов серверов?`, message: 'Права админа серверов пропадут; роли и личные права останутся.', confirmLabel: 'Снять', danger: true })
  if (!ok) return
  adminBusy.value = true
  try {
    if (d.scope === 'platform') await appointAdmin(token(), name, null)
    else if (d.user?.admin_servers?.length || (d.user && d.user.role !== 'moderator')) await setAdminServers(token(), d.user.id, slugs)
    else await appointAdmin(token(), name, slugs)
    toastSuccess(d.scope === 'platform' ? `${name} теперь админ платформы` : (slugs.length ? `${name} — админ: ${names}` : `${name} больше не админ серверов`))
    adminDlg.value = null
    await load()
  } catch (e) {
    toastError(e?.message || 'Не удалось назначить')
  } finally {
    adminBusy.value = false
  }
}

async function demote(m) {
  const platform = m.role === 'admin'
  const ok = await confirmDialog({
    title: platform ? `Снять админа платформы «${m.site_login}»?` : `Снять «${m.site_login}» с админов серверов?`,
    message: platform
      ? 'Он сразу потеряет доступ к админ-панели. Если нужно оставить часть разделов — выдай ему роль.'
      : 'Права админа серверов пропадут; роли и личные права останутся.',
    confirmLabel: 'Снять',
    danger: true,
  })
  if (!ok) return
  try {
    await removeAdmin(token(), m.id)
    toastSuccess('Админ снят')
    await load()
  } catch (e) {
    toastError(e?.message || 'Не удалось снять')
  }
}

const catalog = ref([])
const preset = ref([])
const moderators = ref([])
const loading = ref(true)
const saving = ref(false)

// Editor state: null | 'new' | moderator-id
const editing = ref(null)
// permissions — on every server (and platform-wide keys); byServer — { slug: Set } for
// per-server keys given on some servers only.
const form = ref({ username: '', permissions: new Set(), byServer: {} })
const servers = computed(() =>
  [...serverState.list].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)))
// Personal grants the viewer may touch: all of them (platform admin), or only the
// per-server ones on the servers they run (admin of servers).
const editingRow = computed(() => moderators.value.find((x) => x.id === editing.value) || null)
const scopeSlugs = computed(() => {
  if (isPlatform.value) return null
  return editing.value === 'new' ? (me.value?.admin_servers || []) : (editingRow.value?.personal_scope || [])
})
const limited = computed(() => scopeSlugs.value !== null)
// Servers the person runs as admin: every per-server key there comes from that already.
const viaAdmin = computed(() => new Set(editingRow.value?.admin_servers || []))
const serverKeys = computed(() => new Set(catalog.value.flatMap((g) => g.permissions).filter((p) => p.scope === 'server').map((p) => p.key)))
// Выпадающий список серверов у права: какой открыт; закрывается кликом мимо и Esc.
const openKey = ref(null)
function closePick(e) { if (e.type === 'click' || e.key === 'Escape') openKey.value = null }
onMounted(() => { document.addEventListener('click', closePick); document.addEventListener('keydown', closePick) })
onBeforeUnmount(() => { document.removeEventListener('click', closePick); document.removeEventListener('keydown', closePick) })
function onServers(key) {
  if (has(key)) return servers.value
  return editorServersAll.value.filter((x) => hasOn(x.slug, key) || viaAdmin.value.has(x.slug))
}
function isGiven(key, scope) {
  return scope === 'server' ? onServers(key).length > 0 : has(key)
}
const shortName = (name) => name.replace(/^VoidRP:\s*/, '')
function pickLabel(key) {
  if (has(key)) return 'Все серверы'
  const list = onServers(key)
  if (!list.length) return 'Не выдано'
  if (list.length === 1) return shortName(list[0].name)
  const n = list.length
  return `${n} ${n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'сервера' : 'серверов'}`
}
const adminNames = computed(() => servers.value.filter((x) => viaAdmin.value.has(x.slug)).map((x) => x.name).join(', '))
const editorServersAll = computed(() => servers.value)
const editorServers = computed(() => limited.value ? servers.value.filter((x) => scopeSlugs.value.includes(x.slug)) : servers.value)
const editorCatalog = computed(() => limited.value
  ? catalog.value.map((g) => ({ ...g, permissions: g.permissions.filter((p) => p.scope === 'server') })).filter((g) => g.permissions.length)
  : catalog.value)

const editingName = computed(() => {
  if (editing.value === 'new') return 'Новый модератор'
  const m = moderators.value.find((x) => x.id === editing.value)
  return m ? m.site_login : ''
})

// Granted on every server or on at least one — what "выдано" counts.
const selectedCount = computed(() =>
  catalog.value.reduce((n, g) => n + (g.permissions || []).filter((p) => grantedAnywhere(p.key)).length, 0))
const totalCount = computed(() =>
  catalog.value.reduce((n, g) => n + (g.permissions?.length || 0), 0),
)

function grantedAnywhere(key) {
  if (viaAdmin.value.size && serverKeys.value.has(key)) return true
  return form.value.permissions.has(key) || Object.values(form.value.byServer).some((set) => set.has(key))
}

function groupSelected(group) {
  return (group.permissions || []).filter((p) => grantedAnywhere(p.key)).length
}

function hasOn(slug, key) {
  return !!form.value.byServer[slug]?.has(key)
}

function toggleOn(slug, key) {
  const byServer = { ...form.value.byServer }
  const set = new Set(byServer[slug] || [])
  if (set.has(key)) set.delete(key)
  else set.add(key)
  byServer[slug] = set
  form.value = { ...form.value, byServer }
}

function serverPayload() {
  const out = {}
  for (const [slug, set] of Object.entries(form.value.byServer)) {
    if (viaAdmin.value.has(slug)) continue
    const keys = [...set].filter((k) => !form.value.permissions.has(k))
    if (keys.length) out[slug] = keys
  }
  return out
}

// Where a moderator's per-server grants are, for the list: "Origins: 3".
function serverSummary(m) {
  const names = Object.fromEntries(servers.value.map((x) => [x.slug, x.name]))
  return Object.entries(m.server_permissions || {}).map(([slug, keys]) => `${names[slug] || slug}: ${keys.length}`)
}

async function load() {
  loading.value = true
  try {
    const [cat, mods] = await Promise.all([getPermissionCatalog(token()), listModerators(token()), fetchServers()])
    catalog.value = cat.catalog || []
    preset.value = cat.preset || []
    moderators.value = mods.items || []
    me.value = mods.me || null
  } catch (e) {
    toastError(e?.message || 'Не удалось загрузить')
  } finally {
    loading.value = false
  }
}

function startNew() {
  editing.value = 'new'
  form.value = { username: '', permissions: new Set(limited.value ? [] : preset.value), byServer: {} }
}

function startEdit(m) {
  editing.value = m.id
  const byServer = {}
  for (const [slug, keys] of Object.entries(m.server_permissions || {})) byServer[slug] = new Set(keys)
  form.value = { username: m.site_login, permissions: new Set(m.permissions || []), byServer }
}

function cancel() {
  editing.value = null
}

function toggle(key) {
  const s = form.value.permissions
  if (s.has(key)) s.delete(key)
  else s.add(key)
  // reassign to trigger reactivity on Set
  form.value = { ...form.value, permissions: new Set(s) }
}

function has(key) {
  return form.value.permissions.has(key)
}

function toggleGroup(group) {
  const keys = (group.permissions || []).map((p) => p.key)
  const s = new Set(form.value.permissions)
  const allOn = keys.every((k) => s.has(k))
  keys.forEach((k) => (allOn ? s.delete(k) : s.add(k)))
  form.value = { ...form.value, permissions: s }
}

function applyPreset() {
  form.value = { ...form.value, permissions: new Set(preset.value) }
}
function clearAll() {
  form.value = { ...form.value, permissions: new Set(), byServer: {} }
}

async function save() {
  const perms = [...form.value.permissions]
  saving.value = true
  try {
    if (editing.value === 'new') {
      if (!form.value.username.trim()) { toastError('Укажите ник пользователя'); saving.value = false; return }
      await assignModerator(token(), form.value.username.trim(), perms, serverPayload())
      toastSuccess('Сотрудник добавлен')
    } else {
      await updateModerator(token(), editing.value, perms, serverPayload())
      toastSuccess('Права обновлены')
    }
    cancel()
    await load()
  } catch (e) {
    toastError(e?.message || 'Не удалось сохранить')
  } finally {
    saving.value = false
  }
}

async function revoke(m) {
  const ok = await confirmDialog({
    title: isPlatform.value ? 'Убрать из сотрудников?' : 'Снять с твоих серверов?',
    message: isPlatform.value
      ? `«${m.site_login}» потеряет доступ к админ-панели: личные права, роли и админство серверов.`
      : `У «${m.site_login}» пропадут личные права и роли на твоих серверах. Остальное останется.`,
    confirmLabel: 'Снять',
    danger: true,
  })
  if (!ok) return
  try {
    await revokeModerator(token(), m.id)
    toastSuccess(isPlatform.value ? 'Убран из сотрудников' : 'Права на твоих серверах сняты')
    await load()
  } catch (e) {
    toastError(e?.message || 'Не удалось снять')
  }
}

onMounted(load)
</script>

<template>
  <div class="adm-page">
    <div class="adm-page__head">
      <div>
        <h1 class="adm-title">Сотрудники</h1>
        <p class="adm-sub">Кто работает в панели и что может: админы, роли и личные права — по серверам</p>
      </div>
      <div class="md-head-actions">
        <RouterLink to="/admin/roles" class="adm-btn">Роли</RouterLink>
        <button v-if="isPlatform" class="adm-btn" :disabled="adminDlg !== null" @click="openAdmin()">Назначить админа</button>
        <button v-if="canPersonal" class="adm-btn adm-btn--acc" :disabled="editing === 'new'" @click="startNew">
          Новый сотрудник
        </button>
      </div>
    </div>

    <div v-if="me && !isPlatform" class="md-scopebar">
      <template v-if="me.admin_servers.length">
        Ты админ серверов: <b>{{ me.admin_servers.map((x) => servers.find((v) => v.slug === x)?.name || x).join(', ') }}</b>.
        Можешь выдавать права и роли только там.
      </template>
      <template v-else>Ты можешь выдавать роли ниже своей — на странице «Роли».</template>
    </div>

    <!-- Назначение админа -->
    <div v-if="adminDlg" class="adm-modal-backdrop" @click.self="adminDlg = null">
      <div class="adm-modal md-admin">
        <div class="md-admin__title">{{ adminDlg.user ? `Админство: ${adminDlg.user.site_login}` : 'Назначить админа' }}</div>
        <label v-if="!adminDlg.user" class="adm-field">
          <span>Ник пользователя</span>
          <input v-model="adminDlg.name" class="adm-input" placeholder="ник на сайте" autocomplete="off" />
        </label>
        <div class="md-admin__opts">
          <button type="button" class="md-admin__opt" :class="{ 'md-admin__opt--on': adminDlg.scope === 'servers' }" @click="adminDlg.scope = 'servers'">
            <b>Админ серверов</b>
            <small>Все права выбранных серверов, их сотрудники и роли</small>
          </button>
          <button type="button" class="md-admin__opt" :class="{ 'md-admin__opt--on': adminDlg.scope === 'platform' }" :disabled="!isOwner" :title="isOwner ? '' : 'Админа платформы назначает только владелец'" @click="adminDlg.scope = 'platform'">
            <b>Админ платформы</b>
            <small>{{ isOwner ? 'Всё: все серверы, сайт, лаунчер, аккаунты' : 'Назначает только владелец' }}</small>
          </button>
        </div>
        <div v-if="adminDlg.scope === 'servers'" class="md-admin__servers">
          <button
            v-for="srv in servers" :key="srv.slug" type="button" class="md-srvcard"
            :class="{ 'md-srvcard--on': adminDlg.servers.has(srv.slug) }"
            @click="toggleAdminServer(srv.slug)"
          >
            <span class="md-srvcard__icon md-srvcard__icon--none" :style="srv.accent_color ? { background: srv.accent_color + '2e', color: srv.accent_color } : null">
              <img v-if="srv.icon_url" :src="srv.icon_url" alt="" @error="$event.target.remove()" />
              {{ srv.name.replace(/^VoidRP:\s*/, '').charAt(0) }}
            </span>
            <span class="md-srvcard__name">{{ srv.name }}</span>
            <span class="md-srvcard__check" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
            </span>
          </button>
        </div>
        <div class="md-editor__actions">
          <button class="adm-btn" :disabled="adminBusy" @click="adminDlg = null">Отмена</button>
          <button class="adm-btn adm-btn--danger" :disabled="adminBusy" @click="submitAdmin">
            {{ adminDlg.scope === 'platform' ? 'Сделать админом платформы' : (adminDlg.servers.size ? 'Сохранить' : 'Снять с админов серверов') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Editor -->
    <div v-if="editing" class="adm-card md-editor">
      <div class="md-editor__bar">
        <div class="md-editor__who">
          <span class="adm-avatar">{{ (editingName || '?').charAt(0).toUpperCase() }}</span>
          <div>
            <div class="md-editor__name">{{ editingName }}</div>
            <div class="md-editor__count">
              выдано <b class="adm-num">{{ selectedCount }}</b> из <span class="adm-num">{{ totalCount }}</span>
            </div>
          </div>
        </div>
        <div class="md-editor__presets">
          <button v-if="!limited" type="button" class="adm-btn adm-btn--sm" @click="applyPreset">Стандартный набор</button>
          <button type="button" class="adm-btn adm-btn--sm" @click="clearAll">Снять все</button>
        </div>
      </div>

      <label v-if="editing === 'new'" class="adm-field md-username">
        <span>Ник пользователя</span>
        <input v-model="form.username" class="adm-input" placeholder="например, mironoouv" autocomplete="off" />
      </label>

      <div v-if="viaAdmin.size" class="md-adminnote">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>
        <span>Админ серверов <b>{{ adminNames }}</b>: все права этих серверов включены автоматически (с замком). Ниже можно добавить права на других серверах и права платформы.</span>
      </div>
      <p v-if="limited" class="md-scope-hint">
        Ты правишь только свои серверы: выбери их в списке справа у каждого права. Права на других серверах
        и права платформы у этого человека не меняются.
      </p>
      <p v-else class="md-scope-hint">
        Права серверов выдаются кнопкой справа: отметь нужные серверы или «Все серверы».
        Права с пометкой «платформа» касаются сайта, лаунчера и аккаунтов целиком — их ставит галочка слева.
      </p>

      <div class="md-groups">
        <section v-for="g in editorCatalog" :key="g.group" class="md-group">
          <button type="button" class="md-group__head" :disabled="limited" @click="toggleGroup(g)">
            <span class="adm-label md-group__title">{{ g.group }}</span>
            <span class="md-group__count adm-num">{{ groupSelected(g) }}/{{ g.permissions.length }}</span>
          </button>
          <div v-for="p in g.permissions" :key="p.key" class="md-perm" :class="{ 'md-perm--on': isGiven(p.key, p.scope) }">
            <input v-if="p.scope !== 'server'" type="checkbox" :checked="has(p.key)" :disabled="limited" @change="toggle(p.key)" />
            <span v-else class="md-perm__dot" :class="{ 'md-perm__dot--on': isGiven(p.key, p.scope) }" />
            <span class="md-perm__label">
              {{ p.label }}
              <span v-if="p.scope !== 'server'" class="md-perm__scope md-perm__scope--platform" title="Касается всей платформы (сайт, лаунчер, аккаунты) — на отдельный сервер не выдаётся">платформа</span>
              <span v-if="p.sensitive" class="md-perm__tag" title="Чувствительное право">•</span>
            </span>
            <div v-if="p.scope === 'server'" class="md-pick" @click.stop>
              <button
                type="button" class="md-pick__btn"
                :class="{ 'md-pick__btn--on': onServers(p.key).length, 'md-pick__btn--all': has(p.key), 'md-pick__btn--open': openKey === p.key }"
                @click="openKey = openKey === p.key ? null : p.key"
              >
                <svg v-if="onServers(p.key).length && onServers(p.key).every((x) => viaAdmin.has(x.slug)) && !has(p.key)" class="md-pick__lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>
                <span>{{ pickLabel(p.key) }}</span>
                <svg class="md-pick__chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M6 9l6 6 6-6"/></svg>
              </button>
              <div v-if="onServers(p.key).length > 1 && openKey !== p.key" class="md-pick__tip">
                <div v-for="x in onServers(p.key)" :key="x.slug">{{ x.name }}<span v-if="viaAdmin.has(x.slug) && !has(p.key)"> — админство</span></div>
              </div>
              <div v-if="openKey === p.key" class="md-pick__menu">
                <label v-if="!limited" class="md-pick__opt md-pick__opt--all">
                  <input type="checkbox" :checked="has(p.key)" @change="toggle(p.key)" />
                  <span><b>Все серверы</b><small>и те, что появятся потом</small></span>
                </label>
                <label
                  v-for="srv in editorServers" :key="srv.slug" class="md-pick__opt"
                  :class="{ 'md-pick__opt--locked': has(p.key) || viaAdmin.has(srv.slug) }"
                >
                  <input
                    type="checkbox"
                    :checked="has(p.key) || hasOn(srv.slug, p.key) || viaAdmin.has(srv.slug)"
                    :disabled="has(p.key) || viaAdmin.has(srv.slug)"
                    @change="toggleOn(srv.slug, p.key)"
                  />
                  <span>
                    {{ srv.name }}
                    <small v-if="viaAdmin.has(srv.slug)">через админство</small>
                    <small v-else-if="has(p.key)">входит во «все серверы»</small>
                  </span>
                </label>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div class="md-editor__actions">
        <button class="adm-btn" :disabled="saving" @click="cancel">Отмена</button>
        <button class="adm-btn adm-btn--acc" :disabled="saving" @click="save">
          {{ saving ? 'Сохраняем…' : (editing === 'new' ? 'Назначить' : 'Сохранить') }}
        </button>
      </div>
    </div>

    <!-- List -->
    <div v-if="loading" class="md-skels">
      <div v-for="n in 3" :key="n" class="adm-skel md-skel" />
    </div>

    <div v-else-if="!moderators.length" class="adm-empty">
      <div class="adm-empty__title">Сотрудников пока нет</div>
      <div class="adm-empty__sub">Назначь первого — он получит доступ только к тем разделам, которые ты отметишь.</div>
    </div>

    <div v-else class="adm-table-wrap">
      <div class="adm-table-scroll">
        <table class="adm-table">
          <thead>
            <tr><th>Сотрудник</th><th>Должность и роли</th><th>Личные права</th><th /></tr>
          </thead>
          <tbody>
            <tr v-for="m in moderators" :key="m.id">
              <td>
                <div class="md-row__who">
                  <span class="adm-avatar md-row__ava" :style="m.roles[0] ? { background: m.roles[0].color + '26', color: m.roles[0].color } : null">{{ m.site_login.charAt(0).toUpperCase() }}</span>
                  <div class="md-row__ident">
                    <div class="md-row__login" :style="m.roles[0] ? { color: m.roles[0].color } : null">{{ m.site_login }}</div>
                    <div class="md-row__email adm-mono">{{ m.email }}</div>
                  </div>
                </div>
              </td>
              <td>
                <div class="md-row__tags">
                  <span class="adm-badge" :class="ROLE[m.role]?.cls">{{ ROLE[m.role]?.label || m.role }}</span>
                  <span v-for="slug in m.admin_servers" :key="slug" class="md-srvtag">{{ servers.find((v) => v.slug === slug)?.name || slug }}</span>
                  <span v-for="r in m.roles" :key="r.id" class="md-rolepill" :style="{ '--rc': r.color }"><i />{{ r.name }}</span>
                </div>
                <div v-if="m.staff_since" class="md-row__since">
                  с {{ fmtDate(m.staff_since) }}<template v-if="m.granted_by"> · назначил {{ m.granted_by }}</template>
                </div>
              </td>
              <td>
                <span v-if="m.role === 'owner' || m.role === 'admin'" class="md-row__all">все права</span>
                <template v-else>
                  <span v-if="m.permissions.length || serverSummary(m).length" class="adm-badge" :class="m.permissions.length ? 'adm-badge--acc' : ''">
                    <b class="adm-num">{{ m.permissions.length }}</b>&nbsp;на всех
                  </span>
                  <span v-else class="md-row__none">{{ m.role === 'server_admin' ? 'все права своих серверов' : (m.roles.length ? 'только роли' : 'нет') }}</span>
                  <div v-for="line in serverSummary(m)" :key="line" class="md-row__since">+ {{ line }}</div>
                </template>
              </td>
              <td>
                <div v-if="m.editable" class="md-row__actions">
                  <template v-if="m.role !== 'admin'">
                    <button v-if="canPersonal" class="adm-btn adm-btn--sm" @click="startEdit(m)">Права</button>
                    <button v-if="isPlatform" class="adm-btn adm-btn--sm" @click="openAdmin(m)">{{ m.role === 'server_admin' ? 'Админство' : 'Сделать админом' }}</button>
                    <button v-if="canPersonal" class="adm-btn adm-btn--sm adm-btn--danger" @click="revoke(m)">Снять</button>
                  </template>
                  <button v-else-if="isOwner" class="adm-btn adm-btn--sm adm-btn--danger" @click="demote(m)">Снять админа</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.md-scope-hint { margin: 0 0 0.9rem; font-size: 0.78rem; color: var(--adm-dim); line-height: 1.5; }
.md-perm__scope { display: inline-block; margin-left: 0.35rem; font-size: 0.66rem; color: var(--adm-faint); }
.md-perm__dot { width: 0.95rem; height: 0.95rem; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
.md-perm__dot::before { content: ''; width: 0.42rem; height: 0.42rem; border-radius: 50%; background: var(--adm-faint); }
.md-perm__dot--on::before { background: var(--adm-acc); box-shadow: 0 0 0 3px var(--adm-acc-soft); }
.md-pick { position: relative; flex-shrink: 0; }
.md-pick__btn {
  display: inline-flex; align-items: center; gap: 0.3rem; max-width: 9.5rem; padding: 0.2rem 0.4rem 0.2rem 0.55rem;
  border-radius: 7px; border: 1px solid var(--adm-line-strong); background: transparent; color: var(--adm-dim);
  font-size: 0.7rem; font-weight: 700; cursor: pointer; white-space: nowrap;
}
.md-pick__btn span { overflow: hidden; text-overflow: ellipsis; }
.md-pick__btn:hover, .md-pick__btn--open { border-color: var(--adm-acc-line); color: var(--adm-mut); }
.md-pick__btn--on { color: var(--adm-text); background: var(--adm-acc-soft); border-color: var(--adm-acc-line); }
.md-pick__btn--all { color: var(--adm-acc-text); }
.md-pick__chev { width: 0.7rem; height: 0.7rem; flex-shrink: 0; opacity: 0.7; }
.md-pick__lock { width: 0.62rem; height: 0.62rem; flex-shrink: 0; opacity: 0.85; }
.md-pick__tip {
  position: absolute; right: 0; bottom: calc(100% + 6px); z-index: 20; min-width: 10rem; padding: 0.45rem 0.6rem;
  border-radius: 8px; background: #05070d; border: 1px solid var(--adm-line-strong); box-shadow: 0 10px 24px -8px rgba(0, 0, 0, 0.7);
  font-size: 0.72rem; font-weight: 600; color: var(--adm-text); line-height: 1.6; white-space: nowrap;
  opacity: 0; transform: translateY(3px); pointer-events: none; transition: opacity 0.12s, transform 0.12s;
}
.md-pick__tip span { color: var(--adm-dim); }
.md-pick:hover .md-pick__tip { opacity: 1; transform: none; }
.md-pick__menu {
  position: absolute; right: 0; top: calc(100% + 6px); z-index: 30; width: 15.5rem; padding: 0.35rem;
  border-radius: 10px; background: var(--adm-card); border: 1px solid var(--adm-line-strong); box-shadow: 0 16px 36px -10px rgba(0, 0, 0, 0.75);
}
.md-pick__opt { display: flex; align-items: center; gap: 0.55rem; padding: 0.45rem 0.5rem; border-radius: 7px; cursor: pointer; font-size: 0.78rem; font-weight: 600; color: var(--adm-mut); }
.md-pick__opt:hover { background: rgba(148, 163, 184, 0.06); color: var(--adm-text); }
.md-pick__opt input { accent-color: var(--adm-acc); width: 0.9rem; height: 0.9rem; flex-shrink: 0; }
.md-pick__opt span { display: flex; flex-direction: column; min-width: 0; }
.md-pick__opt small { font-size: 0.66rem; font-weight: 500; color: var(--adm-dim); }
.md-pick__opt--all { border-bottom: 1px solid var(--adm-line); border-radius: 7px 7px 0 0; margin-bottom: 0.2rem; }
.md-pick__opt--all b { color: var(--adm-text); }
.md-pick__opt--locked { cursor: default; }
.md-perm__scope--platform { padding: 0 0.35rem; border-radius: 999px; border: 1px solid var(--adm-line); }
.md-servers { display: flex; flex-wrap: wrap; gap: 0.3rem; padding: 0 0 0.45rem 1.9rem; }
.md-server {
  font-size: 0.7rem; padding: 0.15rem 0.5rem; border-radius: 999px; cursor: pointer;
  border: 1px solid var(--adm-line); background: transparent; color: var(--adm-dim);
}
.md-server:hover { border-color: rgba(var(--adm-acc-rgb), 0.5); }
.md-server--admin, .md-server--admin:hover { cursor: default; }
.md-server { display: inline-flex; align-items: center; gap: 0.25rem; white-space: nowrap; }
.md-server__lock { width: 0.62rem; height: 0.62rem; flex-shrink: 0; opacity: 0.8; }
.md-adminnote { display: flex; align-items: center; gap: 0.5rem; margin: 0 0 0.9rem; padding: 0.55rem 0.8rem; border-radius: 9px; font-size: 0.78rem; color: var(--adm-mut); background: var(--adm-acc-soft); border: 1px solid var(--adm-acc-line); }
.md-adminnote b { color: var(--adm-text); }
.md-adminnote svg { width: 0.9rem; height: 0.9rem; flex-shrink: 0; color: var(--adm-acc-text); }
.md-server--on { background: rgba(var(--adm-acc-rgb), 0.18); border-color: rgba(var(--adm-acc-rgb), 0.6); color: var(--adm-text); }
.md-head-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.md-admin-form { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1rem; }
.md-row__since { margin-top: 0.3rem; font-size: 0.72rem; color: var(--adm-faint); }
.md-row__tags { display: flex; flex-wrap: wrap; gap: 0.3rem; align-items: center; }
.md-row__none { font-size: 0.78rem; color: var(--adm-dim); }
.md-srvtag { font-size: 0.68rem; font-weight: 700; padding: 0.1rem 0.45rem; border-radius: 6px; color: var(--adm-info); background: rgba(56, 189, 248, 0.1); }
.md-rolepill {
  display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.1rem 0.5rem 0.1rem 0.4rem; border-radius: 999px;
  font-size: 0.7rem; font-weight: 700; color: var(--adm-text);
  background: color-mix(in srgb, var(--rc) 15%, transparent); border: 1px solid color-mix(in srgb, var(--rc) 42%, transparent);
}
.md-rolepill i { width: 0.45rem; height: 0.45rem; border-radius: 50%; background: var(--rc); }
.md-scopebar { margin-bottom: 1rem; padding: 0.6rem 0.9rem; border-radius: 10px; font-size: 0.78rem; color: var(--adm-mut); background: var(--adm-acc-soft); border: 1px solid var(--adm-acc-line); }
.md-scopebar b { color: var(--adm-text); }
.md-servers--flat { padding-left: 0.45rem; }
.md-admin { width: min(560px, calc(100vw - 2rem)); display: flex; flex-direction: column; gap: 1rem; padding: 1.3rem; }
.md-admin__title { font-size: 1rem; font-weight: 800; color: var(--adm-text); }
.md-admin__opts { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
@media (max-width: 520px) { .md-admin__opts { grid-template-columns: 1fr; } }
.md-admin__opt { display: flex; flex-direction: column; gap: 0.2rem; text-align: left; padding: 0.75rem 0.85rem; border-radius: 11px; border: 1px solid var(--adm-line-strong); background: transparent; cursor: pointer; }
.md-admin__opt b { font-size: 0.84rem; color: var(--adm-text); }
.md-admin__opt small { font-size: 0.7rem; color: var(--adm-dim); line-height: 1.4; }
.md-admin__opt--on { border-color: var(--adm-acc); background: var(--adm-acc-soft); }
.md-admin__opt:disabled { opacity: 0.45; cursor: not-allowed; }
.md-admin__servers { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.45rem; }
.md-srvcard { display: flex; align-items: center; gap: 0.55rem; padding: 0.55rem 0.6rem; border-radius: 10px; border: 1px solid var(--adm-line-strong); background: var(--adm-bg-soft); cursor: pointer; text-align: left; }
.md-srvcard__icon { width: 1.9rem; height: 1.9rem; border-radius: 8px; flex-shrink: 0; position: relative; overflow: hidden; }
.md-srvcard__icon img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.md-srvcard__icon--none { display: flex; align-items: center; justify-content: center; background: var(--adm-acc-soft); color: var(--adm-acc-text); font-weight: 800; font-size: 0.85rem; }
.md-srvcard__name { flex: 1; min-width: 0; font-size: 0.8rem; font-weight: 700; color: var(--adm-mut); line-height: 1.25; overflow-wrap: anywhere; }
.md-srvcard__check { width: 1.1rem; height: 1.1rem; border-radius: 6px; border: 1.5px solid var(--adm-line-strong); display: flex; align-items: center; justify-content: center; color: transparent; flex-shrink: 0; }
.md-srvcard__check svg { width: 0.75rem; height: 0.75rem; }
.md-srvcard--on { border-color: var(--adm-acc); background: var(--adm-acc-soft); }
.md-srvcard--on .md-srvcard__name { color: var(--adm-text); }
.md-srvcard--on .md-srvcard__check { background: var(--adm-acc); border-color: var(--adm-acc); color: #fff; }
.md-row__all { font-size: 0.82rem; color: var(--adm-dim); }
/* Цвета — только из токенов admin.css, чтобы страница перекрашивалась
   вместе с панелью при смене активного сервера. */

.md-editor { padding: 1.1rem 1.2rem 1.2rem; }
.md-editor__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  padding-bottom: 0.9rem;
  margin-bottom: 1.1rem;
  border-bottom: 1px solid var(--adm-line);
}
.md-editor__who { display: flex; align-items: center; gap: 0.65rem; min-width: 0; }
.md-editor__name { font-size: 0.95rem; font-weight: 800; color: var(--adm-text); line-height: 1.2; }
.md-editor__count { font-size: 0.72rem; color: var(--adm-dim); margin-top: 0.1rem; }
.md-editor__count b { color: var(--adm-acc-text); font-weight: 700; }
.md-editor__presets { display: flex; gap: 0.45rem; }
.md-username { max-width: 320px; margin-bottom: 1.1rem; }

.md-groups { display: grid; grid-template-columns: repeat(auto-fill, minmax(272px, 1fr)); gap: 1rem 1.4rem; }
.md-group { min-width: 0; }
.md-group__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  width: 100%;
  padding: 0 0 0.1rem;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
}
/* .adm-label уже несёт акцентную засечку и микро-капитель — сбрасываем только отступ */
.md-group__title { margin-bottom: 0; }
.md-group__count { font-size: 0.66rem; color: var(--adm-faint); flex-shrink: 0; }
.md-group__head:hover .md-group__count { color: var(--adm-mut); }

.md-perm {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.34rem 0.45rem;
  border-radius: 7px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--adm-mut);
  cursor: pointer;
  transition: background-color 0.12s, color 0.12s;
}
.md-perm:hover { background: rgba(148, 163, 184, 0.055); }
.md-perm--on { color: var(--adm-text); }
.md-perm input { accent-color: var(--adm-acc); width: 0.95rem; height: 0.95rem; cursor: pointer; flex-shrink: 0; }
.md-perm__label { flex: 1; min-width: 0; line-height: 1.35; }
.md-perm__tag { color: var(--adm-warn); font-size: 1rem; line-height: 1; flex-shrink: 0; cursor: help; }

.md-editor__actions { display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1.3rem; }

.md-skels { display: flex; flex-direction: column; gap: 0.5rem; }
.md-skel { height: 58px; }

.md-row__who { display: flex; align-items: center; gap: 0.6rem; min-width: 0; }
.md-row__ava { width: 1.75rem; height: 1.75rem; font-size: 0.72rem; }
.md-row__ident { min-width: 0; }
.md-row__login { font-weight: 700; color: var(--adm-text); }
.md-row__email { font-size: 0.72rem; color: var(--adm-dim); margin-top: 0.05rem; }
.md-row__actions { display: flex; gap: 0.35rem; justify-content: flex-end; }
</style>
