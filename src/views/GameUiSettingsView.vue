<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import '../assets/gui-premium.css'
import { setWebguiToken } from '../services/gameUiApi.js'
import { useWebGuiToken } from '../composables/useWebGui.js'
import { useGameUiSettings } from '../composables/useGameUiSettings.js'
import { setLocale } from '../i18n'
import GameUiSidebar from '../components/GameUiSidebar.vue'
import GameUiStarfield from '../components/GameUiStarfield.vue'
import GameUiTopBar from '../components/GameUiTopBar.vue'
import GuiIcon from '../components/GuiIcon.vue'

const { t, locale } = useI18n()
const token = useWebGuiToken()
setWebguiToken(token)
const settings = useGameUiSettings()

const lang = computed(() => (locale.value || 'ru').startsWith('en') ? 'en' : 'ru')
function pickLang(l) { setLocale(l) }
</script>

<template>
  <section class="gp-shell">
    <GameUiStarfield />
    <GameUiSidebar current="settings" />
    <GameUiTopBar :title="t('gameUiNav.settings')" />

    <div class="gp-wrap gp-wrap--narrow gp-wrap--app">
      <div class="gp-panel st">
        <div class="gp-phead">
          <span class="gp-phead-ic"><GuiIcon name="settings" :size="16" /></span>
          <span class="gp-phead-tt">{{ t('gameUiSettings.title') }}</span>
        </div>

        <!-- language -->
        <div class="st-row">
          <div class="st-info">
            <div class="st-label">{{ t('gameUiSettings.language') }}</div>
            <div class="st-hint">{{ t('gameUiSettings.languageHint') }}</div>
          </div>
          <div class="gp-seg">
            <button class="gp-seg-btn" :class="{ active: lang === 'ru' }" @click="pickLang('ru')">Русский</button>
            <button class="gp-seg-btn" :class="{ active: lang === 'en' }" @click="pickLang('en')">English</button>
          </div>
        </div>

        <!-- background animation -->
        <div class="st-row">
          <div class="st-info">
            <div class="st-label">{{ t('gameUiSettings.starfield') }}</div>
            <div class="st-hint">{{ t('gameUiSettings.starfieldHint') }}</div>
          </div>
          <button class="st-toggle" :class="{ on: settings.starfield }" @click="settings.starfield = !settings.starfield" role="switch" :aria-checked="settings.starfield"><span class="st-knob"></span></button>
        </div>

        <!-- notification toasts -->
        <div class="st-row">
          <div class="st-info">
            <div class="st-label">{{ t('gameUiSettings.toasts') }}</div>
            <div class="st-hint">{{ t('gameUiSettings.toastsHint') }}</div>
          </div>
          <button class="st-toggle" :class="{ on: settings.toasts }" @click="settings.toasts = !settings.toasts" role="switch" :aria-checked="settings.toasts"><span class="st-knob"></span></button>
        </div>

        <p class="st-foot">{{ t('gameUiSettings.savedNote') }}</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.st-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 2px; border-bottom: 1px solid rgba(255,255,255,0.05); }
.st-row:last-of-type { border-bottom: none; }
.st-info { min-width: 0; }
.st-label { font-size: 0.9rem; font-weight: 700; color: #eef2ff; }
.st-hint { font-size: 0.74rem; color: var(--gp-ink-dim, #8a90a8); margin-top: 2px; }
.st-toggle { flex-shrink: 0; width: 46px; height: 26px; border-radius: 999px; border: 1px solid var(--gp-line); background: rgba(0,0,0,0.35); cursor: pointer; padding: 0; position: relative; transition: background 0.18s, border-color 0.18s; }
.st-toggle.on { background: linear-gradient(135deg, #7c6bff, #a78bfa); border-color: rgba(180,140,255,0.5); }
.st-knob { position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; border-radius: 50%; background: #eef2ff; transition: left 0.18s; box-shadow: 0 2px 6px rgba(0,0,0,0.5); }
.st-toggle.on .st-knob { left: 22px; }
.st-foot { margin-top: 14px; font-size: 0.72rem; color: var(--gp-ink-dim, #8a90a8); }
</style>
