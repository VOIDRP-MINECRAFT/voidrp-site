<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import '../assets/gui-premium.css'
import { getBpTrack, setWebguiToken, runGameCommand } from '../services/gameUiApi.js'
import { useWebGuiToken, useActionToast } from '../composables/useWebGui.js'
import GameUiSidebar from '../components/GameUiSidebar.vue'
import GameUiTopBar from '../components/GameUiTopBar.vue'
import GuiIcon from '../components/GuiIcon.vue'
import CountUp from '../components/CountUp.vue'

const { t } = useI18n()
const token = useWebGuiToken()
setWebguiToken(token)
const { toast, show } = useActionToast()

const track = ref(null)
const loading = ref(true)
const error = ref(null)
const claiming = ref('')

async function load() {
  try {
    track.value = await getBpTrack()
    error.value = null
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
onMounted(load)

const xpInLevel = computed(() => track.value ? track.value.xp % (track.value.xp_per_level || 10000) : 0)
const xpPct = computed(() => track.value ? Math.min(100, Math.round(xpInLevel.value / (track.value.xp_per_level || 10000) * 100)) : 0)
const readyCount = computed(() => {
  if (!track.value?.levels) return 0
  let n = 0
  for (const tier of track.value.levels) {
    if (cellState(tier, false) === 'ready') n++
    if (cellState(tier, true) === 'ready') n++
  }
  return n
})

// Let the mouse wheel scroll the horizontal reward track (vertical wheel → sideways).
function onTrackWheel(e) {
  const el = e.currentTarget
  if (el.scrollWidth <= el.clientWidth) return
  const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX
  if (!delta) return
  el.scrollLeft += delta
  e.preventDefault()
}

function money(v) { return Number(v || 0).toLocaleString('ru-RU', { maximumFractionDigits: 0 }) }
function itemIcon(r) {
  if (!r || r.type !== 'item' || !r.material) return null
  const id = String(r.material).toLowerCase().replace('minecraft:', '')
  return `/item-icons/minecraft/${id}.png`
}
function rewardIcon(r) {
  if (!r) return 'gift'
  if (r.type === 'money') return 'coins'
  if (r.type === 'exp') return 'sparkles'
  return 'gift'
}
function rewardAmount(r) {
  if (!r) return ''
  if (r.type === 'money') return money(r.amount)
  if (r.type === 'exp') return `${money(r.amount)} XP`
  return r.count > 1 ? `×${r.count}` : ''
}
function cellState(tier, premiumTrack) {
  const r = premiumTrack ? tier.premium : tier.free
  if (!r) return 'empty'
  const claimed = premiumTrack ? tier.premium_claimed : tier.free_claimed
  if (claimed) return 'claimed'
  const reached = tier.level <= (track.value?.level || 0)
  if (premiumTrack && !track.value?.has_premium) return 'premlock'
  if (reached) return 'ready'
  return 'locked'
}

async function claim(tier, premiumTrack) {
  const key = `${premiumTrack ? 'p' : 'f'}${tier.level}`
  if (claiming.value) return
  claiming.value = key
  try {
    await runGameCommand(`bp claim ${premiumTrack ? 'premium' : 'free'} ${tier.level}`)
    show(t('gameUiBattlepass.claimed'), true)
    setTimeout(load, 1600)
  } catch (e) {
    show(e.message || t('gameUiBattlepass.claimFail'), false)
  } finally {
    setTimeout(() => { claiming.value = '' }, 1600)
  }
}
</script>

<template>
  <section class="gp-shell">
    <GameUiSidebar current="battlepass" />
    <GameUiTopBar :title="t('gameUiNav.battlepass')" />

    <div class="gp-wrap gp-wrap--wide gp-wrap--app">
      <div v-if="!token" class="gp-center"><div class="gp-card gp-state"><span class="gp-state-ico"><GuiIcon name="lock" :size="30" /></span><span class="gp-state-text">{{ t('gameUiBattlepass.tokenError') }}</span></div></div>
      <div v-else-if="loading" class="gp-center"><span class="gp-spinner"></span></div>
      <div v-else-if="error" class="gp-center"><div class="gp-card gp-state"><span class="gp-state-ico"><GuiIcon name="alert" :size="30" /></span><span class="gp-state-text">{{ error }}</span></div></div>

      <template v-else-if="track">
        <!-- Season header -->
        <div class="bp-hero">
          <div class="bp-hero-bg"></div>
          <div class="bp-hero-in">
            <div class="bp-badge"><span class="bp-badge-lv gp-num"><CountUp :value="track.level" /></span></div>
            <div class="bp-title-col">
              <div class="bp-kicker"><GuiIcon name="battlepass" :size="13" />Battle Pass · {{ track.season || t('gameUiBattlepass.season') + ' 1' }}</div>
              <h1 class="bp-title">{{ t('gameUiBattlepass.title') }}</h1>
              <div v-if="track.ends_in_days != null" class="bp-ends"><GuiIcon name="clock" :size="13" />{{ t('gameUiBattlepass.endsIn') }} <b>{{ track.ends_in_days }} {{ t('gameUiBattlepass.days') }}</b></div>
            </div>
            <div class="bp-prog-col">
              <div class="bp-prog-head">
                <span class="bp-lvl-lbl">{{ t('gameUiBattlepass.level') }} {{ track.level }}</span>
                <span class="gp-num bp-xp"><CountUp :value="xpInLevel" :format="money" /> / {{ money(track.xp_per_level) }} XP</span>
              </div>
              <div class="gp-track" style="height:14px"><div class="gp-fill" :class="{ 'gp-fill--gold': track.has_premium }" :style="{ width: xpPct + '%' }"></div></div>
              <div class="bp-cta-row">
                <span v-if="track.has_premium" class="gp-pill gp-pill--gold"><GuiIcon name="crown" :size="13" />{{ t('gameUiBattlepass.premium') }}</span>
                <button v-else class="gp-btn gp-btn--primary gp-btn--sm" @click="runGameCommand('battlepass')"><GuiIcon name="crown" :size="15" />{{ t('gameUiBattlepass.getPremium') }}</button>
                <button v-if="readyCount" class="gp-btn gp-btn--ghost gp-btn--sm claim-all" disabled><GuiIcon name="gift" :size="14" />{{ t('gameUiBattlepass.claimReady') }} ({{ readyCount }})</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Reward track -->
        <div v-if="!track.levels?.length" class="gp-card gp-state"><span class="gp-state-ico"><GuiIcon name="gift" :size="30" /></span><span class="gp-state-text">{{ t('gameUiBattlepass.noRewards') }}</span></div>

        <div v-else class="gp-panel track-panel gp-grow">
          <div class="track-wrap">
            <div class="track-labels">
              <div class="tl free">{{ t('gameUiBattlepass.free') }}</div>
              <div class="tl-gap"></div>
              <div class="tl prem"><GuiIcon name="crown" :size="14" />{{ t('gameUiBattlepass.premiumShort') }}</div>
            </div>

            <div class="track-scroll" @wheel="onTrackWheel">
              <div v-for="tier in track.levels" :key="tier.level" class="tier">
                <div class="cell" :class="cellState(tier, false)">
                  <template v-if="tier.free">
                    <div class="cell-ico">
                      <img v-if="itemIcon(tier.free)" :src="itemIcon(tier.free)" alt="" @error="$event.target.style.display='none'" />
                      <GuiIcon v-else :name="rewardIcon(tier.free)" :size="30" class="cell-gi" />
                    </div>
                    <div class="cell-amt gp-num">{{ rewardAmount(tier.free) }}</div>
                    <div class="cell-foot">
                      <span v-if="cellState(tier,false)==='claimed'" class="ok"><GuiIcon name="check" :size="14" /></span>
                      <span v-else-if="cellState(tier,false)==='locked'" class="lock"><GuiIcon name="lock" :size="13" /></span>
                      <button v-else-if="cellState(tier,false)==='ready'" class="claim-btn" :disabled="claiming===`f${tier.level}`" @click="claim(tier,false)">
                        {{ claiming===`f${tier.level}` ? '…' : t('gameUiBattlepass.take') }}
                      </button>
                    </div>
                  </template>
                </div>

                <div class="tier-badge" :class="{ reached: tier.level <= track.level, cur: tier.level === track.level }">{{ tier.level }}</div>

                <div class="cell prem-cell" :class="cellState(tier, true)">
                  <template v-if="tier.premium">
                    <div class="cell-ico">
                      <img v-if="itemIcon(tier.premium)" :src="itemIcon(tier.premium)" alt="" @error="$event.target.style.display='none'" />
                      <GuiIcon v-else :name="rewardIcon(tier.premium)" :size="30" class="cell-gi" />
                    </div>
                    <div class="cell-amt gp-num">{{ rewardAmount(tier.premium) }}</div>
                    <div class="cell-foot">
                      <span v-if="cellState(tier,true)==='claimed'" class="ok"><GuiIcon name="check" :size="14" /></span>
                      <span v-else-if="cellState(tier,true)==='premlock' || cellState(tier,true)==='locked'" class="lock"><GuiIcon name="lock" :size="13" /></span>
                      <button v-else-if="cellState(tier,true)==='ready'" class="claim-btn gold" :disabled="claiming===`p${tier.level}`" @click="claim(tier,true)">
                        {{ claiming===`p${tier.level}` ? '…' : t('gameUiBattlepass.take') }}
                      </button>
                    </div>
                  </template>
                </div>
              </div>
            </div>
          </div>
          <div class="track-note"><GuiIcon name="sparkles" :size="14" />{{ t('gameUiBattlepass.premiumNote') }}</div>
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
/* Season header */
.bp-hero { position: relative; overflow: hidden; border-radius: var(--gp-r-xl); border: 1px solid rgba(139,123,255,0.28); }
.bp-hero-bg {
  position: absolute; inset: 0;
  background:
    radial-gradient(600px 300px at 88% -20%, rgba(217,70,239,0.24), transparent 60%),
    radial-gradient(500px 320px at 6% 130%, rgba(139,123,255,0.28), transparent 60%),
    linear-gradient(120deg, rgba(28,20,56,0.92), rgba(14,14,28,0.85));
}
.bp-hero-in { position: relative; display: flex; align-items: center; gap: 22px; padding: 20px 24px; flex-wrap: wrap; }
.bp-badge {
  width: 64px; height: 64px; flex-shrink: 0; display: grid; place-items: center; border-radius: 18px;
  border: 1px solid rgba(139,123,255,0.5); background: radial-gradient(circle, rgba(139,123,255,0.32), rgba(139,123,255,0.06));
  box-shadow: 0 0 30px -6px rgba(139,123,255,0.6);
}
.bp-badge-lv { font-size: 1.9rem; font-weight: 900; color: #e6ddff; }
.bp-title-col { min-width: 0; }
.bp-kicker { display: flex; align-items: center; gap: 6px; font-size: 0.66rem; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: #c4b5fd; }
.bp-title { margin-top: 3px; font-size: 1.7rem; font-weight: 900; color: #f4f7ff; line-height: 1; }
.bp-ends { display: flex; align-items: center; gap: 6px; margin-top: 7px; font-size: 0.78rem; color: var(--gp-ink-soft); }
.bp-ends b { color: var(--gp-gold); }

.bp-prog-col { flex: 1; min-width: 280px; display: flex; flex-direction: column; gap: 9px; }
.bp-prog-head { display: flex; align-items: baseline; justify-content: space-between; }
.bp-lvl-lbl { font-size: 0.86rem; font-weight: 800; color: #eef2ff; }
.bp-xp { font-size: 0.8rem; color: var(--gp-ink-soft); }
.bp-cta-row { display: flex; align-items: center; gap: 10px; margin-top: 2px; }
.claim-all { color: var(--gp-gold); }

/* track */
.track-panel { padding: 18px; justify-content: center; }
.cell-gi { color: var(--gp-violet-2); }
.prem-cell .cell-gi { color: var(--gp-gold); }
.track-wrap { display: grid; grid-template-columns: auto 1fr; gap: 12px; align-items: center; }
.track-labels { display: grid; grid-template-rows: 1fr auto 1fr; height: 100%; }
.tl { display: flex; align-items: center; justify-content: flex-end; gap: 6px; font-size: 0.72rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; padding-right: 6px; min-height: 116px; }
.tl.free { color: var(--gp-ink-soft); }
.tl.prem { color: var(--gp-gold); }
.tl-gap { height: 34px; }

.track-scroll { display: flex; gap: 10px; overflow-x: auto; padding: 4px 2px 12px; scroll-snap-type: x proximity; }
.track-scroll::-webkit-scrollbar { height: 8px; }
.track-scroll::-webkit-scrollbar-thumb { background: rgba(139,123,255,0.3); border-radius: 4px; }
.tier { flex-shrink: 0; width: 104px; display: grid; grid-template-rows: 1fr auto 1fr; scroll-snap-align: start; }

.cell {
  height: 116px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
  border-radius: 14px; padding: 8px; border: 1px solid var(--gp-line); background: rgba(255,255,255,0.03);
  transition: border-color 0.15s, background 0.15s;
}
.cell.empty { opacity: 0.28; }
.cell.ready { border-color: rgba(52,211,153,0.5); background: rgba(52,211,153,0.08); box-shadow: 0 0 0 1px rgba(52,211,153,0.15); }
.cell.claimed { opacity: 0.6; border-color: rgba(52,211,153,0.3); }
.cell.premlock { opacity: 0.5; }
.prem-cell { background: linear-gradient(180deg, rgba(251,191,36,0.05), rgba(255,255,255,0.01)); border-color: rgba(251,191,36,0.18); }
.prem-cell.ready { border-color: rgba(251,191,36,0.5); background: rgba(251,191,36,0.1); box-shadow: 0 0 0 1px rgba(251,191,36,0.2); }
.prem-cell.locked, .prem-cell.premlock { border-color: rgba(251,191,36,0.14); }

.cell-ico { width: 44px; height: 44px; display: grid; place-items: center; }
.cell-ico img { width: 42px; height: 42px; image-rendering: pixelated; filter: drop-shadow(0 3px 5px rgba(0,0,0,0.5)); }
.cell-emoji { font-size: 1.9rem; }
.cell-amt { font-size: 0.82rem; font-weight: 800; color: #eef2ff; }
.cell-foot { min-height: 20px; display: flex; align-items: center; }
.ok { color: var(--gp-green); display: grid; place-items: center; }
.lock { opacity: 0.6; color: var(--gp-ink-soft); display: grid; place-items: center; }
.claim-btn { padding: 3px 12px; border-radius: 8px; border: none; font-family: inherit; font-size: 0.72rem; font-weight: 800; color: #fff; cursor: pointer; background: linear-gradient(135deg, #16a34a, #22c55e); }
.claim-btn.gold { background: linear-gradient(135deg, #d97706, #fbbf24); color: #1a1200; }
.claim-btn:active { transform: scale(0.95); }

.tier-badge {
  align-self: center; justify-self: center; width: 30px; height: 30px; margin: 4px 0;
  display: grid; place-items: center; border-radius: 9px;
  font-family: 'JetBrains Mono', monospace; font-size: 0.82rem; font-weight: 800;
  color: var(--gp-ink-dim); background: rgba(0,0,0,0.3); border: 1px solid var(--gp-line);
}
.tier-badge.reached { color: #fff; background: linear-gradient(135deg, #7c6bff, #b45cf0); border-color: transparent; }
.tier-badge.cur { animation: gp-pulse 2.2s ease-in-out infinite; }

.track-note { display: flex; align-items: center; gap: 7px; margin-top: 12px; font-size: 0.76rem; color: var(--gp-ink-dim); }
.track-note svg { color: var(--gp-gold); }
</style>
