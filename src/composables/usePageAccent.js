import { computed } from 'vue'
import { activeServer } from '../stores/serverStore'

// Derives a palette of CSS custom properties from the active server's accent
// colour so a page can theme itself (buttons, glows, badges) to the selected
// server. Bind the returned object via :style on a wrapper element:
//   const { accentVars } = usePageAccent()
//   <div :style="accentVars"> ... uses var(--acc), var(--acc-pale), etc.
const DEFAULT = '#7c3aed'

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '')
  if (!m) return [124, 58, 237]
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function lighten([r, g, b], f) {
  return [r, g, b].map((c) => Math.round(c + (255 - c) * f))
}
function relLuminance([r, g, b]) {
  const a = [r, g, b].map((v) => {
    v /= 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]
}

export function usePageAccent() {
  const accentVars = computed(() => {
    const rgb = hexToRgb(activeServer.value?.accent_color || DEFAULT)
    const pale = lighten(rgb, 0.45)
    const deep = rgb.map((c) => Math.round(c * 0.72))
    return {
      '--acc': `rgb(${rgb.join(',')})`,
      '--acc-rgb': rgb.join(','),
      '--acc-pale': `rgb(${pale.join(',')})`,
      '--acc-pale-rgb': pale.join(','),
      '--acc-deep': `rgb(${deep.join(',')})`,
      // Readable text colour to sit on top of the solid accent.
      '--acc-contrast': relLuminance(rgb) > 0.5 ? '#140a24' : '#ffffff',
    }
  })
  return { accentVars }
}
