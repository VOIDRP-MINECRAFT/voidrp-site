<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import '../assets/gui-premium.css'
import { setWebguiToken } from '../services/gameUiApi.js'
import { useWebGuiToken, navigateGamePage, closeGui } from '../composables/useWebGui.js'
import GameUiSidebar from '../components/GameUiSidebar.vue'
import GameUiStarfield from '../components/GameUiStarfield.vue'
import GameUiTopBar from '../components/GameUiTopBar.vue'
import GuiIcon from '../components/GuiIcon.vue'

// First-join guide: the plugin opens this page once for a brand-new player
// (after the starter kit), and it stays reachable from the sidebar.
const { t, te } = useI18n()
const token = useWebGuiToken()
setWebguiToken(token)
const route = useRoute()
const router = useRouter()

// Each step: icon + texts from i18n (gameUiWelcome.steps.<key>) + optional page to open.
const STEPS = [
  { key: 'dark', icon: 'flame' },
  { key: 'place', icon: 'map' },
  { key: 'team', icon: 'users' },
  { key: 'claim', icon: 'shield' },
  { key: 'battlepass', icon: 'battlepass', page: 'game-ui-battlepass' },
  { key: 'epochs', icon: 'map', page: 'game-ui-roadmap' },
  { key: 'menu', icon: 'home', page: 'game-ui-menu' },
]

const step = ref(0)
const cur = computed(() => STEPS[step.value])
const last = computed(() => step.value === STEPS.length - 1)
// Lines l1..l6; commands and keys are written as [[/rtp]] in the messages and shown as code.
const lines = computed(() => {
  const out = []
  for (let i = 1; i <= 6; i++) {
    const k = `gameUiWelcome.steps.${cur.value.key}.l${i}`
    if (!te(k)) break
    const esc = t(k).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    out.push(esc.replace(/\[\[(.+?)\]\]/g, '<code>$1</code>'))
  }
  return out
})

function next() { if (!last.value) step.value++ }
function prev() { if (step.value > 0) step.value-- }
function openPage(name) {
  const raw = route.query.webgui_token
  navigateGamePage(router, name, Array.isArray(raw) ? raw[0] : raw)
}
</script>

<template>
  <section class="gp-shell">
    <GameUiStarfield />
    <GameUiSidebar current="guide" />
    <GameUiTopBar :title="t('gameUiNav.guide')" />

    <div class="gp-wrap gp-wrap--narrow gp-wrap--app">
      <div class="gp-panel wl">
        <div class="wl-kicker"><GuiIcon name="sparkles" :size="13" />{{ t('gameUiWelcome.kicker') }}</div>

        <div class="wl-dots">
          <button v-for="(s, i) in STEPS" :key="s.key" class="wl-dot" :class="{ on: i === step, done: i < step }"
                  :aria-label="t(`gameUiWelcome.steps.${s.key}.title`)" @click="step = i" />
        </div>

        <transition name="wl-fade" mode="out-in">
          <div :key="cur.key" class="wl-card">
            <span class="wl-ic"><GuiIcon :name="cur.icon" :size="30" /></span>
            <div class="wl-num">{{ t('gameUiWelcome.stepOf', { n: step + 1, total: STEPS.length }) }}</div>
            <h2 class="wl-title">{{ t(`gameUiWelcome.steps.${cur.key}.title`) }}</h2>
            <ul class="wl-lines">
              <li v-for="(l, i) in lines" :key="i" v-html="l" />
            </ul>
            <button v-if="cur.page" class="gp-btn gp-btn--ghost gp-btn--sm wl-open" @click="openPage(cur.page)">
              <GuiIcon :name="cur.icon" :size="14" />{{ t(`gameUiWelcome.steps.${cur.key}.open`) }}
            </button>
          </div>
        </transition>

        <div class="wl-nav">
          <button class="gp-btn gp-btn--ghost gp-btn--sm" :disabled="step === 0" @click="prev">{{ t('gameUiWelcome.back') }}</button>
          <div style="flex:1"></div>
          <button v-if="!last" class="gp-btn gp-btn--primary gp-btn--sm" @click="next">{{ t('gameUiWelcome.next') }}</button>
          <button v-else class="gp-btn gp-btn--primary gp-btn--sm" @click="closeGui">{{ t('gameUiWelcome.done') }}</button>
        </div>
        <div class="wl-foot">{{ t('gameUiWelcome.foot') }}</div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.wl { padding: 22px 24px; display: flex; flex-direction: column; gap: 14px; }
.wl-kicker { display: flex; align-items: center; gap: 6px; font-size: 0.66rem; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: #c4b5fd; }
.wl-dots { display: flex; gap: 6px; }
.wl-dot { flex: 1; height: 5px; border-radius: 999px; border: none; cursor: pointer; background: rgba(255,255,255,0.08); transition: background .2s; }
.wl-dot.done { background: rgba(139,123,255,0.55); }
.wl-dot.on { background: linear-gradient(90deg, #7c6bff, #d946ef); }
.wl-card { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; min-height: 260px; }
.wl-ic { width: 56px; height: 56px; display: grid; place-items: center; border-radius: 16px; color: #e6ddff;
  border: 1px solid rgba(139,123,255,0.5); background: radial-gradient(circle, rgba(139,123,255,0.3), rgba(139,123,255,0.05)); }
.wl-num { font-size: 0.72rem; font-weight: 700; color: var(--gp-ink-dim); }
.wl-title { margin: 0; font-size: 1.45rem; font-weight: 900; color: #f4f7ff; line-height: 1.15; }
.wl-lines { margin: 4px 0 0; padding-left: 18px; display: flex; flex-direction: column; gap: 7px; font-size: 0.9rem; line-height: 1.45; color: #d6dcf0; }
.wl-lines :deep(code) { font-family: 'JetBrains Mono', monospace; font-size: 0.82rem; padding: 1px 6px; border-radius: 6px; background: rgba(139,123,255,0.16); color: #e6ddff; white-space: nowrap; }
.wl-lines :deep(kbd) { font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; padding: 1px 7px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.25); background: rgba(0,0,0,0.3); color: #fff; }
.wl-open { margin-top: 6px; }
.wl-nav { display: flex; align-items: center; gap: 8px; }
.wl-foot { font-size: 0.72rem; color: var(--gp-ink-dim); }
.wl-fade-enter-active, .wl-fade-leave-active { transition: opacity .18s, transform .18s; }
.wl-fade-enter-from { opacity: 0; transform: translateX(12px); }
.wl-fade-leave-to { opacity: 0; transform: translateX(-12px); }
</style>
