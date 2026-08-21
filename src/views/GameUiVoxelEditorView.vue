<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
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
  setTimeout(() => { if (flash.value === msg) flash.value = '' }, 4000)
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

// Зона из мира: подсказка по командам (углы отмечаются в игре, зона пишется в backend,
// мод подхватывает на sync). Показываем инструкцию с подставленным game_id.
function pickZone() {
  const gid = isNew.value ? null : (selected.value?.game_id)
  if (!gid) { note('Сначала выбери/сохрани игру', true); return }
  const zoneName = window.prompt('Имя зоны (напр. spawn_pad):', 'spawn_pad')
  if (!zoneName) return
  note(`Закрой это окно, встань в углы и: /engine zone pos1 → /engine zone pos2 → /engine zone set ${gid} ${zoneName}`)
}

onMounted(() => {
  setVoxelCtx(route.query.webgui_token || '', route.query.server || '')
  load()
})
</script>

<template>
  <div class="vx">
    <header class="vx__head">
      <h1>VOXEL ENGINE <span class="vx__srv">{{ route.query.server || '' }}</span></h1>
      <button class="vx__btn vx__btn--acc" @click="startNew">＋ Новая игра</button>
      <div v-if="flash" class="vx__flash" :class="{ 'vx__flash--err': flashErr }">{{ flash }}</div>
    </header>

    <div class="vx__grid">
      <aside class="vx__list">
        <div v-if="loading" class="vx__empty">Загрузка…</div>
        <div v-else-if="!games.length" class="vx__empty">Игр нет. Создай первую.</div>
        <ul v-else>
          <li v-for="g in games" :key="g.id" class="vx__item" :class="{ 'is-active': g.id === selectedId }" @click="selectGame(g)">
            <div class="vx__item-top">
              <span class="vx__item-name">{{ g.name }}</span>
              <span v-if="g.is_active" class="vx__badge vx__badge--ok">активна</span>
            </div>
            <div class="vx__item-meta"><span class="vx__mono">{{ g.game_id }}</span> · v{{ g.version }}</div>
            <div class="vx__item-report" :class="{
              'is-ok': g.last_report_status === 'ok', 'is-err': g.last_report_status === 'error' }">
              {{ g.last_report_status ? (g.last_report_status === 'ok' ? 'загружено v' + g.last_reported_version : 'ошибка загрузки') : 'нет отчёта' }}
            </div>
          </li>
        </ul>
      </aside>

      <section class="vx__editor">
        <div v-if="!selected && !isNew" class="vx__empty">Выбери игру или создай новую.</div>
        <template v-else>
          <div class="vx__row">
            <label>game_id<input v-model="form.game_id" class="vx__inp vx__mono" :disabled="!isNew" placeholder="arena_demo" /></label>
            <label>Название<input v-model="form.name" class="vx__inp" placeholder="Демо-арена" /></label>
          </div>
          <label class="vx__check"><input type="checkbox" v-model="form.enabled" /> enabled (мод тянет игру)</label>

          <div v-if="selected" class="vx__report-line" :class="{
            'is-ok': selected.last_report_status === 'ok', 'is-err': selected.last_report_status === 'error' }">
            версия v{{ selected.version }} ·
            {{ selected.last_report_status ? (selected.last_report_status === 'ok' ? 'мод загрузил v' + selected.last_reported_version : 'ошибка: ' + (selected.last_report_message || '')) : 'мод ещё не отчитался' }}
          </div>

          <div class="vx__jsonhead">
            <span>definition (JSON)</span>
            <div>
              <button class="vx__btn vx__btn--sm" @click="pickZone">Зона из мира</button>
              <button class="vx__btn vx__btn--sm" @click="formatJson">Форматировать</button>
            </div>
          </div>
          <textarea v-model="form.definitionText" class="vx__json vx__mono" spellcheck="false"></textarea>
          <div v-if="jsonError" class="vx__err">{{ jsonError }}</div>

          <div class="vx__actions">
            <button class="vx__btn vx__btn--acc" :disabled="saving" @click="save">{{ saving ? 'Сохранение…' : (isNew ? 'Создать' : 'Сохранить') }}</button>
            <button v-if="selected && !selected.is_active" class="vx__btn" @click="activate(selected)">Сделать активной</button>
          </div>
        </template>
      </section>
    </div>
  </div>
</template>

<style scoped>
.vx { position: fixed; inset: 0; background: rgba(15, 17, 26, 0.92); color: #eceef5; font-family: Inter, system-ui, sans-serif; padding: 20px clamp(16px, 4vw, 48px); overflow-y: auto; }
.vx__mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
.vx__head { display: flex; align-items: center; gap: 16px; margin-bottom: 18px; flex-wrap: wrap; }
.vx__head h1 { font-family: Rubik, sans-serif; font-weight: 800; font-size: 22px; letter-spacing: .02em; margin: 0; }
.vx__srv { color: #3fd0c0; font-family: 'JetBrains Mono', monospace; font-size: 13px; margin-left: 8px; }
.vx__flash { margin-left: auto; font-size: 13px; color: #3fd0c0; }
.vx__flash--err { color: #e56a5a; }
.vx__grid { display: grid; grid-template-columns: 300px 1fr; gap: 16px; align-items: start; }
@media (max-width: 820px) { .vx__grid { grid-template-columns: 1fr; } }
.vx__list ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.vx__list { max-height: 82vh; overflow-y: auto; }
.vx__item { padding: 10px 12px; border: 1px solid rgba(255,255,255,.1); border-radius: 10px; cursor: pointer; }
.vx__item.is-active { border-color: #3fd0c0; background: rgba(63,208,192,.08); }
.vx__item-top { display: flex; align-items: center; gap: 8px; }
.vx__item-name { font-weight: 600; }
.vx__item-meta { font-size: 12px; color: #a6adc0; margin: 3px 0; }
.vx__item-report { font-size: 12px; color: #6e7590; }
.vx__item-report.is-ok { color: #3fd0c0; }
.vx__item-report.is-err { color: #e56a5a; }
.vx__badge { font-size: 11px; padding: 1px 7px; border-radius: 6px; background: rgba(255,255,255,.08); }
.vx__badge--ok { background: rgba(63,208,192,.18); color: #3fd0c0; }
.vx__editor { border: 1px solid rgba(255,255,255,.1); border-radius: 12px; padding: 16px; background: rgba(25,29,43,.6); }
.vx__row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 520px) { .vx__row { grid-template-columns: 1fr; } }
.vx__row label, .vx__check { display: flex; flex-direction: column; gap: 5px; font-size: 12px; color: #a6adc0; }
.vx__check { flex-direction: row; align-items: center; gap: 8px; margin: 12px 0; }
.vx__inp { background: #0f111a; border: 1px solid rgba(255,255,255,.12); border-radius: 8px; color: #eceef5; padding: 8px 10px; font-size: 14px; }
.vx__inp:disabled { opacity: .6; }
.vx__report-line { font-size: 12.5px; color: #a6adc0; margin: 4px 0 10px; }
.vx__report-line.is-ok { color: #3fd0c0; }
.vx__report-line.is-err { color: #e56a5a; }
.vx__jsonhead { display: flex; align-items: center; justify-content: space-between; margin: 6px 0; font-size: 12px; color: #a6adc0; }
.vx__jsonhead > div { display: flex; gap: 8px; }
.vx__json { width: 100%; min-height: 42vh; resize: vertical; background: #0c0e15; border: 1px solid rgba(255,255,255,.12); border-radius: 8px; color: #eceef5; padding: 12px; font-size: 13px; line-height: 1.5; }
.vx__err { color: #e56a5a; font-size: 12.5px; margin-top: 6px; }
.vx__actions { display: flex; gap: 10px; margin-top: 14px; flex-wrap: wrap; }
.vx__btn { background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.15); color: #eceef5; border-radius: 8px; padding: 9px 16px; font-size: 14px; cursor: pointer; }
.vx__btn:hover { background: rgba(255,255,255,.1); }
.vx__btn--sm { padding: 5px 10px; font-size: 12px; }
.vx__btn--acc { background: #3fd0c0; color: #0f111a; border-color: #3fd0c0; font-weight: 600; }
.vx__btn--acc:disabled { opacity: .6; }
.vx__empty { color: #6e7590; padding: 20px; text-align: center; }
</style>
