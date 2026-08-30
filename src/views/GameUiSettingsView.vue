<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import '../assets/gui-premium.css'
import { setWebguiToken, getAccountSettings, patchAccountSettings } from '../services/gameUiApi.js'
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

// Account-level (server-synced) settings.
const account = ref(null)
onMounted(async () => {
  try { account.value = await getAccountSettings() } catch { /* silent */ }
})
async function setHudAutoOpen(v) {
  if (!account.value) return
  account.value.hud_auto_open = v
  try { await patchAccountSettings({ hud_auto_open: v }) } catch { /* keep optimistic */ }
}
function isMuted(type) { return (account.value?.muted_notifications || []).includes(type) }
async function toggleNotif(type) {
  if (!account.value) return
  const muted = new Set(account.value.muted_notifications || [])
  if (muted.has(type)) muted.delete(type); else muted.add(type)
  account.value.muted_notifications = [...muted]
  try { await patchAccountSettings({ muted_notifications: account.value.muted_notifications }) } catch { /* keep optimistic */ }
}
function notifLabel(type) {
  return t('gameUiSettings.notif.' + type)
}
</script>

<template>
  <section class="gp-shell">
    <!-- key by the toggle so flipping it here re-mounts the starfield (its loop inits on mount) -->
    <GameUiStarfield :key="settings.starfield" />
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

      <!-- account (synced) settings -->
      <div v-if="account" class="gp-panel st" style="margin-top:16px">
        <div class="gp-phead">
          <span class="gp-phead-ic"><GuiIcon name="users" :size="16" /></span>
          <span class="gp-phead-tt">{{ t('gameUiSettings.accountTitle') }}</span>
        </div>

        <div class="st-row">
          <div class="st-info">
            <div class="st-label">{{ t('gameUiSettings.hudAutoOpen') }}</div>
            <div class="st-hint">{{ t('gameUiSettings.hudAutoOpenHint') }}</div>
          </div>
          <button class="st-toggle" :class="{ on: account.hud_auto_open }" @click="setHudAutoOpen(!account.hud_auto_open)" role="switch" :aria-checked="account.hud_auto_open"><span class="st-knob"></span></button>
        </div>

        <div v-if="(account.mutable_notifications || []).length" class="st-notif">
          <div class="st-label" style="margin:6px 0 2px">{{ t('gameUiSettings.notifPrefs') }}</div>
          <div class="st-hint" style="margin-bottom:10px">{{ t('gameUiSettings.notifPrefsHint') }}</div>
          <div v-for="type in account.mutable_notifications" :key="type" class="st-row">
            <div class="st-info"><div class="st-label" style="font-size:0.82rem">{{ notifLabel(type) }}</div></div>
            <button class="st-toggle" :class="{ on: !isMuted(type) }" @click="toggleNotif(type)" role="switch" :aria-checked="!isMuted(type)"><span class="st-knob"></span></button>
          </div>
        </div>

        <p class="st-foot">{{ t('gameUiSettings.accountNote') }}</p>
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
