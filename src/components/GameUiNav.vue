<script setup>
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

const props = defineProps({
  current: { type: String, default: '' },
})

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const items = [
  { key: 'home',       icon: '🏠', route: 'game-ui-menu' },
  { key: 'market',     icon: '🛒', route: 'game-ui-market' },
  { key: 'nmarket',    icon: '🏷️', route: 'game-ui-nmarket' },
  { key: 'treasury',   icon: '🏦', route: 'game-ui-treasury' },
  { key: 'research',   icon: '🔬', route: 'game-ui-research' },
  { key: 'alliance',   icon: '🤝', route: 'game-ui-alliance' },
  { key: 'battlepass', icon: '⭐', route: 'game-ui-battlepass' },
  { key: 'quests',     icon: '📜', route: 'game-ui-quests' },
]

// Switch pages inside the SPA, preserving the webgui_token in the URL so the
// target page authenticates. (The old approach fired an in-game command via the
// mod bridge, which didn't reliably re-open the page.)
function go(item) {
  if (item.key === props.current) return
  const raw = route.query.webgui_token
  const webgui_token = Array.isArray(raw) ? raw[0] : raw
  router.push({ name: item.route, query: webgui_token ? { webgui_token } : {} })
}
</script>

<template>
  <nav class="gnav">
    <button
      v-for="item in items"
      :key="item.key"
      class="gnav-tab"
      :class="{ active: item.key === current }"
      @click="go(item)"
    >
      <span class="gnav-ic">{{ item.icon }}</span>
      <span class="gnav-lbl">{{ t('gameUiNav.' + item.key) }}</span>
    </button>
  </nav>
</template>

<style scoped>
/* Mobile-style floating bottom tab bar — its own elevated layer over the GUI.
   GUI pages have an opaque background, so the drop shadow renders cleanly. */
.gnav {
  position: fixed;
  left: 50%;
  bottom: 14px;
  transform: translateX(-50%);
  width: calc(100% - 28px);
  max-width: 540px;
  z-index: 60;
  display: flex;
  gap: 3px;
  padding: 6px;
  border-radius: 20px;
  background: rgba(10, 12, 24, 0.9);
  border: 1px solid rgba(150, 168, 220, 0.16);
  box-shadow: 0 16px 40px -12px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(14px);
}

.gnav-tab {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 7px 2px 6px;
  border: none;
  border-radius: 14px;
  background: transparent;
  color: #7c889f;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.16s, color 0.16s, transform 0.1s;
}
.gnav-tab:hover { color: #c3cdec; }
.gnav-tab:active { transform: scale(0.9); }
.gnav-tab.active {
  color: #fff;
  background: linear-gradient(135deg, #7c6bff, #b45cf0);
  box-shadow: 0 6px 18px -4px rgba(139, 123, 255, 0.6);
}

.gnav-ic {
  font-size: 1.15rem;
  line-height: 1;
  transition: transform 0.16s;
}
.gnav-tab.active .gnav-ic { transform: translateY(-1px) scale(1.06); }
.gnav-lbl {
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.01em;
  line-height: 1;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
