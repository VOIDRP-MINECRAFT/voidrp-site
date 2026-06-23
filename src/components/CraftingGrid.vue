<script setup>
import { computed } from 'vue'
import ItemSlot from './ItemSlot.vue'

const props = defineProps({
  recipe: { type: Object, required: true },
})

// Разворачиваем pattern + keys в плоский массив 9 слотов
const slots = computed(() => {
  if (props.recipe.type !== 'shaped') return []
  const grid = Array(9).fill('')
  const pattern = props.recipe.pattern
  const keys = props.recipe.keys ?? {}

  for (let row = 0; row < Math.min(pattern.length, 3); row++) {
    const rowStr = pattern[row]
    for (let col = 0; col < Math.min(rowStr.length, 3); col++) {
      const ch = rowStr[col]
      grid[row * 3 + col] = ch === ' ' ? '' : (keys[ch] ?? '')
    }
  }
  return grid
})

const inputs = computed(() => {
  if (props.recipe.type !== 'shapeless') return []
  return props.recipe.inputs ?? []
})
</script>

<template>
  <!-- Shaped -->
  <div v-if="recipe.type === 'shaped'" class="flex items-center gap-3">
    <div class="grid grid-cols-3 gap-0.5">
      <ItemSlot
        v-for="(slot, i) in slots"
        :key="i"
        :item="slot"
        size="md"
      />
    </div>

    <div class="text-white/40 text-xl">→</div>

    <ItemSlot :item="recipe.output" :count="recipe.output_count" size="lg" />
  </div>

  <!-- Shapeless -->
  <div v-else class="flex items-center gap-2 flex-wrap">
    <div class="flex flex-wrap gap-0.5 max-w-[160px]">
      <ItemSlot
        v-for="(inp, i) in inputs"
        :key="i"
        :item="inp"
        size="sm"
      />
    </div>
    <div class="text-white/40 text-xl">→</div>
    <ItemSlot :item="recipe.output" :count="recipe.output_count" size="lg" />
  </div>
</template>
