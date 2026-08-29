// Nation accent colors are player-picked and can be anything — including near-black
// (e.g. ANARCHO-COMMUNISM), which is invisible as text on the dark game-ui background.
// readableAccent() keeps the nation's hue but lifts the lightness so the color always
// reads on a dark surface: a black accent becomes a light grey, a dark navy a brighter
// blue, while already-bright accents pass through mostly unchanged.

function parseHex(input) {
  if (!input) return null
  let hex = String(input).trim().replace(/^#/, '')
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('')
  if (hex.length !== 6 || /[^0-9a-fA-F]/.test(hex)) return null
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  }
}

function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  const d = max - min
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1))
    switch (max) {
      case r: h = ((g - b) / d) % 6; break
      case g: h = (b - r) / d + 2; break
      default: h = (r - g) / d + 4
    }
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s, l }
}

function hslToCss({ h, s, l }) {
  return `hsl(${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`
}

const FALLBACK = '#a78bfa'
const MIN_L = 0.62 // minimum lightness so text stays legible on the dark UI
const MIN_S = 0.35 // give faint/greyish accents a bit of saturation so hue shows

function readableHsl(input) {
  const rgb = parseHex(input)
  if (!rgb) return null
  const hsl = rgbToHsl(rgb)
  const l = Math.max(hsl.l, MIN_L)
  // Only nudge saturation up for colors that actually have a hue; keep true
  // greys (black/white/grey nations) desaturated so they read as light grey.
  const s = hsl.s > 0.08 ? Math.max(hsl.s, MIN_S) : hsl.s
  return { h: hsl.h, s, l }
}

// Returns a readable CSS color derived from the raw accent, hue preserved.
export function readableAccent(input) {
  const hsl = readableHsl(input)
  return hsl ? hslToCss(hsl) : FALLBACK
}

// Same hue, but translucent — for accent-tinted backgrounds/borders where the
// old code appended a hex-alpha suffix (which does not work on hsl() strings).
export function readableAccentAlpha(input, alpha = 0.16) {
  const hsl = readableHsl(input)
  if (!hsl) return `rgba(167, 139, 250, ${alpha})`
  return `hsla(${Math.round(hsl.h)}, ${Math.round(hsl.s * 100)}%, ${Math.round(hsl.l * 100)}%, ${alpha})`
}
