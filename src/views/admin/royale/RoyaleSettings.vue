<script setup>
// Game settings: the team size (kept in the backend, the plugin takes it within ~2 s) and the
// map of the next game (the plugin's own «/br map use»).
import { computed, onMounted, ref } from 'vue'
import { authState, hasPermission } from '../../../stores/authStore'
import { toastError, toastSuccess } from '../../../services/toast'
import { royaleCommand, royaleSaveSettings, royaleSettings } from '../../../services/royaleAdminApi'
import RoyaleGrace from './RoyaleGrace.vue'

const emit = defineEmits(['changed'])
const token = () => authState.accessToken
const canManage = computed(() => hasPermission('royale.manage'))

const settings = ref(null)
const teamSize = ref(5)
const saving = ref(false)
const mapChoice = ref('')
const savingMap = ref(false)
const mode = ref('event')
const minPlayers = ref(2)
const savingMode = ref(false)
const rewardsEnabled = ref(false)
const coinsWin = ref(0)
const coinsKill = ref(0)
const coins2 = ref(0)
const coins3 = ref(0)
const savingRewards = ref(false)

async function load() {
  try {
    const res = await royaleSettings(token())
    const first = settings.value === null
    settings.value = res
    if (first) {
      teamSize.value = res.team_size ?? res.current ?? 5
      mapChoice.value = res.map || ''
      mode.value = res.mode || 'event'
      minPlayers.value = res.min_players ?? 2
      const rw = res.rewards || {}
      rewardsEnabled.value = !!rw.enabled
      coinsWin.value = rw.coins_win ?? 0
      coinsKill.value = rw.coins_kill ?? 0
      coins2.value = (rw.coins_placement || {})['2'] ?? 0
      coins3.value = (rw.coins_placement || {})['3'] ?? 0
    }
  } catch (e) {
    toastError(e.message || 'Не удалось загрузить настройки')
  }
}
onMounted(load)
defineExpose({ load })

const sizeDirty = computed(() => settings.value && teamSize.value !== (settings.value.team_size ?? settings.value.current))
const sizeApplied = computed(() => settings.value?.team_size != null && settings.value.current === settings.value.team_size)
const PRESETS = [1, 2, 3, 4, 5, 6]

async function saveSize() {
  const n = Number(teamSize.value)
  if (!Number.isInteger(n) || n < 1 || n > 20) { toastError('Размер команды — от 1 до 20'); return }
  saving.value = true
  try {
    settings.value = await royaleSaveSettings(token(), { team_size: n })
    toastSuccess(settings.value.online ? `До ${n} в команде — сервер применит за пару секунд` : `До ${n} в команде — применится, когда сервер запустится`)
    emit('changed')
    setTimeout(load, 3000)
  } catch (e) {
    toastError(e.message || 'Не удалось сохранить')
  } finally {
    saving.value = false
  }
}

function onGraceSaved(res) {
  if (res) settings.value = res
  setTimeout(load, 2500)
}

const modeDirty = computed(() => settings.value && (mode.value !== (settings.value.mode || 'event') || (mode.value === 'public' && Number(minPlayers.value) !== (settings.value.min_players ?? 2))))

async function saveMode() {
  savingMode.value = true
  try {
    const body = { mode: mode.value }
    if (mode.value === 'public') body.min_players = Math.min(40, Math.max(2, Number(minPlayers.value) || 2))
    settings.value = await royaleSaveSettings(token(), body)
    toastSuccess(mode.value === 'public' ? 'Общий режим — игры запускаются сами' : 'Режим ивента — запускает ведущий')
    emit('changed')
    setTimeout(load, 2500)
  } catch (e) {
    toastError(e.message || 'Не удалось сохранить')
  } finally {
    savingMode.value = false
  }
}

async function saveRewards() {
  savingRewards.value = true
  try {
    const n = (v) => Math.min(100000, Math.max(0, Number(v) || 0))
    const rewards = {
      enabled: !!rewardsEnabled.value,
      coins_win: n(coinsWin.value),
      coins_kill: n(coinsKill.value),
      coins_placement: { 2: n(coins2.value), 3: n(coins3.value) },
    }
    settings.value = await royaleSaveSettings(token(), { rewards })
    toastSuccess('Награды сохранены — сервер применит за пару секунд')
    emit('changed')
    setTimeout(load, 2500)
  } catch (e) {
    toastError(e.message || 'Не удалось сохранить')
  } finally {
    savingRewards.value = false
  }
}

async function saveMap() {
  if (!mapChoice.value) return
  savingMap.value = true
  try {
    const res = await royaleCommand(token(), { action: 'map', map: mapChoice.value })
    toastSuccess(res.answer)
    setTimeout(load, 1500)
  } catch (e) {
    toastError(e.message || 'Не удалось сменить карту')
  } finally {
    savingMap.value = false
  }
}
</script>

<template>
  <div v-if="!settings" class="adm-skel" style="height: 220px" />
  <div v-else class="rt">
    <div class="adm-card adm-card--pad rt-card">
      <div class="rt-text">
        <div class="rt-h">Режим сервера</div>
        <div class="rt-sub">
          <b>Ивент</b> — игры запускает ведущий с пульта в игре (нужен код ведущего); игроки заходят как есть. Подходит
          для мероприятий, где всем управляет человек.<br>
          <b>Общий</b> — игра стартует сама, когда в лобби набралось достаточно игроков на две команды. Для постоянного
          публичного сервера.
        </div>
        <div class="rt-state">
          <template v-if="!settings.online"><span class="adm-dot" /> Сервер не в сети — режим применится при запуске.</template>
          <template v-else-if="settings.current_mode === mode && !modeDirty"><span class="adm-dot adm-dot--ok" /> Сейчас на сервере: {{ mode === 'public' ? 'общий' : 'ивент' }}.</template>
          <template v-else><span class="adm-dot adm-dot--warn" /> Сервер применит за пару секунд.</template>
        </div>
      </div>
      <div class="rt-ctl">
        <div class="rt-presets">
          <button class="rt-preset rt-mode" :class="{ 'rt-preset--on': mode === 'event' }" :disabled="!canManage" @click="mode = 'event'">Ивент</button>
          <button class="rt-preset rt-mode" :class="{ 'rt-preset--on': mode === 'public' }" :disabled="!canManage" @click="mode = 'public'">Общий</button>
        </div>
        <div v-if="mode === 'public'" class="rt-stepper">
          <span class="rt-sub" style="margin:0">Запуск от</span>
          <button class="adm-btn adm-btn--sm" :disabled="!canManage || minPlayers <= 2" @click="minPlayers = Math.max(2, minPlayers - 1)">−</button>
          <input v-model.number="minPlayers" class="adm-input rt-size adm-num" type="number" min="2" max="40" :disabled="!canManage" />
          <button class="adm-btn adm-btn--sm" :disabled="!canManage || minPlayers >= 40" @click="minPlayers = Math.min(40, minPlayers + 1)">+</button>
          <span class="rt-sub" style="margin:0">игроков</span>
        </div>
        <button v-if="canManage" class="adm-btn adm-btn--acc" :disabled="savingMode || !modeDirty" @click="saveMode">{{ savingMode ? 'Сохраняю…' : 'Сохранить' }}</button>
      </div>
    </div>

    <div class="adm-card adm-card--pad rt-card">
      <div class="rt-text">
        <div class="rt-h">Игроков в команде</div>
        <div class="rt-sub">
          Сколько человек может встать в одну команду. Если уменьшить, а в команде уже больше людей, последние вошедшие
          выйдут из неё и выберут другую. Во время игры её команды не меняются — новый размер начнёт действовать к следующей.
        </div>
        <div class="rt-state">
          <template v-if="!settings.online"><span class="adm-dot" /> Сервер не в сети — размер применится, когда он запустится.</template>
          <template v-else-if="sizeApplied"><span class="adm-dot adm-dot--ok" /> На сервере сейчас: до {{ settings.current }} в команде.</template>
          <template v-else-if="settings.team_size != null"><span class="adm-dot adm-dot--warn" /> Сервер ещё на {{ settings.current }} — применит за пару секунд.</template>
          <template v-else><span class="adm-dot adm-dot--ok" /> На сервере сейчас: до {{ settings.current }} в команде (из настроек плагина).</template>
        </div>
      </div>
      <div class="rt-ctl">
        <div class="rt-presets">
          <button
            v-for="n in PRESETS" :key="n" class="rt-preset" :class="{ 'rt-preset--on': teamSize === n }"
            :disabled="!canManage" @click="teamSize = n"
          >{{ n }}</button>
        </div>
        <div class="rt-stepper">
          <button class="adm-btn adm-btn--sm" :disabled="!canManage || teamSize <= 1" @click="teamSize = Math.max(1, teamSize - 1)">−</button>
          <input v-model.number="teamSize" class="adm-input rt-size adm-num" type="number" min="1" max="20" :disabled="!canManage" @keydown.enter="saveSize" />
          <button class="adm-btn adm-btn--sm" :disabled="!canManage || teamSize >= 20" @click="teamSize = Math.min(20, teamSize + 1)">+</button>
          <button v-if="canManage" class="adm-btn adm-btn--acc" :disabled="saving || !sizeDirty" @click="saveSize">{{ saving ? 'Сохраняю…' : 'Сохранить' }}</button>
        </div>
      </div>
    </div>

    <div class="adm-card adm-card--pad">
      <RoyaleGrace :value="settings" @saved="onGraceSaved" />
    </div>

    <div class="adm-card adm-card--pad rt-card">
      <div class="rt-text">
        <div class="rt-h">Награды Void Coins</div>
        <div class="rt-sub">
          Начисляются в конце игры <b>только в общем режиме</b>. Void Coins — валюта аккаунта, переживает выход игрока.
          Нужен аккаунт (игрок зашёл через портал Origins). 0 — награда выключена.
        </div>
        <div class="rt-state">
          <span class="adm-dot" :class="{ 'adm-dot--ok': rewardsEnabled }" />
          {{ rewardsEnabled ? 'Награды включены' : 'Награды выключены' }}
        </div>
      </div>
      <div class="rt-ctl">
        <label class="rt-check"><input v-model="rewardsEnabled" type="checkbox" :disabled="!canManage"> Включить награды</label>
        <div class="rt-rewards">
          <label>Победа<input v-model.number="coinsWin" type="number" min="0" class="adm-input adm-num" :disabled="!canManage"></label>
          <label>За килл<input v-model.number="coinsKill" type="number" min="0" class="adm-input adm-num" :disabled="!canManage"></label>
          <label>2 место<input v-model.number="coins2" type="number" min="0" class="adm-input adm-num" :disabled="!canManage"></label>
          <label>3 место<input v-model.number="coins3" type="number" min="0" class="adm-input adm-num" :disabled="!canManage"></label>
        </div>
        <button v-if="canManage" class="adm-btn adm-btn--acc" :disabled="savingRewards" @click="saveRewards">{{ savingRewards ? 'Сохраняю…' : 'Сохранить' }}</button>
      </div>
    </div>

    <div class="adm-card adm-card--pad rt-card">
      <div class="rt-text">
        <div class="rt-h">Карта следующей игры</div>
        <div class="rt-sub">Арена копируется заново к каждой игре. Смена карты действует со следующего старта.</div>
        <div class="rt-state">
          <template v-if="!settings.online"><span class="adm-dot" /> Сервер не в сети.</template>
          <template v-else><span class="adm-dot adm-dot--ok" /> Сейчас: {{ settings.map || '—' }}</template>
        </div>
      </div>
      <div class="rt-ctl">
        <div class="rt-stepper">
          <select v-model="mapChoice" class="adm-select rt-map" :disabled="!canManage || !settings.maps?.length">
            <option v-for="m in settings.maps" :key="m" :value="m">{{ m }}</option>
          </select>
          <button v-if="canManage" class="adm-btn adm-btn--acc" :disabled="savingMap || !mapChoice || mapChoice === settings.map" @click="saveMap">
            {{ savingMap ? 'Меняю…' : 'Выбрать' }}
          </button>
        </div>
        <div v-if="settings.online && (settings.maps || []).length <= 1" class="rt-sub">На сервере одна карта.</div>
      </div>
    </div>

    <div v-if="!canManage" class="rt-sub">Менять настройки может тот, у кого есть право «Королевская битва: удалять тестовые матчи, менять размер команд и карту».</div>
  </div>
</template>

<style scoped>
.rt { display: flex; flex-direction: column; gap: 16px; max-width: 1000px; }
.rt .rt-card { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 18px 28px; align-items: center;
  background: #0e0e13; border: 1px solid rgba(255,255,255,.07); border-radius: 20px; padding: 22px 24px; }
@media (max-width: 760px) { .rt .rt-card { grid-template-columns: 1fr; } }
.rt-h { font-weight: 800; font-size: 1.05rem; color: var(--adm-text, #fff); }
.rt-sub { font-size: 13px; color: #8a8a96; margin-top: 5px; line-height: 1.55; }
.rt-state { display: flex; gap: 8px; align-items: center; font-size: 13px; color: #c7c7d1; margin-top: 12px; }
.rt-ctl { display: flex; flex-direction: column; gap: 12px; align-items: flex-end; }
@media (max-width: 760px) { .rt-ctl { align-items: stretch; } }
.rt-presets { display: flex; gap: 7px; }
.rt-preset { min-width: 2.5rem; height: 2.5rem; padding: 0 2px; border-radius: 12px; border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.04); color: #b8b8c2; font-weight: 800; font-size: 1rem; cursor: pointer; transition: all .14s; }
.rt-preset:hover:not(:disabled) { background: rgba(255,255,255,.1); color: #fff; }
.rt-preset--on { border-color: transparent; background: linear-gradient(135deg, #ff8a3d, #ff5a9e); color: #1a0f08; box-shadow: 0 4px 14px rgba(255,90,120,.25); }
.rt-stepper { display: flex; gap: 7px; align-items: center; }
.rt-size { width: 4.6rem; height: 2.5rem; text-align: center; font-weight: 800; border-radius: 12px; }
.rt-map { min-width: 200px; border-radius: 12px; }
.rt-mode { width: auto; padding: 0 20px; }
.rt-check { display: flex; gap: 9px; align-items: center; font-weight: 700; cursor: pointer; }
.rt-rewards { display: flex; flex-wrap: wrap; gap: 12px; }
.rt-rewards label { display: flex; flex-direction: column; gap: 4px; font-size: 0.78rem; color: #8a8a96; }
.rt-rewards .adm-num { width: 5rem; height: 2.4rem; text-align: center; font-weight: 800; border-radius: 10px; }
.rt :deep(.adm-btn--acc) { border-radius: 999px; border-color: transparent; background: linear-gradient(135deg, #ff8a3d, #ff5a9e); color: #1a0f08; font-weight: 700; padding: 0 18px; }
.rt :deep(.adm-btn--acc:hover) { filter: brightness(1.07); }
</style>
