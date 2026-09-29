<script setup>
import { computed, onMounted, ref } from 'vue'
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
  removeAdmin,
} from '../../services/adminModeratorsApi'

const token = () => authState.accessToken
// Only the owner appoints and removes full admins; the backend refuses anyone else.
const isOwner = computed(() => !!authState.user?.is_owner)
const ROLE = {
  owner: { label: 'Владелец', cls: 'adm-badge--acc' },
  admin: { label: 'Админ', cls: 'adm-badge--warn' },
  moderator: { label: 'Модератор', cls: '' },
}
const fmtDate = (v) => (v ? new Date(v).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '')

// «Новый админ»: a nickname and a confirmation.
const adminForm = ref(null)
const adminBusy = ref(false)
async function submitAdmin() {
  const name = (adminForm.value || '').trim()
  if (!name) { toastError('Укажите ник пользователя'); return }
  const ok = await confirmDialog({
    title: `Сделать «${name}» админом?`,
    message: 'Админ получает все права на всех серверах и может назначать модераторов. Снять его сможешь только ты.',
    confirmLabel: 'Сделать админом',
    danger: true,
  })
  if (!ok) return
  adminBusy.value = true
  try {
    await appointAdmin(token(), name)
    toastSuccess(`${name} теперь админ`)
    adminForm.value = null
    await load()
  } catch (e) {
    toastError(e?.message || 'Не удалось назначить')
  } finally {
    adminBusy.value = false
  }
}

async function promote(m) {
  const ok = await confirmDialog({
    title: `Сделать «${m.site_login}» админом?`,
    message: 'Вместо отмеченных прав модератора он получит все права на всех серверах и сможет назначать модераторов.',
    confirmLabel: 'Сделать админом',
    danger: true,
  })
  if (!ok) return
  try {
    await appointAdmin(token(), m.site_login)
    toastSuccess(`${m.site_login} теперь админ`)
    await load()
  } catch (e) {
    toastError(e?.message || 'Не удалось назначить')
  }
}

async function demote(m) {
  const ok = await confirmDialog({
    title: `Снять админа «${m.site_login}»?`,
    message: 'Он сразу потеряет доступ к админ-панели. Если нужно оставить ему часть разделов — после снятия назначь его модератором.',
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
  } catch (e) {
    toastError(e?.message || 'Не удалось загрузить')
  } finally {
    loading.value = false
  }
}

function startNew() {
  editing.value = 'new'
  form.value = { username: '', permissions: new Set(preset.value), byServer: {} }
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
      toastSuccess('Модератор назначен')
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
    title: 'Снять модератора?',
    message: `«${m.site_login}» потеряет доступ к админ-панели.`,
    confirmLabel: 'Снять',
    danger: true,
  })
  if (!ok) return
  try {
    await revokeModerator(token(), m.id)
    toastSuccess('Модератор снят')
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
        <h1 class="adm-title">Модерация</h1>
        <p class="adm-sub">Сотрудники панели: админы видят всё, модераторам доступно только отмеченное</p>
      </div>
      <div class="md-head-actions">
        <button v-if="isOwner" class="adm-btn" :disabled="adminForm !== null" @click="adminForm = ''">Новый админ</button>
        <button class="adm-btn adm-btn--acc" :disabled="editing === 'new'" @click="startNew">
          Новый модератор
        </button>
      </div>
    </div>

    <!-- Новый админ (только владелец) -->
    <div v-if="isOwner && adminForm !== null" class="adm-card adm-card--pad md-admin-form">
      <label class="adm-field md-username">
        <span>Ник пользователя — станет админом: все права на всех серверах</span>
        <input v-model="adminForm" class="adm-input" placeholder="ник на сайте" autocomplete="off" @keyup.enter="submitAdmin" />
      </label>
      <div class="md-editor__actions">
        <button class="adm-btn" :disabled="adminBusy" @click="adminForm = null">Отмена</button>
        <button class="adm-btn adm-btn--danger" :disabled="adminBusy" @click="submitAdmin">Сделать админом</button>
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
          <button type="button" class="adm-btn adm-btn--sm" @click="applyPreset">Стандартный набор</button>
          <button type="button" class="adm-btn adm-btn--sm" @click="clearAll">Снять все</button>
        </div>
      </div>

      <label v-if="editing === 'new'" class="adm-field md-username">
        <span>Ник пользователя</span>
        <input v-model="form.username" class="adm-input" placeholder="например, mironoouv" autocomplete="off" />
      </label>

      <p class="md-scope-hint">
        Галочка — право на всех серверах. У прав «по серверам» без галочки можно отметить
        отдельные серверы кнопками под ними: модератор получит это право только там.
      </p>

      <div class="md-groups">
        <section v-for="g in catalog" :key="g.group" class="md-group">
          <button type="button" class="md-group__head" @click="toggleGroup(g)">
            <span class="adm-label md-group__title">{{ g.group }}</span>
            <span class="md-group__count adm-num">{{ groupSelected(g) }}/{{ g.permissions.length }}</span>
          </button>
          <div v-for="p in g.permissions" :key="p.key" class="md-perm-wrap">
            <label class="md-perm" :class="{ 'md-perm--on': has(p.key) }">
              <input type="checkbox" :checked="has(p.key)" @change="toggle(p.key)" />
              <span class="md-perm__label">
                {{ p.label }}
                <span v-if="p.scope === 'server'" class="md-perm__scope">{{ has(p.key) ? 'на всех серверах' : 'по серверам' }}</span>
              </span>
              <span v-if="p.sensitive" class="md-perm__tag" title="Чувствительное право">•</span>
            </label>
            <div v-if="p.scope === 'server' && !has(p.key) && servers.length" class="md-servers">
              <button
                v-for="srv in servers"
                :key="srv.slug"
                type="button"
                class="md-server"
                :class="{ 'md-server--on': hasOn(srv.slug, p.key) }"
                @click="toggleOn(srv.slug, p.key)"
              >{{ srv.name }}</button>
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
            <tr><th>Сотрудник</th><th>Роль</th><th>Права</th><th /></tr>
          </thead>
          <tbody>
            <tr v-for="m in moderators" :key="m.id">
              <td>
                <div class="md-row__who">
                  <span class="adm-avatar md-row__ava">{{ m.site_login.charAt(0).toUpperCase() }}</span>
                  <div class="md-row__ident">
                    <div class="md-row__login">{{ m.site_login }}</div>
                    <div class="md-row__email adm-mono">{{ m.email }}</div>
                  </div>
                </div>
              </td>
              <td>
                <span class="adm-badge" :class="ROLE[m.role]?.cls">{{ ROLE[m.role]?.label || m.role }}</span>
                <div v-if="m.staff_since" class="md-row__since">
                  с {{ fmtDate(m.staff_since) }}<template v-if="m.granted_by"> · назначил {{ m.granted_by }}</template>
                </div>
              </td>
              <td>
                <span v-if="m.role !== 'moderator'" class="md-row__all">все права</span>
                <template v-else>
                  <span class="adm-badge" :class="m.permissions.length ? 'adm-badge--acc' : ''">
                    <b class="adm-num">{{ m.permissions.length }}</b>&nbsp;из&nbsp;<span class="adm-num">{{ totalCount }}</span>
                  </span>
                  <div v-for="line in serverSummary(m)" :key="line" class="md-row__since">+ {{ line }}</div>
                </template>
              </td>
              <td>
                <div v-if="m.role === 'moderator'" class="md-row__actions">
                  <button class="adm-btn adm-btn--sm" @click="startEdit(m)">Изменить</button>
                  <button v-if="isOwner" class="adm-btn adm-btn--sm" @click="promote(m)">Сделать админом</button>
                  <button class="adm-btn adm-btn--sm adm-btn--danger" @click="revoke(m)">Снять</button>
                </div>
                <div v-else-if="m.role === 'admin' && isOwner" class="md-row__actions">
                  <button class="adm-btn adm-btn--sm adm-btn--danger" @click="demote(m)">Снять админа</button>
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
.md-servers { display: flex; flex-wrap: wrap; gap: 0.3rem; padding: 0 0 0.45rem 1.9rem; }
.md-server {
  font-size: 0.7rem; padding: 0.15rem 0.5rem; border-radius: 999px; cursor: pointer;
  border: 1px solid var(--adm-line); background: transparent; color: var(--adm-dim);
}
.md-server:hover { border-color: rgba(var(--adm-acc-rgb), 0.5); }
.md-server--on { background: rgba(var(--adm-acc-rgb), 0.18); border-color: rgba(var(--adm-acc-rgb), 0.6); color: var(--adm-text); }
.md-head-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.md-admin-form { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1rem; }
.md-row__since { margin-top: 0.3rem; font-size: 0.72rem; color: var(--adm-faint); }
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
