<script setup>
import { useI18n } from 'vue-i18n'
import { runCommand } from '../composables/useWebGui.js'

const props = defineProps({
  current: { type: String, default: '' },
})

const { t } = useI18n()

const items = [
  { key: 'market',     icon: '🛒', cmd: '/shop' },
  { key: 'nmarket',    icon: '🏷️', cmd: '/nmarket' },
  { key: 'treasury',   icon: '🏦', cmd: '/nationtreasury' },
  { key: 'alliance',   icon: '🤝', cmd: '/alliance' },
  { key: 'battlepass', icon: '⭐', cmd: '/battlepass' },
  { key: 'quests',     icon: '📜', cmd: '/dailyquest' },
]

function go(item) {
  if (item.key === props.current) return
  runCommand(item.cmd)
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
  background: rgba(15, 20, 36, 0.94);
  border: 1px solid rgba(148, 163, 184, 0.16);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.05);
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
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);
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
