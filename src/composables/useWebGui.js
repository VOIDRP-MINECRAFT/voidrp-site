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
    if (typeof window === 'undefined') {
      reject(new Error('not in mod'))
      return
    }
    // Use raw cefQuery directly — this is the path proven to actually DELIVER to
    // the mod (its callback fires on success). window.webgui.postToGame resolves
    // unconditionally even when nothing reached the game, so it's unreliable.
    if (typeof window.cefQuery === 'function') {
      window.cefQuery({
        request: typeof payload === 'string' ? payload : JSON.stringify(payload),
        persistent: false,
        onSuccess: resolve,
        onFailure: (_code, msg) => reject(new Error(msg)),
      })
      return
    }
    if (window.webgui && typeof window.webgui.postToGame === 'function') {
      try { window.webgui.postToGame(payload); resolve() } catch (e) { reject(e) }
      return
    }
    reject(new Error('not in mod'))
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

/**
 * Navigate to another game-ui page by route name from WITHIN an open WebGUI screen
 * (sidebar tabs, dashboard tiles, notification-center action buttons).
 *
 * This is a plain SPA soft-navigation. Do NOT route it through the open_gui mod
 * bridge: that does setScreen(new WebViewScreen) which REPLACES the current screen,
 * and replacing a WebViewScreen from inside its own page (mid-cefQuery-callback)
 * doesn't reliably re-open — the button appears to "do nothing" in-game. router.push
 * stays inside the same MCEF browser and repaints reliably. (The open_gui bridge is
 * only for opening a GUI from the HUD overlay, where no screen is open yet.)
 * The webgui_token is carried through so the target page stays authenticated.
 */
export function navigateGamePage(router, name, webguiToken) {
  const query = webguiToken ? { webgui_token: webguiToken } : {}
  return Promise.resolve(router.push({ name, query }))
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
