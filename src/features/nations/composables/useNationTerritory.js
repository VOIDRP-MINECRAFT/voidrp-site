import { computed, ref, toValue } from 'vue'
import { siteConfig } from '../../../config.site'

// Territory of a nation as drawn from FTB Chunks claims. The summary is written every 5 minutes
// by scripts/update_bluemap_ftb_claims.py next to the BlueMap web app (ftb-claims/nations.json).
export function bluemapUrl(x, z, world, distance = 300) {
  return `${siteConfig.bluemapUrl}/#${world || 'world'}:${Math.round(x)}:64:${Math.round(z)}:${Math.round(distance)}:0:0:0:0:flat`
}

export function useNationTerritory(slug, nation) {
  const territory = ref(null)

  async function load() {
    const s = toValue(slug)
    if (!s) { territory.value = null; return }
    try {
      const res = await fetch(`${siteConfig.bluemapUrl}/ftb-claims/nations.json`, { cache: 'no-cache' })
      const data = res.ok ? await res.json() : null
      territory.value = data?.nations?.[s] || null
    } catch {
      territory.value = null
    }
  }

  const mainArea = computed(() => territory.value?.areas?.[0] || null)

  // Claims win over the manually set capital: they are where the nation really is.
  const mapTarget = computed(() => {
    const a = mainArea.value
    if (a) {
      const [x0, z0, x1, z1] = a.main_bbox || a.bbox
      return { x: a.center.x, z: a.center.z, world: a.map, distance: Math.min(3000, Math.max(220, Math.max(x1 - x0, z1 - z0) * 1.6)), auto: true }
    }
    const n = toValue(nation)
    if (n?.capital_x != null && n?.capital_z != null) return { x: n.capital_x, z: n.capital_z, world: n.capital_world, distance: 400, auto: false }
    return null
  })

  const mapUrl = computed(() => (mapTarget.value
    ? bluemapUrl(mapTarget.value.x, mapTarget.value.z, mapTarget.value.world, mapTarget.value.distance)
    : siteConfig.bluemapUrl))

  // Outline of the main piece of land, framed 16:10 with a margin.
  const miniMap = computed(() => {
    const a = mainArea.value
    if (!a) return null
    const [x0, z0, x1, z1] = a.main_bbox || a.bbox
    const pad = Math.max(48, Math.max(x1 - x0, z1 - z0) * 0.18)
    let vx = x0 - pad
    let vz = z0 - pad
    let vw = x1 - x0 + pad * 2
    let vh = z1 - z0 + pad * 2
    const ratio = 16 / 10
    if (vw / vh < ratio) { const nw = vh * ratio; vx -= (nw - vw) / 2; vw = nw } else { const nh = vw / ratio; vz -= (nh - vh) / 2; vh = nh }
    const path = a.loops.map((loop) => `M${loop.map(([x, z]) => `${x},${z}`).join('L')}Z`).join('')
    return {
      viewBox: `${vx} ${vz} ${vw} ${vh}`,
      path,
      cx: a.center.x,
      cz: a.center.z,
      r: Math.max(vw, vh) * 0.012,
      stroke: Math.max(vw, vh) * 0.004,
      grid: 16 * Math.max(1, Math.round(vw / 16 / 40)),
    }
  })

  return { territory, mainArea, mapTarget, mapUrl, miniMap, load }
}
