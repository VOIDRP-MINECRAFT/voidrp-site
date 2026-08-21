<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import '../assets/gameui.css'
import { closeGui } from '../composables/useWebGui.js'
import {
  setVoxelCtx,
  listGames,
  createGame,
  updateGame,
  activateGame,
} from '../services/voxelGameUiApi'

const route = useRoute()

const games = ref([])
const loading = ref(true)
const selectedId = ref(null) // uuid | 'new' | null
const saving = ref(false)
const jsonError = ref('')
const flash = ref('')
const flashErr = ref(false)

const form = ref({ game_id: '', name: '', enabled: true, definitionText: '' })
const selected = computed(() => games.value.find((g) => g.id === selectedId.value) || null)
const isNew = computed(() => selectedId.value === 'new')

function note(msg, isErr = false) {
  flash.value = msg
  flashErr.value = isErr
  setTimeout(() => { if (flash.value === msg) flash.value = '' }, 4200)
}

function defaultDefinition() {
  return {
    format: 1, id: 'new_game', name: 'Новая игра',
    zones: { spawn_pad: { type: 'box', dimension: 'minecraft:overworld', min: [0, 64, 0], max: [8, 68, 8] } },
    triggers: [{
      event: { type: 'onEnterZone', zone: 'spawn_pad' },
      condition: { type: 'always' },
      action: { type: 'giveItem', item: 'minecraft:iron_sword', count: 1 },
    }],
  }
}

async function load() {
  loading.value = true
  try {
    games.value = (await listGames()) || []
    if (selectedId.value && selectedId.value !== 'new') {
      const cur = games.value.find((g) => g.id === selectedId.value)
      if (cur) selectGame(cur)
    }
  } catch (e) {
    note('Не удалось загрузить: ' + (e?.message || e), true)
    games.value = []
  } finally {
    loading.value = false
  }
}

function selectGame(g) {
  selectedId.value = g.id
  jsonError.value = ''
  form.value = { game_id: g.game_id, name: g.name, enabled: g.enabled, definitionText: JSON.stringify(g.definition ?? {}, null, 2) }
}

function startNew() {
  selectedId.value = 'new'
  jsonError.value = ''
  form.value = { game_id: '', name: '', enabled: true, definitionText: JSON.stringify(defaultDefinition(), null, 2) }
}

function parseDefinition() {
  try {
    const obj = JSON.parse(form.value.definitionText)
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) { jsonError.value = 'JSON должен быть объектом игры'; return null }
    jsonError.value = ''
    return obj
  } catch (e) { jsonError.value = 'Ошибка JSON: ' + e.message; return null }
}

function formatJson() { const o = parseDefinition(); if (o) form.value.definitionText = JSON.stringify(o, null, 2) }

async function save() {
  const definition = parseDefinition()
  if (!definition) return
  if (!form.value.name.trim()) { note('Укажите название', true); return }
  saving.value = true
  try {
    if (isNew.value) {
      if (!/^[a-z0-9][a-z0-9_-]*$/.test(form.value.game_id)) { note('game_id: латиница/цифры/дефис, с буквы/цифры', true); return }
      const created = await createGame({ game_id: form.value.game_id.trim(), name: form.value.name.trim(), definition, enabled: form.value.enabled })
      note('Игра создана')
      await load()
      const g = games.value.find((x) => x.id === created.id); if (g) selectGame(g)
    } else {
      await updateGame(selectedId.value, { name: form.value.name.trim(), enabled: form.value.enabled, definition })
      note('Сохранено — мод подхватит на следующем sync')
      await load()
    }
  } catch (e) { note('Ошибка: ' + (e?.message || e), true) } finally { saving.value = false }
}

async function activate(g) {
  try { await activateGame(g.id); note(`«${g.name}» активна`); await load() }
  catch (e) { note('Не удалось активировать: ' + (e?.message || e), true) }
}

function pickZone() {
  const gid = isNew.value ? null : (selected.value?.game_id)
  if (!gid) { note('Сначала выбери/сохрани игру', true); return }
  const zoneName = window.prompt('Имя зоны (напр. spawn_pad):', 'spawn_pad')
  if (!zoneName) return
  note(`Закрой окно и в игре: /engine zone pos1 → pos2 → /engine zone set ${gid} ${zoneName}`)
}

function reportText(g) {
  if (!g.last_report_status) return 'нет отчёта'
  if (g.last_report_status === 'ok') return 'загружено v' + g.last_reported_version
  return 'ошибка загрузки'
}
function reportClass(g) {
  if (g.last_report_status === 'ok') return 'gui-badge-success'
  if (g.last_report_status === 'error') return 'gui-badge-error'
  return 'gui-badge-neutral'
}

onMounted(() => {
  setVoxelCtx(route.query.webgui_token || '', route.query.server || '')
  load()
})
</script>

<template>
  <div class="gui-root">
    <div class="gui-header">
      <div class="gui-title"><span class="gui-title-icon">🧊</span> Voxel Engine
        <span v-if="route.query.server" class="vx-srv">{{ route.query.server }}</span>
      </div>
      <button class="gui-close" @click="closeGui">✕</button>
    </div>

    <transition name="gui-toast">
      <div v-if="flash" class="gui-toast" :class="flashErr ? 'gui-toast-err' : 'gui-toast-ok'">{{ flash }}</div>
    </transition>

    <div class="gui-body vx-body">
      <!-- Список игр -->
      <aside class="gui-card vx-list">
        <div class="vx-list-head">
          <span class="gui-section-title">Игры</span>
          <button class="gui-btn gui-btn-primary gui-btn-sm" @click="startNew">＋ Новая</button>
        </div>
        <div v-if="loading" class="gui-state"><span class="gui-state-text">Загрузка…</span></div>
        <div v-else-if="!games.length" class="gui-state">
          <span class="gui-state-icon">🎮</span>
          <span class="gui-state-text">Игр пока нет</span>
          <span class="gui-state-sub">Создай первую справа</span>
        </div>
        <div v-else class="gui-list">
          <button v-for="g in games" :key="g.id" class="vx-item" :class="{ 'is-active': g.id === selectedId }" @click="selectGame(g)">
            <div class="vx-item-top">
              <span class="vx-item-name">{{ g.name }}</span>
              <span v-if="g.is_active" class="gui-badge gui-badge-success">активна</span>
            </div>
            <div class="vx-item-meta"><code>{{ g.game_id }}</code> · v{{ g.version }}</div>
            <span class="gui-badge" :class="reportClass(g)">{{ reportText(g) }}</span>
          </button>
        </div>
      </aside>

      <!-- Редактор -->
      <section class="gui-card vx-editor">
        <div v-if="!selected && !isNew" class="gui-state">
          <span class="gui-state-icon">✏️</span>
          <span class="gui-state-text">Выбери игру или создай новую</span>
        </div>
        <template v-else>
          <div class="vx-fields">
            <label class="vx-field">
              <span>game_id</span>
              <input v-model="form.game_id" class="gui-input mono" :disabled="!isNew" placeholder="arena_demo" />
            </label>
            <label class="vx-field">
              <span>Название</span>
              <input v-model="form.name" class="gui-input" placeholder="Демо-арена" />
            </label>
          </div>
          <label class="vx-check"><input type="checkbox" v-model="form.enabled" /> enabled (мод тянет игру)</label>

          <div v-if="selected" class="vx-report">
            <span class="gui-badge" :class="reportClass(selected)">{{ reportText(selected) }}</span>
            <span class="vx-report-note">версия на сервере v{{ selected.version }}<template v-if="selected.last_report_status === 'error' && selected.last_report_message"> · {{ selected.last_report_message }}</template></span>
          </div>

          <div class="vx-jsonhead">
            <span class="gui-section-title">definition (JSON)</span>
            <div class="vx-jsonbtns">
              <button class="gui-btn gui-btn-ghost gui-btn-xs" @click="pickZone">Зона из мира</button>
              <button class="gui-btn gui-btn-ghost gui-btn-xs" @click="formatJson">Форматировать</button>
            </div>
          </div>
          <textarea v-model="form.definitionText" class="gui-input mono vx-json" spellcheck="false"></textarea>
          <div v-if="jsonError" class="vx-err">{{ jsonError }}</div>

          <div class="vx-actions">
            <button class="gui-btn gui-btn-primary" :disabled="saving" @click="save">{{ saving ? 'Сохранение…' : (isNew ? 'Создать' : 'Сохранить') }}</button>
            <button v-if="selected && !selected.is_active" class="gui-btn gui-btn-success" @click="activate(selected)">Сделать активной</button>
          </div>
        </template>
      </section>
    </div>
  </div>
</template>

<style scoped>
.vx-srv { font-size: 0.7rem; font-weight: 700; color: var(--gui-accent); background: rgba(129,140,248,.12); border: 1px solid var(--gui-border); border-radius: 999px; padding: 2px 9px; margin-left: 10px; -webkit-text-fill-color: initial; }
.vx-body { display: grid; grid-template-columns: 300px 1fr; gap: 14px; align-items: start; overflow: hidden; }
@media (max-width: 820px) { .vx-body { grid-template-columns: 1fr; } }
.vx-list { display: flex; flex-direction: column; gap: 12px; max-height: 82vh; overflow-y: auto; }
.vx-list-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.vx-item { text-align: left; width: 100%; background: var(--gui-surface-2); border: 1px solid var(--gui-border); border-radius: 12px; padding: 11px 13px; cursor: pointer; transition: border-color .15s, background .15s; color: var(--gui-text); }
.vx-item:hover { border-color: var(--gui-border-strong); background: var(--gui-surface-hover); }
.vx-item.is-active { border-color: var(--gui-accent); background: rgba(129,140,248,.1); }
.vx-item-top { display: flex; align-items: center; gap: 8px; margin-bottom: 3px; }
.vx-item-name { font-weight: 700; }
.vx-item-meta { font-size: 0.78rem; color: var(--gui-muted); margin-bottom: 7px; }
.vx-item-meta code { font-family: ui-monospace, monospace; color: var(--gui-text-soft); }
.vx-editor { display: flex; flex-direction: column; gap: 12px; }
.vx-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 520px) { .vx-fields { grid-template-columns: 1fr; } }
.vx-field { display: flex; flex-direction: column; gap: 5px; font-size: 0.76rem; color: var(--gui-text-soft); }
.vx-check { display: flex; align-items: center; gap: 8px; font-size: 0.82rem; color: var(--gui-text-soft); }
.mono { font-family: ui-monospace, 'JetBrains Mono', monospace; }
.vx-report { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.vx-report-note { font-size: 0.78rem; color: var(--gui-muted); }
.vx-jsonhead { display: flex; align-items: center; justify-content: space-between; }
.vx-jsonbtns { display: flex; gap: 8px; }
.vx-json { width: 100%; min-height: 40vh; resize: vertical; line-height: 1.5; font-size: 0.82rem; }
.vx-err { color: var(--gui-red); font-size: 0.8rem; }
.vx-actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 4px; }
</style>
