<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import '../assets/gui-premium.css'
import { getMyQuests, setWebguiToken, runGameCommand } from '../services/gameUiApi.js'
import { useWebGuiToken, closeGui, useActionToast } from '../composables/useWebGui.js'
import GameUiSidebar from '../components/GameUiSidebar.vue'
import GameUiStarfield from '../components/GameUiStarfield.vue'
import GameUiTopBar from '../components/GameUiTopBar.vue'
import GuiIcon from '../components/GuiIcon.vue'

const { t } = useI18n()
const token = useWebGuiToken()
setWebguiToken(token)
const { toast, show } = useActionToast()

const loading = ref(true)
const snapshot = ref(null)
const error = ref(null)
const claiming = ref(null)
const opening = ref(null)
const filter = ref('available')
const selectedIdx = ref(null)

const otherQuests = [
  { key: 'hard',     icon: 'swords',  cmd: 'bossquest' },
  { key: 'delivery', icon: 'package', cmd: 'delivery' },
]

const daily = computed(() => snapshot.value?.daily || [])
const filtered = computed(() => {
  if (filter.value === 'progress') return daily.value.filter(q => !q.claimed && q.progress < q.required)
  if (filter.value === 'done') return daily.value.filter(q => q.claimed)
  return daily.value.filter(q => !q.claimed) // available (incl. ready-to-claim)
})
const selected = computed(() => daily.value.find(q => q.index === selectedIdx.value) || filtered.value[0] || null)

watch(filtered, (f) => {
  if (!f.find(q => q.index === selectedIdx.value)) selectedIdx.value = f[0]?.index ?? null
})

async function load() {
  try {
    snapshot.value = await getMyQuests()
    error.value = null
    if (selectedIdx.value == null) selectedIdx.value = (snapshot.value?.daily || []).find(q => !q.claimed)?.index ?? null
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
onMounted(load)

function money(v) { return Number(v || 0).toLocaleString('ru-RU', { maximumFractionDigits: 0 }) }
function pct(q) { return q.required > 0 ? Math.min(100, Math.round(q.progress / q.required * 100)) : 0 }
// Fill quest-description placeholders ({n}/{count}/{amount}/{required}) with the goal count.
function descOf(q) { return (q.description || '').replace(/\{\s*(n|count|amount|required|goal)\s*\}/gi, q.required ?? '') }
function qState(q) { return q.claimed ? 'done' : (q.progress >= q.required ? 'ready' : 'progress') }

async function claim(q) {
  if (!q || claiming.value || q.claimed || q.progress < q.required) return
  claiming.value = q.index
  try {
    await runGameCommand(`dailyquest claim ${q.index}`)
    show(t('gameUiQuests.claimed'), true)
    setTimeout(load, 1600)
  } catch (e) {
    show(e.message || t('gameUiQuests.claimFail'), false)
  } finally {
    setTimeout(() => { claiming.value = null }, 1600)
  }
}
async function openOther(q) {
  if (opening.value) return
  opening.value = q.key
  try {
    await runGameCommand(q.cmd)
    show(t('gameUiQuests.opening'), true)
    setTimeout(() => closeGui(), 900)
  } catch (e) {
    show(e.message || t('gameUiQuests.openFail'), false)
    opening.value = null
  }
}
</script>

<template>
  <section class="gp-shell">
    <GameUiStarfield />
    <GameUiSidebar current="quests" />
    <GameUiTopBar :title="t('gameUiNav.quests')" />

    <div class="gp-wrap gp-wrap--wide gp-wrap--app">
      <div v-if="!token" class="gp-center"><div class="gp-card gp-state"><span class="gp-state-ico"><GuiIcon name="lock" :size="30" /></span><span class="gp-state-text">{{ t('gameUiQuests.tokenError') }}</span></div></div>
      <div v-else-if="loading" class="qdash gp-grow">
        <div class="gp-panel"><div class="gp-skel gp-skel-row" style="width:35%;height:16px"></div><div v-for="i in 3" :key="i" class="gp-skel" style="height:62px;margin-top:10px"></div></div>
        <div class="gp-panel"><div class="gp-skel" style="height:74px;border-radius:14px"></div><div class="gp-skel" style="height:120px;border-radius:12px;margin-top:12px"></div></div>
      </div>
      <div v-else-if="error" class="gp-center"><div class="gp-card gp-state"><span class="gp-state-ico"><GuiIcon name="alert" :size="30" /></span><span class="gp-state-text">{{ error }}</span></div></div>

      <template v-else>
        <div class="qdash gp-grow">
          <!-- LIST -->
          <div class="gp-panel qlist-panel">
            <div class="gp-phead">
              <span class="gp-phead-ic"><GuiIcon name="quest" :size="16" /></span>
              <span class="gp-phead-tt">{{ t('gameUiQuests.daily') }}</span>
              <span class="gp-phead-sp"></span>
              <div class="gp-seg">
                <button class="gp-seg-btn" :class="{ active: filter==='available' }" @click="filter='available'">{{ t('gameUiQuests.fAvailable') }}</button>
                <button class="gp-seg-btn" :class="{ active: filter==='progress' }" @click="filter='progress'">{{ t('gameUiQuests.fProgress') }}</button>
                <button class="gp-seg-btn" :class="{ active: filter==='done' }" @click="filter='done'">{{ t('gameUiQuests.fDone') }}</button>
              </div>
            </div>

            <div v-if="!filtered.length" class="gp-state" style="padding:32px">
              <span class="gp-state-ico"><GuiIcon name="sunrise" :size="30" /></span><span class="gp-state-text">{{ t('gameUiQuests.noDaily') }}</span>
            </div>
            <div v-else class="qlist gp-scroll gp-stagger">
              <button v-for="q in filtered" :key="q.index" class="qrow" :class="[qState(q), { sel: q.index === (selected && selected.index) }]" @click="selectedIdx = q.index">
                <span class="qrow-ic"><GuiIcon :name="qState(q)==='done' ? 'check' : (qState(q)==='ready' ? 'gift' : 'target')" :size="17" /></span>
                <span class="qrow-main">
                  <span class="qrow-name">{{ q.display_name }}</span>
                  <span class="qrow-track"><span class="qrow-bar"><i :style="{ width: pct(q) + '%' }"></i></span><span class="qrow-prog gp-num">{{ Math.min(q.progress, q.required) }}/{{ q.required }}</span></span>
                </span>
                <span class="qrow-rw gp-num"><GuiIcon name="coins" :size="13" />{{ money(q.money_reward) }}</span>
              </button>
            </div>

            <div class="gp-phead" style="margin-top:6px"><span class="gp-phead-ic"><GuiIcon name="star" :size="16" /></span><span class="gp-phead-tt">{{ t('gameUiQuests.otherTitle') }}</span></div>
            <div class="other-grid">
              <button v-for="q in otherQuests" :key="q.key" class="other" :disabled="!!opening" @click="openOther(q)">
                <span class="other-ic"><GuiIcon :name="q.icon" :size="18" /></span>
                <span class="other-tx"><span class="other-name">{{ t('gameUiQuests.' + q.key) }}</span><span class="other-desc">{{ t('gameUiQuests.' + q.key + 'Desc') }}</span></span>
                <span v-if="opening === q.key" class="gp-spinner" style="width:16px;height:16px;border-width:2px"></span>
                <GuiIcon v-else name="arrowRight" :size="16" class="other-arr" />
              </button>
            </div>
          </div>

          <!-- DETAIL -->
          <div class="gp-panel qdetail" v-if="selected">
            <div class="qd-hero" :class="qState(selected)">
              <span class="qd-badge"><GuiIcon :name="qState(selected)==='done' ? 'check' : 'target'" :size="22" /></span>
              <div class="qd-htext">
                <div class="qd-title">{{ selected.display_name }}</div>
                <div class="qd-kicker">{{ qState(selected)==='done' ? t('gameUiQuests.claimedTag') : (qState(selected)==='ready' ? t('gameUiQuests.claim') : t('gameUiQuests.inProgress')) }}</div>
              </div>
            </div>
            <p v-if="selected.description" class="qd-desc">{{ descOf(selected) }}</p>

            <div class="qd-prog">
              <div class="qd-prog-head"><span>{{ t('gameUiQuests.progress') }}</span><span class="gp-num">{{ Math.min(selected.progress, selected.required) }} / {{ selected.required }}</span></div>
              <div class="gp-track"><div class="gp-fill" :style="{ width: pct(selected) + '%' }"></div></div>
            </div>

            <div class="gp-phead" style="margin-top:2px"><span class="gp-phead-tt">{{ t('gameUiQuests.rewards') }}</span></div>
            <div class="qd-rewards">
              <div class="qd-rw"><GuiIcon name="coins" :size="16" /><span class="qd-rw-val gp-num">{{ money(selected.money_reward) }}</span></div>
              <div v-if="selected.exp_reward" class="qd-rw"><GuiIcon name="sparkles" :size="16" /><span class="qd-rw-val gp-num">{{ money(selected.exp_reward) }} XP</span></div>
            </div>

            <button
              class="gp-btn gp-btn--primary gp-btn--full qd-cta"
              :disabled="selected.claimed || selected.progress < selected.required || claiming === selected.index"
              @click="claim(selected)"
            >
              <span v-if="claiming === selected.index" class="gp-spinner" style="width:15px;height:15px;border-width:2px"></span>
              <template v-else-if="selected.claimed"><GuiIcon name="check" :size="15" />{{ t('gameUiQuests.claimedTag') }}</template>
              <template v-else-if="selected.progress >= selected.required"><GuiIcon name="gift" :size="15" />{{ t('gameUiQuests.claim') }}</template>
              <template v-else><GuiIcon name="clock" :size="15" />{{ t('gameUiQuests.inProgress') }}</template>
            </button>
          </div>
          <div v-else class="gp-panel gp-state"><span class="gp-state-ico"><GuiIcon name="quest" :size="30" /></span><span class="gp-state-text">{{ t('gameUiQuests.selectHint') }}</span></div>
        </div>
      </template>
    </div>

    <transition name="gp-toast">
      <div v-if="toast" class="gp-toast" :class="toast.ok ? 'gp-toast--ok' : 'gp-toast--err'">
        <GuiIcon :name="toast.ok ? 'check' : 'alert'" :size="16" /><span>{{ toast.text }}</span>
      </div>
    </transition>
  </section>
</template>

<style scoped>
.qdash { display: grid; grid-template-columns: minmax(0,1fr) 340px; gap: 16px; align-items: start; }
@media (max-width: 900px) { .qdash { grid-template-columns: 1fr; } }
.qlist { display: flex; flex-direction: column; gap: 8px; max-height: 340px; padding-right: 4px; }
.qrow {
  display: flex; align-items: center; gap: 12px; padding: 13px 14px; cursor: pointer; text-align: left;
  min-height: 62px; flex-shrink: 0;
  border-radius: 13px; border: 1px solid var(--gp-line); background: rgba(255,255,255,0.02);
  color: inherit; font-family: inherit; transition: border-color 0.14s, background 0.14s, transform 0.1s;
}
.qrow:hover { transform: translateY(-1px); }
.qrow:hover { background: rgba(255,255,255,0.045); }
.qrow.sel { border-color: rgba(139,123,255,0.5); background: rgba(139,123,255,0.09); }
.qrow.ready { border-color: rgba(52,211,153,0.35); }
.qrow.done { opacity: 0.55; }
.qrow-ic { width: 36px; height: 36px; flex-shrink: 0; display: grid; place-items: center; border-radius: 10px; color: var(--gp-violet-2); background: rgba(139,123,255,0.12); border: 1px solid rgba(139,123,255,0.24); }
.qrow.ready .qrow-ic { color: #6ee7b7; background: rgba(52,211,153,0.12); border-color: rgba(52,211,153,0.28); }
.qrow.done .qrow-ic { color: #6ee7b7; }
.qrow-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.qrow-name { font-size: 0.88rem; font-weight: 700; color: #eef2ff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.qrow-track { display: flex; align-items: center; gap: 9px; }
.qrow-bar { flex: 1; height: 6px; border-radius: 999px; background: rgba(0,0,0,0.35); overflow: hidden; }
.qrow-bar i { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, #7c6bff, #b45cf0); }
.qrow-prog { font-size: 0.7rem; color: var(--gp-ink-dim); flex-shrink: 0; }
.qrow-rw { display: flex; align-items: center; gap: 5px; font-size: 0.8rem; font-weight: 800; color: var(--gp-gold); flex-shrink: 0; }
.qrow-rw svg { color: var(--gp-gold); }

.other-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
@media (max-width: 560px) { .other-grid { grid-template-columns: 1fr; } }
.other { display: flex; align-items: center; gap: 11px; padding: 12px; cursor: pointer; text-align: left; border-radius: 13px; border: 1px solid var(--gp-line); background: rgba(255,255,255,0.02); color: inherit; font-family: inherit; transition: transform 0.12s, border-color 0.15s; }
.other:hover { transform: translateX(3px); border-color: rgba(139,123,255,0.45); }
.other-ic { width: 38px; height: 38px; flex-shrink: 0; display: grid; place-items: center; border-radius: 11px; color: var(--gp-violet-2); background: rgba(0,0,0,0.28); border: 1px solid var(--gp-line); }
.other-tx { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.other-name { font-size: 0.86rem; font-weight: 800; color: #eef2ff; }
.other-desc { font-size: 0.68rem; line-height: 1.35; color: var(--gp-ink-dim); }
.other-arr { color: var(--gp-ink-dim); flex-shrink: 0; }

/* detail */
.qdetail { align-self: start; position: sticky; top: 74px; gap: 13px; }
.qd-hero { display: flex; align-items: center; gap: 12px; min-height: 74px; padding: 16px; border-radius: 14px; border: 1px solid rgba(139,123,255,0.24); background: linear-gradient(135deg, rgba(139,123,255,0.14), rgba(139,123,255,0.02)); }
.qd-hero.ready { border-color: rgba(52,211,153,0.3); background: linear-gradient(135deg, rgba(52,211,153,0.14), rgba(52,211,153,0.02)); }
.qd-hero.done { opacity: 0.75; }
.qd-badge { width: 44px; height: 44px; flex-shrink: 0; display: grid; place-items: center; border-radius: 12px; color: var(--gp-violet-2); background: rgba(139,123,255,0.16); border: 1px solid rgba(139,123,255,0.3); }
.qd-hero.ready .qd-badge { color: #6ee7b7; background: rgba(52,211,153,0.16); border-color: rgba(52,211,153,0.32); }
.qd-htext { min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 3px; }
.qd-title { font-size: 1rem; font-weight: 800; color: #f2f5ff; line-height: 1.15; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.qd-kicker { font-size: 0.62rem; font-weight: 700; letter-spacing: 0.04em; color: var(--gp-violet-2); line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.qd-hero.ready .qd-kicker { color: #6ee7b7; }
.qd-hero.done .qd-kicker { color: var(--gp-ink-dim); }
.qd-desc { font-size: 0.8rem; line-height: 1.55; color: var(--gp-ink-soft); }
.qd-prog { display: flex; flex-direction: column; gap: 7px; }
.qd-prog-head { display: flex; justify-content: space-between; font-size: 0.76rem; font-weight: 700; color: var(--gp-ink-soft); }
.qd-rewards { display: flex; gap: 10px; }
.qd-rw { flex: 1; display: flex; align-items: center; gap: 8px; padding: 11px 13px; border-radius: 11px; border: 1px solid var(--gp-line); background: rgba(0,0,0,0.2); color: var(--gp-gold); }
.qd-rw-val { font-size: 0.9rem; font-weight: 800; color: #fcd77a; }
.qd-cta { margin-top: 2px; }
</style>
