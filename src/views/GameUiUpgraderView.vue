<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import '../assets/gui-premium.css'
import { getUpgraderRewards, spinUpgrader, getUpgraderHistory, getUpgraderRecentWins, setWebguiToken } from '../services/gameUiApi.js'
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

async function doSpin() {
  if (!canSpin.value) return
  spinning.value = true
  result.value = null
  wheelState.value = 'spinning'
  try {
    const res = await spinUpgrader(selected.value.id, stake.value, null)
    const target = res.roll * 360
    const base = pointerDeg.value - (pointerDeg.value % 360)
    pointerDeg.value = base + 360 * 6 + target
    balance.value = res.new_void_coins
    setVoidCoins(res.new_void_coins)   // update the navbar instantly
    setTimeout(() => {
      result.value = { won: res.won, reward: res.reward }
      wheelState.value = res.won ? 'win' : 'lose'
      spinning.value = false
      burst(res.won)
      loadHistory()
      if (res.won) loadWins()
    }, 4300)
  } catch (e) {
    error.value = e?.message || 'error'
    spinning.value = false
    wheelState.value = ''
  }
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
    error.value = null
    if (rewards.value.length) { await nextTick(); pickReward(rewards.value.find((r) => r.tier === 'rare') || rewards.value[0]) }
  } catch (e) {
    error.value = e?.message || 'error'
  } finally {
    loading.value = false
  }
  loadHistory()
  loadWins()
}
onMounted(() => { load(); winsTimer = setInterval(loadWins, 12000) })
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
              <circle class="up-track" cx="100" cy="100" r="84" fill="none" stroke-width="15" />
              <circle v-show="arcVisible" class="up-arc" cx="100" cy="100" r="84" fill="none" stroke="url(#upg)" stroke-width="15"
                      :stroke-dasharray="winDash" transform="rotate(-90 100 100)" stroke-linecap="round" />
              <circle class="up-ticks" cx="100" cy="100" r="72" fill="none" stroke="rgba(255,255,255,0.10)" stroke-width="10"
                      stroke-dasharray="0.6 11.5" transform="rotate(-90 100 100)" />
              <defs>
                <linearGradient id="upg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8b7bff" /><stop offset="0.5" stop-color="#c084fc" /><stop offset="1" stop-color="#f0abfc" /></linearGradient>
              </defs>
              <g class="up-needle" :style="{ transform: 'rotate(' + pointerDeg + 'deg)', transition: spinning ? 'transform 4.2s cubic-bezier(0.12,0.72,0.16,1)' : 'none' }">
                <polygon points="100,6 92,32 108,32" />
              </g>
              <circle class="up-hub" cx="100" cy="100" r="58" />
            </svg>
            <div class="up-wheel-center">
              <transition name="up-pop" mode="out-in">
                <div v-if="result" :key="'r'" class="up-res-wrap">
                  <div class="up-res" :class="result.won ? 'win' : 'lose'">{{ result.won ? t('gameUiUpgrader.win') : t('gameUiUpgrader.lose') }}</div>
                  <div v-if="result.won" class="up-res-item"><ItemIcon :itemKey="result.reward.item_key" :size="26" /><span>{{ result.reward.display_name }}</span></div>
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
            <button class="up-spin" :class="{ ready: canSpin }" :disabled="!canSpin" @click="doSpin">
              <span class="up-spin-sheen"></span>
              <GuiIcon name="sparkles" :size="16" />
              {{ spinning ? t('gameUiUpgrader.spinning') : t('gameUiUpgrader.spin') }}
            </button>
            <div class="up-bal">{{ t('gameUiUpgrader.balance') }}: <b><GuiIcon name="voidcoin" :size="12" />{{ money(balance) }}</b></div>
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

          <div v-if="history.length" class="gp-panel">
            <div class="gp-phead"><span class="gp-phead-ic"><GuiIcon name="clock" :size="16" /></span><span class="gp-phead-tt">{{ t('gameUiUpgrader.history') }}</span></div>
            <div class="up-hist">
              <div v-for="(h, i) in history" :key="i" class="up-hrow" :class="h.won ? 'win' : 'lose'">
                <span class="up-hres">{{ h.won ? '✓' : '✕' }}</span>
                <span class="up-hname">{{ h.reward_display }}</span>
                <span class="up-hstake"><GuiIcon name="voidcoin" :size="10" />{{ money(h.stake) }}</span>
                <span class="up-hmult">×{{ h.multiplier }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
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
.up-track { stroke: rgba(255,255,255,0.06); }
.up-arc { filter: drop-shadow(0 0 6px rgba(168,85,247,0.8)); transition: stroke-dasharray .35s ease; }
.up-wheel-box.win .up-arc { stroke: #34d399; filter: drop-shadow(0 0 8px rgba(52,211,153,0.9)); }
.up-hub { fill: rgba(9,11,22,0.94); stroke: rgba(150,168,220,0.16); stroke-width: 1; }
.up-needle { transform-origin: 100px 100px; }
.up-needle polygon { fill: #eef2ff; filter: drop-shadow(0 0 5px rgba(238,242,255,0.9)); }
.up-wheel-box.win .up-needle polygon { fill: #34d399; filter: drop-shadow(0 0 7px rgba(52,211,153,1)); }
.up-wheel-box.lose .up-needle polygon { fill: #fb7185; }
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
.up-hist { display: flex; flex-direction: column; gap: 5px; margin-top: 8px; }
.up-hrow { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-radius: 9px; background: rgba(255,255,255,0.02); border-left: 3px solid transparent; }
.up-hrow.win { border-left-color: #34d399; background: rgba(52,211,153,0.05); } .up-hrow.lose { border-left-color: #fb7185; }
.up-hres { font-weight: 900; width: 14px; }
.up-hrow.win .up-hres { color: #34d399; } .up-hrow.lose .up-hres { color: #fb7185; }
.up-hname { flex: 1; font-size: 0.75rem; font-weight: 700; color: #d5dcf0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.up-hstake { display: inline-flex; align-items: center; gap: 2px; font-size: 0.68rem; color: #aab2cc; }
.up-hmult { font-size: 0.68rem; font-weight: 800; color: #a78bfa; }
</style>
