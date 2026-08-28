<script setup>
import { computed, onMounted, ref } from 'vue'
import { authState } from '../../stores/authStore'
import { confirmDialog } from '../../composables/useConfirm'
import { toastSuccess, toastError } from '../../services/toast'
import {
  getPermissionCatalog,
  listModerators,
  assignModerator,
  updateModerator,
  revokeModerator,
} from '../../services/adminModeratorsApi'

const token = () => authState.accessToken

const catalog = ref([])
const preset = ref([])
const moderators = ref([])
const loading = ref(true)
const saving = ref(false)

// Editor state: null | 'new' | moderator-id
const editing = ref(null)
const form = ref({ username: '', permissions: new Set() })

const editingName = computed(() => {
  if (editing.value === 'new') return 'Новый модератор'
  const m = moderators.value.find((x) => x.id === editing.value)
  return m ? m.site_login : ''
})

const selectedCount = computed(() => form.value.permissions.size)
const totalCount = computed(() =>
  catalog.value.reduce((n, g) => n + (g.permissions?.length || 0), 0),
)

function groupSelected(group) {
  return (group.permissions || []).filter((p) => form.value.permissions.has(p.key)).length
}

async function load() {
  loading.value = true
  try {
    const [cat, mods] = await Promise.all([getPermissionCatalog(token()), listModerators(token())])
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
  form.value = { username: '', permissions: new Set(preset.value) }
}

function startEdit(m) {
  editing.value = m.id
  form.value = { username: m.site_login, permissions: new Set(m.permissions || []) }
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
  form.value = { ...form.value, permissions: new Set() }
}

async function save() {
  const perms = [...form.value.permissions]
  saving.value = true
  try {
    if (editing.value === 'new') {
      if (!form.value.username.trim()) { toastError('Укажите ник пользователя'); saving.value = false; return }
      await assignModerator(token(), form.value.username.trim(), perms)
      toastSuccess('Модератор назначен')
    } else {
      await updateModerator(token(), editing.value, perms)
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
        <p class="adm-sub">Назначай модераторов по нику и выбирай, что им доступно в панели</p>
      </div>
      <button class="adm-btn adm-btn--acc" :disabled="editing === 'new'" @click="startNew">
        Новый модератор
      </button>
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

      <div class="md-groups">
        <section v-for="g in catalog" :key="g.group" class="md-group">
          <button type="button" class="md-group__head" @click="toggleGroup(g)">
            <span class="adm-label md-group__title">{{ g.group }}</span>
            <span class="md-group__count adm-num">{{ groupSelected(g) }}/{{ g.permissions.length }}</span>
          </button>
          <label
            v-for="p in g.permissions"
            :key="p.key"
            class="md-perm"
            :class="{ 'md-perm--on': has(p.key) }"
          >
            <input type="checkbox" :checked="has(p.key)" @change="toggle(p.key)" />
            <span class="md-perm__label">{{ p.label }}</span>
            <span v-if="p.sensitive" class="md-perm__tag" title="Чувствительное право">•</span>
          </label>
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
      <div class="adm-empty__title">Модераторов пока нет</div>
      <div class="adm-empty__sub">Назначь первого — он получит доступ только к тем разделам, которые ты отметишь.</div>
    </div>

    <div v-else class="adm-table-wrap">
      <div class="adm-table-scroll">
        <table class="adm-table">
          <thead>
            <tr><th>Модератор</th><th>Права</th><th /></tr>
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
                <span class="adm-badge" :class="m.permissions.length ? 'adm-badge--acc' : ''">
                  <b class="adm-num">{{ m.permissions.length }}</b>&nbsp;из&nbsp;<span class="adm-num">{{ totalCount }}</span>
                </span>
              </td>
              <td>
                <div class="md-row__actions">
                  <button class="adm-btn adm-btn--sm" @click="startEdit(m)">Изменить</button>
                  <button class="adm-btn adm-btn--sm adm-btn--danger" @click="revoke(m)">Снять</button>
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
