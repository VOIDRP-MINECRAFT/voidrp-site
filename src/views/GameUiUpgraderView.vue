<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import '../assets/gui-premium.css'
import { getUpgraderRewards, spinUpgrader, getUpgraderHistory, getUpgraderRecentWins,
  getUpgraderWinnings, claimUpgraderWinning, sellUpgraderWinning, sellAllUpgraderWinnings,
  claimAllUpgraderWinnings, getUpgraderStats, dailySpinUpgrader, getUpgraderJackpot,
  getUpgraderLeaderboard, getUpgraderFairness, rotateUpgraderFairness, setWebguiToken } from '../services/gameUiApi.js'
import { toastSuccess, toastError } from '../services/toast'
import { API_BASE_URL } from '../services/apiBase'
import { useWebGuiToken } from '../composables/useWebGui.js'
import { setVoidCoins } from '../composables/useCurrency.js'
import GameUiSidebar from '../components/GameUiSidebar.vue'
import GameUiStarfield from '../components/GameUiStarfield.vue'
import GameUiTopBar from '../components/GameUiTopBar.vue'
import GuiIcon from '../components/GuiIcon.vue'
import ItemIcon from '../components/ItemIcon.vue'

const { t } = useI18n()
const token = useWebGuiToken()
setWebguiToken(token)

const loading = ref(true)
const error = ref(null)
const rewards = ref([])
const balance = ref(0)
const rtp = ref(0.9)
const minStake = ref(1)
const maxMult = ref(100)
const maxChance = ref(0.9)

const selected = ref(null)
const stake = ref(1)
const spinning = ref(false)
const result = ref(null)           // { won, reward } after a spin
const history = ref([])

// wheel + fx
const CIRC = 2 * Math.PI * 84
const pointerDeg = ref(0)
const arcVisible = ref(false)
const wheelState = ref('')         // '' | 'spinning' | 'win' | 'lose'
const particles = ref([])
let pid = 0

const TIER_ORDER = ['common', 'rare', 'epic', 'legendary']
const tierColor = { common: '#94a3b8', rare: '#38bdf8', epic: '#a78bfa', legendary: '#fbbf24' }

// reward browsing: search + tier filter, inside a fixed-height scroll area
const rewardSearch = ref('')
const tierFilter = ref('all')
const filteredGrouped = computed(() => {
  const q = rewardSearch.value.trim().toLowerCase()
  const g = {}
  for (const r of rewards.value) {
    if (tierFilter.value !== 'all' && r.tier !== tierFilter.value) continue
    if (q && !(r.display_name.toLowerCase().includes(q) || r.item_key.includes(q))) continue
    ;(g[r.tier] || (g[r.tier] = [])).push(r)
  }
  return TIER_ORDER.filter((tk) => g[tk]?.length).map((tk) => ({ tier: tk, items: g[tk] }))
})

// won-items inventory (claim in-game / sell for Void Coin)
const winnings = ref([])
const winBusy = ref('')
async function loadWinnings() {
  try { winnings.value = await getUpgraderWinnings() } catch { /* silent */ }
}
async function sellWin(w) {
  if (winBusy.value) return
  winBusy.value = w.id
  try {
    const res = await sellUpgraderWinning(w.id)
    balance.value = res.new_void_coins
    setVoidCoins(res.new_void_coins)
    winnings.value = winnings.value.filter((x) => x.id !== w.id)
    toastSuccess(`+${money(res.vc_value)} Void Coin`)
  } catch (e) { toastError(e?.message || 'Ошибка') } finally { winBusy.value = '' }
}
async function claimWin(w) {
  if (winBusy.value) return
  winBusy.value = w.id
  try {
    await claimUpgraderWinning(w.id)
    winnings.value = winnings.value.filter((x) => x.id !== w.id)
    toastSuccess('Забрано в игру')
  } catch (e) { toastError(e?.message || 'Ошибка') } finally { winBusy.value = '' }
}
const poolTotal = computed(() => winnings.value.reduce((s, w) => s + Number(w.vc_value || 0), 0))
async function sellAll() {
  if (winBusy.value || !winnings.value.length) return
  winBusy.value = 'all'
  try {
    const res = await sellAllUpgraderWinnings()
    balance.value = res.new_void_coins
    setVoidCoins(res.new_void_coins)
    winnings.value = []
    toastSuccess(`+${money(res.vc_total)} Void Coin`)
  } catch (e) { toastError(e?.message || 'Ошибка') } finally { winBusy.value = '' }
}
async function claimAll() {
  if (winBusy.value || !winnings.value.length) return
  winBusy.value = 'all'
  try {
    const res = await claimAllUpgraderWinnings()
    winnings.value = []
    toastSuccess(t('gameUiUpgrader.claimedAll', { n: res.claimed_count || 0 }))
  } catch (e) { toastError(e?.message || 'Ошибка') } finally { winBusy.value = '' }
}

// personal stats
const stats = ref(null)
async function loadStats() {
  try { stats.value = await getUpgraderStats() } catch { /* silent */ }
}

// server-wide jackpot + daily free spin + weekly leaderboard
const jackpot = ref({ enabled: false, amount: 0, last_winner: null, last_amount: null })
const daily = ref({ enabled: false, available: false, free_stake: 25, streak: 0 })
const leaderboard = ref({ entries: [] })
const jackpotFlash = ref(null)
async function refreshJackpot() {
  try { jackpot.value = await getUpgraderJackpot() } catch { /* silent */ }
}
async function loadLeaderboard() {
  try { leaderboard.value = await getUpgraderLeaderboard() } catch { /* silent */ }
}

// provably-fair (commit-reveal) verification
const lastSpin = ref(null)
const verify = ref(null)
const fairness = ref({ commit_hash: '', nonce: 0, rotated_at: null })
const rotating = ref(false)
async function hmacRoll(serverSeed, clientSeed, nonce) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(serverSeed), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${clientSeed}:${nonce}`))
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
  return Number(BigInt('0x' + hex.slice(0, 15))) / 2 ** 60
}
async function loadFairness() {
  try { fairness.value = await getUpgraderFairness() } catch { /* silent */ }
}
async function openVerify(src) {
  if (!src) return
  const v = {
    server_seed: src.server_seed || null,       // present only for a rotated (revealed) seed
    server_seed_hash: src.server_seed_hash || fairness.value.commit_hash || null,
    client_seed: src.client_seed,
    nonce: src.nonce,
    roll: src.roll,
    win_chance: src.win_chance ?? src.winChance ?? null,
    won: src.won,
    display: src.reward_display || src.reward?.display_name || '',
    committed: !src.server_seed,                 // still sealed under the active seed
    computed: null,
    ok: null,
  }
  verify.value = v
  if (v.server_seed) {
    try {
      const c = await hmacRoll(v.server_seed, v.client_seed, v.nonce)
      v.computed = c
      v.ok = Math.abs(c - Number(v.roll)) < 1e-6
    } catch { v.ok = false }
  }
}
function closeVerify() { verify.value = null }
async function rotateSeed() {
  if (rotating.value) return
  rotating.value = true
  try {
    const res = await rotateUpgraderFairness()
    fairness.value = { commit_hash: res.commit_hash, nonce: 0, rotated_at: new Date().toISOString() }
    await loadHistory()
    toastSuccess(t('gameUiUpgrader.fairRotated', { n: res.revealed_spins }))
    // if the verify modal is open on a now-revealed spin, refresh it from history
    if (verify.value) {
      const match = history.value.find((h) => h.nonce === verify.value.nonce && h.client_seed === verify.value.client_seed && h.server_seed)
      if (match) openVerify(match); else closeVerify()
    }
  } catch (e) { toastError(e?.message || 'Ошибка') } finally { rotating.value = false }
}

// multiplier presets — set the stake so the payout multiplier ≈ M
const MULT_PRESETS = [2, 5, 10]
function presetStake(m) { return selected.value ? Math.round(selected.value.vc_value / m) : 0 }
function presetOk(m) {
  if (!selected.value) return false
  const s = presetStake(m)
  return s >= minStake.value && s <= Math.min(balance.value, selected.value.vc_value - 1) && m <= maxMult.value
}
function applyPreset(m) { if (presetOk(m)) setStake(presetStake(m)) }

// recent-wins ticker
const recentWins = ref([])
let winsTimer = null
function headUrl(nick) { return `${API_BASE_URL}/public/player-head/${encodeURIComponent(nick)}` }
async function loadWins() {
  try { recentWins.value = await getUpgraderRecentWins() } catch { /* silent */ }
}

const multiplier = computed(() => {
  if (!selected.value || stake.value < 1) return 0
  return selected.value.vc_value / stake.value
})
const chance = computed(() => {
  if (!selected.value || multiplier.value < 1) return 0
  return Math.min(maxChance.value, rtp.value / multiplier.value)
})
const winDash = computed(() => `${(chance.value * CIRC).toFixed(2)} ${CIRC.toFixed(2)}`)
const chancePct = computed(() => (chance.value * 100).toFixed(1))
const chanceClass = computed(() => (chance.value >= 0.55 ? 'hi' : chance.value >= 0.3 ? 'mid' : 'lo'))
const selColor = computed(() => (selected.value ? tierColor[selected.value.tier] : '#8b7bff'))

const canSpin = computed(() =>
  !spinning.value && selected.value &&
  stake.value >= minStake.value && stake.value <= balance.value &&
  stake.value < selected.value.vc_value && multiplier.value <= maxMult.value,
)

function money(v) { return Number(v || 0).toLocaleString('ru-RU', { maximumFractionDigits: 0 }) }

function pickReward(r) {
  if (spinning.value) return
  selected.value = r
  result.value = null
  wheelState.value = ''
  arcVisible.value = true
  const target = Math.max(minStake.value, Math.round(r.vc_value / 2))
  stake.value = Math.min(target, balance.value, r.vc_value - 1) || minStake.value
}
function setStake(v) {
  if (spinning.value || !selected.value) return
  const cap = Math.min(balance.value, selected.value.vc_value - 1)
  stake.value = Math.max(minStake.value, Math.min(Math.round(v), cap))
}

function burst(win) {
  const colors = win
    ? ['#34d399', '#a7f3d0', '#fbbf24', '#8b7bff', '#f0abfc']
    : ['#fb7185', '#7c7f95']
  const n = win ? 42 : 16
  const out = []
  for (let i = 0; i < n; i++) {
    const ang = Math.random() * Math.PI * 2
    const dist = 70 + Math.random() * 150
    out.push({
      id: pid++,
      tx: Math.cos(ang) * dist + 'px',
      ty: Math.sin(ang) * dist + 'px',
      rot: (Math.random() * 720 - 360) + 'deg',
      color: colors[(Math.random() * colors.length) | 0],
      delay: Math.random() * 0.08 + 's',
      dur: (0.9 + Math.random() * 0.7) + 's',
      sz: (5 + Math.random() * 6) | 0,
    })
  }
  particles.value = out
  setTimeout(() => { particles.value = [] }, 1900)
}

function applySpinResult(res) {
  lastSpin.value = res
  const target = res.roll * 360
  const base = pointerDeg.value - (pointerDeg.value % 360)
  pointerDeg.value = base + 360 * 6 + target
  balance.value = res.new_void_coins
  setVoidCoins(res.new_void_coins)   // update the navbar instantly
  if (res.jackpot && typeof res.jackpot.amount === 'number') jackpot.value.amount = res.jackpot.amount
  setTimeout(() => {
    result.value = { won: res.won, reward: res.reward }
    wheelState.value = res.won ? 'win' : 'lose'
    spinning.value = false
    burst(res.won)
    loadHistory()
    loadStats()
    loadLeaderboard()
    if (res.won) { loadWins(); loadWinnings() }
    if (res.free) { daily.value.available = false; if (typeof res.daily_streak === 'number') daily.value.streak = res.daily_streak }
    if (res.jackpot && res.jackpot.hit) onJackpotHit(res.jackpot)
    refreshJackpot()
    if (typeof res.nonce === 'number') fairness.value.nonce = res.nonce + 1
  }, 4300)
}

async function doSpin() {
  if (!canSpin.value) return
  spinning.value = true
  result.value = null
  wheelState.value = 'spinning'
  try {
    applySpinResult(await spinUpgrader(selected.value.id, stake.value, null))
  } catch (e) {
    toastError(e?.message || 'Ошибка')
    spinning.value = false
    wheelState.value = ''
  }
}

async function doDailySpin() {
  if (spinning.value || !selected.value || !daily.value.available) return
  if (selected.value.vc_value <= daily.value.free_stake) { toastError(t('gameUiUpgrader.dailyPickBigger', { n: money(daily.value.free_stake) })); return }
  spinning.value = true
  result.value = null
  wheelState.value = 'spinning'
  try {
    applySpinResult(await dailySpinUpgrader(selected.value.id, null))
  } catch (e) {
    const msg = e?.message || 'Ошибка'
    if (/сегодня|today/i.test(msg)) daily.value.available = false
    toastError(msg)
    spinning.value = false
    wheelState.value = ''
  }
}

function onJackpotHit(j) {
  jackpotFlash.value = { amount: j.won_amount }
  burst(true)
  toastSuccess(`🎉 ${t('gameUiUpgrader.jackpotWon')} +${money(j.won_amount)} Void Coin`)
  setTimeout(() => { jackpotFlash.value = null }, 6000)
}

async function loadHistory() {
  try { history.value = await getUpgraderHistory() } catch { /* silent */ }
}
async function load() {
  loading.value = true
  try {
    const d = await getUpgraderRewards()
    rewards.value = d.rewards || []
    balance.value = d.void_coins || 0
    setVoidCoins(d.void_coins || 0)
    rtp.value = d.rtp || 0.9
    minStake.value = d.min_stake || 1
    maxMult.value = d.max_multiplier || 100
    maxChance.value = d.max_chance || 0.9
    if (d.jackpot) jackpot.value = d.jackpot
    if (d.daily) daily.value = d.daily
    if (d.fairness) fairness.value = d.fairness
    error.value = null
    if (rewards.value.length) { await nextTick(); pickReward(rewards.value.find((r) => r.tier === 'rare') || rewards.value[0]) }
  } catch (e) {
    error.value = e?.message || 'error'
  } finally {
    loading.value = false
  }
  loadHistory()
  loadWins()
  loadWinnings()
  loadStats()
  loadLeaderboard()
}
onMounted(() => { load(); winsTimer = setInterval(() => { loadWins(); refreshJackpot() }, 12000) })
onUnmounted(() => { clearInterval(winsTimer) })
</script>

<template>
  <section class="gp-shell">
    <GameUiStarfield />
    <GameUiSidebar current="upgrader" />
    <GameUiTopBar :title="t('gameUiNav.upgrader')" />

    <div class="gp-wrap gp-wrap--app up-wrap">
      <div v-if="loading" class="gp-center"><span class="gp-spinner"></span></div>
      <div v-else-if="error" class="gp-center"><div class="gp-card gp-state"><span class="gp-state-ico"><GuiIcon name="alert" :size="30" /></span><span class="gp-state-text">{{ error }}</span></div></div>
      <div v-else-if="!rewards.length" class="gp-center"><div class="gp-card gp-state"><span class="gp-state-ico"><GuiIcon name="voidcoin" :size="30" /></span><span class="gp-state-text">{{ t('gameUiUpgrader.empty') }}</span></div></div>

      <template v-else>
        <!-- left column: machine + recent wins under it -->
        <div class="up-left">
        <div class="gp-panel up-machine" :style="{ '--sel': selColor }">
          <!-- server-wide progressive jackpot -->
          <div v-if="jackpot.enabled" class="up-jackpot" :class="{ hit: jackpotFlash }">
            <span class="up-jp-glow"></span>
            <span class="up-jp-label"><GuiIcon name="crown" :size="14" />{{ t('gameUiUpgrader.jackpot') }}</span>
            <span class="up-jp-amount"><GuiIcon name="voidcoin" :size="15" />{{ money(jackpot.amount) }}</span>
            <span v-if="jackpot.last_winner" class="up-jp-last">{{ t('gameUiUpgrader.jackpotLast', { nick: jackpot.last_winner, amount: money(jackpot.last_amount) }) }}</span>
          </div>

          <div class="up-target" v-if="selected" :class="'t-' + selected.tier">
            <div class="up-target-ico">
              <ItemIcon :itemKey="selected.item_key" :size="42" />
            </div>
            <div class="up-target-info">
              <div class="up-target-name">{{ selected.display_name }}</div>
              <div class="up-target-val"><GuiIcon name="voidcoin" :size="13" />{{ money(selected.vc_value) }} <span class="up-tier">{{ t('gameUiUpgrader.tier.' + selected.tier) }}</span></div>
            </div>
          </div>

          <!-- wheel -->
          <div class="up-wheel-box" :class="wheelState">
            <div class="up-aura"></div>
            <div class="up-fx">
              <span v-for="p in particles" :key="p.id" class="up-particle"
                    :style="{ '--tx': p.tx, '--ty': p.ty, '--rot': p.rot, '--dl': p.delay, '--du': p.dur, width: p.sz+'px', height: p.sz+'px', background: p.color }"></span>
            </div>
            <svg class="up-wheel" viewBox="0 0 200 200">
              <defs>
                <linearGradient id="upgArc" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stop-color="#7c6bff" /><stop offset="0.5" stop-color="#c084fc" /><stop offset="1" stop-color="#f472d0" />
                </linearGradient>
                <radialGradient id="upgHub" cx="50%" cy="40%" r="70%">
                  <stop offset="0" stop-color="#1b1e38" /><stop offset="0.68" stop-color="#0d0f20" /><stop offset="1" stop-color="#06070f" />
                </radialGradient>
                <linearGradient id="upgGloss" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stop-color="rgba(255,255,255,0.12)" /><stop offset="1" stop-color="rgba(255,255,255,0)" />
                </linearGradient>
                <filter id="upgGlow" x="-40%" y="-40%" width="180%" height="180%">
                  <feGaussianBlur stdDeviation="3.4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>

              <!-- bezel -->
              <circle cx="100" cy="100" r="94" fill="none" stroke="rgba(150,168,220,0.10)" stroke-width="1" />
              <circle cx="100" cy="100" r="90.5" fill="none" stroke="rgba(150,168,220,0.05)" stroke-width="2.5" />

              <!-- track + graduated ticks -->
              <circle class="up-track" cx="100" cy="100" r="84" fill="none" stroke-width="15" />
              <circle class="up-ticks" cx="100" cy="100" r="72" fill="none" stroke="rgba(255,255,255,0.09)" stroke-width="9"
                      stroke-dasharray="0.7 10.4" transform="rotate(-90 100 100)" />

              <!-- win arc: soft glow underlay + crisp arc + glossy centerline -->
              <g v-show="arcVisible">
                <circle class="up-arc-glow" cx="100" cy="100" r="84" fill="none" stroke="url(#upgArc)" stroke-width="15"
                        :stroke-dasharray="winDash" transform="rotate(-90 100 100)" stroke-linecap="round" filter="url(#upgGlow)" />
                <circle class="up-arc" cx="100" cy="100" r="84" fill="none" stroke="url(#upgArc)" stroke-width="15"
                        :stroke-dasharray="winDash" transform="rotate(-90 100 100)" stroke-linecap="round" />
                <circle class="up-arc-hi" cx="100" cy="100" r="84" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="2.5"
                        :stroke-dasharray="winDash" transform="rotate(-90 100 100)" stroke-linecap="round" />
              </g>

              <!-- hub -->
              <circle cx="100" cy="100" r="63" fill="none" stroke="rgba(139,123,255,0.16)" stroke-width="1" />
              <circle class="up-hub" cx="100" cy="100" r="60" fill="url(#upgHub)" stroke="rgba(150,168,220,0.14)" stroke-width="1" />
              <ellipse cx="100" cy="80" rx="50" ry="28" fill="url(#upgGloss)" />

              <!-- pointer -->
              <g class="up-needle" :style="{ transform: 'rotate(' + pointerDeg + 'deg)', transition: spinning ? 'transform 4.2s cubic-bezier(0.12,0.72,0.16,1)' : 'none' }">
                <path d="M100 3 L108.5 25 Q100 31 91.5 25 Z" />
                <circle class="up-needle-knob" cx="100" cy="11" r="3.4" />
              </g>
            </svg>
            <div class="up-wheel-center">
              <transition name="up-pop" mode="out-in">
                <div v-if="result" :key="'r'" class="up-res-wrap">
                  <div class="up-res" :class="result.won ? 'win' : 'lose'">{{ result.won ? t('gameUiUpgrader.win') : t('gameUiUpgrader.lose') }}</div>
                  <div v-if="result.won" class="up-res-item"><ItemIcon :itemKey="result.reward.item_key" :size="26" /><span>{{ result.reward.display_name }}</span></div>
                  <button v-if="lastSpin" class="up-fair-btn" @click="openVerify(lastSpin)"><GuiIcon name="shield" :size="12" />{{ t('gameUiUpgrader.fair') }}</button>
                </div>
                <div v-else :key="'c'" class="up-meter">
                  <div class="up-chance" :class="chanceClass">{{ chancePct }}<small>%</small></div>
                  <div class="up-mult">×{{ multiplier.toFixed(2) }}</div>
                </div>
              </transition>
            </div>
          </div>

          <!-- stake controls -->
          <div class="up-controls" v-if="selected">
            <div class="up-stake-row">
              <span class="up-lbl">{{ t('gameUiUpgrader.stake') }}</span>
              <div class="up-stake-in">
                <GuiIcon name="voidcoin" :size="14" class="up-vc" />
                <input type="number" v-model.number="stake" :min="minStake" :max="Math.min(balance, selected.vc_value - 1)" :disabled="spinning" @input="setStake(stake)" />
              </div>
            </div>
            <div class="up-quick">
              <button :disabled="spinning" @click="setStake(stake / 2)">½</button>
              <button :disabled="spinning" @click="setStake(stake * 2)">2×</button>
              <button :disabled="spinning" @click="setStake(Math.min(balance, selected.vc_value - 1))">MAX</button>
            </div>
            <div class="up-presets">
              <span class="up-presets-lbl">{{ t('gameUiUpgrader.targetMult') }}</span>
              <button v-for="m in MULT_PRESETS" :key="m" class="up-preset" :disabled="spinning || !presetOk(m)" @click="applyPreset(m)">×{{ m }}</button>
            </div>
            <button class="up-spin" :class="{ ready: canSpin }" :disabled="!canSpin" @click="doSpin">
              <span class="up-spin-sheen"></span>
              <GuiIcon name="sparkles" :size="16" />
              {{ spinning ? t('gameUiUpgrader.spinning') : t('gameUiUpgrader.spin') }}
            </button>
            <!-- daily free spin -->
            <button v-if="daily.enabled" class="up-daily" :class="{ ready: daily.available && !spinning }"
                    :disabled="!daily.available || spinning" @click="doDailySpin">
              <GuiIcon name="gift" :size="15" />
              <span v-if="daily.available">{{ t('gameUiUpgrader.dailyFree', { n: money(daily.free_stake) }) }}</span>
              <span v-else>{{ t('gameUiUpgrader.dailyUsed') }}</span>
              <span v-if="daily.bp_level > 0" class="up-daily-bp" :title="t('gameUiUpgrader.dailyBpBoost')">⚡BP{{ daily.bp_level }}</span>
              <span v-if="daily.streak > 0" class="up-daily-streak">🔥{{ daily.streak }}</span>
            </button>
            <div class="up-bal">{{ t('gameUiUpgrader.balance') }}: <b><GuiIcon name="voidcoin" :size="12" />{{ money(balance) }}</b></div>
            <div v-if="fairness.commit_hash" class="up-fairbar" :title="t('gameUiUpgrader.fairBarHint')">
              <GuiIcon name="shield" :size="12" />
              <span class="up-fairbar-h">{{ t('gameUiUpgrader.fairCommit') }}: {{ fairness.commit_hash.slice(0, 16) }}…</span>
              <button class="up-fairbar-btn" :disabled="rotating" @click="rotateSeed">{{ t('gameUiUpgrader.fairReveal') }}</button>
            </div>
          </div>
        </div>

        <!-- won-items inventory: claim in-game or sell for Void Coin -->
        <div v-if="winnings.length" class="gp-panel up-inv">
          <div class="gp-phead"><span class="gp-phead-ic"><GuiIcon name="gift" :size="16" /></span><span class="gp-phead-tt">{{ t('gameUiUpgrader.myWins') }}</span><span class="gp-phead-sp"></span><span class="up-inv-count">{{ winnings.length }} · <GuiIcon name="voidcoin" :size="10" />{{ money(poolTotal) }}</span></div>
          <div class="up-inv-bulk">
            <button class="up-bulk-sell" :disabled="winBusy === 'all'" @click="sellAll"><GuiIcon name="voidcoin" :size="12" />{{ t('gameUiUpgrader.sellAll') }} {{ money(poolTotal) }}</button>
            <button class="up-bulk-claim" :disabled="winBusy === 'all'" @click="claimAll">{{ t('gameUiUpgrader.claimAll') }}</button>
          </div>
          <div class="up-inv-list">
            <div v-for="w in winnings" :key="w.id" class="up-inv-row" :style="{ '--tc': tierColor[w.tier] || '#8b7bff' }">
              <div class="up-inv-ic"><ItemIcon :itemKey="w.item_key" :size="30" /></div>
              <div class="up-inv-info">
                <div class="up-inv-name">{{ w.display_name }}</div>
                <div class="up-inv-val"><GuiIcon name="voidcoin" :size="10" />{{ money(w.vc_value) }}</div>
              </div>
              <div class="up-inv-btns">
                <button class="up-inv-sell" :disabled="winBusy === w.id" @click="sellWin(w)"><GuiIcon name="voidcoin" :size="11" />{{ t('gameUiUpgrader.sell') }} {{ money(w.vc_value) }}</button>
                <button class="up-inv-claim" :disabled="winBusy === w.id" @click="claimWin(w)">{{ t('gameUiUpgrader.take') }}</button>
              </div>
            </div>
          </div>
        </div>

        <!-- recent winners (right under the machine) -->
        <div v-if="recentWins.length" class="gp-panel up-recent">
          <div class="gp-phead"><span class="gp-phead-ic"><GuiIcon name="trophy" :size="16" /></span><span class="gp-phead-tt">{{ t('gameUiUpgrader.recentWins') }}</span></div>
          <div class="up-recent-row">
            <div v-for="(w, i) in recentWins" :key="i" class="up-win" :style="{ '--tc': '#a78bfa' }">
              <img class="up-win-head" :src="headUrl(w.nickname)" alt="" @error="$event.target.style.visibility='hidden'" />
              <div class="up-win-ic"><ItemIcon :itemKey="w.reward_item_key" :size="26" /></div>
              <div class="up-win-info">
                <div class="up-win-item">{{ w.reward_display }}</div>
                <div class="up-win-meta"><span class="up-win-nick">{{ w.nickname }}</span><span class="up-win-mult">×{{ w.multiplier }}</span></div>
                <div class="up-win-stake"><GuiIcon name="voidcoin" :size="10" />{{ money(w.stake) }}</div>
              </div>
            </div>
          </div>
        </div>
        </div><!-- /up-left -->

        <!-- reward ladder + history -->
        <div class="up-side">
          <div class="gp-panel">
            <div class="gp-phead"><span class="gp-phead-ic"><GuiIcon name="gift" :size="16" /></span><span class="gp-phead-tt">{{ t('gameUiUpgrader.rewards') }}</span></div>
            <div class="up-filters">
              <div class="up-search"><GuiIcon name="market" :size="14" /><input v-model="rewardSearch" :placeholder="t('gameUiUpgrader.search')" /></div>
              <div class="up-chips">
                <button class="up-chip" :class="{ on: tierFilter === 'all' }" @click="tierFilter = 'all'">{{ t('gameUiUpgrader.allTiers') }}</button>
                <button v-for="tk in TIER_ORDER" :key="tk" class="up-chip" :class="{ on: tierFilter === tk }"
                        :style="tierFilter === tk ? { color: tierColor[tk], borderColor: tierColor[tk] } : {}" @click="tierFilter = tk">{{ t('gameUiUpgrader.tier.' + tk) }}</button>
              </div>
            </div>
            <div class="up-rewards-scroll">
              <div v-for="grp in filteredGrouped" :key="grp.tier" class="up-tier-grp">
                <div class="up-tier-head" :style="{ '--tc': tierColor[grp.tier] }"><span class="up-tier-dot"></span>{{ t('gameUiUpgrader.tier.' + grp.tier) }}</div>
                <div class="up-grid">
                  <button v-for="r in grp.items" :key="r.id" class="up-card" :class="['t-' + r.tier, { sel: selected && selected.id === r.id }]"
                          :style="{ '--tc': tierColor[r.tier] }" @click="pickReward(r)">
                    <span class="up-card-shine"></span>
                    <ItemIcon :itemKey="r.item_key" :size="30" />
                    <span class="up-card-name">{{ r.display_name }}</span>
                    <span class="up-card-val"><GuiIcon name="voidcoin" :size="10" />{{ money(r.vc_value) }}</span>
                  </button>
                </div>
              </div>
              <div v-if="!filteredGrouped.length" class="up-noresult">{{ t('gameUiUpgrader.noResult') }}</div>
            </div>
          </div>

          <!-- weekly leaderboard: biggest wins this week -->
          <div v-if="leaderboard.entries.length" class="gp-panel up-lb">
            <div class="gp-phead"><span class="gp-phead-ic"><GuiIcon name="trophy" :size="16" /></span><span class="gp-phead-tt">{{ t('gameUiUpgrader.weeklyTop') }}</span></div>
            <div class="up-lb-list">
              <div v-for="(e, i) in leaderboard.entries" :key="e.nickname" class="up-lb-row" :class="'r' + (i + 1)">
                <span class="up-lb-rank">{{ i + 1 }}</span>
                <img class="up-lb-head" :src="headUrl(e.nickname)" alt="" @error="$event.target.style.visibility='hidden'" />
                <span class="up-lb-nick">{{ e.nickname }}</span>
                <span class="up-lb-wins">{{ t('gameUiUpgrader.lbWins', { n: e.wins }) }}</span>
                <span class="up-lb-big"><GuiIcon name="voidcoin" :size="11" />{{ money(e.biggest_win) }}</span>
              </div>
            </div>
          </div>

          <div v-if="stats && stats.spins" class="gp-panel up-stats">
            <div class="gp-phead"><span class="gp-phead-ic"><GuiIcon name="activity" :size="16" /></span><span class="gp-phead-tt">{{ t('gameUiUpgrader.myStats') }}</span></div>
            <div class="up-stats-grid">
              <div class="up-stat"><span class="up-stat-v">{{ money(stats.spins) }}</span><span class="up-stat-l">{{ t('gameUiUpgrader.stSpins') }}</span></div>
              <div class="up-stat"><span class="up-stat-v" :class="{ hi: stats.win_rate >= 0.4 }">{{ (stats.win_rate * 100).toFixed(0) }}%</span><span class="up-stat-l">{{ t('gameUiUpgrader.stWinrate') }} · {{ money(stats.wins) }}</span></div>
              <div class="up-stat"><span class="up-stat-v"><GuiIcon name="voidcoin" :size="12" />{{ money(stats.vc_staked) }}</span><span class="up-stat-l">{{ t('gameUiUpgrader.stStaked') }}</span></div>
              <div class="up-stat"><span class="up-stat-v win"><GuiIcon name="voidcoin" :size="12" />{{ money(stats.vc_won) }}</span><span class="up-stat-l">{{ t('gameUiUpgrader.stWon') }}</span></div>
            </div>
          </div>

          <div v-if="history.length" class="gp-panel">
            <div class="gp-phead"><span class="gp-phead-ic"><GuiIcon name="clock" :size="16" /></span><span class="gp-phead-tt">{{ t('gameUiUpgrader.history') }}</span></div>
            <div class="up-hist">
              <div v-for="(h, i) in history" :key="i" class="up-hrow" :class="h.won ? 'win' : 'lose'">
                <span class="up-hres">{{ h.won ? '✓' : '✕' }}</span>
                <span class="up-hname">{{ h.reward_display }}</span>
                <span class="up-hstake"><GuiIcon name="voidcoin" :size="10" />{{ money(h.stake) }}</span>
                <span class="up-hmult">×{{ h.multiplier }}</span>
                <button v-if="h.server_seed" class="up-hfair" :title="t('gameUiUpgrader.fair')" @click="openVerify(h)"><GuiIcon name="shield" :size="12" /></button>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- jackpot win celebration -->
    <transition name="up-fade">
      <div v-if="jackpotFlash" class="up-jpwin" @click="jackpotFlash = null">
        <div class="up-jpwin-card">
          <div class="up-jpwin-crown"><GuiIcon name="crown" :size="46" /></div>
          <div class="up-jpwin-title">{{ t('gameUiUpgrader.jackpotWon') }}</div>
          <div class="up-jpwin-amount"><GuiIcon name="voidcoin" :size="30" />{{ money(jackpotFlash.amount) }}</div>
          <div class="up-jpwin-sub">Void Coin</div>
        </div>
      </div>
    </transition>

    <!-- provably-fair verification -->
    <transition name="up-fade">
      <div v-if="verify" class="up-modal" @click.self="closeVerify">
        <div class="up-modal-card">
          <div class="up-modal-head">
            <span class="up-modal-ic"><GuiIcon name="shield" :size="16" /></span>
            <span class="up-modal-tt">{{ t('gameUiUpgrader.fairTitle') }}</span>
            <button class="up-modal-x" @click="closeVerify">✕</button>
          </div>
          <p class="up-modal-desc">{{ t('gameUiUpgrader.fairDesc') }}</p>

          <!-- committed but still sealed under the active seed -->
          <template v-if="verify.committed">
            <div class="up-fair-verdict sealed">🔒 {{ t('gameUiUpgrader.fairSealed') }}</div>
            <div class="up-fair-rows">
              <div class="up-fair-r"><span>{{ t('gameUiUpgrader.fairCommit') }}</span><code>{{ verify.server_seed_hash }}</code></div>
              <div class="up-fair-r"><span>client_seed</span><code>{{ verify.client_seed }}</code></div>
              <div class="up-fair-r"><span>nonce</span><code>{{ verify.nonce }}</code></div>
              <div class="up-fair-r"><span>roll</span><code>{{ Number(verify.roll).toFixed(6) }}</code></div>
            </div>
            <p class="up-fair-formula">{{ t('gameUiUpgrader.fairSealedHint') }}</p>
            <button class="up-reveal-btn" :disabled="rotating" @click="rotateSeed">
              <GuiIcon name="refresh" :size="14" />{{ t('gameUiUpgrader.fairReveal') }}
            </button>
          </template>

          <!-- revealed → recompute in-browser -->
          <template v-else>
            <div class="up-fair-verdict" :class="verify.ok === true ? 'ok' : verify.ok === false ? 'bad' : ''">
              <template v-if="verify.ok === true">✓ {{ t('gameUiUpgrader.fairOk') }}</template>
              <template v-else-if="verify.ok === false">✕ {{ t('gameUiUpgrader.fairBad') }}</template>
              <template v-else>… {{ t('gameUiUpgrader.fairChecking') }}</template>
            </div>
            <div class="up-fair-rows">
              <div class="up-fair-r"><span>server_seed</span><code>{{ verify.server_seed }}</code></div>
              <div v-if="verify.server_seed_hash" class="up-fair-r"><span>{{ t('gameUiUpgrader.fairCommit') }}</span><code>{{ verify.server_seed_hash }}</code></div>
              <div class="up-fair-r"><span>client_seed</span><code>{{ verify.client_seed }}</code></div>
              <div class="up-fair-r"><span>nonce</span><code>{{ verify.nonce }}</code></div>
              <div class="up-fair-r"><span>roll</span><code>{{ Number(verify.roll).toFixed(6) }}</code></div>
              <div class="up-fair-r"><span>{{ t('gameUiUpgrader.fairComputed') }}</span><code>{{ verify.computed != null ? verify.computed.toFixed(6) : '…' }}</code></div>
              <div v-if="verify.win_chance != null" class="up-fair-r"><span>win_chance</span><code>{{ Number(verify.win_chance).toFixed(6) }}</code></div>
            </div>
            <p class="up-fair-formula">roll = int( HMAC_SHA256(server_seed, client_seed:nonce)[:15], 16 ) / 16<sup>15</sup></p>
            <p class="up-fair-formula">{{ t('gameUiUpgrader.fairRule') }}</p>
          </template>
        </div>
      </div>
    </transition>
  </section>
</template>

<style scoped>
.up-wrap { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 16px; align-items: start; }
@media (max-width: 860px) { .up-wrap { grid-template-columns: 1fr; } }

.up-machine { display: flex; flex-direction: column; align-items: center; gap: 16px; overflow: hidden; }

/* selected target banner */
.up-target { display: flex; align-items: center; gap: 12px; width: 100%; padding: 11px 13px; border-radius: 13px;
  background: linear-gradient(120deg, color-mix(in srgb, var(--sel) 14%, transparent), rgba(255,255,255,0.02));
  border: 1px solid color-mix(in srgb, var(--sel) 45%, transparent); position: relative; overflow: hidden; }
.up-target::after { content: ''; position: absolute; inset: 0; background: radial-gradient(120px 60px at 12% 50%, color-mix(in srgb, var(--sel) 30%, transparent), transparent 70%); pointer-events: none; }
.up-target-ico { width: 56px; height: 56px; display: grid; place-items: center; border-radius: 12px; background: rgba(0,0,0,0.34);
  border: 1px solid color-mix(in srgb, var(--sel) 60%, transparent); box-shadow: 0 0 18px -4px var(--sel); position: relative; z-index: 1; }
.up-target-name { font-size: 1rem; font-weight: 800; color: #f4f7ff; }
.up-target-val { display: flex; align-items: center; gap: 5px; font-size: 0.84rem; font-weight: 700; color: #d8ccff; margin-top: 3px; }
.up-tier { font-size: 0.64rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.06em; margin-left: 6px; color: var(--sel);
  padding: 1px 7px; border-radius: 6px; background: color-mix(in srgb, var(--sel) 16%, transparent); border: 1px solid color-mix(in srgb, var(--sel) 40%, transparent); }

/* wheel */
.up-wheel-box { position: relative; width: 300px; height: 300px; display: grid; place-items: center; }
.up-aura { position: absolute; inset: 8px; border-radius: 50%; pointer-events: none;
  background: radial-gradient(closest-side, color-mix(in srgb, var(--sel) 22%, transparent), transparent 78%);
  filter: blur(6px); opacity: 0.7; transition: background .3s, opacity .3s; }
.up-wheel-box.spinning .up-aura { animation: aura-pulse 1.1s ease-in-out infinite; }
.up-wheel-box.win .up-aura { background: radial-gradient(closest-side, rgba(52,211,153,0.5), transparent 76%); opacity: 1; animation: aura-flash .6s ease-out; }
.up-wheel-box.lose .up-aura { background: radial-gradient(closest-side, rgba(251,113,133,0.4), transparent 76%); }
@keyframes aura-pulse { 0%,100% { opacity: .5; } 50% { opacity: .95; } }
@keyframes aura-flash { 0% { transform: scale(.6); opacity: 1; } 100% { transform: scale(1.15); opacity: 1; } }

.up-wheel { width: 100%; height: 100%; position: relative; z-index: 1; }
.up-track { stroke: rgba(255,255,255,0.055); }
.up-arc { transition: stroke-dasharray .35s ease; }
.up-arc-glow { opacity: 0.5; transition: stroke-dasharray .35s ease; }
.up-arc-hi { opacity: 0.5; transition: stroke-dasharray .35s ease; }
.up-ticks { transition: stroke .3s; }
.up-wheel-box.win .up-arc, .up-wheel-box.win .up-arc-glow { stroke: #34d399; }
.up-hub { transition: stroke .3s; }
.up-needle { transform-origin: 100px 100px; }
.up-needle path { fill: #f4f7ff; filter: drop-shadow(0 0 5px rgba(238,242,255,0.95)); transition: fill .2s; }
.up-needle-knob { fill: #f4f7ff; filter: drop-shadow(0 0 4px rgba(238,242,255,0.9)); transition: fill .2s; }
.up-wheel-box.win .up-needle path, .up-wheel-box.win .up-needle-knob { fill: #34d399; filter: drop-shadow(0 0 8px rgba(52,211,153,1)); }
.up-wheel-box.lose .up-needle path, .up-wheel-box.lose .up-needle-knob { fill: #fb7185; filter: drop-shadow(0 0 6px rgba(251,113,133,0.9)); }
.up-wheel-box.lose { animation: shake .4s ease; }
@keyframes shake { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-7px); } 40% { transform: translateX(6px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(3px); } }

.up-wheel-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none; z-index: 2; }
.up-meter { display: flex; flex-direction: column; align-items: center; }
.up-chance { font-family: 'JetBrains Mono', monospace; font-size: 2.3rem; font-weight: 800; line-height: 1; text-shadow: 0 0 18px currentColor; }
.up-chance small { font-size: 1rem; opacity: 0.7; }
.up-chance.hi { color: #4ade80; } .up-chance.mid { color: #fbbf24; } .up-chance.lo { color: #fb7185; }
.up-mult { font-size: 0.92rem; font-weight: 800; color: #c4b5fd; margin-top: 6px; letter-spacing: 0.02em; }
.up-res-wrap { display: flex; flex-direction: column; align-items: center; }
.up-res { font-size: 1.7rem; font-weight: 900; letter-spacing: 0.05em; text-transform: uppercase; }
.up-res.win { color: #34d399; text-shadow: 0 0 22px rgba(52,211,153,0.9); }
.up-res.lose { color: #fb7185; text-shadow: 0 0 16px rgba(251,113,133,0.7); }
.up-res-item { display: flex; align-items: center; gap: 6px; font-size: 0.76rem; font-weight: 800; color: #eef2ff; margin-top: 7px; text-align: center; padding: 0 10px; }
.up-pop-enter-active { transition: transform .34s cubic-bezier(0.2,1.5,0.4,1), opacity .3s; }
.up-pop-leave-active { transition: transform .18s, opacity .18s; }
.up-pop-enter-from { transform: scale(0.4); opacity: 0; }
.up-pop-leave-to { transform: scale(0.85); opacity: 0; }

/* particle burst */
.up-fx { position: absolute; inset: 0; pointer-events: none; z-index: 3; display: grid; place-items: center; }
.up-particle { position: absolute; border-radius: 2px; opacity: 0; animation: confetti var(--du) ease-out var(--dl) forwards; }
@keyframes confetti {
  0% { transform: translate(0,0) rotate(0) scale(1); opacity: 1; }
  100% { transform: translate(var(--tx), var(--ty)) rotate(var(--rot)) scale(0.4); opacity: 0; }
}

/* controls */
.up-controls { width: 100%; display: flex; flex-direction: column; gap: 11px; }
.up-stake-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.up-lbl { font-size: 0.8rem; font-weight: 700; color: #aeb9d6; }
.up-stake-in { display: flex; align-items: center; gap: 6px; padding: 8px 12px; border-radius: 10px; background: rgba(0,0,0,0.32);
  border: 1px solid rgba(167,139,250,0.35); transition: border-color .14s, box-shadow .14s; }
.up-stake-in:focus-within { border-color: rgba(167,139,250,0.7); box-shadow: 0 0 0 3px rgba(139,123,255,0.14); }
.up-vc { color: #c4b5fd; }
.up-stake-in input { width: 96px; background: none; border: none; outline: none; color: #eef2ff; font-family: 'JetBrains Mono', monospace; font-weight: 800; font-size: 0.92rem; text-align: right; }
.up-quick { display: flex; gap: 6px; }
.up-quick button { flex: 1; padding: 7px; border-radius: 9px; border: 1px solid var(--gp-line); background: rgba(255,255,255,0.03); color: #c9d2ee; font-weight: 800; font-size: 0.78rem; cursor: pointer; transition: background .14s, transform .1s; }
.up-quick button:hover:not(:disabled) { background: rgba(139,123,255,0.16); }
.up-quick button:active:not(:disabled) { transform: scale(0.94); }

.up-spin { position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 14px; border-radius: 13px; border: none; cursor: pointer;
  background: linear-gradient(135deg, #6d5cf0, #b45cf0, #6d5cf0); background-size: 200% 100%; color: #fff; font-weight: 800; font-size: 0.98rem; letter-spacing: 0.03em;
  box-shadow: 0 12px 30px -8px rgba(139,123,255,0.8); transition: transform .1s, filter .14s; }
.up-spin.ready { animation: spin-grad 3s linear infinite; }
@keyframes spin-grad { to { background-position: 200% 0; } }
.up-spin:hover:not(:disabled) { filter: brightness(1.1); }
.up-spin:active:not(:disabled) { transform: scale(0.98); }
.up-spin:disabled { opacity: 0.45; cursor: not-allowed; box-shadow: none; animation: none; }
.up-spin-sheen { position: absolute; top: 0; left: -60%; width: 45%; height: 100%; transform: skewX(-20deg);
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent); }
.up-spin.ready .up-spin-sheen { animation: sheen 2.4s ease-in-out infinite; }
@keyframes sheen { 0% { left: -60%; } 55%,100% { left: 130%; } }

.up-bal { text-align: center; font-size: 0.78rem; color: var(--gp-ink-dim, #8a90a8); }
.up-bal b { color: #d8ccff; display: inline-flex; align-items: center; gap: 3px; }

/* reward ladder */
.up-side { display: flex; flex-direction: column; gap: 16px; }
.up-tier-grp { margin-top: 12px; }
.up-tier-head { display: flex; align-items: center; gap: 7px; font-size: 0.68rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 7px; color: var(--tc); }
.up-tier-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--tc); box-shadow: 0 0 8px var(--tc); }
.up-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(86px, 1fr)); gap: 8px; }
.up-card { position: relative; overflow: hidden; display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 10px 6px; border-radius: 12px; cursor: pointer;
  background: linear-gradient(180deg, color-mix(in srgb, var(--tc) 7%, transparent), rgba(255,255,255,0.015));
  border: 1px solid var(--gp-line); transition: border-color .14s, transform .12s, box-shadow .14s; }
.up-card:hover { border-color: color-mix(in srgb, var(--tc) 65%, transparent); transform: translateY(-2px); box-shadow: 0 8px 18px -8px color-mix(in srgb, var(--tc) 70%, transparent); }
.up-card.sel { border-color: var(--tc); box-shadow: 0 0 0 1px var(--tc) inset, 0 0 16px -4px var(--tc); background: linear-gradient(180deg, color-mix(in srgb, var(--tc) 16%, transparent), rgba(255,255,255,0.02)); }
.up-card-shine { position: absolute; top: 0; left: -80%; width: 55%; height: 100%; transform: skewX(-20deg); background: linear-gradient(90deg, transparent, rgba(255,255,255,0.16), transparent); transition: none; }
.up-card:hover .up-card-shine { animation: shine .7s ease; }
@keyframes shine { to { left: 130%; } }
.up-card-name { font-size: 0.63rem; font-weight: 700; color: #c9d2ee; text-align: center; line-height: 1.15; }
.up-card-val { display: inline-flex; align-items: center; gap: 3px; font-size: 0.65rem; font-weight: 800; color: #c4b5fd; }

/* reward search + tier filter + scroll area */
.up-filters { display: flex; flex-direction: column; gap: 8px; margin: 10px 0 6px; }
.up-search { display: flex; align-items: center; gap: 7px; padding: 7px 11px; border-radius: 10px; background: rgba(0,0,0,0.3); border: 1px solid var(--gp-line); color: #8a90a8; }
.up-search:focus-within { border-color: rgba(139,123,255,0.5); }
.up-search input { flex: 1; min-width: 0; background: none; border: none; outline: none; color: #eef2ff; font-size: 0.82rem; }
.up-chips { display: flex; flex-wrap: wrap; gap: 5px; }
.up-chip { padding: 4px 10px; border-radius: 999px; border: 1px solid var(--gp-line); background: rgba(255,255,255,0.03); color: #aeb9d6; font-size: 0.68rem; font-weight: 800; cursor: pointer; transition: background .12s, border-color .12s; }
.up-chip:hover { background: rgba(139,123,255,0.12); }
.up-chip.on { background: rgba(139,123,255,0.16); border-color: rgba(167,139,250,0.5); color: #eef2ff; }
.up-rewards-scroll { max-height: 300px; overflow-y: auto; padding-right: 4px; }
.up-rewards-scroll::-webkit-scrollbar { width: 6px; }
.up-rewards-scroll::-webkit-scrollbar-thumb { background: rgba(139,123,255,0.3); border-radius: 3px; }
.up-noresult { text-align: center; padding: 24px; font-size: 0.8rem; color: #8a90a8; }

/* left column: machine stacked over the recent-wins ticker */
.up-left { display: flex; flex-direction: column; gap: 16px; min-width: 0; }

/* won-items inventory */
.up-inv-count { font-size: 0.72rem; font-weight: 800; color: #c4b5fd; }
.up-inv-list { display: flex; flex-direction: column; gap: 7px; margin-top: 8px; max-height: 260px; overflow-y: auto; padding-right: 3px; }
.up-inv-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 11px; background: rgba(255,255,255,0.02); border: 1px solid var(--gp-line); border-left: 3px solid var(--tc); }
.up-inv-ic { width: 36px; height: 36px; display: grid; place-items: center; border-radius: 9px; background: rgba(0,0,0,0.3); border: 1px solid var(--gp-line); flex-shrink: 0; }
.up-inv-info { flex: 1; min-width: 0; }
.up-inv-name { font-size: 0.8rem; font-weight: 800; color: #eef2ff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.up-inv-val { display: inline-flex; align-items: center; gap: 3px; font-size: 0.68rem; font-weight: 700; color: #c4b5fd; margin-top: 1px; }
.up-inv-btns { display: flex; flex-direction: column; gap: 5px; flex-shrink: 0; }
.up-inv-sell, .up-inv-claim { display: inline-flex; align-items: center; justify-content: center; gap: 3px; padding: 5px 10px; border-radius: 8px; font-size: 0.7rem; font-weight: 800; cursor: pointer; border: 1px solid; transition: filter .12s; white-space: nowrap; }
.up-inv-sell { background: linear-gradient(135deg, rgba(139,123,255,0.22), rgba(180,92,240,0.16)); border-color: rgba(167,139,250,0.5); color: #d8ccff; }
.up-inv-claim { background: rgba(52,211,153,0.12); border-color: rgba(52,211,153,0.4); color: #6ee7b7; }
.up-inv-sell:hover:not(:disabled), .up-inv-claim:hover:not(:disabled) { filter: brightness(1.15); }
.up-inv-sell:disabled, .up-inv-claim:disabled { opacity: 0.5; cursor: default; }

/* recent winners ticker */
.up-recent-row { display: flex; gap: 9px; overflow-x: auto; padding: 10px 2px 4px; }
.up-recent-row::-webkit-scrollbar { height: 6px; }
.up-recent-row::-webkit-scrollbar-thumb { background: rgba(139,123,255,0.3); border-radius: 3px; }
.up-win { flex: 0 0 auto; display: flex; align-items: center; gap: 9px; padding: 9px 12px 9px 9px; border-radius: 12px;
  background: linear-gradient(120deg, rgba(52,211,153,0.08), rgba(255,255,255,0.02)); border: 1px solid rgba(52,211,153,0.28); min-width: 190px; }
.up-win-head { width: 34px; height: 34px; border-radius: 8px; image-rendering: pixelated; flex-shrink: 0; border: 1px solid rgba(255,255,255,0.12); }
.up-win-ic { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 9px; background: rgba(0,0,0,0.3); border: 1px solid var(--gp-line); flex-shrink: 0; }
.up-win-info { min-width: 0; }
.up-win-item { font-size: 0.76rem; font-weight: 800; color: #eef2ff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px; }
.up-win-meta { display: flex; align-items: center; gap: 6px; margin-top: 1px; }
.up-win-nick { font-size: 0.66rem; font-weight: 700; color: #34d399; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 84px; }
.up-win-mult { font-size: 0.64rem; font-weight: 800; color: #a78bfa; }
.up-win-stake { display: inline-flex; align-items: center; gap: 3px; font-size: 0.64rem; font-weight: 700; color: #c4b5fd; margin-top: 1px; }

/* history */
.up-hist { display: flex; flex-direction: column; gap: 5px; margin-top: 8px; max-height: 264px; overflow-y: auto; padding-right: 4px; }
.up-hist::-webkit-scrollbar { width: 6px; }
.up-hist::-webkit-scrollbar-thumb { background: rgba(139,123,255,0.3); border-radius: 3px; }
.up-hrow { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-radius: 9px; background: rgba(255,255,255,0.02); border-left: 3px solid transparent; }
.up-hrow.win { border-left-color: #34d399; background: rgba(52,211,153,0.05); } .up-hrow.lose { border-left-color: #fb7185; }
.up-hres { font-weight: 900; width: 14px; }
.up-hrow.win .up-hres { color: #34d399; } .up-hrow.lose .up-hres { color: #fb7185; }
.up-hname { flex: 1; font-size: 0.75rem; font-weight: 700; color: #d5dcf0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.up-hstake { display: inline-flex; align-items: center; gap: 2px; font-size: 0.68rem; color: #aab2cc; }
.up-hmult { font-size: 0.68rem; font-weight: 800; color: #a78bfa; }
.up-hfair { margin-left: 2px; display: grid; place-items: center; width: 22px; height: 22px; border-radius: 7px; border: 1px solid var(--gp-line);
  background: rgba(139,123,255,0.08); color: #a78bfa; cursor: pointer; flex-shrink: 0; transition: background .12s, color .12s; }
.up-hfair:hover { background: rgba(139,123,255,0.2); color: #c4b5fd; }

/* multiplier presets */
.up-presets { display: flex; align-items: center; gap: 6px; }
.up-presets-lbl { font-size: 0.68rem; font-weight: 700; color: #8a90a8; margin-right: 2px; }
.up-preset { flex: 1; padding: 6px; border-radius: 9px; border: 1px solid rgba(167,139,250,0.32); background: rgba(139,123,255,0.08);
  color: #c4b5fd; font-weight: 800; font-size: 0.76rem; cursor: pointer; transition: background .12s, transform .1s; }
.up-preset:hover:not(:disabled) { background: rgba(139,123,255,0.2); }
.up-preset:active:not(:disabled) { transform: scale(0.94); }
.up-preset:disabled { opacity: 0.35; cursor: not-allowed; }

/* provably-fair result button */
.up-fair-btn { pointer-events: auto; margin-top: 9px; display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 8px;
  border: 1px solid rgba(139,123,255,0.4); background: rgba(139,123,255,0.12); color: #c4b5fd; font-size: 0.68rem; font-weight: 800; cursor: pointer; transition: background .12s; }
.up-fair-btn:hover { background: rgba(139,123,255,0.24); }

/* winnings bulk actions */
.up-inv-bulk { display: flex; gap: 7px; margin-top: 9px; }
.up-bulk-sell, .up-bulk-claim { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 4px; padding: 8px; border-radius: 10px;
  font-size: 0.76rem; font-weight: 800; cursor: pointer; border: 1px solid; transition: filter .12s; }
.up-bulk-sell { background: linear-gradient(135deg, rgba(139,123,255,0.26), rgba(180,92,240,0.2)); border-color: rgba(167,139,250,0.55); color: #e4dcff; }
.up-bulk-claim { background: rgba(52,211,153,0.14); border-color: rgba(52,211,153,0.45); color: #6ee7b7; flex: 0 0 auto; padding: 8px 14px; }
.up-bulk-sell:hover:not(:disabled), .up-bulk-claim:hover:not(:disabled) { filter: brightness(1.15); }
.up-bulk-sell:disabled, .up-bulk-claim:disabled { opacity: 0.5; cursor: default; }

/* personal stats */
.up-stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }
.up-stat { display: flex; flex-direction: column; gap: 3px; padding: 10px 12px; border-radius: 11px; background: rgba(255,255,255,0.02); border: 1px solid var(--gp-line); }
.up-stat-v { display: inline-flex; align-items: center; gap: 4px; font-family: 'JetBrains Mono', monospace; font-size: 1.05rem; font-weight: 800; color: #eef2ff; }
.up-stat-v.hi { color: #4ade80; } .up-stat-v.win { color: #34d399; }
.up-stat-l { font-size: 0.64rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #8a90a8; }

/* verify modal */
.up-modal { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; padding: 20px; background: rgba(4,5,12,0.72); backdrop-filter: blur(4px); }
.up-modal-card { width: min(460px, 100%); max-height: 88vh; overflow-y: auto; border-radius: 16px; padding: 18px; background: linear-gradient(180deg, #14162c, #0c0e1c);
  border: 1px solid rgba(139,123,255,0.28); box-shadow: 0 24px 60px -18px rgba(0,0,0,0.8); }
.up-modal-head { display: flex; align-items: center; gap: 9px; }
.up-modal-ic { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 9px; background: rgba(139,123,255,0.16); color: #c4b5fd; }
.up-modal-tt { flex: 1; font-size: 0.98rem; font-weight: 800; color: #f4f7ff; }
.up-modal-x { width: 28px; height: 28px; border-radius: 8px; border: 1px solid var(--gp-line); background: rgba(255,255,255,0.03); color: #aeb9d6; cursor: pointer; font-weight: 800; }
.up-modal-x:hover { background: rgba(255,255,255,0.08); }
.up-modal-desc { font-size: 0.76rem; color: #9aa3bf; margin: 10px 0 12px; line-height: 1.4; }
.up-fair-verdict { text-align: center; font-weight: 800; font-size: 0.9rem; padding: 9px; border-radius: 10px; margin-bottom: 12px; border: 1px solid var(--gp-line); color: #aeb9d6; }
.up-fair-verdict.ok { color: #34d399; background: rgba(52,211,153,0.1); border-color: rgba(52,211,153,0.4); }
.up-fair-verdict.bad { color: #fb7185; background: rgba(251,113,133,0.1); border-color: rgba(251,113,133,0.4); }
.up-fair-rows { display: flex; flex-direction: column; gap: 6px; }
.up-fair-r { display: flex; align-items: baseline; gap: 10px; font-size: 0.74rem; }
.up-fair-r span { flex: 0 0 92px; color: #8a90a8; font-weight: 700; }
.up-fair-r code { flex: 1; min-width: 0; word-break: break-all; font-family: 'JetBrains Mono', monospace; color: #d5dcf0; background: rgba(0,0,0,0.3); padding: 4px 8px; border-radius: 7px; border: 1px solid var(--gp-line); }
.up-fair-formula { font-size: 0.68rem; color: #8a90a8; margin-top: 12px; line-height: 1.5; font-family: 'JetBrains Mono', monospace; }
.up-fair-verdict.sealed { color: #c4b5fd; background: rgba(139,123,255,0.1); border-color: rgba(139,123,255,0.4); }
.up-reveal-btn { width: 100%; margin-top: 12px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 9px; border-radius: 10px;
  border: 1px solid rgba(139,123,255,0.45); background: rgba(139,123,255,0.14); color: #d8ccff; font-weight: 800; font-size: 0.8rem; cursor: pointer; transition: filter .12s; }
.up-reveal-btn:hover:not(:disabled) { filter: brightness(1.15); }
.up-reveal-btn:disabled { opacity: 0.5; cursor: default; }
/* standing-commitment strip */
.up-fairbar { display: flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 9px; background: rgba(139,123,255,0.06);
  border: 1px solid var(--gp-line); font-size: 0.64rem; color: #8a90a8; }
.up-fairbar .gp-icon, .up-fairbar > svg { color: #a78bfa; flex-shrink: 0; }
.up-fairbar-h { flex: 1; min-width: 0; font-family: 'JetBrains Mono', monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.up-fairbar-btn { flex-shrink: 0; padding: 3px 8px; border-radius: 6px; border: 1px solid rgba(139,123,255,0.4); background: rgba(139,123,255,0.12); color: #c4b5fd; font-size: 0.62rem; font-weight: 800; cursor: pointer; }
.up-fairbar-btn:hover:not(:disabled) { background: rgba(139,123,255,0.24); }
.up-fairbar-btn:disabled { opacity: 0.5; cursor: default; }
.up-fade-enter-active, .up-fade-leave-active { transition: opacity .18s; }
.up-fade-enter-from, .up-fade-leave-to { opacity: 0; }

/* ── server-wide jackpot bar ── */
.up-jackpot { position: relative; overflow: hidden; width: 100%; display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  padding: 10px 14px; border-radius: 13px; background: linear-gradient(120deg, rgba(251,191,36,0.14), rgba(180,92,240,0.12));
  border: 1px solid rgba(251,191,36,0.4); box-shadow: 0 0 22px -8px rgba(251,191,36,0.6); }
.up-jp-glow { position: absolute; top: 0; left: -60%; width: 45%; height: 100%; transform: skewX(-20deg);
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent); animation: sheen 3.2s ease-in-out infinite; }
.up-jp-label { display: inline-flex; align-items: center; gap: 5px; font-size: 0.66rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; color: #fbbf24; }
.up-jp-amount { display: inline-flex; align-items: center; gap: 5px; font-family: 'JetBrains Mono', monospace; font-size: 1.15rem; font-weight: 800; color: #fff6db; text-shadow: 0 0 12px rgba(251,191,36,0.6); margin-left: auto; }
.up-jp-last { flex-basis: 100%; font-size: 0.64rem; color: #b9a789; }
.up-jackpot.hit { animation: jp-flash .6s ease-out 3; }
@keyframes jp-flash { 0%,100% { box-shadow: 0 0 22px -8px rgba(251,191,36,0.6); } 50% { box-shadow: 0 0 30px 2px rgba(251,191,36,0.95); } }

/* ── daily free spin ── */
.up-daily { display: flex; align-items: center; justify-content: center; gap: 7px; padding: 10px; border-radius: 12px; cursor: pointer;
  border: 1px solid rgba(52,211,153,0.4); background: rgba(52,211,153,0.1); color: #6ee7b7; font-weight: 800; font-size: 0.86rem; transition: filter .12s, transform .1s; }
.up-daily.ready { animation: daily-pulse 2.2s ease-in-out infinite; }
@keyframes daily-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(52,211,153,0); } 50% { box-shadow: 0 0 16px -2px rgba(52,211,153,0.6); } }
.up-daily:hover:not(:disabled) { filter: brightness(1.15); }
.up-daily:active:not(:disabled) { transform: scale(0.98); }
.up-daily:disabled { opacity: 0.5; cursor: not-allowed; border-color: var(--gp-line); background: rgba(255,255,255,0.03); color: #8a90a8; animation: none; }
.up-daily-streak { font-size: 0.72rem; font-weight: 900; color: #fbbf24; }
.up-daily-bp { font-size: 0.66rem; font-weight: 900; color: #7dd3fc; }

/* ── weekly leaderboard ── */
.up-lb-list { display: flex; flex-direction: column; gap: 5px; margin-top: 8px; }
.up-lb-row { display: flex; align-items: center; gap: 9px; padding: 7px 10px; border-radius: 10px; background: rgba(255,255,255,0.02); border: 1px solid var(--gp-line); }
.up-lb-row.r1 { border-color: rgba(251,191,36,0.5); background: rgba(251,191,36,0.07); }
.up-lb-row.r2 { border-color: rgba(203,213,225,0.4); }
.up-lb-row.r3 { border-color: rgba(217,164,102,0.4); }
.up-lb-rank { width: 18px; text-align: center; font-family: 'JetBrains Mono', monospace; font-weight: 900; color: #8a90a8; flex-shrink: 0; }
.up-lb-row.r1 .up-lb-rank { color: #fbbf24; } .up-lb-row.r2 .up-lb-rank { color: #cbd5e1; } .up-lb-row.r3 .up-lb-rank { color: #d9a466; }
.up-lb-head { width: 26px; height: 26px; border-radius: 7px; image-rendering: pixelated; flex-shrink: 0; border: 1px solid rgba(255,255,255,0.12); }
.up-lb-nick { flex: 1; min-width: 0; font-size: 0.78rem; font-weight: 800; color: #eef2ff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.up-lb-wins { font-size: 0.64rem; font-weight: 700; color: #8a90a8; flex-shrink: 0; }
.up-lb-big { display: inline-flex; align-items: center; gap: 3px; font-family: 'JetBrains Mono', monospace; font-size: 0.76rem; font-weight: 800; color: #fbbf24; flex-shrink: 0; }

/* ── jackpot win celebration ── */
.up-jpwin { position: fixed; inset: 0; z-index: 70; display: grid; place-items: center; padding: 20px; background: rgba(4,5,12,0.78); backdrop-filter: blur(5px); cursor: pointer; }
.up-jpwin-card { text-align: center; padding: 34px 46px; border-radius: 22px; background: linear-gradient(160deg, #2a2410, #16182c);
  border: 1px solid rgba(251,191,36,0.55); box-shadow: 0 0 60px -6px rgba(251,191,36,0.7); animation: jpwin-pop .5s cubic-bezier(0.2,1.6,0.4,1); }
@keyframes jpwin-pop { 0% { transform: scale(0.4) rotate(-6deg); opacity: 0; } 100% { transform: scale(1) rotate(0); opacity: 1; } }
.up-jpwin-crown { color: #fbbf24; filter: drop-shadow(0 0 16px rgba(251,191,36,0.9)); animation: jpwin-bob 1.4s ease-in-out infinite; }
@keyframes jpwin-bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
.up-jpwin-title { margin-top: 8px; font-size: 1.2rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; color: #fbbf24; text-shadow: 0 0 18px rgba(251,191,36,0.8); }
.up-jpwin-amount { display: inline-flex; align-items: center; gap: 8px; margin-top: 12px; font-family: 'JetBrains Mono', monospace; font-size: 2.6rem; font-weight: 800; color: #fff6db; text-shadow: 0 0 24px rgba(251,191,36,0.7); }
.up-jpwin-sub { font-size: 0.8rem; font-weight: 700; color: #b9a789; margin-top: 2px; letter-spacing: 0.15em; text-transform: uppercase; }
</style>
