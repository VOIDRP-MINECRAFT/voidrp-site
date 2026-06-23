<script setup>
import { computed } from 'vue'
import ItemSlot from './ItemSlot.vue'
import CraftingGrid from './CraftingGrid.vue'
import { useItemNames } from '../composables/useItemNames'
import { useRecipeGraph } from '../composables/useRecipeGraph'

const props = defineProps({
  item: { type: String, default: null },
})
const emit = defineEmits(['close', 'open-tree'])

const itemNames = useItemNames()
const { getRecipesByIngredient } = useRecipeGraph()

const recipes = computed(() => props.item ? getRecipesByIngredient(props.item) : [])

const itemName = computed(() => {
  if (!props.item) return ''
  return itemNames.value[props.item] || props.item.split(':')[1]?.replace(/_/g, ' ') || props.item
})

function outputName(item) {
  if (!item) return ''
  return itemNames.value[item] || item.split(':')[1]?.replace(/_/g, ' ') || item
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="item"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" @click="emit('close')" />

      <div class="relative z-10 w-full max-w-2xl max-h-[85vh] flex flex-col surface-card overflow-hidden">

        <!-- Header -->
        <div class="flex items-center gap-3 p-4 border-b border-slate-700/40 shrink-0">
          <ItemSlot :item="item" size="md" />
          <div class="min-w-0 flex-1">
            <p class="text-base font-bold text-slate-100 capitalize truncate">{{ itemName }}</p>
            <p class="text-xs text-slate-500 mt-0.5">
              Используется как ингредиент в
              <span class="text-slate-300 font-semibold">{{ recipes.length }}</span>
              {{ recipes.length === 1 ? 'рецепте' : recipes.length < 5 ? 'рецептах' : 'рецептах' }}
            </p>
          </div>
          <button @click="emit('close')" class="text-slate-500 hover:text-slate-300 transition">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <!-- List -->
        <div class="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          <div
            v-for="recipe in recipes"
            :key="recipe.id"
            class="rounded-xl border border-slate-700/40 bg-slate-800/40 p-3 flex flex-col gap-2.5"
          >
            <!-- Recipe output header -->
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2 min-w-0">
                <ItemSlot :item="recipe.output" :count="recipe.output_count" size="sm" />
                <div class="min-w-0">
                  <p class="text-sm font-semibold text-slate-200 truncate capitalize">
                    {{ outputName(recipe.output) }}
                  </p>
                  <p class="text-xs text-slate-500 font-mono truncate">{{ recipe.output }}</p>
                </div>
              </div>
              <button
                @click="emit('open-tree', recipe)"
                class="shrink-0 flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 text-violet-400 hover:text-violet-300 transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="5" r="3"/><path d="M12 8v8"/><circle cx="5" cy="19" r="3"/><circle cx="19" cy="19" r="3"/><path d="M12 16l-7 3M12 16l7 3"/>
                </svg>
                Дерево
              </button>
            </div>

            <!-- Crafting grid -->
            <CraftingGrid :recipe="recipe" />
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
