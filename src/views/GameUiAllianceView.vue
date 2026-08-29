<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import '../assets/gui-premium.css'
import { getMyAlliance, setWebguiToken } from '../services/gameUiApi.js'
import { useWebGuiToken, runCommand, useActionToast } from '../composables/useWebGui.js'
import GameUiSidebar from '../components/GameUiSidebar.vue'
import GameUiStarfield from '../components/GameUiStarfield.vue'
import GameUiTopBar from '../components/GameUiTopBar.vue'
import GuiIcon from '../components/GuiIcon.vue'
import CountUp from '../components/CountUp.vue'

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
    if (e.status === 404) { emptyMsg.value = e.message; alliance.value = null; error.value = null }
    else error.value = e.message
  } finally {
    loading.value = false
  }
}
onMounted(load)

const openCount = computed(() => alliance.value ? alliance.value.proposals.filter(p => p.status === 'open').length : 0)

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
function typeLabel(type) { return { nato: t('gameUiAlliance.typeNato'), un: t('gameUiAlliance.typeUn'), economic: t('gameUiAlliance.typeEconomic') }[type] || type }
function roleLabel(r) { return { founder: t('gameUiAlliance.roleFounder'), leader: t('gameUiAlliance.roleLeader'), member: t('gameUiAlliance.roleMember') }[r] || r }
function propTypeLabel(type) { return { add_member: t('gameUiAlliance.propAdd'), remove_member: t('gameUiAlliance.propRemove'), set_policy: t('gameUiAlliance.propPolicy'), treasury_transfer: t('gameUiAlliance.propTransfer') }[type] || type }
function statusPill(s) { return { open: 'gp-pill--gold', approved: 'gp-pill--green', rejected: 'gp-pill--red', executed: 'gp-pill--violet', expired: 'gp-pill--muted' }[s] || 'gp-pill--muted' }
function statusLabel(s) { return { open: t('gameUiAlliance.statusOpen'), approved: t('gameUiAlliance.statusApproved'), rejected: t('gameUiAlliance.statusRejected'), executed: t('gameUiAlliance.statusExecuted'), expired: t('gameUiAlliance.statusExpired') }[s] || s }
</script>

<template>
  <section class="gp-shell">
    <GameUiStarfield />
    <GameUiSidebar current="alliance" />
    <GameUiTopBar :title="t('gameUiNav.alliance')" />

    <div class="gp-wrap gp-wrap--wide gp-wrap--app">
      <div v-if="!token" class="gp-center"><div class="gp-card gp-state"><span class="gp-state-ico"><GuiIcon name="lock" :size="30" /></span><span class="gp-state-text">{{ t('gameUiAlliance.tokenError') }}</span></div></div>
      <div v-else-if="loading && !alliance" class="gp-center"><span class="gp-spinner"></span></div>
      <div v-else-if="emptyMsg" class="gp-center"><div class="gp-card gp-state"><span class="gp-state-ico"><GuiIcon name="alliance" :size="30" /></span><span class="gp-state-text">{{ emptyMsg }}</span><span class="gp-sub gp-muted">{{ t('gameUiAlliance.emptyHint') }}</span></div></div>
      <div v-else-if="error" class="gp-center"><div class="gp-card gp-state"><span class="gp-state-ico"><GuiIcon name="alert" :size="30" /></span><span class="gp-state-text">{{ error }}</span></div></div>

      <template v-else-if="alliance">
        <div class="adash gp-grow">
          <!-- LEFT: emblem + stats -->
          <div class="gp-panel emblem-panel">
            <div class="emblem">
              <div class="emblem-mark">{{ alliance.tag }}</div>
              <div class="emblem-glow"></div>
            </div>
            <div class="emblem-title">{{ alliance.title }}</div>
            <div class="emblem-sub"><GuiIcon name="crown" :size="13" />{{ typeLabel(alliance.alliance_type) }}</div>
            <div class="emblem-motto">{{ t('gameUiAlliance.motto') }}</div>

            <div class="astats">
              <div class="astat"><span class="as-lbl"><GuiIcon name="users" :size="15" />{{ t('gameUiAlliance.membersCount') }}</span><span class="as-val gp-num">{{ alliance.members.length }}</span></div>
              <div class="astat"><span class="as-lbl"><GuiIcon name="treasury" :size="15" />{{ t('gameUiAlliance.treasury') }}</span><span class="as-val gp-num gold"><CountUp :value="alliance.treasury_balance" :format="money" /></span></div>
              <div class="astat"><span class="as-lbl"><GuiIcon name="quest" :size="15" />{{ t('gameUiAlliance.openProps') }}</span><span class="as-val gp-num">{{ openCount }}</span></div>
            </div>
          </div>

          <!-- RIGHT: members / proposals -->
          <div class="gp-panel">
            <div class="gp-phead">
              <span class="gp-phead-ic"><GuiIcon name="alliance" :size="16" /></span>
              <span class="gp-phead-tt">{{ tab === 'members' ? t('gameUiAlliance.tabMembers') : t('gameUiAlliance.tabProposals') }}</span>
              <span class="gp-phead-sp"></span>
              <div class="gp-seg">
                <button class="gp-seg-btn" :class="{ active: tab==='members' }" @click="tab='members'">{{ t('gameUiAlliance.tabMembers') }}</button>
                <button class="gp-seg-btn" :class="{ active: tab==='proposals' }" @click="tab='proposals'">{{ t('gameUiAlliance.tabProposals') }}<span v-if="openCount" class="count">{{ openCount }}</span></button>
              </div>
            </div>

            <!-- members table -->
            <table v-if="tab === 'members'" class="gp-table">
              <thead><tr><th>{{ t('gameUiAlliance.thNation') }}</th><th>{{ t('gameUiAlliance.thRole') }}</th><th></th></tr></thead>
              <tbody>
                <tr v-for="m in alliance.members" :key="m.nation_slug">
                  <td>
                    <div class="m-cell">
                      <span class="m-tag">{{ m.nation_tag }}</span>
                      <span class="m-name">{{ m.nation_title }}</span>
                    </div>
                  </td>
                  <td><span class="m-role" :class="{ founder: m.role === 'founder' }"><GuiIcon v-if="m.role==='founder'" name="crown" :size="13" />{{ roleLabel(m.role) }}</span></td>
                  <td style="text-align:right">
                    <span v-if="m.nation_slug === alliance.player_nation_slug" class="gp-pill gp-pill--violet">{{ t('gameUiAlliance.you') }}</span>
                  </td>
                </tr>
              </tbody>
            </table>

            <!-- proposals -->
            <div v-else class="prop-list">
              <div v-if="!alliance.proposals.length" class="gp-state" style="padding:28px"><span class="gp-state-ico"><GuiIcon name="clipboard" :size="30" /></span><span class="gp-state-text">{{ t('gameUiAlliance.noProposals') }}</span></div>
              <div v-for="p in alliance.proposals" :key="p.id" class="prop">
                <div class="prop-head">
                  <span class="prop-title">{{ p.title }}</span>
                  <span class="gp-pill" :class="statusPill(p.status)">{{ statusLabel(p.status) }}</span>
                </div>
                <div class="prop-meta gp-muted">{{ propTypeLabel(p.proposal_type) }} · {{ formatDate(p.created_at) }}</div>
                <div v-if="p.description" class="prop-desc">{{ p.description }}</div>
                <div class="votes gp-num">
                  <span class="v-yes"><GuiIcon name="check" :size="13" />{{ p.yes_count }}</span>
                  <span class="v-no"><GuiIcon name="x" :size="13" />{{ p.no_count }}</span>
                  <span class="v-veto"><GuiIcon name="shield" :size="13" />{{ p.veto_count }}</span>
                </div>
                <div v-if="p.status === 'open'" class="prop-actions">
                  <button class="gp-btn gp-btn--sm vote-yes" @click="vote(p, 'yes')">{{ t('gameUiAlliance.voteYes') }}</button>
                  <button class="gp-btn gp-btn--sm vote-no" @click="vote(p, 'no')">{{ t('gameUiAlliance.voteNo') }}</button>
                </div>
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
.adash { display: grid; grid-template-columns: 300px minmax(0,1fr); gap: 16px; align-items: start; }
@media (max-width: 900px) { .adash { grid-template-columns: 1fr; } }

/* emblem */
.emblem-panel { align-items: center; text-align: center; gap: 10px; }
.emblem { position: relative; width: 96px; height: 96px; display: grid; place-items: center; margin: 4px 0; }
.emblem-mark {
  position: relative; z-index: 1; width: 82px; height: 82px; display: grid; place-items: center; border-radius: 22px;
  font-size: 1.2rem; font-weight: 900; letter-spacing: 0.02em; color: #e6ddff;
  background: linear-gradient(160deg, rgba(139,123,255,0.34), rgba(217,70,239,0.14));
  border: 1px solid rgba(139,123,255,0.5); box-shadow: inset 0 1px 0 rgba(255,255,255,0.12);
}
.emblem-glow { position: absolute; inset: -8px; border-radius: 50%; background: radial-gradient(circle, rgba(139,123,255,0.5), transparent 65%); filter: blur(14px); }
.emblem-title { font-size: 1.25rem; font-weight: 900; color: #f4f7ff; }
.emblem-sub { display: inline-flex; align-items: center; gap: 6px; font-size: 0.74rem; font-weight: 700; color: var(--gp-violet-2); }
.emblem-motto { font-size: 0.76rem; color: var(--gp-ink-soft); line-height: 1.5; font-style: italic; padding: 0 6px; }

.astats { width: 100%; display: flex; flex-direction: column; gap: 8px; margin-top: 6px; }
.astat { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-radius: 11px; border: 1px solid var(--gp-line); background: rgba(255,255,255,0.02); }
.as-lbl { display: flex; align-items: center; gap: 8px; font-size: 0.78rem; color: var(--gp-ink-soft); }
.as-lbl svg { color: var(--gp-violet-2); }
.as-val { font-size: 0.92rem; font-weight: 800; color: #eef2ff; }
.as-val.gold { color: var(--gp-gold); }

/* members */
.m-cell { display: flex; align-items: center; gap: 10px; }
.m-tag { width: 34px; height: 30px; flex-shrink: 0; display: grid; place-items: center; border-radius: 8px; font-size: 0.58rem; font-weight: 800; color: #c9beff; background: rgba(139,123,255,0.14); border: 1px solid rgba(139,123,255,0.26); }
.m-name { font-size: 0.86rem; font-weight: 700; color: #e8edfb; }
.m-role { display: inline-flex; align-items: center; gap: 5px; font-size: 0.8rem; color: var(--gp-ink-soft); }
.m-role.founder { color: var(--gp-gold); font-weight: 700; }

/* proposals */
.prop-list { display: flex; flex-direction: column; gap: 9px; }
.prop { display: flex; flex-direction: column; gap: 7px; padding: 13px; border-radius: 13px; border: 1px solid var(--gp-line); background: rgba(255,255,255,0.02); }
.prop-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.prop-title { font-size: 0.9rem; font-weight: 800; color: #eef2ff; }
.prop-meta { font-size: 0.7rem; }
.prop-desc { font-size: 0.82rem; line-height: 1.5; color: var(--gp-ink-soft); }
.votes { display: flex; gap: 14px; font-size: 0.8rem; font-weight: 700; margin-top: 2px; }
.v-yes { display: inline-flex; align-items: center; gap: 4px; color: var(--gp-green); }
.v-no { display: inline-flex; align-items: center; gap: 4px; color: var(--gp-red); }
.v-veto { display: inline-flex; align-items: center; gap: 4px; color: #fb923c; }
.prop-actions { display: flex; gap: 8px; margin-top: 4px; }
.vote-yes { background: linear-gradient(135deg, #16a34a, #22c55e); color: #fff; }
.vote-no { background: linear-gradient(135deg, #dc2626, #ef4444); color: #fff; }
.vote-yes:hover, .vote-no:hover { filter: brightness(1.1); }
</style>
