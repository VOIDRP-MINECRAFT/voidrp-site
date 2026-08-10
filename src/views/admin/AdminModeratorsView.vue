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
    confirmText: 'Снять',
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
    <div class="adm-head">
      <div>
        <h1 class="adm-title">Модерация</h1>
        <p class="adm-mut">Назначай модераторов по нику и выбирай, что им доступно в админ-панели.</p>
      </div>
      <button class="adm-btn adm-btn--acc" :disabled="editing === 'new'" @click="startNew">+ Новый модератор</button>
    </div>

    <!-- Editor -->
    <div v-if="editing" class="adm-card mod-editor">
      <div class="mod-editor__top">
        <div class="mod-editor__title">{{ editingName }}</div>
        <div class="mod-editor__preset">
          <button type="button" class="adm-btn adm-btn--sm" @click="applyPreset">Стандартный модератор</button>
          <button type="button" class="adm-btn adm-btn--sm" @click="clearAll">Снять все</button>
        </div>
      </div>

      <label v-if="editing === 'new'" class="adm-field mod-username">
        <span>Ник пользователя (site login)</span>
        <input v-model="form.username" class="adm-input" placeholder="например, mironoouv" autocomplete="off" />
      </label>

      <div class="mod-groups">
        <div v-for="g in catalog" :key="g.group" class="mod-group">
          <div class="mod-group__title">{{ g.group }}</div>
          <label
            v-for="p in g.permissions"
            :key="p.key"
            class="mod-perm"
            :class="{ 'mod-perm--sensitive': p.sensitive, 'mod-perm--on': has(p.key) }"
          >
            <input type="checkbox" :checked="has(p.key)" @change="toggle(p.key)" />
            <span class="mod-perm__label">{{ p.label }}</span>
            <span v-if="p.sensitive" class="mod-perm__badge">чувств.</span>
          </label>
        </div>
      </div>

      <div class="mod-editor__bar">
        <button class="adm-btn adm-btn--acc" :disabled="saving" @click="save">
          {{ saving ? 'Сохраняем…' : (editing === 'new' ? 'Назначить' : 'Сохранить') }}
        </button>
        <button class="adm-btn" :disabled="saving" @click="cancel">Отмена</button>
      </div>
    </div>

    <!-- List -->
    <div class="adm-card">
      <div v-if="loading" class="adm-mut" style="padding:1rem">Загрузка…</div>
      <div v-else-if="!moderators.length" class="adm-empty">Модераторов пока нет.</div>
      <table v-else class="mod-table">
        <thead><tr><th>Модератор</th><th>Права</th><th></th></tr></thead>
        <tbody>
          <tr v-for="m in moderators" :key="m.id">
            <td>
              <div class="mod-row-login">{{ m.site_login }}</div>
              <div class="mod-row-email">{{ m.email }}</div>
            </td>
            <td class="mod-row-perms">
              <span class="mod-count">{{ m.permissions.length }} прав</span>
            </td>
            <td class="mod-actions">
              <button class="adm-btn adm-btn--sm" @click="startEdit(m)">Изменить</button>
              <button class="adm-btn adm-btn--sm adm-btn--danger" @click="revoke(m)">Снять</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.adm-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem; }
.mod-editor { margin-bottom: 1.25rem; padding: 1.1rem; }
.mod-editor__top { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-bottom: 1rem; flex-wrap: wrap; }
.mod-editor__title { font-weight: 700; font-size: 1.05rem; color: var(--adm-text, #f4f2fb); }
.mod-editor__preset { display: flex; gap: .5rem; }
.mod-username { margin-bottom: 1rem; max-width: 360px; }
.mod-groups { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem 1.5rem; }
.mod-group__title { font-size: .72rem; text-transform: uppercase; letter-spacing: .06em; color: #8b86a3; margin-bottom: .45rem; }
.mod-perm { display: flex; align-items: center; gap: .5rem; padding: .32rem .4rem; border-radius: 8px; font-size: .88rem; color: #d6d2e6; cursor: pointer; }
.mod-perm:hover { background: rgba(255,255,255,.04); }
.mod-perm--on { color: #f4f2fb; }
.mod-perm input { accent-color: #7c3aed; width: .95rem; height: .95rem; cursor: pointer; }
.mod-perm__label { flex: 1; }
.mod-perm__badge { font-size: .62rem; text-transform: uppercase; color: #f59e0b; background: rgba(245,158,11,.12); padding: .05rem .3rem; border-radius: 4px; }
.mod-editor__bar { display: flex; gap: .6rem; margin-top: 1.25rem; }

.mod-table { width: 100%; border-collapse: collapse; }
.mod-table th { text-align: left; font-size: .75rem; color: #8b86a3; text-transform: uppercase; padding: .6rem .5rem; border-bottom: 1px solid rgba(255,255,255,.08); }
.mod-table td { padding: .7rem .5rem; border-bottom: 1px solid rgba(255,255,255,.05); vertical-align: middle; }
.mod-row-login { font-weight: 600; color: #f4f2fb; }
.mod-row-email { font-size: .8rem; color: #8b86a3; }
.mod-count { font-size: .82rem; color: #a5a1bb; }
.mod-actions { display: flex; gap: .4rem; justify-content: flex-end; }
</style>
