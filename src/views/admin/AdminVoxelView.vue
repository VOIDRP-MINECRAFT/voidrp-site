<script setup>
import { computed, onMounted, ref } from 'vue'
import { authState } from '../../stores/authStore'
import { serverState, activeServer } from '../../stores/serverStore'
import { toastError, toastSuccess } from '../../services/toast'
import { confirmDialog } from '../../composables/useConfirm'
import {
  listVoxelGames,
  createVoxelGame,
  updateVoxelGame,
  deleteVoxelGame,
  activateVoxelGame,
} from '../../services/voxelAdminApi'

const token = () => authState.accessToken

const games = ref([])
const loading = ref(true)
const selectedId = ref(null) // uuid, или 'new', или null
const saving = ref(false)
const jsonError = ref('')

// Форма редактора
const form = ref({ game_id: '', name: '', enabled: true, definitionText: '' })

const selected = computed(() => games.value.find((g) => g.id === selectedId.value) || null)
const isNew = computed(() => selectedId.value === 'new')

function defaultDefinition(gameId, name) {
  return {
    format: 1,
    id: gameId || 'new_game',
    name: name || 'Новая игра',
    zones: {
      spawn_pad: { type: 'box', dimension: 'minecraft:overworld', min: [0, 64, 0], max: [8, 68, 8] },
    },
    triggers: [
      {
        event: { type: 'onEnterZone', zone: 'spawn_pad' },
        condition: { type: 'always' },
        action: { type: 'giveItem', item: 'minecraft:iron_sword', count: 1 },
      },
    ],
  }
}

async function loadGames() {
  loading.value = true
  try {
    games.value = (await listVoxelGames(token())) || []
  } catch (e) {
    toastError('Не удалось загрузить игры: ' + (e?.message || e))
    games.value = []
  } finally {
    loading.value = false
  }
}

function selectGame(g) {
  selectedId.value = g.id
  jsonError.value = ''
  form.value = {
    game_id: g.game_id,
    name: g.name,
    enabled: g.enabled,
    definitionText: JSON.stringify(g.definition ?? {}, null, 2),
  }
}

function startNew() {
  selectedId.value = 'new'
  jsonError.value = ''
  form.value = {
    game_id: '',
    name: '',
    enabled: true,
    definitionText: JSON.stringify(defaultDefinition('', ''), null, 2),
  }
}

function parseDefinition() {
  try {
    const obj = JSON.parse(form.value.definitionText)
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
      jsonError.value = 'JSON должен быть объектом игры'
      return null
    }
    jsonError.value = ''
    return obj
  } catch (e) {
    jsonError.value = 'Ошибка JSON: ' + e.message
    return null
  }
}

function formatJson() {
  const obj = parseDefinition()
  if (obj) form.value.definitionText = JSON.stringify(obj, null, 2)
}

async function save() {
  const definition = parseDefinition()
  if (!definition) return
  if (!form.value.name.trim()) { toastError('Укажите название'); return }

  saving.value = true
  try {
    if (isNew.value) {
      if (!/^[a-z0-9][a-z0-9_-]*$/.test(form.value.game_id)) {
        toastError('game_id: латиница/цифры/дефис/подчёркивание, начинается с буквы или цифры')
        return
      }
      const created = await createVoxelGame(token(), {
        game_id: form.value.game_id.trim(),
        name: form.value.name.trim(),
        definition,
        enabled: form.value.enabled,
      })
      toastSuccess('Игра создана')
      await loadGames()
      selectGame(games.value.find((g) => g.id === created.id) || created)
    } else {
      await updateVoxelGame(token(), selectedId.value, {
        name: form.value.name.trim(),
        enabled: form.value.enabled,
        definition,
      })
      toastSuccess('Сохранено — версия повышена, мод подхватит на следующем sync')
      await loadGames()
      const cur = games.value.find((g) => g.id === selectedId.value)
      if (cur) selectGame(cur)
    }
  } catch (e) {
    toastError('Ошибка сохранения: ' + (e?.message || e))
  } finally {
    saving.value = false
  }
}

async function activate(g) {
  try {
    await activateVoxelGame(token(), g.id)
    toastSuccess(`Игра «${g.name}» сделана активной`)
    await loadGames()
  } catch (e) {
    toastError('Не удалось активировать: ' + (e?.message || e))
  }
}

async function remove(g) {
  const ok = await confirmDialog({
    title: 'Удалить игру?',
    message: `«${g.name}» (${g.game_id}) будет удалена безвозвратно.`,
    confirmLabel: 'Удалить',
    danger: true,
  })
  if (!ok) return
  try {
    await deleteVoxelGame(token(), g.id)
    toastSuccess('Удалено')
    if (selectedId.value === g.id) selectedId.value = null
    await loadGames()
  } catch (e) {
    toastError('Не удалось удалить: ' + (e?.message || e))
  }
}

function reportBadge(g) {
  if (!g.last_report_status) return { cls: 'adm-badge', text: 'нет отчёта' }
  if (g.last_report_status === 'ok') {
    const behind = g.last_reported_version != null && g.last_reported_version < g.version
    return behind
      ? { cls: 'adm-badge adm-badge--warn', text: `мод на v${g.last_reported_version} (ждём v${g.version})` }
      : { cls: 'adm-badge adm-badge--ok', text: `загружено v${g.last_reported_version}` }
  }
  return { cls: 'adm-badge adm-badge--err', text: 'ошибка загрузки' }
}

function fmtTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
}

onMounted(loadGames)
</script>

<template>
  <div class="adm-page">
    <div class="vx-head">
      <div>
        <h1 class="adm-title">Voxel Engine</h1>
        <p class="adm-sub">Игры сервера <b>{{ activeServer?.name || serverState.activeSlug }}</b> — правишь здесь, мод подхватывает по каналу.</p>
      </div>
      <button class="adm-btn adm-btn--acc" @click="startNew">＋ Новая игра</button>
    </div>

    <div class="vx-grid">
      <!-- Список -->
      <div class="adm-card adm-card--pad vx-list">
        <div v-if="loading" class="adm-empty">Загрузка…</div>
        <div v-else-if="!games.length" class="adm-empty">Игр пока нет. Создай первую.</div>
        <ul v-else class="vx-items">
          <li
            v-for="g in games"
            :key="g.id"
            class="vx-item"
            :class="{ 'vx-item--active': g.id === selectedId }"
            @click="selectGame(g)"
          >
            <div class="vx-item__top">
              <span class="vx-item__name">{{ g.name }}</span>
              <span v-if="g.is_active" class="adm-badge adm-badge--ok">активна</span>
              <span v-if="!g.enabled" class="adm-badge">выкл</span>
            </div>
            <div class="vx-item__meta">
              <span class="adm-mono adm-dim">{{ g.game_id }}</span>
              <span class="adm-dim">v{{ g.version }}</span>
            </div>
            <div class="vx-item__report">
              <span :class="reportBadge(g).cls">{{ reportBadge(g).text }}</span>
              <span class="adm-faint">{{ fmtTime(g.last_reported_at) }}</span>
            </div>
          </li>
        </ul>
      </div>

      <!-- Редактор -->
      <div class="adm-card adm-card--pad vx-editor">
        <div v-if="!selected && !isNew" class="adm-empty">Выбери игру слева или создай новую.</div>
        <template v-else>
          <div class="vx-editor__row">
            <label class="adm-label">game_id
              <input v-model="form.game_id" class="adm-input adm-mono" :disabled="!isNew" placeholder="arena_demo" />
            </label>
            <label class="adm-label">Название
              <input v-model="form.name" class="adm-input" placeholder="Демо-арена" />
            </label>
          </div>

          <label class="adm-check">
            <input type="checkbox" v-model="form.enabled" /> enabled (мод тянет игру)
          </label>

          <!-- Обратный канал -->
          <div v-if="selected" class="vx-report">
            <span :class="reportBadge(selected).cls">{{ reportBadge(selected).text }}</span>
            <span class="adm-faint">версия на сервере: v{{ selected.version }} · отчёт: {{ fmtTime(selected.last_reported_at) }}</span>
            <div v-if="selected.last_report_status === 'error' && selected.last_report_message" class="adm-note adm-note--error vx-report__msg">
              {{ selected.last_report_message }}
            </div>
          </div>

          <div class="vx-editor__jsonhead">
            <span class="adm-label">definition (JSON — тот же формат, что читает мод)</span>
            <button class="adm-btn adm-btn--sm" @click="formatJson">Форматировать</button>
          </div>
          <textarea v-model="form.definitionText" class="adm-input adm-mono vx-json" spellcheck="false" rows="20"></textarea>
          <div v-if="jsonError" class="adm-note adm-note--error">{{ jsonError }}</div>

          <div class="vx-editor__actions">
            <button class="adm-btn adm-btn--acc" :disabled="saving" @click="save">
              {{ saving ? 'Сохранение…' : (isNew ? 'Создать' : 'Сохранить') }}
            </button>
            <button v-if="selected && !selected.is_active" class="adm-btn" @click="activate(selected)">Сделать активной</button>
            <button v-if="selected" class="adm-btn adm-btn--danger" @click="remove(selected)">Удалить</button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.vx-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 18px; flex-wrap: wrap; }
.vx-grid { display: grid; grid-template-columns: 340px 1fr; gap: 18px; align-items: start; }
@media (max-width: 900px) { .vx-grid { grid-template-columns: 1fr; } }
.vx-list { max-height: 78vh; overflow-y: auto; }
.vx-items { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.vx-item { padding: 12px 14px; border: 1px solid var(--adm-line, rgba(255,255,255,.08)); border-radius: 10px; cursor: pointer; transition: .15s; }
.vx-item:hover { border-color: var(--adm-acc-line, rgba(63,208,192,.4)); }
.vx-item--active { border-color: var(--adm-acc-text, #3fd0c0); background: var(--adm-acc-soft, rgba(63,208,192,.08)); }
.vx-item__top { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.vx-item__name { font-weight: 600; }
.vx-item__meta { display: flex; gap: 12px; font-size: 13px; margin-bottom: 6px; }
.vx-item__report { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.vx-editor__row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 12px; }
@media (max-width: 560px) { .vx-editor__row { grid-template-columns: 1fr; } }
.vx-report { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin: 12px 0; font-size: 13px; }
.vx-report__msg { flex-basis: 100%; }
.vx-editor__jsonhead { display: flex; align-items: center; justify-content: space-between; margin: 8px 0 6px; }
.vx-json { width: 100%; resize: vertical; line-height: 1.5; font-size: 13px; min-height: 320px; }
.vx-editor__actions { display: flex; gap: 10px; margin-top: 14px; flex-wrap: wrap; }
</style>
