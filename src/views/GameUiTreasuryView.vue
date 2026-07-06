<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import '../assets/gameui.css'
import { getTreasurySummary, setWebguiToken } from '../services/gameUiApi.js'
import { useWebGuiToken, runCommand, closeGui, useActionToast } from '../composables/useWebGui.js'
import GameUiNav from '../components/GameUiNav.vue'

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

function money(v) {
  if (v == null || Number.isNaN(Number(v))) return '0'
  return Number(v).toLocaleString('ru-RU', { maximumFractionDigits: 2 })
}

function formatDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function txTypeLabel(type) {
  const map = {
    player_donate: 'Пожертвование',
    player_withdraw: 'Вывод',
    alliance_transfer: 'Перевод альянсу',
    market_fee: 'Комиссия рынка',
    event_reward: 'Событие',
  }
  return map[type] || type
}

function roleLabel(r) {
  return { leader: 'Глава', officer: 'Офицер', member: 'Участник' }[r] || r
}

async function sendDonate() {
  const amount = parseFloat(donateAmount.value)
  if (!amount || amount <= 0) return
  donateLoading.value = true
  try {
    await runCommand(`/nationdonate ${amount}`)
    show(t('gameUiTreasury.donateQueued'), true)
    donateAmount.value = ''
    setTimeout(load, 1500)
  } catch (e) {
    show(e.message || t('gameUiTreasury.donateFail'), false)
  } finally {
    donateLoading.value = false
  }
}
</script>

<template>
  <div class="gui-root">
    <header class="gui-header">
      <span class="gui-title"><span class="gui-title-icon">🏦</span>{{ t('gameUiTreasury.title') }}</span>
      <button class="gui-close" @click="closeGui">✕</button>
    </header>

    <GameUiNav current="treasury" />

    <div v-if="!token" class="gui-state"><span class="gui-state-icon">🔒</span><span class="gui-state-text">{{ t('gameUiTreasury.tokenError') }}</span></div>
    <div v-else-if="loading && !summary" class="gui-state"><span class="gui-spinner" /><span class="gui-state-sub">{{ t('gameUiTreasury.loading') }}</span></div>
    <div v-else-if="error" class="gui-state"><span class="gui-state-icon">⚠️</span><span class="gui-state-text">{{ error }}</span></div>

    <div v-else-if="summary" class="gui-body">
      <!-- Balance hero -->
      <div class="gui-card-hero balance">
        <div class="balance-top">
          <span class="balance-label">{{ t('gameUiTreasury.balance') }}</span>
          <span class="role-chip">{{ roleLabel(summary.role) }}</span>
        </div>
        <div class="balance-value">{{ money(summary.stats.treasury_balance) }}</div>
        <div class="balance-nation">{{ summary.nation_title }}</div>
      </div>

      <!-- Stats -->
      <div class="stats">
        <div class="stat"><div class="stat-num">{{ summary.stats.territory_points }}</div><div class="stat-lbl">{{ t('gameUiTreasury.territory') }}</div></div>
        <div class="stat"><div class="stat-num">{{ summary.stats.prestige_score }}</div><div class="stat-lbl">{{ t('gameUiTreasury.prestige') }}</div></div>
        <div class="stat"><div class="stat-num">{{ summary.stats.pvp_kills }}</div><div class="stat-lbl">{{ t('gameUiTreasury.pvp') }}</div></div>
      </div>

      <!-- Donate -->
      <div class="gui-card donate">
        <div class="gui-section-title">{{ t('gameUiTreasury.donateTitle') }}</div>
        <div class="donate-row">
          <input v-model="donateAmount" type="number" min="1" class="gui-input" :placeholder="t('gameUiTreasury.donateAmount')" @keydown.enter="sendDonate" />
          <button class="gui-btn gui-btn-primary gui-btn-sm" @click="sendDonate" :disabled="donateLoading || !donateAmount">
            {{ donateLoading ? '…' : t('gameUiTreasury.donateBtn') }}
          </button>
        </div>
      </div>

      <!-- Transactions -->
      <div class="tx">
        <div class="gui-section-title">{{ t('gameUiTreasury.txHistory') }}</div>
        <div v-if="!summary.transactions.items?.length" class="tx-empty">{{ t('gameUiTreasury.noTx') }}</div>
        <div v-else class="tx-list">
          <div v-for="item in summary.transactions.items" :key="item.id" class="tx-row">
            <div class="tx-dot" :class="item.net_amount >= 0 ? 'pos' : 'neg'" />
            <div class="tx-main">
              <span class="tx-type">{{ txTypeLabel(item.transaction_type) }}</span>
              <span class="tx-date">{{ formatDate(item.created_at) }}</span>
            </div>
            <div class="tx-amount" :class="item.net_amount >= 0 ? 'pos' : 'neg'">
              {{ item.net_amount >= 0 ? '+' : '' }}{{ money(item.net_amount) }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <transition name="gui-toast">
      <div v-if="toast" class="gui-toast" :class="toast.ok ? 'gui-toast-ok' : 'gui-toast-err'">
        <span>{{ toast.ok ? '✅' : '⚠️' }}</span><span>{{ toast.text }}</span>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.balance { padding: 18px 20px; text-align: center; }
.balance-top { display: flex; align-items: center; justify-content: space-between; }
.balance-label { font-size: 0.72rem; font-weight: 700; color: #aab6d4; text-transform: uppercase; letter-spacing: 0.1em; }
.role-chip { font-size: 0.66rem; font-weight: 700; color: #a78bfa; background: rgba(167, 139, 250, 0.14); border-radius: 999px; padding: 2px 9px; }
.balance-value {
  font-size: 2.1rem; font-weight: 900; margin: 8px 0 2px;
  background: linear-gradient(90deg, #c4b5fd, #a78bfa);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
}
.balance-nation { font-size: 0.82rem; color: #6b7a9c; }

.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 9px; }
.stat {
  background: rgba(255, 255, 255, 0.035);
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 12px;
  padding: 12px 8px;
  text-align: center;
}
.stat-num { font-size: 1.2rem; font-weight: 800; color: #e8eefc; }
.stat-lbl { font-size: 0.66rem; color: #6b7a9c; margin-top: 3px; text-transform: uppercase; letter-spacing: 0.05em; }

.donate-row { display: flex; gap: 8px; }

.tx { display: flex; flex-direction: column; }
.tx-empty { font-size: 0.82rem; color: #6b7a9c; text-align: center; padding: 14px; }
.tx-list { display: flex; flex-direction: column; gap: 5px; }
.tx-row {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 11px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid rgba(148, 163, 184, 0.08);
}
.tx-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.tx-dot.pos { background: #4ade80; box-shadow: 0 0 7px rgba(74, 222, 128, 0.6); }
.tx-dot.neg { background: #f87171; box-shadow: 0 0 7px rgba(248, 113, 113, 0.6); }
.tx-main { flex: 1; display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.tx-type { font-size: 0.82rem; color: #cbd5e1; }
.tx-date { font-size: 0.7rem; color: #6b7a9c; }
.tx-amount { font-size: 0.86rem; font-weight: 700; flex-shrink: 0; }
.tx-amount.pos { color: #4ade80; }
.tx-amount.neg { color: #f87171; }
</style>
