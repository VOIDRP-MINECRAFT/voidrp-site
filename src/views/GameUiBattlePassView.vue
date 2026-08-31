<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import '../assets/gui-premium.css'
import { getBpTrack, setWebguiToken, runGameCommand, buyBattlepassPremium } from '../services/gameUiApi.js'
import { useWebGuiToken, useActionToast } from '../composables/useWebGui.js'
import { setVoidCoins } from '../composables/useCurrency.js'
import { prestigeColor } from '../composables/usePrestige.js'
import { toastSuccess, toastError } from '../services/toast'
import GameUiSidebar from '../components/GameUiSidebar.vue'
import GameUiStarfield from '../components/GameUiStarfield.vue'
import GameUiTopBar from '../components/GameUiTopBar.vue'
import GuiIcon from '../components/GuiIcon.vue'
import ItemIcon from '../components/ItemIcon.vue'
import CountUp from '../components/CountUp.vue'

const { t } = useI18n()
const token = useWebGuiToken()
setWebguiToken(token)
const { toast, show } = useActionToast()

const track = ref(null)
const loading = ref(true)
const error = ref(null)
const claiming = ref('')
const PREMIUM_VC_PRICE = 2000
const buying = ref(false)

async function buyPremium() {
  if (buying.value) return
  buying.value = true
  try {
    const res = await buyBattlepassPremium()
    setVoidCoins(res.new_void_coins)
    if (track.value) track.value.has_premium = true   // optimistic; plugin re-syncs the track shortly
    toastSuccess(t('gameUiBattlepass.premiumBought', { n: res.days }))
  } catch (e) {
    toastError(e?.message || 'Ошибка')
  } finally {
    buying.value = false
  }
}

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
  if (r.type === 'voidcoin') return 'voidcoin'
  if (r.type === 'exp') return 'sparkles'
  return 'gift'
}
function rewardAmount(r) {
  if (!r) return ''
  if (r.type === 'money') return money(r.amount)
  if (r.type === 'voidcoin') return money(r.amount)
  if (r.type === 'exp') return `${money(r.amount)} XP`
  return r.count > 1 ? `×${r.count}` : ''
}
function isVoidReward(r) { return r && r.type === 'voidcoin' }
// Item texture (vanilla + modded) for item/command rewards; null → use a GuiIcon glyph.
function rewardItemIcon(r) {
  if (!r) return null
  if (r.icon && (r.type === 'item' || r.type === 'command')) return r.icon
  if (r.type === 'item' && r.material) return `minecraft:${String(r.material).toLowerCase()}`
  return null
}
// Hover tooltip: what the reward gives.
function rewardTip(r) {
  if (!r) return ''
  if (r.type === 'money') return `${money(r.amount)} монет`
  if (r.type === 'voidcoin') return `${money(r.amount)} Void Coin`
  if (r.type === 'exp') return `${money(r.amount)} XP`
  return r.display_name || (r.count > 1 ? `×${r.count}` : 'Награда')
}
const tip = ref({ show: false, x: 0, y: 0, text: '', void: false })
function showTip(e, r) {
  if (!r) return
  const rc = e.currentTarget.getBoundingClientRect()
  tip.value = { show: true, x: rc.left + rc.width / 2, y: rc.top, text: rewardTip(r), void: isVoidReward(r) }
}
function hideTip() { tip.value = { ...tip.value, show: false } }
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
    <GameUiStarfield />
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
                <span class="bp-lvl-lbl">{{ t('gameUiBattlepass.level') }} {{ track.level }}<span v-if="track.prestige > 0" class="bp-prestige" :style="{ color: prestigeColor(track.prestige), borderColor: prestigeColor(track.prestige) }">✦ {{ t('gameUiBattlepass.prestige') }} {{ track.prestige }}</span></span>
                <span class="gp-num bp-xp"><CountUp :value="xpInLevel" :format="money" /> / {{ money(track.xp_per_level) }} XP</span>
              </div>
              <div class="gp-track" style="height:14px"><div class="gp-fill" :class="{ 'gp-fill--gold': track.has_premium }" :style="{ width: xpPct + '%' }"></div></div>
              <div class="bp-cta-row">
                <span v-if="track.has_premium" class="gp-pill gp-pill--gold"><GuiIcon name="crown" :size="13" />{{ t('gameUiBattlepass.premium') }}</span>
                <button class="gp-btn gp-btn--primary gp-btn--sm bp-buy" :disabled="buying" @click="buyPremium">
                  <GuiIcon name="crown" :size="15" />
                  {{ track.has_premium ? t('gameUiBattlepass.extendPremiumVc', { n: money(PREMIUM_VC_PRICE) }) : t('gameUiBattlepass.buyPremiumVc', { n: money(PREMIUM_VC_PRICE) }) }}
                </button>
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
                <div class="cell" :class="cellState(tier, false)" @mouseenter="showTip($event, tier.free)" @mouseleave="hideTip">
                  <template v-if="tier.free">
                    <div class="cell-ico">
                      <ItemIcon v-if="rewardItemIcon(tier.free)" :itemKey="rewardItemIcon(tier.free)" :size="34" />
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

                <div class="cell prem-cell" :class="[cellState(tier, true), { void: isVoidReward(tier.premium) }]" @mouseenter="showTip($event, tier.premium)" @mouseleave="hideTip">
                  <template v-if="tier.premium">
                    <div class="cell-ico">
                      <ItemIcon v-if="rewardItemIcon(tier.premium)" :itemKey="rewardItemIcon(tier.premium)" :size="34" />
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

    <!-- reward hover tooltip -->
    <div v-if="tip.show" class="bp-tip" :class="{ void: tip.void }" :style="{ left: tip.x + 'px', top: tip.y + 'px' }">{{ tip.text }}</div>
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
  position: relative; overflow: hidden;
  width: 64px; height: 64px; flex-shrink: 0; display: grid; place-items: center; border-radius: 18px;
  border: 1px solid rgba(139,123,255,0.5); background: radial-gradient(circle, rgba(139,123,255,0.32), rgba(139,123,255,0.06));
  box-shadow: 0 0 30px -6px rgba(139,123,255,0.6);
}
.bp-badge::after {
  content: ''; position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(115deg, transparent 38%, rgba(255,255,255,0.35) 47%, rgba(198,148,255,0.42) 52%, transparent 63%);
  transform: translateX(-130%); animation: gp-enchant 3.4s ease-in-out infinite;
}
.bp-badge-lv { font-family: 'Silkscreen', 'JetBrains Mono', monospace; font-size: 1.5rem; font-weight: 700; color: #e6ddff; text-shadow: 0 2px 0 rgba(0,0,0,0.4); }
.bp-title-col { min-width: 0; }
.bp-kicker { display: flex; align-items: center; gap: 6px; font-size: 0.66rem; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: #c4b5fd; }
.bp-title { margin-top: 3px; font-size: 1.7rem; font-weight: 900; color: #f4f7ff; line-height: 1; }
.bp-ends { display: flex; align-items: center; gap: 6px; margin-top: 7px; font-size: 0.78rem; color: var(--gp-ink-soft); }
.bp-ends b { color: var(--gp-gold); }

.bp-prog-col { flex: 1; min-width: 280px; display: flex; flex-direction: column; gap: 9px; }
.bp-prog-head { display: flex; align-items: baseline; justify-content: space-between; }
.bp-lvl-lbl { font-size: 0.86rem; font-weight: 800; color: #eef2ff; }
.bp-prestige { margin-left: 8px; font-size: 0.68rem; font-weight: 900; letter-spacing: 0.04em; color: #d8ccff; padding: 1px 8px; border-radius: 999px; background: linear-gradient(135deg, rgba(139,123,255,0.22), rgba(180,92,240,0.16)); border: 1px solid rgba(167,139,250,0.5); }
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
.bp-tip {
  position: fixed; z-index: 90; transform: translate(-50%, calc(-100% - 9px));
  max-width: 220px; padding: 7px 11px; border-radius: 10px; text-align: center;
  font-size: 0.78rem; font-weight: 700; color: #eef2ff; white-space: nowrap;
  background: rgba(16,18,32,0.98); border: 1px solid rgba(150,168,220,0.22);
  box-shadow: 0 12px 30px -12px rgba(0,0,0,0.85); pointer-events: none;
}
.bp-tip::after { content: ''; position: absolute; left: 50%; top: 100%; transform: translateX(-50%); border: 6px solid transparent; border-top-color: rgba(16,18,32,0.98); }
.bp-tip.void { border-color: rgba(167,139,250,0.5); color: #d8ccff; }
.cell.void { border-color: rgba(167,139,250,0.5); background: linear-gradient(160deg, rgba(139,123,255,0.16), rgba(180,92,240,0.08)); box-shadow: inset 0 0 16px rgba(139,123,255,0.14); }
.cell.void .cell-gi { color: #c4b5fd; filter: drop-shadow(0 0 5px rgba(167,139,250,0.7)); }
.cell.void .cell-amt { color: #d8ccff; }
.cell.ready { border-color: rgba(52,211,153,0.5); background: rgba(52,211,153,0.08); box-shadow: 0 0 0 1px rgba(52,211,153,0.15); }
.cell.claimed { opacity: 0.6; border-color: rgba(52,211,153,0.3); }
.cell.premlock { opacity: 0.5; }
.prem-cell { background: linear-gradient(180deg, rgba(251,191,36,0.05), rgba(255,255,255,0.01)); border-color: rgba(251,191,36,0.18); }
.prem-cell.ready { border-color: rgba(251,191,36,0.5); background: rgba(251,191,36,0.1); box-shadow: 0 0 0 1px rgba(251,191,36,0.2); }
.prem-cell.locked, .prem-cell.premlock { border-color: rgba(251,191,36,0.14); }

.cell-ico { position: relative; overflow: hidden; width: 44px; height: 44px; border-radius: 10px; display: grid; place-items: center; }
.cell-ico img { width: 42px; height: 42px; image-rendering: pixelated; filter: drop-shadow(0 3px 5px rgba(0,0,0,0.5)); transition: transform 0.2s; }
.cell.ready .cell-ico img { animation: bp-bob 2.4s ease-in-out infinite; }
@keyframes bp-bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
/* premium rewards get the Minecraft enchant glint */
.prem-cell .cell-ico::after {
  content: ''; position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(115deg, transparent 38%, rgba(255,255,255,0.34) 47%, rgba(251,191,36,0.4) 52%, transparent 63%);
  transform: translateX(-130%); animation: gp-enchant 3s ease-in-out infinite;
}
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
  font-family: 'Silkscreen', 'JetBrains Mono', monospace; font-size: 0.62rem; font-weight: 700;
  color: var(--gp-ink-dim); background: rgba(0,0,0,0.3); border: 1px solid var(--gp-line);
}
.tier-badge.reached { color: #fff; background: linear-gradient(135deg, #7c6bff, #b45cf0); border-color: transparent; }
.tier-badge.cur { animation: gp-pulse 2.2s ease-in-out infinite; }

.track-note { display: flex; align-items: center; gap: 7px; margin-top: 12px; font-size: 0.76rem; color: var(--gp-ink-dim); }
.track-note svg { color: var(--gp-gold); }
</style>
