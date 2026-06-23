<script setup>
import { ref, computed } from 'vue'
import ItemSlot from './ItemSlot.vue'
import { useItemNames } from '../composables/useItemNames'

const props = defineProps({
  node: { type: Object, required: true },
  depth: { type: Number, default: 0 },
})

const itemNames = useItemNames()
const open = ref(props.node.expanded ?? props.depth < 2)

const hasChildren = computed(() => props.node.children?.length > 0)
const isTag = computed(() => props.node.item?.startsWith('#'))
const isCraftable = computed(() => !!props.node.recipe)

const displayName = computed(() => {
  const item = props.node.item
  if (!item) return ''
  if (isTag.value) return item.replace(/^#[^:]+:/, '').replace(/_/g, ' ')
  return itemNames.value[item] || item.split(':')[1]?.replace(/_/g, ' ') || item
})
</script>

<template>
  <div :style="{ marginLeft: depth > 0 ? '20px' : '0' }">
    <!-- Row -->
    <div
      class="flex items-center gap-2 py-1 rounded px-1 group"
      :class="isCraftable ? 'cursor-pointer hover:bg-white/5' : ''"
      @click="hasChildren && (open = !open)"
    >
      <!-- Expand indicator -->
      <span class="w-3 shrink-0 text-slate-500 text-xs">
        <template v-if="hasChildren">{{ open ? '▾' : '▸' }}</template>
        <template v-else>·</template>
      </span>

      <!-- Icon -->
      <ItemSlot :item="node.item" size="sm" />

      <!-- Name -->
      <span
        class="text-sm leading-tight"
        :class="isCraftable ? 'text-slate-200' : 'text-slate-400'"
      >{{ displayName }}</span>

      <!-- Quantity badge -->
      <span class="ml-auto shrink-0 text-xs font-bold px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-300">
        ×{{ node.qty }}
      </span>

      <!-- Craftable pill -->
      <span
        v-if="isCraftable"
        class="shrink-0 text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
      >крафт</span>
    </div>

    <!-- Children -->
    <div v-if="open && hasChildren" class="border-l border-slate-700/40 ml-4">
      <RecipeTreeNode
        v-for="(child, i) in node.children"
        :key="i"
        :node="child"
        :depth="depth + 1"
      />
    </div>
  </div>
</template>
