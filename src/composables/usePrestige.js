// Battle Pass prestige → status colour (a public flex shown next to nicknames).
export function prestigeColor(n) {
  if (n >= 10) return '#f472d0'   // mythic
  if (n >= 7) return '#a78bfa'    // legend
  if (n >= 5) return '#fbbf24'    // veteran
  if (n >= 3) return '#cbd5e1'    // silver
  if (n >= 1) return '#cd7f32'    // bronze
  return null
}
