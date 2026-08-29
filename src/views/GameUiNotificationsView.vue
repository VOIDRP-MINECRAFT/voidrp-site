<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import '../assets/gui-premium.css'
import { getNotificationHistory, dismissNotification, setWebguiToken } from '../services/gameUiApi.js'
import { useWebGuiToken } from '../composables/useWebGui.js'
import GameUiSidebar from '../components/GameUiSidebar.vue'
import GameUiStarfield from '../components/GameUiStarfield.vue'
import GameUiTopBar from '../components/GameUiTopBar.vue'
import GuiIcon from '../components/GuiIcon.vue'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const token = useWebGuiToken()
setWebguiToken(token)

const items = ref([])
const loading = ref(true)
const error = ref(null)

const ICONS = new Set(['battlepass','crown','coins','alliance','quest','treasury','tech','users','gift','trophy','shield','bell','market','star','sparkles'])
const PAGE_ROUTES = {
  menu: 'game-ui-menu', market: 'game-ui-market', nmarket: 'game-ui-nmarket',
  treasury: 'game-ui-treasury', research: 'game-ui-research', alliance: 'game-ui-alliance',
  battlepass: 'game-ui-battlepass', quests: 'game-ui-quests', leaderboards: 'game-ui-leaderboards',
}

function isItemIcon(n) { return n.icon && !ICONS.has(n.icon) }
function itemUrl(id) { return `/item-icons/minecraft/${String(id).toLowerCase().replace('minecraft:', '')}.png` }

function timeAgo(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return t('gameUiNotifications.now')
  const m = Math.floor(s / 60)
  if (m < 60) return t('gameUiNotifications.minAgo', { n: m })
  const h = Math.floor(m / 60)
  if (h < 24) return t('gameUiNotifications.hourAgo', { n: h })
  const d = Math.floor(h / 24)
  return t('gameUiNotifications.dayAgo', { n: d })
}

async function load() {
  loading.value = true
  error.value = null
  try {
    const d = await getNotificationHistory()
    items.value = d?.items || []
  } catch (e) {
    error.value = e?.message || 'error'
  } finally {
    loading.value = false
  }
}

function act(n) {
  if (n.action_type !== 'route' || !n.action_payload) return
  const name = PAGE_ROUTES[n.action_payload]
  if (!name) return
  const raw = route.query.webgui_token
  const webgui_token = Array.isArray(raw) ? raw[0] : raw
  router.push({ name, query: webgui_token ? { webgui_token } : {} })
}

async function dismiss(n) {
  items.value = items.value.filter((x) => x.id !== n.id)
  try { await dismissNotification(n.id) } catch { /* keep it removed locally */ }
}

onMounted(load)
</script>

<template>
  <section class="gp-shell">
    <GameUiStarfield />
    <GameUiSidebar current="notifications" />
    <GameUiTopBar :title="t('gameUiNav.notifications')" />

    <div class="gp-wrap gp-wrap--narrow gp-wrap--app">
      <div v-if="!token" class="gp-center"><div class="gp-card gp-state"><span class="gp-state-ico"><GuiIcon name="lock" :size="30" /></span><span class="gp-state-text">{{ t('gameUiNotifications.tokenError') }}</span></div></div>
      <div v-else-if="loading" class="gp-center"><span class="gp-spinner"></span></div>
      <div v-else-if="error" class="gp-center"><div class="gp-card gp-state"><span class="gp-state-ico"><GuiIcon name="alert" :size="30" /></span><span class="gp-state-text">{{ error }}</span></div></div>

      <div v-else class="gp-panel">
        <div class="gp-phead">
          <span class="gp-phead-ic"><GuiIcon name="bell" :size="16" /></span>
          <span class="gp-phead-tt">{{ t('gameUiNav.notifications') }}</span>
        </div>

        <div v-if="!items.length" class="gp-state" style="padding:48px">
          <span class="gp-state-ico"><GuiIcon name="bell" :size="30" /></span>
          <span class="gp-state-text">{{ t('gameUiNotifications.empty') }}</span>
        </div>

        <div v-else class="nc-list gp-stagger">
          <div v-for="n in items" :key="n.id" class="nc-row" :class="{ unseen: !n.seen_at }" :style="n.accent ? { '--nac': n.accent } : {}">
            <span class="nc-ico" :style="n.accent ? { color: n.accent } : {}">
              <img v-if="isItemIcon(n)" :src="itemUrl(n.icon)" alt="" @error="$event.target.style.display='none'" />
              <GuiIcon v-else :name="n.icon || 'bell'" :size="20" />
            </span>
            <div class="nc-body">
              <div class="nc-title">{{ n.title }}</div>
              <div v-if="n.body" class="nc-text">{{ n.body }}</div>
              <div class="nc-meta">
                <span class="nc-time">{{ timeAgo(n.created_at) }}</span>
                <button v-if="n.action_type === 'route' && n.action_label" class="nc-act" @click="act(n)">
                  {{ n.action_label }}<GuiIcon name="chevronRight" :size="12" />
                </button>
              </div>
            </div>
            <button class="nc-dismiss" :title="t('gameUiNotifications.dismiss')" @click="dismiss(n)">
              <GuiIcon name="x" :size="14" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.nc-list { display: flex; flex-direction: column; gap: 9px; }
.nc-row {
  display: flex; align-items: flex-start; gap: 12px; padding: 12px 14px;
  border-radius: 14px; border: 1px solid var(--gp-line); background: rgba(255,255,255,0.022);
  box-shadow: inset 3px 0 0 var(--nac, transparent);
}
.nc-row.unseen { background: rgba(139,123,255,0.06); border-color: rgba(139,123,255,0.22); }
.nc-ico {
  flex-shrink: 0; width: 38px; height: 38px; display: grid; place-items: center; border-radius: 10px;
  background: rgba(0,0,0,0.28); border: 1px solid var(--gp-line); color: var(--gp-violet-2);
}
.nc-ico img { width: 24px; height: 24px; image-rendering: pixelated; }
.nc-body { flex: 1; min-width: 0; }
.nc-title { font-size: 0.92rem; font-weight: 800; color: #eef2ff; }
.nc-text { font-size: 0.8rem; color: var(--gp-ink-soft, #b9c0d8); margin-top: 2px; line-height: 1.35; }
.nc-meta { display: flex; align-items: center; gap: 12px; margin-top: 7px; }
.nc-time { font-size: 0.68rem; color: var(--gp-ink-dim, #8a90a8); font-weight: 600; }
.nc-act {
  display: inline-flex; align-items: center; gap: 3px; padding: 4px 9px; border-radius: 8px;
  border: 1px solid rgba(139,123,255,0.35); background: rgba(139,123,255,0.14); color: #cabfff;
  font-family: inherit; font-size: 0.72rem; font-weight: 700; cursor: pointer; transition: background 0.14s;
}
.nc-act:hover { background: rgba(139,123,255,0.24); }
.nc-dismiss {
  flex-shrink: 0; width: 26px; height: 26px; display: grid; place-items: center; border-radius: 8px;
  border: 1px solid transparent; background: none; color: var(--gp-ink-dim, #8a90a8); cursor: pointer; transition: color 0.14s, background 0.14s;
}
.nc-dismiss:hover { color: #fda4af; background: rgba(251,111,132,0.1); }
</style>
