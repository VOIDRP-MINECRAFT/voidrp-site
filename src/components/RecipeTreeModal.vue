<script setup>
import { ref, computed, watch } from 'vue'
import ItemSlot from './ItemSlot.vue'
import RecipeTreeNode from './RecipeTreeNode.vue'
import { useRecipeGraph } from '../composables/useRecipeGraph'
import { useItemNames } from '../composables/useItemNames'

const props = defineProps({
  recipe: { type: Object, default: null },
})
const emit = defineEmits(['close'])

const { buildTree, calcBaseResources } = useRecipeGraph()
const itemNames = useItemNames()

const tab = ref('tree')
const qty = ref(1)

const tree = computed(() => {
  if (!props.recipe) return null
  return buildTree(props.recipe.output, qty.value)
})

const baseResources = computed(() => {
  if (!props.recipe) return []
  return calcBaseResources(props.recipe.output, qty.value)
})

const outputName = computed(() => {
  if (!props.recipe) return ''
  const item = props.recipe.output
  return itemNames.value[item] || item.split(':')[1]?.replace(/_/g, ' ') || item
})

function onKeydown(e) {
  if (e.key === 'Escape') emit('close')
}

watch(() => props.recipe, () => {
  tab.value = 'tree'
  qty.value = 1
})

const QTY_PRESETS = [1, 4, 8, 16, 32, 64]
</script>

<template>
  <Teleport to="body">
    <div
      v-if="recipe"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
      @click.self="emit('close')"
      @keydown="onKeydown"
      tabindex="-1"
    >
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" @click="emit('close')" />

      <!-- Modal -->
      <div class="relative z-10 w-full max-w-2xl max-h-[85vh] flex flex-col surface-card overflow-hidden">

        <!-- Header -->
        <div class="flex items-center gap-3 p-4 border-b border-slate-700/40 shrink-0">
          <ItemSlot :item="recipe.output" :count="recipe.output_count" size="md" />
          <div class="min-w-0 flex-1">
            <p class="text-base font-bold text-slate-100 capitalize truncate">{{ outputName }}</p>
            <p class="text-xs text-slate-500 font-mono truncate">{{ recipe.output }}</p>
          </div>

          <!-- Quantity -->
          <div class="flex items-center gap-1.5 shrink-0">
            <span class="text-xs text-slate-400">×</span>
            <input
              v-model.number="qty"
              type="number"
              min="1"
              max="9999"
              class="w-16 text-center bg-slate-800 border border-slate-600/60 rounded-lg px-2 py-1 text-sm text-slate-100 outline-none focus:border-violet-500/60"
            />
            <div class="flex gap-0.5">
              <button
                v-for="p in QTY_PRESETS"
                :key="p"
                @click="qty = p"
                class="text-[9px] px-1.5 py-0.5 rounded border transition"
                :class="qty === p
                  ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                  : 'border-slate-600/40 text-slate-500 hover:text-slate-300 hover:border-slate-500/60'"
              >{{ p }}</button>
            </div>
          </div>

          <button @click="emit('close')" class="text-slate-500 hover:text-slate-300 transition ml-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <!-- Tabs -->
        <div class="flex gap-0 border-b border-slate-700/40 shrink-0 px-4">
          <button
            v-for="t in [{id:'tree',label:'Дерево крафта'},{id:'resources',label:'Ресурсы'}]"
            :key="t.id"
            @click="tab = t.id"
            class="px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px"
            :class="tab === t.id
              ? 'border-violet-500 text-violet-300'
              : 'border-transparent text-slate-500 hover:text-slate-300'"
          >{{ t.label }}</button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-4">

          <!-- Tree tab -->
          <div v-if="tab === 'tree'">
            <p class="text-xs text-slate-500 mb-3">
              Серые предметы — базовые материалы без кастомного крафта.
              Нажми на строку чтобы раскрыть/свернуть.
            </p>
            <RecipeTreeNode v-if="tree" :node="tree" :depth="0" />
          </div>

          <!-- Resources tab -->
          <div v-else-if="tab === 'resources'">
            <p class="text-xs text-slate-500 mb-3">
              Базовые ресурсы для крафта ×{{ qty }}
              <span class="text-slate-300 font-semibold">{{ outputName }}</span>
              (теги — любой подходящий предмет).
            </p>

            <div v-if="baseResources.length === 0" class="text-sm text-slate-500 text-center py-6">
              Рецепт не требует вложенных крафтов
            </div>

            <div v-else class="flex flex-col gap-1">
              <div
                v-for="[item, amount] in baseResources"
                :key="item"
                class="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/4 transition"
              >
                <ItemSlot :item="item" size="sm" />
                <span class="text-sm text-slate-200 flex-1">
                  {{ itemNames[item] || item.split(':')[1]?.replace(/_/g, ' ') || item }}
                </span>
                <span class="text-sm font-bold tabular-nums text-slate-300 ml-auto">×{{ amount }}</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  </Teleport>
</template>
