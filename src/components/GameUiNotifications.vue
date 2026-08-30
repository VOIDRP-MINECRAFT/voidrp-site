<script setup>
// Reactive in-game notification toasts, shown in the HUD overlay (top-right).
// Polls the one-shot feed; each notification slides in once, auto-hides, and can
// carry an action (runs a whitelisted command server-side via the web-action poll).
import { ref, onMounted, onUnmounted } from 'vue'
import { getNotifications, runGameCommand, runGameOpenPage } from '../services/gameUiApi.js'
import { useGameUiSettings } from '../composables/useGameUiSettings.js'
import { openGui, useWebGuiToken } from '../composables/useWebGui.js'
import GuiIcon from './GuiIcon.vue'

const guiSettings = useGameUiSettings()
const webguiToken = useWebGuiToken()

// Known page keys → route path; toast route-actions open the interactive GUI here.
const PAGES = new Set(['menu','market','nmarket','treasury','research','alliance','battlepass','quests','leaderboards','notifications'])
function pageUrl(page) {
  const q = webguiToken ? '?webgui_token=' + encodeURIComponent(webguiToken) : ''
  return window.location.origin + '/game-ui/' + page + q
}

const notes = ref([])
const timers = new Map()
let pollTimer = null
const AUTO_MS = 12000
const MAX = 4

// Known GuiIcon names; anything else is treated as a Minecraft item texture.
const ICONS = new Set(['battlepass','crown','coins','alliance','quest','treasury','tech','users','gift','trophy','shield','bell','market','star','sparkles'])

function isItemIcon(n) { return n.icon && !ICONS.has(n.icon) }
function itemUrl(id) { return `/item-icons/minecraft/${String(id).toLowerCase().replace('minecraft:','')}.png` }

async function poll() {
  let res
  try { res = await getNotifications() } catch { return }
  // feed is newest-first; add oldest-first so the newest ends up on top of the stack
  for (const it of (res?.items || []).slice().reverse()) {
    if (notes.value.some(n => n.id === it.id)) continue
    notes.value.unshift(it)
    while (notes.value.length > MAX) drop(notes.value[notes.value.length - 1].id)
    timers.set(it.id, setTimeout(() => drop(it.id), AUTO_MS))
  }
}
function drop(id) {
  notes.value = notes.value.filter(n => n.id !== id)
  const t = timers.get(id); if (t) { clearTimeout(t); timers.delete(id) }
}
function act(n) {
  if (!n.action_payload) { drop(n.id); return }
  if (n.action_type === 'route') {
    // Open the interactive WEBGUI page directly via the mod bridge (instant, no backend
    // round-trip); fall back to the server-polled open_gui action if the bridge isn't there.
    if (PAGES.has(n.action_payload)) {
      openGui(pageUrl(n.action_payload)).catch(() => runGameOpenPage(n.action_payload).catch(() => {}))
    } else {
      runGameOpenPage(n.action_payload).catch(() => {})
    }
  } else if (n.action_type === 'command') {
    runGameCommand(n.action_payload).catch(() => {})
  }
  drop(n.id)
}
// Triggered by the in-game "Open notification" keybind (mod dispatches it): act on the
// newest actionable toast — works during gameplay without freeing the cursor.
function actLatest() {
  const n = notes.value.find((x) => x.action_type && x.action_payload) || notes.value[0]
  if (n) act(n)
}

onMounted(() => {
  if (!guiSettings.toasts) return  // toasts disabled in webgui settings
  window.addEventListener('webgui:notifyAct', actLatest)  // mod emits this via WebviewClientEmit
  poll(); pollTimer = setInterval(poll, 8000)
})
onUnmounted(() => {
  clearInterval(pollTimer); timers.forEach((t) => clearTimeout(t))
  window.removeEventListener('webgui:notifyAct', actLatest)
})
</script>

<template>
  <transition-group tag="div" name="gnote" class="gnotes">
    <div v-for="n in notes" :key="n.id" class="gnote" :class="'ac-' + (n.accent || 'violet')"
         :style="{ cursor: n.action_payload ? 'pointer' : 'default' }" @click="act(n)">
      <span class="gnote-ic">
        <img v-if="isItemIcon(n)" :src="itemUrl(n.icon)" alt="" @error="$event.target.style.display='none'" />
        <GuiIcon v-else :name="n.icon || 'bell'" :size="18" />
      </span>
      <div class="gnote-main">
        <div class="gnote-title">{{ n.title }}</div>
        <div v-if="n.body" class="gnote-body">{{ n.body }}</div>
        <div v-if="n.action_label" class="gnote-act"><kbd class="gnote-key">↑</kbd>{{ n.action_label }}</div>
      </div>
    </div>
  </transition-group>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800&family=JetBrains+Mono:wght@700;800&display=swap');

/* CEF-safe: flat fill + crisp border (no backdrop-filter/box-shadow halo). */
.gnotes {
  position: fixed; top: 14px; right: 14px; z-index: 9998;
  display: flex; flex-direction: column; gap: 8px;
  width: 268px; pointer-events: none;
  font-family: 'Inter', system-ui, sans-serif;
}
.gnote {
  pointer-events: auto; position: relative;
  display: flex; align-items: flex-start; gap: 10px;
  padding: 10px 11px 10px 13px;
  border-radius: 12px;
  background: linear-gradient(160deg, rgba(17, 19, 36, 0.82), rgba(10, 12, 24, 0.74));
  border: 1px solid var(--ac, rgba(139,123,255,0.4));
  border-left: 3px solid var(--ac, rgba(139,123,255,0.95));
  overflow: hidden;
}
.gnote * { text-shadow: 0 1px 2px rgba(0,0,0,0.9); }
.ac-violet { --ac: #8b7bff; --acs: rgba(139,123,255,0.16); }
.ac-gold   { --ac: #fbbf24; --acs: rgba(251,191,36,0.16); }
.ac-green  { --ac: #34d399; --acs: rgba(52,211,153,0.16); }
.ac-red    { --ac: #fb7185; --acs: rgba(251,113,133,0.16); }
.ac-blue   { --ac: #38bdf8; --acs: rgba(56,189,248,0.16); }

.gnote-ic {
  width: 32px; height: 32px; flex-shrink: 0; display: grid; place-items: center;
  border-radius: 9px; color: var(--ac); background: var(--acs, rgba(139,123,255,0.16));
  border: 1px solid color-mix(in srgb, var(--ac) 38%, transparent);
}
.gnote-ic img { width: 22px; height: 22px; image-rendering: pixelated; }
.gnote-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.gnote-title { font-size: 0.78rem; font-weight: 800; color: #fff; line-height: 1.2; }
.gnote-body { font-size: 0.68rem; line-height: 1.35; color: #c3cdec; }
.gnote-act {
  align-self: flex-start; margin-top: 6px;
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 0.66rem; font-weight: 700; color: var(--ac);
}
.gnote-key {
  font-family: 'JetBrains Mono', monospace; font-size: 0.62rem; font-weight: 800; color: #eaf0ff;
  min-width: 15px; text-align: center; padding: 0 5px; border-radius: 5px; line-height: 1.5;
  background: color-mix(in srgb, var(--ac) 22%, transparent);
  border: 1px solid color-mix(in srgb, var(--ac) 55%, transparent); border-bottom-width: 2px;
}

/* slide-in from the right */
.gnote-enter-active { transition: opacity 0.3s, transform 0.35s cubic-bezier(0.22,1,0.36,1); }
.gnote-leave-active { transition: opacity 0.3s, transform 0.3s ease; position: absolute; width: 100%; }
.gnote-enter-from { opacity: 0; transform: translateX(120%); }
.gnote-leave-to { opacity: 0; transform: translateX(60%); }
.gnote-move { transition: transform 0.3s ease; }
</style>
