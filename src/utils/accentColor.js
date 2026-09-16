// Players pick any accent colour, from pure white to pure black. These helpers keep text on the
// accent readable and lift accents that would vanish on the dark site background.

export function hexToRgb(hex) {
  const v = String(hex || '').replace('#', '')
  const n = v.length === 3 ? v.split('').map((x) => x + x).join('') : v
  if (!/^[0-9a-f]{6}$/i.test(n)) return [139, 92, 246]
  const i = Number.parseInt(n, 16)
  return [(i >> 16) & 255, (i >> 8) & 255, i & 255]
}

// WCAG relative luminance.
export function luminance([r, g, b]) {
  const c = [r, g, b].map((x) => { const v = x / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}

function mix([r, g, b], [r2, g2, b2], t) {
  return [r + (r2 - r) * t, g + (g2 - g) * t, b + (b2 - b) * t].map(Math.round)
}

// CSS custom properties for an accent: `${prefix}-accent`, `-accent-ui`, `-on-accent`, `-accent-soft`, `-accent-line`, `-accent-glow`.
export function accentVars(hex, prefix) {
  const rgb = hexToRgb(hex)
  const lum = luminance(rgb)
  const ui = lum < 0.06 ? mix(rgb, [255, 255, 255], 0.45) : rgb
  const css = (c, a = 1) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`
  return {
    [`${prefix}-accent`]: css(rgb),
    [`${prefix}-accent-ui`]: css(ui),
    [`${prefix}-on-accent`]: lum > 0.45 ? '#0e0c18' : '#ffffff',
    [`${prefix}-accent-soft`]: css(ui, 0.14),
    [`${prefix}-accent-line`]: css(ui, 0.4),
    [`${prefix}-accent-glow`]: css(ui, 0.28),
  }
}
