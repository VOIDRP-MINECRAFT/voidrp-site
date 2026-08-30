<script setup>
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import GuiIcon from './GuiIcon.vue'
import { closeGui, navigateGamePage } from '../composables/useWebGui.js'
import { getNotificationHistory, getWebguiToken, setWebguiToken } from '../services/gameUiApi.js'

const props = defineProps({ current: { type: String, default: '' } })

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

// Unread badge on the notifications tab: undismissed notifications not yet seen.
// (The one-shot toast feed runs only on the HUD overlay, so notifications fired while
// in the full menu stay unseen — this prompts opening the center.)
const unread = ref(0)
onMounted(async () => {
  // This child mounts before the parent view's onMounted sets the token, so ensure it
  // ourselves from the route — otherwise the badge fetch drops ?webgui_token= and 422s.
  if (!getWebguiToken()) {
    const raw = route.query.webgui_token
    const tok = Array.isArray(raw) ? raw[0] : raw
    if (tok) setWebguiToken(tok)
  }
  try {
    const d = await getNotificationHistory()
    unread.value = (d?.items || []).filter((n) => !n.seen_at).length
  } catch { /* silent */ }
})

// Left icon rail — the persistent in-game navigation (reference layout).
const items = [
  { key: 'home',       icon: 'home',       route: 'game-ui-menu' },
  { key: 'research',   icon: 'tech',       route: 'game-ui-research' },
  { key: 'treasury',   icon: 'treasury',   route: 'game-ui-treasury' },
  { key: 'alliance',   icon: 'alliance',   route: 'game-ui-alliance' },
  { key: 'quests',     icon: 'quest',      route: 'game-ui-quests' },
  { key: 'leaderboards', icon: 'trophy',   route: 'game-ui-leaderboards' },
  { key: 'upgrader',     icon: 'voidcoin',  route: 'game-ui-upgrader' },
  { key: 'notifications', icon: 'bell',    route: 'game-ui-notifications' },
  { key: 'market',     icon: 'market',     route: 'game-ui-market' },
  { key: 'nmarket',    icon: 'globe',      route: 'game-ui-nmarket' },
  { key: 'battlepass', icon: 'battlepass', route: 'game-ui-battlepass' },
  { key: 'settings',   icon: 'settings',   route: 'game-ui-settings' },
]

function go(item) {
  if (item.key === props.current) return
  const raw = route.query.webgui_token
  const webgui_token = Array.isArray(raw) ? raw[0] : raw
  navigateGamePage(router, item.route, webgui_token)   // bridge in-game, soft-nav in browser
}
</script>

<template>
  <aside class="grail">
    <div class="grail-logo">
      <svg viewBox="0 0 32 32" class="grail-mark" aria-hidden="true">
        <path d="M16 2 4 8v9c0 7 5.2 11.4 12 13 6.8-1.6 12-6 12-13V8z" fill="url(#gsg)" opacity=".18"/>
        <path d="M9 11l7 12 7-12-7 4z" fill="url(#gsg)"/>
        <defs><linearGradient id="gsg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8b7bff"/><stop offset="1" stop-color="#d946ef"/></linearGradient></defs>
      </svg>
    </div>

    <nav class="grail-nav">
      <button
        v-for="item in items"
        :key="item.key"
        class="grail-tab"
        :class="{ active: item.key === current }"
        :data-tip="t('gameUiNav.' + item.key)"
        @click="go(item)"
      >
        <GuiIcon :name="item.icon" :size="21" />
        <span v-if="item.key === 'notifications' && unread > 0" class="grail-badge">{{ unread > 9 ? '9+' : unread }}</span>
        <span class="grail-tip">{{ t('gameUiNav.' + item.key) }}</span>
      </button>
    </nav>

    <div class="grail-foot">
      <button class="grail-tab" :data-tip="t('gameUiNav.close')" @click="closeGui">
        <GuiIcon name="logout" :size="21" />
        <span class="grail-tip">{{ t('gameUiNav.close') }}</span>
      </button>
    </div>
  </aside>
</template>

<style scoped>
.grail {
  position: fixed;
  top: 0; left: 0; bottom: 0;
  z-index: 65;
  width: 68px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 14px 0 16px;
  gap: 10px;
  background: linear-gradient(180deg, rgba(11,13,26,0.96), rgba(9,11,22,0.92));
  border-right: 1px solid rgba(150,168,220,0.12);
  backdrop-filter: blur(16px);
}
.grail-logo { width: 40px; height: 40px; display: grid; place-items: center; margin-bottom: 8px; }
.grail-mark { width: 34px; height: 34px; filter: drop-shadow(0 0 10px rgba(139,123,255,0.6)); }

.grail-nav { display: flex; flex-direction: column; gap: 6px; flex: 1; }
.grail-foot { display: flex; flex-direction: column; gap: 6px; }

.grail-tab {
  position: relative;
  width: 44px; height: 44px;
  display: grid; place-items: center;
  border: 1px solid transparent;
  border-radius: 13px;
  background: transparent;
  color: #7c889f;
  cursor: pointer;
  transition: color .15s, background .15s, border-color .15s, transform .1s;
}
.grail-tab:hover { color: #c9d2ee; background: rgba(255,255,255,0.05); }
.grail-tab:active { transform: scale(0.9); }
.grail-tab.active {
  color: #fff;
  background: linear-gradient(135deg, rgba(124,107,255,0.9), rgba(180,92,240,0.9));
  border-color: rgba(180,140,255,0.5);
  box-shadow: 0 8px 20px -6px rgba(139,123,255,0.7);
}
.grail-badge {
  position: absolute; top: -3px; right: -3px; min-width: 16px; height: 16px; padding: 0 4px;
  display: grid; place-items: center; border-radius: 999px;
  background: linear-gradient(135deg, #fb7185, #e11d48); color: #fff;
  font-size: 9px; font-weight: 800; line-height: 1; box-shadow: 0 0 0 2px rgba(6,7,15,0.9);
}
.grail-tab.active::before {
  content: ''; position: absolute; left: -14px; top: 50%; transform: translateY(-50%);
  width: 3px; height: 22px; border-radius: 3px;
  background: linear-gradient(180deg, #8b7bff, #d946ef);
}

/* tooltip */
.grail-tip {
  position: absolute; left: calc(100% + 12px); top: 50%; transform: translateY(-50%) translateX(-6px);
  padding: 5px 10px; border-radius: 9px; white-space: nowrap;
  font-size: 0.72rem; font-weight: 700; letter-spacing: 0.02em;
  color: #eaf0ff; background: rgba(18,20,34,0.98);
  border: 1px solid rgba(150,168,220,0.18);
  box-shadow: 0 10px 26px -10px rgba(0,0,0,0.8);
  opacity: 0; pointer-events: none; transition: opacity .14s, transform .14s;
  z-index: 3;
}
.grail-tab:hover .grail-tip { opacity: 1; transform: translateY(-50%) translateX(0); }
</style>
