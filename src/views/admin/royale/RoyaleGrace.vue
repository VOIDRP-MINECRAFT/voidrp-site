<script setup>
// «Время без драк»: the no-fight seconds at a game's start. Saved in the backend; the plugin
// takes it within ~2 s, and changes a running game at once (the time already passed stays, the
// rest jumps to the new total). Used on the host panel (compact, with the live countdown) and
// in settings. The number is minutes with 30-second steps — plenty for a kids' event.
import { computed, ref, watch } from 'vue'
import { authState, hasPermission } from '../../../stores/authStore'
import { toastError, toastSuccess } from '../../../services/toast'
import { royaleSaveSettings } from '../../../services/royaleAdminApi'
import { clock, mmss } from './royaleUi'

const props = defineProps({
  // The /admin/royale/settings answer (settings tab) or the live state (panel).
  value: { type: Object, default: null },
  compact: { type: Boolean, default: false },
})
const emit = defineEmits(['saved'])

const token = () => authState.accessToken
const canSet = computed(() => hasPermission('royale.control') || hasPermission('royale.manage'))

// On the panel the live state gives `grace` (configured) and `grace_left` (running countdown);
// on the settings tab the settings answer gives `grace` (saved) and `current_grace` (on server).
const configured = computed(() => props.value?.grace ?? props.value?.current_grace ?? 600)
const onServer = computed(() => props.value?.current_grace ?? props.value?.grace ?? null)
const graceLeft = computed(() => props.value?.grace_left ?? null)
const inGame = computed(() => graceLeft.value != null)

const seconds = ref(configured.value)
// Follow the server unless the host is mid-edit (dirty).
watch(configured, (v) => { if (!dirty.value) seconds.value = v })

const dirty = computed(() => seconds.value !== configured.value)
const PRESETS = [0, 60, 120, 180, 300, 540]
const saving = ref(false)
const step = (d) => { seconds.value = Math.min(1800, Math.max(0, seconds.value + d)) }

async function save() {
  const n = Number(seconds.value)
  if (!Number.isInteger(n) || n < 0 || n > 1800) { toastError('Время без драк — от 0 до 30 минут'); return }
  saving.value = true
  try {
    const res = await royaleSaveSettings(token(), { grace: n })
    toastSuccess(inGame.value
      ? `Время без драк — ${mmss(n)}. В игре поменяется через пару секунд.`
      : res.online ? `Время без драк — ${mmss(n)}.` : `Время без драк — ${mmss(n)} (применится на старте).`)
    emit('saved', res)
  } catch (e) {
    toastError(e.message || 'Не удалось сохранить')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="rg" :class="{ 'rg--compact': compact }">
    <div class="rg-text">
      <div class="rg-title">Время без драк</div>
      <div v-if="!compact" class="rg-sub">
        Сколько секунд после высадки нельзя драться и не наносится урон — дети успевают найти оружие и броню.
        Меняется прямо в идущей игре: что уже прошло, остаётся, остаток пересчитывается на новое значение.
      </div>
      <div class="rg-state">
        <template v-if="inGame">
          <span class="adm-dot adm-dot--warn" /> Сейчас в игре без драк ещё <b>{{ clock(graceLeft) }}</b>
          <span class="rg-dim"> · всего {{ mmss(onServer ?? configured) }}</span>
        </template>
        <template v-else-if="onServer != null">
          <span class="adm-dot adm-dot--ok" /> На сервере: {{ mmss(onServer) }} в начале игры
        </template>
        <template v-else>
          <span class="adm-dot" /> Сервер не в сети — применится, когда он запустится
        </template>
      </div>
    </div>
    <div class="rg-ctl">
      <div class="rg-presets">
        <button
          v-for="p in PRESETS" :key="p" class="rg-preset" :class="{ 'rg-preset--on': seconds === p }"
          :disabled="!canSet" @click="seconds = p"
        >{{ p === 0 ? 'сразу' : mmss(p) }}</button>
      </div>
      <div class="rg-stepper">
        <button class="adm-btn adm-btn--sm" :disabled="!canSet || seconds <= 0" title="−30 секунд" @click="step(-30)">−30с</button>
        <span class="rg-value adm-num">{{ clock(seconds) }}</span>
        <button class="adm-btn adm-btn--sm" :disabled="!canSet || seconds >= 1800" title="+30 секунд" @click="step(30)">+30с</button>
        <button v-if="canSet" class="adm-btn" :class="inGame ? 'adm-btn--ok' : 'adm-btn--acc'" :disabled="saving || !dirty" @click="save">
          {{ saving ? '…' : inGame ? 'Применить сейчас' : 'Сохранить' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rg { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 14px 24px; align-items: center; }
@media (max-width: 760px) { .rg { grid-template-columns: 1fr; } }
.rg--compact { gap: 10px 18px; align-items: center; }
.rg-title { font-weight: 800; color: var(--adm-text); font-size: .98rem; }
.rg--compact .rg-title { font-size: .9rem; }
.rg-sub { font-size: 12.5px; color: var(--adm-mut); margin-top: 4px; line-height: 1.5; }
.rg-state { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--adm-text); margin-top: 8px; }
.rg-state b { color: var(--adm-text); }
.rg-dim { color: var(--adm-dim); }
.rg-ctl { display: flex; flex-direction: column; gap: 10px; align-items: flex-end; }
@media (max-width: 760px) { .rg-ctl { align-items: stretch; } }
.rg-presets { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
.rg-preset { padding: 0 .7rem; height: 2.1rem; border-radius: 9px; border: 1px solid var(--adm-line-strong); background: rgba(148, 163, 184, .05); color: var(--adm-mut); font-weight: 700; font-size: .82rem; cursor: pointer; white-space: nowrap; transition: all .15s; }
.rg-preset:hover:not(:disabled) { border-color: var(--adm-acc-line); color: var(--adm-text); }
.rg-preset--on { background: var(--adm-acc-soft); border-color: var(--adm-acc-line); color: var(--adm-acc-text); }
.rg-stepper { display: flex; gap: 6px; align-items: center; }
.rg-value { min-width: 3.4rem; text-align: center; font-weight: 800; font-size: 1.05rem; color: var(--adm-text); }
</style>
