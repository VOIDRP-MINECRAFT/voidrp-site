<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import '../assets/gui-premium.css'
import { getUpgraderRewards, spinUpgrader, getUpgraderHistory, setWebguiToken } from '../services/gameUiApi.js'
import { useWebGuiToken } from '../composables/useWebGui.js'
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

const selected = ref(null)
const stake = ref(1)
const spinning = ref(false)
const result = ref(null)           // { won, reward } after a spin
const history = ref([])

// wheel
const CIRC = 2 * Math.PI * 84
const pointerDeg = ref(0)
const arcVisible = ref(false)

const TIER_ORDER = ['common', 'rare', 'epic', 'legendary']
const tierColor = { common: '#94a3b8', rare: '#38bdf8', epic: '#a78bfa', legendary: '#fbbf24' }
const grouped = computed(() => {
  const g = {}
  for (const r of rewards.value) (g[r.tier] || (g[r.tier] = [])).push(r)
  return TIER_ORDER.filter((tk) => g[tk]?.length).map((tk) => ({ tier: tk, items: g[tk] }))
})

const multiplier = computed(() => {
  if (!selected.value || stake.value < 1) return 0
  return selected.value.vc_value / stake.value
})
const chance = computed(() => {
  if (!selected.value || multiplier.value < 1) return 0
  return Math.min(0.9, rtp.value / multiplier.value)
})
const winDash = computed(() => `${(chance.value * CIRC).toFixed(2)} ${CIRC.toFixed(2)}`)
const chancePct = computed(() => (chance.value * 100).toFixed(1))

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
  arcVisible.value = true
  // default stake → ~×2 upgrade, clamped to balance and just under the reward value
  const target = Math.max(minStake.value, Math.round(r.vc_value / 2))
  stake.value = Math.min(target, balance.value, r.vc_value - 1) || minStake.value
}
function setStake(v) {
  if (spinning.value || !selected.value) return
  const cap = Math.min(balance.value, selected.value.vc_value - 1)
  stake.value = Math.max(minStake.value, Math.min(Math.round(v), cap))
}

async function doSpin() {
  if (!canSpin.value) return
  spinning.value = true
  result.value = null
  try {
    const res = await spinUpgrader(selected.value.id, stake.value, null)
    // land the pointer exactly on the server roll (forward spin + 5 full turns)
    const target = res.roll * 360
    const base = pointerDeg.value - (pointerDeg.value % 360)
    pointerDeg.value = base + 360 * 5 + target
    balance.value = res.new_void_coins
    setTimeout(() => {
      result.value = { won: res.won, reward: res.reward }
      spinning.value = false
      loadHistory()
    }, 4300)
  } catch (e) {
    error.value = e?.message || 'error'
    spinning.value = false
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
    rtp.value = d.rtp || 0.9
    minStake.value = d.min_stake || 1
    maxMult.value = d.max_multiplier || 100
    error.value = null
    if (rewards.value.length) pickReward(rewards.value.find((r) => r.tier === 'rare') || rewards.value[0])
  } catch (e) {
    error.value = e?.message || 'error'
  } finally {
    loading.value = false
  }
  loadHistory()
}
onMounted(load)
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
        <!-- machine -->
        <div class="gp-panel up-machine">
          <div class="up-target" v-if="selected">
            <div class="up-target-ico" :style="{ borderColor: tierColor[selected.tier] }">
              <ItemIcon :itemKey="selected.item_key" :size="42" />
            </div>
            <div class="up-target-info">
              <div class="up-target-name">{{ selected.display_name }}</div>
              <div class="up-target-val"><GuiIcon name="voidcoin" :size="13" />{{ money(selected.vc_value) }} <span class="up-tier" :style="{ color: tierColor[selected.tier] }">{{ t('gameUiUpgrader.tier.' + selected.tier) }}</span></div>
            </div>
          </div>

          <!-- wheel -->
          <div class="up-wheel-box">
            <svg class="up-wheel" viewBox="0 0 200 200">
              <circle cx="100" cy="100" r="84" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="14" />
              <circle v-show="arcVisible" cx="100" cy="100" r="84" fill="none" stroke="url(#upg)" stroke-width="14"
                      :stroke-dasharray="winDash" transform="rotate(-90 100 100)" stroke-linecap="butt" />
              <defs><linearGradient id="upg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8b7bff" /><stop offset="1" stop-color="#d946ef" /></linearGradient></defs>
              <g :style="{ transform: 'rotate(' + pointerDeg + 'deg)', transformOrigin: '100px 100px', transition: spinning ? 'transform 4.2s cubic-bezier(0.16,0.84,0.28,1)' : 'none' }">
                <polygon points="100,8 93,30 107,30" :fill="result ? (result.won ? '#34d399' : '#fb7185') : '#eef2ff'" />
              </g>
              <circle cx="100" cy="100" r="60" fill="rgba(9,11,22,0.9)" stroke="rgba(150,168,220,0.14)" />
            </svg>
            <div class="up-wheel-center">
              <template v-if="result">
                <div class="up-res" :class="result.won ? 'win' : 'lose'">{{ result.won ? t('gameUiUpgrader.win') : t('gameUiUpgrader.lose') }}</div>
                <div v-if="result.won" class="up-res-item">{{ result.reward.display_name }}</div>
              </template>
              <template v-else>
                <div class="up-chance">{{ chancePct }}%</div>
                <div class="up-mult">×{{ multiplier.toFixed(2) }}</div>
              </template>
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
            <button class="up-spin" :disabled="!canSpin" @click="doSpin">
              <GuiIcon name="sparkles" :size="16" />
              {{ spinning ? t('gameUiUpgrader.spinning') : t('gameUiUpgrader.spin') }}
            </button>
            <div class="up-bal">{{ t('gameUiUpgrader.balance') }}: <b><GuiIcon name="voidcoin" :size="12" />{{ money(balance) }}</b></div>
          </div>
        </div>

        <!-- reward ladder + history -->
        <div class="up-side">
          <div class="gp-panel">
            <div class="gp-phead"><span class="gp-phead-ic"><GuiIcon name="gift" :size="16" /></span><span class="gp-phead-tt">{{ t('gameUiUpgrader.rewards') }}</span></div>
            <div v-for="grp in grouped" :key="grp.tier" class="up-tier-grp">
              <div class="up-tier-head" :style="{ color: tierColor[grp.tier] }">{{ t('gameUiUpgrader.tier.' + grp.tier) }}</div>
              <div class="up-grid">
                <button v-for="r in grp.items" :key="r.id" class="up-card" :class="{ sel: selected && selected.id === r.id }"
                        :style="{ '--tc': tierColor[r.tier] }" @click="pickReward(r)">
                  <ItemIcon :itemKey="r.item_key" :size="30" />
                  <span class="up-card-name">{{ r.display_name }}</span>
                  <span class="up-card-val"><GuiIcon name="voidcoin" :size="10" />{{ money(r.vc_value) }}</span>
                </button>
              </div>
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

.up-machine { display: flex; flex-direction: column; align-items: center; gap: 14px; }
.up-target { display: flex; align-items: center; gap: 12px; width: 100%; padding: 10px 12px; border-radius: 12px; background: rgba(255,255,255,0.03); border: 1px solid var(--gp-line); }
.up-target-ico { width: 54px; height: 54px; display: grid; place-items: center; border-radius: 11px; background: rgba(0,0,0,0.3); border: 1px solid; }
.up-target-name { font-size: 0.98rem; font-weight: 800; color: #eef2ff; }
.up-target-val { display: flex; align-items: center; gap: 5px; font-size: 0.82rem; font-weight: 700; color: #d8ccff; margin-top: 3px; }
.up-tier { font-size: 0.66rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; margin-left: 6px; }

.up-wheel-box { position: relative; width: 260px; height: 260px; }
.up-wheel { width: 100%; height: 100%; }
.up-wheel-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none; }
.up-chance { font-family: 'JetBrains Mono', monospace; font-size: 2rem; font-weight: 800; color: #eef2ff; line-height: 1; }
.up-mult { font-size: 0.9rem; font-weight: 800; color: #a78bfa; margin-top: 4px; }
.up-res { font-size: 1.5rem; font-weight: 900; letter-spacing: 0.04em; text-transform: uppercase; }
.up-res.win { color: #34d399; } .up-res.lose { color: #fb7185; }
.up-res-item { font-size: 0.8rem; font-weight: 700; color: #eef2ff; margin-top: 4px; text-align: center; padding: 0 12px; }

.up-controls { width: 100%; display: flex; flex-direction: column; gap: 10px; }
.up-stake-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.up-lbl { font-size: 0.8rem; font-weight: 700; color: #aeb9d6; }
.up-stake-in { display: flex; align-items: center; gap: 6px; padding: 7px 11px; border-radius: 10px; background: rgba(0,0,0,0.3); border: 1px solid rgba(167,139,250,0.35); }
.up-vc { color: #c4b5fd; }
.up-stake-in input { width: 90px; background: none; border: none; outline: none; color: #eef2ff; font-family: 'JetBrains Mono', monospace; font-weight: 800; font-size: 0.9rem; text-align: right; }
.up-quick { display: flex; gap: 6px; }
.up-quick button { flex: 1; padding: 6px; border-radius: 8px; border: 1px solid var(--gp-line); background: rgba(255,255,255,0.03); color: #c9d2ee; font-weight: 800; font-size: 0.76rem; cursor: pointer; transition: background .14s; }
.up-quick button:hover:not(:disabled) { background: rgba(139,123,255,0.14); }
.up-spin { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 13px; border-radius: 12px; border: none; cursor: pointer;
  background: linear-gradient(135deg, #7c6bff, #b45cf0); color: #fff; font-weight: 800; font-size: 0.95rem; letter-spacing: 0.02em;
  box-shadow: 0 10px 26px -8px rgba(139,123,255,0.7); transition: transform .1s, filter .14s; }
.up-spin:hover:not(:disabled) { filter: brightness(1.08); }
.up-spin:active:not(:disabled) { transform: scale(0.98); }
.up-spin:disabled { opacity: 0.45; cursor: not-allowed; box-shadow: none; }
.up-bal { text-align: center; font-size: 0.76rem; color: var(--gp-ink-dim, #8a90a8); }
.up-bal b { color: #d8ccff; display: inline-flex; align-items: center; gap: 3px; }

.up-side { display: flex; flex-direction: column; gap: 16px; }
.up-tier-grp { margin-top: 10px; }
.up-tier-head { font-size: 0.68rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }
.up-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 7px; }
.up-card { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 9px 6px; border-radius: 11px; cursor: pointer;
  background: rgba(255,255,255,0.02); border: 1px solid var(--gp-line); transition: border-color .14s, background .14s; }
.up-card:hover { border-color: color-mix(in srgb, var(--tc) 60%, transparent); background: color-mix(in srgb, var(--tc) 8%, transparent); }
.up-card.sel { border-color: var(--tc); background: color-mix(in srgb, var(--tc) 14%, transparent); box-shadow: 0 0 0 1px var(--tc) inset; }
.up-card-name { font-size: 0.62rem; font-weight: 700; color: #c9d2ee; text-align: center; line-height: 1.15; }
.up-card-val { display: inline-flex; align-items: center; gap: 3px; font-size: 0.64rem; font-weight: 800; color: #c4b5fd; }

.up-hist { display: flex; flex-direction: column; gap: 5px; margin-top: 8px; }
.up-hrow { display: flex; align-items: center; gap: 8px; padding: 6px 9px; border-radius: 8px; background: rgba(255,255,255,0.02); border-left: 2px solid transparent; }
.up-hrow.win { border-left-color: #34d399; } .up-hrow.lose { border-left-color: #fb7185; }
.up-hres { font-weight: 900; width: 14px; }
.up-hrow.win .up-hres { color: #34d399; } .up-hrow.lose .up-hres { color: #fb7185; }
.up-hname { flex: 1; font-size: 0.74rem; font-weight: 700; color: #d5dcf0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.up-hstake { display: inline-flex; align-items: center; gap: 2px; font-size: 0.68rem; color: #aab2cc; }
.up-hmult { font-size: 0.68rem; font-weight: 800; color: #a78bfa; }
</style>
