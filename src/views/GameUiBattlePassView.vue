<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import '../assets/gui-premium.css'
import { getBpTrack, setWebguiToken, runGameCommand, buyBattlepassPremium, getBattlepassQuests } from '../services/gameUiApi.js'
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

const quests = ref(null)
const isFinale = computed(() => track.value && track.value.ends_in_days != null && track.value.ends_in_days <= 7)
const allQuests = computed(() => {
  if (!quests.value) return []
  const free = (quests.value.free || []).map((q) => ({ ...q, premium: false }))
  const prem = (quests.value.premium || []).map((q) => ({ ...q, premium: true }))
  return [...free, ...prem]
})

async function loadQuests() {
  try { quests.value = await getBattlepassQuests() } catch { /* silent */ }
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
  loadQuests()
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
// Random amounts come as a lower bound + *_max; show "от–до".
function amountRange(r) { return r.amount_max ? `${money(r.amount)}–${money(r.amount_max)}` : money(r.amount) }
function countRange(r) { return r.count_max ? `${r.count}–${r.count_max}` : String(r.count) }
function isChoice(r) { return r && r.type === 'choice' }

// Zone gates: levels past a closed gate wait for the epoch.
const firstClosedGate = computed(() => {
  const gates = [...(track.value?.gates || [])].sort((a, b) => a.level - b.level)
  return gates.find((g) => !g.unlocked) || null
})
function gateAfter(level) { return (track.value?.gates || []).find((g) => g.level === level) || null }
function isGated(tier) { return !!firstClosedGate.value && tier.level > firstClosedGate.value.level }
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
  if (isChoice(r)) return t('gameUiBattlepass.choiceShort', { n: r.options?.length || 0 })
  if (r.type === 'money') return amountRange(r)
  if (r.type === 'voidcoin') return amountRange(r)
  if (r.type === 'exp') return `${amountRange(r)} XP`
  return r.count_max ? `×${countRange(r)}` : (r.count > 1 ? `×${r.count}` : '')
}
function isVoidReward(r) { return r && r.type === 'voidcoin' }
// Item texture (vanilla + modded) for item/command rewards; null → use a GuiIcon glyph.
function rewardItemIcon(r) {
  if (!r) return null
  if (r.icon && (r.type === 'item' || r.type === 'command' || r.type === 'choice')) return r.icon
  if (r.type === 'item' && r.material) return `minecraft:${String(r.material).toLowerCase()}`
  return null
}
// Hover tooltip: what the reward gives.
function rewardTip(r) {
  if (!r) return ''
  if (isChoice(r)) return `${r.display_name || t('gameUiBattlepass.choice')}: ${(r.options || []).map(rewardTip).join(' / ')}`
  if (r.type === 'money') return `${amountRange(r)} ${t('gameUiBattlepass.coins')}`
  if (r.type === 'voidcoin') return `${amountRange(r)} Void Coin`
  if (r.type === 'exp') return `${amountRange(r)} XP`
  const name = (r.display_name || t('gameUiBattlepass.reward')).replace(/\s*×\s*[\d–-]+$/, '')
  if (r.count_max) return `${name} ×${countRange(r)}`
  return r.display_name || (r.count > 1 ? `×${r.count}` : t('gameUiBattlepass.reward'))
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
  if (isGated(tier)) return 'gated'
  const reached = tier.level <= (track.value?.level || 0)
  if (premiumTrack && !track.value?.has_premium) return 'premlock'
  if (reached) return 'ready'
  return 'locked'
}

// Choice rewards: pick a variant first, then claim with its index.
const picker = ref(null)
function closePicker() { picker.value = null }

async function claim(tier, premiumTrack, option = null) {
  const reward = premiumTrack ? tier.premium : tier.free
  if (isChoice(reward) && option == null) {
    picker.value = { tier, premiumTrack, reward }
    return
  }
  picker.value = null
  const key = `${premiumTrack ? 'p' : 'f'}${tier.level}`
  if (claiming.value) return
  claiming.value = key
  try {
    await runGameCommand(`bp claim ${premiumTrack ? 'premium' : 'free'} ${tier.level}${option != null ? ' ' + option : ''}`)
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

        <!-- Season finale banner -->
        <div v-if="isFinale" class="bp-finale">
          <span class="bp-finale-ic">🔥</span>
          <div class="bp-finale-txt">
            <div class="bp-finale-h">{{ t('gameUiBattlepass.finaleTitle') }}</div>
            <div class="bp-finale-s">{{ t('gameUiBattlepass.finaleSub', { n: track.ends_in_days }) }}</div>
          </div>
          <span class="bp-finale-x2">×2 XP</span>
        </div>

        <!-- Daily quests -->
        <div v-if="allQuests.length" class="bp-quests gp-card">
          <div class="bp-quests-head"><GuiIcon name="quest" :size="16" /><span>{{ t('gameUiBattlepass.questsTitle') }}</span><span class="bp-quests-note">{{ t('gameUiBattlepass.questsNote') }}</span></div>
          <div class="bp-quests-grid">
            <div v-for="q in allQuests" :key="(q.premium ? 'p' : 'f') + q.id" class="bp-quest" :class="{ done: q.completed, prem: q.premium, lock: q.premium && !track.has_premium }">
              <div class="bp-quest-top">
                <span class="bp-quest-name">{{ q.name }}<span v-if="q.premium" class="bp-quest-badge"><GuiIcon name="crown" :size="10" /></span></span>
                <span class="bp-quest-xp">+{{ money(q.xp) }} XP</span>
              </div>
              <div v-if="q.description" class="bp-quest-desc">{{ q.description }}</div>
              <div class="bp-quest-bar"><div class="bp-quest-fill" :class="{ full: q.completed }" :style="{ width: Math.min(100, Math.round(q.progress / Math.max(1, q.required) * 100)) + '%' }"></div></div>
              <div class="bp-quest-prog">
                <span v-if="q.completed" class="bp-quest-ok">✓ {{ t('gameUiBattlepass.questDone') }}</span>
                <span v-else>{{ money(q.progress) }} / {{ money(q.required) }}</span>
                <span v-if="q.premium && !track.has_premium" class="bp-quest-locktxt">🔒 {{ t('gameUiBattlepass.premiumShort') }}</span>
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
              <template v-for="tier in track.levels" :key="tier.level">
              <div class="tier">
                <div class="cell" :class="cellState(tier, false)" @mouseenter="showTip($event, tier.free)" @mouseleave="hideTip">
                  <template v-if="tier.free">
                    <div class="cell-ico">
                      <ItemIcon v-if="rewardItemIcon(tier.free)" :itemKey="rewardItemIcon(tier.free)" :size="34" />
                      <GuiIcon v-else :name="rewardIcon(tier.free)" :size="30" class="cell-gi" />
                    </div>
                    <div class="cell-amt gp-num">{{ rewardAmount(tier.free) }}</div>
                    <div class="cell-foot">
                      <span v-if="cellState(tier,false)==='claimed'" class="ok"><GuiIcon name="check" :size="14" /></span>
                      <span v-else-if="cellState(tier,false)==='locked' || cellState(tier,false)==='gated'" class="lock"><GuiIcon name="lock" :size="13" /></span>
                      <button v-else-if="cellState(tier,false)==='ready'" class="claim-btn" :disabled="claiming===`f${tier.level}`" @click="claim(tier,false)">
                        {{ claiming===`f${tier.level}` ? '…' : (isChoice(tier.free) ? t('gameUiBattlepass.pick') : t('gameUiBattlepass.take')) }}
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
                      <span v-else-if="cellState(tier,true)==='premlock' || cellState(tier,true)==='locked' || cellState(tier,true)==='gated'" class="lock"><GuiIcon name="lock" :size="13" /></span>
                      <button v-else-if="cellState(tier,true)==='ready'" class="claim-btn gold" :disabled="claiming===`p${tier.level}`" @click="claim(tier,true)">
                        {{ claiming===`p${tier.level}` ? '…' : (isChoice(tier.premium) ? t('gameUiBattlepass.pick') : t('gameUiBattlepass.take')) }}
                      </button>
                    </div>
                  </template>
                </div>
              </div>
              <div v-if="gateAfter(tier.level) && tier.level < track.levels[track.levels.length - 1].level" class="zone-gate" :class="{ open: gateAfter(tier.level).unlocked }">
                <GuiIcon :name="gateAfter(tier.level).unlocked ? 'check' : 'lock'" :size="16" />
                <span class="zone-gate-lbl">{{ gateAfter(tier.level).unlocked ? t('gameUiBattlepass.zoneOpen') : t('gameUiBattlepass.zoneNeeds') }}</span>
                <span class="zone-gate-tier">{{ gateAfter(tier.level).label }}</span>
              </div>
              </template>
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

    <!-- choice picker -->
    <transition name="gp-toast">
      <div v-if="picker" class="bp-pick-back" @click.self="closePicker">
        <div class="bp-pick gp-card">
          <div class="bp-pick-head">
            <span class="bp-pick-title">{{ picker.reward.display_name || t('gameUiBattlepass.choice') }}</span>
            <span class="bp-pick-lvl">{{ t('gameUiBattlepass.level') }} {{ picker.tier.level }}</span>
          </div>
          <div class="bp-pick-hint">{{ t('gameUiBattlepass.pickHint') }}</div>
          <div class="bp-pick-grid">
            <button v-for="(o, i) in picker.reward.options" :key="i" class="bp-pick-opt" :class="{ gold: picker.premiumTrack }" @click="claim(picker.tier, picker.premiumTrack, i)">
              <span class="cell-ico">
                <ItemIcon v-if="rewardItemIcon(o)" :itemKey="rewardItemIcon(o)" :size="34" />
                <GuiIcon v-else :name="rewardIcon(o)" :size="30" class="cell-gi" />
              </span>
              <span class="bp-pick-name">{{ rewardTip(o) }}</span>
            </button>
          </div>
          <button class="gp-btn gp-btn--ghost gp-btn--sm" @click="closePicker">{{ t('gameUiBattlepass.cancel') }}</button>
        </div>
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

/* ── zone gates ── */
.cell.gated { opacity: 0.42; filter: grayscale(0.6); }
.zone-gate {
  flex-shrink: 0; width: 86px; align-self: stretch; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
  border-radius: 14px; padding: 8px; text-align: center; scroll-snap-align: start;
  border: 1px dashed rgba(251,191,36,0.55); background: repeating-linear-gradient(135deg, rgba(251,191,36,0.08) 0 8px, transparent 8px 16px);
  color: #fbbf24;
}
.zone-gate.open { border-color: rgba(52,211,153,0.5); background: rgba(52,211,153,0.06); color: var(--gp-green); }
.zone-gate-lbl { font-size: 0.6rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: var(--gp-ink-soft); }
.zone-gate-tier { font-size: 0.72rem; font-weight: 800; line-height: 1.15; }

/* ── choice picker ── */
.bp-pick-back { position: fixed; inset: 0; z-index: 80; display: grid; place-items: center; padding: 16px; background: rgba(6,8,16,0.72); }
.bp-pick { width: min(560px, 100%); display: flex; flex-direction: column; gap: 12px; padding: 18px; }
.bp-pick-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.bp-pick-title { font-size: 1.05rem; font-weight: 900; color: #f4f7ff; }
.bp-pick-lvl { font-size: 0.74rem; font-weight: 800; color: var(--gp-ink-soft); }
.bp-pick-hint { font-size: 0.76rem; color: var(--gp-ink-dim); }
.bp-pick-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
.bp-pick-opt {
  display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px 10px; border-radius: 12px; cursor: pointer;
  font-family: inherit; color: #eef2ff; border: 1px solid rgba(52,211,153,0.35); background: rgba(52,211,153,0.06);
  transition: border-color .15s, background .15s, transform .1s;
}
.bp-pick-opt:hover { border-color: rgba(52,211,153,0.7); background: rgba(52,211,153,0.12); }
.bp-pick-opt.gold { border-color: rgba(251,191,36,0.35); background: rgba(251,191,36,0.06); }
.bp-pick-opt.gold:hover { border-color: rgba(251,191,36,0.7); background: rgba(251,191,36,0.12); }
.bp-pick-opt:active { transform: scale(0.97); }
.bp-pick-name { font-size: 0.76rem; font-weight: 700; text-align: center; line-height: 1.25; }

/* ── season finale banner ── */
.bp-finale { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; padding: 12px 16px; border-radius: 14px;
  background: linear-gradient(120deg, rgba(251,113,60,0.18), rgba(251,191,36,0.12)); border: 1px solid rgba(251,146,60,0.5); box-shadow: 0 0 24px -8px rgba(251,146,60,0.6); }
.bp-finale-ic { font-size: 1.6rem; animation: bp-bob 1.4s ease-in-out infinite; }
@keyframes bp-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-3px) } }
.bp-finale-txt { flex: 1; min-width: 0; }
.bp-finale-h { font-size: 0.98rem; font-weight: 900; color: #fdba74; text-transform: uppercase; letter-spacing: 0.04em; }
.bp-finale-s { font-size: 0.78rem; color: #e7cfae; margin-top: 1px; }
.bp-finale-x2 { font-family: 'JetBrains Mono', monospace; font-size: 1.3rem; font-weight: 800; color: #fff2dc; text-shadow: 0 0 14px rgba(251,146,60,0.7); }

/* ── daily quests ── */
.bp-quests { margin-bottom: 14px; }
.bp-quests-head { display: flex; align-items: center; gap: 8px; font-size: 0.92rem; font-weight: 800; color: #eef2ff; }
.bp-quests-head svg { color: #a78bfa; }
.bp-quests-note { margin-left: auto; font-size: 0.7rem; font-weight: 600; color: var(--gp-ink-dim); }
.bp-quests-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px; margin-top: 12px; }
.bp-quest { padding: 11px 13px; border-radius: 12px; background: rgba(255,255,255,0.02); border: 1px solid var(--gp-line); }
.bp-quest.prem { border-color: rgba(251,191,36,0.35); background: rgba(251,191,36,0.05); }
.bp-quest.done { border-color: rgba(52,211,153,0.45); background: rgba(52,211,153,0.06); }
.bp-quest.lock { opacity: 0.6; }
.bp-quest-top { display: flex; align-items: baseline; gap: 8px; }
.bp-quest-name { flex: 1; min-width: 0; font-size: 0.82rem; font-weight: 800; color: #eef2ff; display: inline-flex; align-items: center; gap: 5px; }
.bp-quest-badge { color: #fbbf24; display: inline-flex; }
.bp-quest-xp { font-size: 0.72rem; font-weight: 800; color: #c4b5fd; white-space: nowrap; }
.bp-quest-desc { font-size: 0.7rem; color: var(--gp-ink-dim); margin-top: 3px; line-height: 1.3; }
.bp-quest-bar { height: 7px; border-radius: 999px; background: rgba(0,0,0,0.32); overflow: hidden; margin-top: 8px; }
.bp-quest-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #7c6bff, #c084fc); transition: width .3s; }
.bp-quest-fill.full { background: linear-gradient(90deg, #34d399, #6ee7b7); }
.bp-quest-prog { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 5px; font-size: 0.7rem; font-weight: 700; color: #aab2cc; }
.bp-quest-ok { color: #34d399; }
.bp-quest-locktxt { color: #fbbf24; font-size: 0.64rem; }
</style>
