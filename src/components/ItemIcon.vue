<template>
  <img
    v-if="iconUrl && !imgError"
    :src="iconUrl"
    :width="size"
    :height="size"
    :alt="itemKey"
    class="object-contain rounded"
    style="image-rendering: pixelated"
    @error="imgError = true"
  />
  <div
    v-else
    :style="{ width: size + 'px', height: size + 'px', background: fallbackBg }"
    class="rounded flex items-center justify-center text-xs font-mono overflow-hidden"
    style="color: rgba(255,255,255,0.55); font-size: 0.6em; font-weight: 700; letter-spacing: 0.02em;"
  >
    {{ shortKey }}
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  itemKey: { type: String, default: '' },
  size: { type: Number, default: 32 },
})

const imgError = ref(false)

// Pseudo-namespaces that are really vanilla minecraft types with subtypes
const VANILLA_TYPES = {
  ENCHANTED_BOOK: 'enchanted_book',
  POTION: 'potion',
  SPLASH_POTION: 'splash_potion',
  LINGERING_POTION: 'lingering_potion',
  TIPPED_ARROW: 'tipped_arrow',
}

// Mod-specific fallback colors for the placeholder box
const MOD_COLORS = {
  ae2: 'rgba(80,120,200,.35)',
  create: 'rgba(180,120,60,.35)',
  avaritia: 'rgba(20,200,180,.35)',
  mekanism: 'rgba(60,180,220,.35)',
  draconicevolution: 'rgba(140,60,220,.35)',
  immersiveengineering: 'rgba(180,80,60,.35)',
  industrialforegoing: 'rgba(60,160,80,.35)',
  kubejs: 'rgba(220,160,40,.35)',
  minecraft: 'rgba(100,100,120,.28)',
}

const resolved = computed(() => {
  const raw = (props.itemKey || '').toUpperCase()
  if (!raw) return { modid: 'minecraft', itemId: '' }

  // Check pseudo-namespaces first (ENCHANTED_BOOK:X, POTION:X, etc.)
  for (const [prefix, iconName] of Object.entries(VANILLA_TYPES)) {
    if (raw === prefix || raw.startsWith(prefix + ':')) {
      return { modid: 'minecraft', itemId: iconName }
    }
  }

  const colonIdx = raw.indexOf(':')
  if (colonIdx === -1) {
    // No namespace → vanilla minecraft item
    return { modid: 'minecraft', itemId: raw.toLowerCase() }
  }

  const modid = raw.slice(0, colonIdx).toLowerCase()
  const rest = raw.slice(colonIdx + 1)
  // Only take the first segment after the first colon (handles ENCHANTED_BOOK:TYPE:LEVEL)
  const itemId = rest.split(':')[0].toLowerCase()
  return { modid, itemId }
})

const iconUrl = computed(() => {
  const { modid, itemId } = resolved.value
  if (!itemId) return null
  return `/item-icons/${modid}/${itemId}.png`
})

const shortKey = computed(() => resolved.value.itemId?.slice(0, 3).toUpperCase() || '?')

const fallbackBg = computed(() => {
  const mod = resolved.value.modid
  return MOD_COLORS[mod] || 'rgba(80,80,100,.3)'
})
</script>
