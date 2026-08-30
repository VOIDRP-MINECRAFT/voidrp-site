import { reactive, watch } from 'vue'

// Client-side webgui preferences, persisted per client in localStorage. (Language is handled
// separately by the shared i18n setLocale/voidrp_lang.) Kept as a module-level reactive
// singleton so the settings page, starfield and toast components all share one state.
const KEY = 'voidrp_gui_settings_v1'

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} }
}

const saved = load()
const settings = reactive({
  starfield: saved.starfield !== false, // default on
  toasts: saved.toasts !== false,       // default on
})

watch(
  settings,
  () => {
    try { localStorage.setItem(KEY, JSON.stringify({ starfield: settings.starfield, toasts: settings.toasts })) } catch { /* ignore */ }
  },
  { deep: true },
)

export function useGameUiSettings() {
  return settings
}
