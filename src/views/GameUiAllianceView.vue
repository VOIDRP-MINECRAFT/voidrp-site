<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import '../assets/gameui.css'
import { getMyAlliance, setWebguiToken } from '../services/gameUiApi.js'
import { useWebGuiToken, runCommand, closeGui, useActionToast } from '../composables/useWebGui.js'
import GameUiNav from '../components/GameUiNav.vue'

const { t } = useI18n()
const token = useWebGuiToken()
setWebguiToken(token)
const { toast, show } = useActionToast()

const alliance = ref(null)
const loading = ref(false)
const error = ref(null)
const emptyMsg = ref(null)
const tab = ref('members')

async function load() {
  loading.value = true
  try {
    alliance.value = await getMyAlliance()
    error.value = null
    emptyMsg.value = null
  } catch (e) {
    // 404 = player not in a nation / nation not in an alliance — a normal state,
    // not an error. Show a calm empty view instead of a red error.
    if (e.status === 404) {
      emptyMsg.value = e.message
      alliance.value = null
      error.value = null
    } else {
      error.value = e.message
    }
  } finally {
    loading.value = false
  }
}

onMounted(load)

const openCount = computed(() =>
  alliance.value ? alliance.value.proposals.filter(p => p.status === 'open').length : 0,
)

function money(v) {
  if (v == null || Number.isNaN(Number(v))) return '0'
  return Number(v).toLocaleString('ru-RU', { maximumFractionDigits: 0 })
}

function formatDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

async function vote(p, choice) {
  try {
    await runCommand(`/alliance vote ${p.id} ${choice}`)
    show(t('gameUiAlliance.voteSent'), true)
    setTimeout(load, 1200)
  } catch (e) {
    show(e.message || t('gameUiAlliance.voteFail'), false)
  }
}

function typeLabel(type) {
  return { nato: 'НАТО', un: 'ООН', economic: 'Экономический' }[type] || type
}
function roleLabel(r) {
  return { founder: 'Основатель', leader: 'Лидер', member: 'Участник' }[r] || r
}
function propTypeLabel(type) {
  return { add_member: 'Принятие', remove_member: 'Исключение', set_policy: 'Политика', treasury_transfer: 'Перевод' }[type] || type
}
function statusBadge(s) {
  return { open: 'gui-badge-warning', approved: 'gui-badge-success', rejected: 'gui-badge-error', executed: 'gui-badge-info', expired: 'gui-badge-neutral' }[s] || 'gui-badge-neutral'
}
function statusLabel(s) {
  return { open: 'открыто', approved: 'одобрено', rejected: 'отклонено', executed: 'исполнено', expired: 'истекло' }[s] || s
}
</script>

<template>
  <div class="gui-root">
    <header class="gui-header">
      <span class="gui-title"><span class="gui-title-icon">🤝</span>{{ t('gameUiAlliance.title') }}</span>
      <button class="gui-close" @click="closeGui">✕</button>
    </header>

    <GameUiNav current="alliance" />

    <div v-if="!token" class="gui-state"><span class="gui-state-icon">🔒</span><span class="gui-state-text">{{ t('gameUiAlliance.tokenError') }}</span></div>
    <div v-else-if="loading" class="gui-state"><span class="gui-spinner" /><span class="gui-state-sub">{{ t('gameUiAlliance.loading') }}</span></div>
    <div v-else-if="emptyMsg" class="gui-state">
      <span class="gui-state-icon">🤝</span>
      <span class="gui-state-text">{{ emptyMsg }}</span>
      <span class="gui-state-sub">{{ t('gameUiAlliance.emptyHint') }}</span>
    </div>
    <div v-else-if="error" class="gui-state"><span class="gui-state-icon">⚠️</span><span class="gui-state-text">{{ error }}</span></div>

    <div v-else-if="alliance" class="gui-body">
      <!-- Alliance hero -->
      <div class="al-hero">
        <div class="al-tag">{{ alliance.tag }}</div>
        <div class="al-info">
          <div class="al-title">{{ alliance.title }}</div>
          <div class="al-meta">{{ typeLabel(alliance.alliance_type) }} · {{ alliance.members.length }} {{ t('gameUiAlliance.nations') }}</div>
          <div class="al-treasury">💰 {{ money(alliance.treasury_balance) }}</div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="gui-tabs">
        <button class="gui-tab" :class="{ active: tab === 'members' }" @click="tab = 'members'">{{ t('gameUiAlliance.tabMembers') }}</button>
        <button class="gui-tab" :class="{ active: tab === 'proposals' }" @click="tab = 'proposals'">
          {{ t('gameUiAlliance.tabProposals') }}
          <span v-if="openCount" class="gui-tab-count">{{ openCount }}</span>
        </button>
      </div>

      <!-- Members -->
      <div v-if="tab === 'members'" class="al-members">
        <div v-for="m in alliance.members" :key="m.nation_slug" class="gui-row al-member" :class="{ self: m.nation_slug === alliance.player_nation_slug }">
          <div class="al-mtag">{{ m.nation_tag }}</div>
          <div class="al-minfo">
            <span class="al-mname">{{ m.nation_title }}</span>
            <span class="al-mrole" :class="{ founder: m.role === 'founder' }">{{ roleLabel(m.role) }}</span>
          </div>
          <span v-if="m.nation_slug === alliance.player_nation_slug" class="al-you">ВЫ</span>
        </div>
      </div>

      <!-- Proposals -->
      <div v-else class="al-proposals">
        <div v-if="!alliance.proposals.length" class="al-empty">{{ t('gameUiAlliance.noProposals') }}</div>
        <div v-for="p in alliance.proposals" :key="p.id" class="al-prop">
          <div class="al-prop-head">
            <span class="al-prop-title">{{ p.title }}</span>
            <span class="gui-badge" :class="statusBadge(p.status)">{{ statusLabel(p.status) }}</span>
          </div>
          <div class="al-prop-meta">{{ propTypeLabel(p.proposal_type) }} · {{ formatDate(p.created_at) }}</div>
          <div v-if="p.description" class="al-prop-desc">{{ p.description }}</div>
          <div class="al-votes">
            <span class="vote-stat yes">✅ {{ p.yes_count }}</span>
            <span class="vote-stat no">❌ {{ p.no_count }}</span>
            <span class="vote-stat veto">🚫 {{ p.veto_count }}</span>
          </div>
          <div v-if="p.status === 'open'" class="al-actions">
            <button class="gui-btn gui-btn-success gui-btn-xs" @click="vote(p, 'yes')">{{ t('gameUiAlliance.voteYes') }}</button>
            <button class="gui-btn gui-btn-danger gui-btn-xs" @click="vote(p, 'no')">{{ t('gameUiAlliance.voteNo') }}</button>
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
.al-hero {
  display: flex; align-items: center; gap: 14px;
  padding: 15px;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(56, 189, 248, 0.12), rgba(99, 102, 241, 0.08));
  border: 1px solid rgba(56, 189, 248, 0.25);
}
.al-tag {
  width: 56px; height: 56px;
  border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.8rem; font-weight: 900;
  color: #7dd3fc;
  background: rgba(56, 189, 248, 0.14);
  border: 1px solid rgba(56, 189, 248, 0.3);
  flex-shrink: 0;
}
.al-info { flex: 1; min-width: 0; }
.al-title { font-size: 1.05rem; font-weight: 800; }
.al-meta { font-size: 0.76rem; color: #94a3b8; margin: 3px 0; }
.al-treasury { font-size: 0.8rem; font-weight: 600; color: #fcd34d; }

.al-members, .al-proposals { display: flex; flex-direction: column; gap: 7px; }

.al-member.self { border-color: rgba(129, 140, 248, 0.4); background: rgba(99, 102, 241, 0.08); }
.al-mtag {
  width: 36px; height: 36px;
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.62rem; font-weight: 800;
  color: #818cf8;
  background: rgba(129, 140, 248, 0.1);
  border: 1px solid rgba(129, 140, 248, 0.2);
  flex-shrink: 0;
}
.al-minfo { flex: 1; min-width: 0; }
.al-mname { display: block; font-size: 0.86rem; font-weight: 600; }
.al-mrole { font-size: 0.72rem; color: #6b7a9c; }
.al-mrole.founder { color: #fcd34d; }
.al-you { font-size: 0.64rem; font-weight: 800; letter-spacing: 0.05em; color: #818cf8; background: rgba(129, 140, 248, 0.16); padding: 3px 7px; border-radius: 6px; }

.al-empty { font-size: 0.85rem; color: #6b7a9c; text-align: center; padding: 24px; }

.al-prop {
  display: flex; flex-direction: column; gap: 6px;
  padding: 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid rgba(148, 163, 184, 0.1);
}
.al-prop-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.al-prop-title { font-size: 0.9rem; font-weight: 700; }
.al-prop-meta { font-size: 0.72rem; color: #6b7a9c; }
.al-prop-desc { font-size: 0.8rem; color: #94a3b8; line-height: 1.45; }
.al-votes { display: flex; gap: 12px; margin-top: 2px; }
.vote-stat { font-size: 0.76rem; font-weight: 600; }
.vote-stat.yes { color: #4ade80; }
.vote-stat.no { color: #f87171; }
.vote-stat.veto { color: #fb923c; }
.al-actions { display: flex; gap: 7px; margin-top: 4px; }
</style>
