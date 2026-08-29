<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import '../assets/gui-premium.css'
import { getTreasurySummary, setWebguiToken, runGameCommand } from '../services/gameUiApi.js'
import { useWebGuiToken, useActionToast } from '../composables/useWebGui.js'
import GameUiSidebar from '../components/GameUiSidebar.vue'
import GameUiStarfield from '../components/GameUiStarfield.vue'
import GameUiTopBar from '../components/GameUiTopBar.vue'
import GuiIcon from '../components/GuiIcon.vue'
import CountUp from '../components/CountUp.vue'

const { t } = useI18n()
const token = useWebGuiToken()
setWebguiToken(token)
const { toast, show } = useActionToast()

const summary = ref(null)
const loading = ref(false)
const error = ref(null)
const donateAmount = ref('')
const donateLoading = ref(false)

async function load() {
  loading.value = true
  try {
    summary.value = await getTreasurySummary()
    error.value = null
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
onMounted(load)

const txIn = computed(() => (summary.value?.transactions?.items || []).filter(i => i.net_amount >= 0).reduce((s, i) => s + Number(i.net_amount), 0))
const txOut = computed(() => (summary.value?.transactions?.items || []).filter(i => i.net_amount < 0).reduce((s, i) => s + Math.abs(Number(i.net_amount)), 0))

function money(v) {
  if (v == null || Number.isNaN(Number(v))) return '0'
  return Number(v).toLocaleString('ru-RU', { maximumFractionDigits: 0 })
}
function formatDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}
function txTypeLabel(type) {
  const map = {
    player_donate: t('gameUiTreasury.txPlayerDonate'),
    player_donation: t('gameUiTreasury.txPlayerDonate'),
    player_withdraw: t('gameUiTreasury.txPlayerWithdraw'),
    alliance_transfer: t('gameUiTreasury.txAllianceTransfer'),
    market_fee: t('gameUiTreasury.txMarketFee'),
    event_reward: t('gameUiTreasury.txEventReward'),
    research: t('gameUiTreasury.txResearch'),
    interest: t('gameUiTreasury.txInterest'),
    season_reward: t('gameUiTreasury.txEventReward'),
  }
  return map[type] || type
}
function txIcon(type, pos) {
  if (type === 'market_fee') return 'market'
  if (type === 'research') return 'tech'
  if (type === 'alliance_transfer') return 'alliance'
  if (type === 'interest') return 'trendingUp'
  return pos ? 'trendingUp' : 'wallet'
}
function roleLabel(r) {
  return { leader: t('gameUiTreasury.roleLeader'), officer: t('gameUiTreasury.roleOfficer'), member: t('gameUiTreasury.roleMember') }[r] || r
}

async function sendDonate() {
  const amount = parseFloat(donateAmount.value)
  if (!amount || amount <= 0) return
  donateLoading.value = true
  try {
    await runGameCommand(`nationdonate ${amount}`)
    show(t('gameUiTreasury.donateQueued'), true)
    donateAmount.value = ''
    setTimeout(load, 2500)
  } catch (e) {
    show(e.message || t('gameUiTreasury.donateFail'), false)
  } finally {
    donateLoading.value = false
  }
}
</script>

<template>
  <section class="gp-shell">
    <GameUiStarfield />
    <GameUiSidebar current="treasury" />
    <GameUiTopBar :title="t('gameUiNav.treasury')" />

    <div class="gp-wrap gp-wrap--wide gp-wrap--app">
      <div v-if="!token" class="gp-center"><div class="gp-card gp-state"><span class="gp-state-ico"><GuiIcon name="lock" :size="30" /></span><span class="gp-state-text">{{ t('gameUiTreasury.tokenError') }}</span></div></div>
      <div v-else-if="loading && !summary" class="gp-grow">
        <div class="gp-grid gp-grid--4"><div v-for="i in 4" :key="i" class="gp-skel" style="height:96px"></div></div>
        <div class="tdash" style="margin-top:14px"><div class="gp-skel" style="height:360px"></div><div class="gp-skel" style="height:360px"></div></div>
      </div>
      <div v-else-if="error" class="gp-center"><div class="gp-card gp-state"><span class="gp-state-ico"><GuiIcon name="alert" :size="30" /></span><span class="gp-state-text">{{ error }}</span></div></div>

      <template v-else-if="summary">
        <!-- KPI row -->
        <div class="gp-grid gp-grid--4 gp-stagger">
          <div class="gp-kpi gp-kpi--gold big">
            <div class="gp-kpi-top"><GuiIcon name="treasury" :size="16" /><span class="gp-kpi-lbl">{{ t('gameUiTreasury.balance') }}</span></div>
            <div class="gp-kpi-val"><CountUp :value="summary.stats.treasury_balance" :format="money" /></div>
            <div class="kpi-foot">{{ summary.nation_title }} · <span class="gp-pill gp-pill--violet">{{ roleLabel(summary.role) }}</span></div>
          </div>
          <div class="gp-kpi gp-kpi--green">
            <div class="gp-kpi-top"><GuiIcon name="trendingUp" :size="15" /><span class="gp-kpi-lbl">{{ t('gameUiTreasury.recentIn') }}</span></div>
            <div class="gp-kpi-val">+<CountUp :value="txIn" :format="money" /></div>
          </div>
          <div class="gp-kpi">
            <div class="gp-kpi-top"><GuiIcon name="wallet" :size="15" /><span class="gp-kpi-lbl">{{ t('gameUiTreasury.recentOut') }}</span></div>
            <div class="gp-kpi-val" style="color:#fda4af">−<CountUp :value="txOut" :format="money" /></div>
          </div>
          <div class="gp-kpi">
            <div class="gp-kpi-top"><GuiIcon name="trophy" :size="15" /><span class="gp-kpi-lbl">{{ t('gameUiTreasury.prestige') }}</span></div>
            <div class="gp-kpi-val"><CountUp :value="summary.stats.prestige_score" :format="money" /></div>
          </div>
        </div>

        <div class="tdash gp-grow">
          <!-- transactions -->
          <div class="gp-panel tx-panel">
            <div class="gp-phead">
              <span class="gp-phead-ic"><GuiIcon name="activity" :size="16" /></span>
              <span class="gp-phead-tt">{{ t('gameUiTreasury.txHistory') }}</span>
            </div>
            <div v-if="!summary.transactions.items?.length" class="empty">{{ t('gameUiTreasury.noTx') }}</div>
            <div v-else class="tx-list gp-scroll gp-stagger">
              <div v-for="item in summary.transactions.items" :key="item.id" class="tx">
                <div class="tx-ic" :class="item.net_amount >= 0 ? 'pos' : 'neg'"><GuiIcon :name="txIcon(item.transaction_type, item.net_amount >= 0)" :size="16" /></div>
                <div class="tx-main">
                  <span class="tx-type">{{ txTypeLabel(item.transaction_type) }}</span>
                  <span class="tx-date">{{ formatDate(item.created_at) }}</span>
                </div>
                <div class="tx-amt gp-num" :class="item.net_amount >= 0 ? 'pos' : 'neg'">{{ item.net_amount >= 0 ? '+' : '−' }}{{ money(Math.abs(item.net_amount)) }}</div>
              </div>
            </div>
          </div>

          <!-- side: donate + nation stats -->
          <div class="tside">
            <div class="gp-panel">
              <div class="gp-phead"><span class="gp-phead-ic"><GuiIcon name="plus" :size="16" /></span><span class="gp-phead-tt">{{ t('gameUiTreasury.donateTitle') }}</span></div>
              <p class="donate-hint">{{ t('gameUiTreasury.donateHint') }}</p>
              <div class="donate">
                <input v-model="donateAmount" type="number" min="1" class="gp-input" :placeholder="t('gameUiTreasury.donateAmount')" @keydown.enter="sendDonate" />
                <button class="gp-btn gp-btn--primary" :disabled="donateLoading || !donateAmount" @click="sendDonate">
                  {{ donateLoading ? '…' : t('gameUiTreasury.donateBtn') }}
                </button>
              </div>
            </div>

            <div class="gp-panel">
              <div class="gp-phead"><span class="gp-phead-ic"><GuiIcon name="shield" :size="16" /></span><span class="gp-phead-tt">{{ t('gameUiTreasury.nationStats') }}</span></div>
              <div class="nstat-list">
                <div class="nstat"><span class="ns-lbl"><GuiIcon name="map" :size="15" />{{ t('gameUiTreasury.territory') }}</span><span class="ns-val gp-num">{{ money(summary.stats.territory_points) }}</span></div>
                <div class="nstat"><span class="ns-lbl"><GuiIcon name="trophy" :size="15" />{{ t('gameUiTreasury.prestige') }}</span><span class="ns-val gp-num">{{ money(summary.stats.prestige_score) }}</span></div>
                <div class="nstat"><span class="ns-lbl"><GuiIcon name="swords" :size="15" />{{ t('gameUiTreasury.pvp') }}</span><span class="ns-val gp-num">{{ money(summary.stats.pvp_kills) }}</span></div>
              </div>
            </div>
          </div>
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
.kpi-foot { margin-top: 5px; font-size: 0.72rem; color: var(--gp-ink-soft); display: flex; align-items: center; gap: 6px; }
.gp-kpi.big .gp-kpi-val { font-size: 1.7rem; }

.tdash { display: grid; grid-template-columns: 1fr 340px; gap: 14px; align-items: start; }
@media (max-width: 860px) { .tdash { grid-template-columns: 1fr; } }
.tx-panel .tx-list { max-height: 360px; padding-right: 4px; }
.tside { display: flex; flex-direction: column; gap: 14px; }

.empty { text-align: center; font-size: 0.84rem; color: var(--gp-ink-dim); padding: 24px; }
.tx-list { display: flex; flex-direction: column; gap: 7px; }
.tx { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--gp-line); background: rgba(255, 255, 255, 0.02); transition: background 0.14s; }
.tx:hover { background: rgba(255,255,255,0.04); }
.tx-ic { width: 34px; height: 34px; flex-shrink: 0; display: grid; place-items: center; border-radius: 10px; }
.tx-ic.pos { color: #6ee7b7; background: rgba(52,211,153,0.12); border: 1px solid rgba(52,211,153,0.24); }
.tx-ic.neg { color: #fda4af; background: rgba(251,113,133,0.1); border: 1px solid rgba(251,113,133,0.22); }
.tx-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.tx-type { font-size: 0.85rem; font-weight: 600; color: #e2e8f8; }
.tx-date { font-size: 0.68rem; color: var(--gp-ink-dim); }
.tx-amt { font-size: 0.9rem; font-weight: 800; flex-shrink: 0; }
.tx-amt.pos { color: var(--gp-green); }
.tx-amt.neg { color: var(--gp-red); }

.donate-hint { font-size: 0.76rem; color: var(--gp-ink-soft); line-height: 1.5; }
.donate { display: flex; gap: 9px; }
.donate .gp-btn { flex-shrink: 0; }

.nstat-list { display: flex; flex-direction: column; gap: 8px; }
.nstat { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-radius: 11px; border: 1px solid var(--gp-line); background: rgba(255,255,255,0.02); }
.ns-lbl { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; color: var(--gp-ink-soft); }
.ns-lbl svg { color: var(--gp-violet-2); }
.ns-val { font-size: 0.9rem; font-weight: 800; color: #eef2ff; }
</style>
