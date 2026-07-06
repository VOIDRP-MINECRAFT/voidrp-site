import { ref, onMounted, onUnmounted } from 'vue'

/** True when running inside the WebGUI NeoForge mod browser (MCEF). */
export function isInMod() {
  return typeof window !== 'undefined' && typeof window.webgui !== 'undefined'
}

/** Token from the ?webgui_token= query param embedded by the plugin when opening the GUI. */
export function useWebGuiToken() {
  return new URLSearchParams(window.location.search).get('webgui_token') ?? ''
}

/** Live client info pushed by the mod into window.webgui.client. */
export function useWebGuiClient() {
  const client = ref(window.webgui?.client ?? null)
  function handler(e) { client.value = e.detail }
  onMounted(() => window.addEventListener('webgui:client', handler))
  onUnmounted(() => window.removeEventListener('webgui:client', handler))
  return client
}

/**
 * Send a channel message from the page to the mod/game.
 * Supported channels: close | run_command | open_gui | open_hud
 */
export function postToGame(payload) {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.cefQuery) {
      reject(new Error('not in mod'))
      return
    }
    window.cefQuery({
      request: typeof payload === 'string' ? payload : JSON.stringify(payload),
      onSuccess: resolve,
      onFailure: (_code, msg) => reject(new Error(msg)),
    })
  })
}

/** Convenience: run a Minecraft command from the page. */
export function runCommand(cmd) {
  return postToGame({ channel: 'run_command', command: cmd })
}

/** Convenience: open a different game-ui URL in the same WebView. */
export function openGui(url) {
  return postToGame({ channel: 'open_gui', url })
}

/** Convenience: close the current WebView. */
export function closeGui() {
  return postToGame({ channel: 'close' })
}

/**
 * Lightweight in-page toast for action feedback (buy / vote / donate).
 * Returns { toast, show } — render <transition name="gui-toast"> with the ref.
 */
export function useActionToast() {
  const toast = ref(null)
  let timer = null
  function show(text, ok = true) {
    toast.value = { text, ok }
    clearTimeout(timer)
    timer = setTimeout(() => { toast.value = null }, 2600)
  }
  onUnmounted(() => clearTimeout(timer))
  return { toast, show }
}
