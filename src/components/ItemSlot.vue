<script setup>
import { computed, ref } from 'vue'
import { useItemNames } from '../composables/useItemNames'

const props = defineProps({
  item: { type: String, default: '' },
  count: { type: Number, default: 1 },
  size: { type: String, default: 'md' },
})

const itemNames = useItemNames()
const imgError = ref(false)

const isTag = computed(() => props.item.startsWith('#'))
const isEmpty = computed(() => !props.item)

const modid = computed(() => {
  if (isTag.value || isEmpty.value) return null
  return props.item.split(':')[0]
})

const itemKey = computed(() => {
  if (isTag.value || isEmpty.value) return ''
  return props.item.split(':')[1] ?? ''
})

const ruName = computed(() => {
  if (isTag.value || isEmpty.value) return ''
  return itemNames.value[props.item] ?? ''
})

const displayName = computed(() => {
  if (isTag.value) return props.item.replace(/^#[^:]+:/, '').replace(/_/g, ' ')
  return ruName.value || itemKey.value.replace(/_/g, ' ')
})

const tooltipText = computed(() => {
  if (isEmpty.value) return ''
  if (isTag.value) return props.item
  return ruName.value ? `${ruName.value}\n${props.item}` : props.item
})

const iconUrl = computed(() => {
  if (isTag.value || isEmpty.value || imgError.value) return null
  return `/item-icons/${modid.value.toLowerCase()}/${itemKey.value.toLowerCase()}.png`
})

const tagLabel = computed(() => {
  if (!isTag.value) return ''
  const inner = props.item.replace('#', '')
  const parts = inner.split(':')
  return parts.length > 1 ? parts.slice(1).join(':').replace(/\//g, ' ').replace(/_/g, ' ') : inner
})

const modColor = computed(() => {
  const colors = {
    minecraft: '#6b7280',
    create: '#f59e0b',
    mekanism: '#3b82f6',
    immersiveengineering: '#92400e',
    ae2: '#8b5cf6',
    kubejs: '#10b981',
    industrialforegoing: '#ec4899',
    draconicevolution: '#7c3aed',
    avaritia: '#f97316',
    aether: '#60a5fa',
    twilightforest: '#16a34a',
    cataclysm: '#dc2626',
    mahoutsukai: '#db2777',
    tfmg: '#b45309',
    deeperdarker: '#1e1b4b',
    bigreactors: '#0891b2',
    evolvedmekanism: '#2563eb',
    farmersdelight: '#65a30d',
  }
  return colors[modid.value] ?? '#374151'
})

const sizeClass = computed(() => ({
  sm: 'w-9 h-9',
  md: 'w-11 h-11',
  lg: 'w-14 h-14',
}[props.size] ?? 'w-11 h-11'))

const imgSizeClass = computed(() => ({
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
  lg: 'w-10 h-10',
}[props.size] ?? 'w-8 h-8'))
</script>

<template>
  <div
    class="relative flex items-center justify-center rounded border select-none group/slot cursor-default"
    :class="[sizeClass, isEmpty ? 'border-white/5 bg-white/3' : 'border-white/15 bg-black/40']"
  >
    <!-- Тег -->
    <template v-if="isTag">
      <div class="flex flex-col items-center justify-center gap-0.5 px-0.5 text-center leading-tight" style="color: #a78bfa">
        <span class="text-xs font-bold">#</span>
        <span class="text-[7px] break-all line-clamp-2">{{ tagLabel }}</span>
      </div>
    </template>

    <!-- Иконка -->
    <template v-else-if="iconUrl && !imgError">
      <img
        :src="iconUrl"
        :alt="displayName"
        :class="imgSizeClass"
        class="object-contain"
        style="image-rendering: pixelated"
        @error="imgError = true"
      />
    </template>

    <!-- Фолбэк — цветная метка -->
    <template v-else-if="!isEmpty">
      <div
        class="flex items-center justify-center w-full h-full rounded text-[7px] font-bold text-center leading-tight px-0.5 break-all line-clamp-3"
        :style="{ background: modColor + '33', color: modColor }"
      >
        {{ displayName }}
      </div>
    </template>

    <!-- Счётчик -->
    <span
      v-if="count > 1"
      class="absolute bottom-0 right-0.5 text-[9px] font-bold text-white drop-shadow leading-none"
    >{{ count }}</span>

    <!-- Тултип -->
    <div
      v-if="!isEmpty"
      class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50
             hidden group-hover/slot:flex flex-col items-center pointer-events-none"
    >
      <div class="bg-[#0d1117] border border-white/15 rounded-lg px-2.5 py-1.5 shadow-xl text-center whitespace-nowrap max-w-[200px]">
        <template v-if="isTag">
          <p class="text-xs font-semibold text-violet-300">{{ tagLabel }}</p>
          <p class="text-xs text-white/40 font-mono mt-0.5">{{ item }}</p>
        </template>
        <template v-else>
          <p v-if="ruName" class="text-xs font-semibold text-white/90">{{ ruName }}</p>
          <p class="text-xs text-white/40 font-mono" :class="ruName ? 'mt-0.5' : ''">{{ item }}</p>
        </template>
      </div>
      <div class="w-2 h-2 bg-[#0d1117] border-r border-b border-white/15 rotate-45 -mt-1.5"></div>
    </div>
  </div>
</template>
