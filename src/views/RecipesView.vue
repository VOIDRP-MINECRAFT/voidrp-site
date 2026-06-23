<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import CraftingGrid from '../components/CraftingGrid.vue'
import ItemSlot from '../components/ItemSlot.vue'
import RecipeTreeModal from '../components/RecipeTreeModal.vue'
import UsedInModal from '../components/UsedInModal.vue'
import recipesData from '../data/recipes.json'
import { useItemNames } from '../composables/useItemNames'
import { useRecipeGraph } from '../composables/useRecipeGraph'

const { t } = useI18n()
const itemNames = useItemNames()
const { getRecipesByIngredient } = useRecipeGraph()

const search = ref('')
const selectedCategory = ref('')
const selectedMod = ref('')
const selectedType = ref('')

const allRecipes = recipesData.recipes

// Modal state
const treeRecipe = ref(null)
const usedInItem = ref(null)

const categories = computed(() => {
  const s = new Set(allRecipes.map(r => r.category).filter(Boolean))
  return Array.from(s).sort()
})

const outputMods = computed(() => {
  const s = new Set(allRecipes.map(r => r.output?.split(':')[0]).filter(Boolean))
  return Array.from(s).sort()
})

const MOD_LABELS = {
  minecraft: 'Minecraft',
  create: 'Create',
  mekanism: 'Mekanism',
  immersiveengineering: 'Immersive Engineering',
  ae2: 'Applied Energistics 2',
  kubejs: 'KubeJS (кастом)',
  industrialforegoing: 'Industrial Foregoing',
  draconicevolution: 'Draconic Evolution',
  avaritia: 'Avaritia',
  aether: 'Aether',
  twilightforest: 'Twilight Forest',
  cataclysm: 'Cataclysm',
  mahoutsukai: 'Mahou Tsukai',
  tfmg: 'TFMG',
  deeperdarker: 'Deeper & Darker',
  bigreactors: 'Big Reactors',
  evolvedmekanism: 'Evolved Mekanism',
  farmersdelight: "Farmer's Delight",
  sophisticatedbackpacks: 'Sophisticated Backpacks',
  waystones: 'Waystones',
}

function modLabel(mod) {
  return MOD_LABELS[mod] ?? mod
}

const filtered = computed(() => {
  const q = search.value.toLowerCase().trim()
  return allRecipes.filter(r => {
    if (selectedCategory.value && r.category !== selectedCategory.value) return false
    if (selectedMod.value && r.output?.split(':')[0] !== selectedMod.value) return false
    if (selectedType.value && r.type !== selectedType.value) return false
    if (!q) return true
    const outId = r.output ?? ''
    const outRu = (itemNames.value[outId] ?? '').toLowerCase()
    const outEn = outId.replace(/_/g, ' ')
    const recipeId = r.id ?? ''
    const ingredientIds = r.type === 'shaped'
      ? Object.values(r.keys ?? {})
      : (r.inputs ?? [])
    const ingredientsRu = ingredientIds.map(i => (itemNames.value[i] ?? '').toLowerCase()).join(' ')
    const ingredientsEn = ingredientIds.join(' ').replace(/_/g, ' ')
    return outRu.includes(q) || outEn.includes(q) || recipeId.includes(q)
      || ingredientsRu.includes(q) || ingredientsEn.includes(q)
  })
})

function clearFilters() {
  search.value = ''
  selectedCategory.value = ''
  selectedMod.value = ''
  selectedType.value = ''
}

const hasFilters = computed(() => search.value || selectedCategory.value || selectedMod.value || selectedType.value)

function outputDisplayName(item) {
  if (!item) return ''
  return itemNames.value[item] || item.split(':')[1]?.replace(/_/g, ' ') || item
}

// Фильтровать по ингредиенту
function filterByIngredient(item) {
  search.value = item
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
</script>

<template>
  <section class="py-8 md:py-10">
    <div class="container-shell">

      <!-- Заголовок -->
      <div class="mb-6">
        <div class="section-kicker !mb-2">{{ t('recipes.kicker') }}</div>
        <h1 class="text-3xl font-black tracking-tight text-slate-50 md:text-4xl">{{ t('recipes.title') }}</h1>
        <p class="mt-2 text-sm text-slate-400">
          {{ t('recipes.desc', { count: allRecipes.length }) }}
        </p>
      </div>

      <!-- Фильтры -->
      <div class="surface-card mb-6 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
        <div class="relative flex-1 min-w-[200px]">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            v-model="search"
            type="text"
            :placeholder="t('recipes.searchPlaceholder')"
            class="w-full pl-9 pr-3 py-2 bg-slate-800/60 border border-slate-700/60 rounded-xl text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-violet-500/60 transition"
          />
        </div>

        <select v-model="selectedCategory" class="bg-slate-800/60 border border-slate-700/60 rounded-xl px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-500/60 transition">
          <option value="">{{ t('recipes.allCategories') }}</option>
          <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
        </select>

        <select v-model="selectedMod" class="bg-slate-800/60 border border-slate-700/60 rounded-xl px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-500/60 transition">
          <option value="">{{ t('recipes.allMods') }}</option>
          <option v-for="mod in outputMods" :key="mod" :value="mod">{{ modLabel(mod) }}</option>
        </select>

        <select v-model="selectedType" class="bg-slate-800/60 border border-slate-700/60 rounded-xl px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-500/60 transition">
          <option value="">{{ t('recipes.allTypes') }}</option>
          <option value="shaped">{{ t('recipes.typeShaped') }}</option>
          <option value="shapeless">{{ t('recipes.typeShapeless') }}</option>
        </select>

        <button
          v-if="hasFilters"
          class="shrink-0 flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition px-2 py-1 rounded-lg hover:bg-slate-700/40"
          @click="clearFilters"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          {{ t('recipes.clearFilters') }}
        </button>
      </div>

      <!-- Счётчик -->
      <p class="mb-4 text-xs text-slate-500">
        {{ t('recipes.showing') }} <span class="text-slate-300 font-semibold">{{ filtered.length }}</span> {{ t('recipes.of') }} {{ allRecipes.length }} {{ t('recipes.recipesWord') }}
      </p>

      <!-- Пусто -->
      <div v-if="filtered.length === 0" class="surface-card p-10 text-center text-sm text-slate-500">
        {{ t('recipes.noRecipes') }}
      </div>

      <!-- Сетка карточек -->
      <div
        v-else
        class="grid gap-3"
        style="grid-template-columns: repeat(auto-fill, minmax(340px, 1fr))"
      >
        <div
          v-for="recipe in filtered"
          :key="recipe.id"
          class="surface-card p-4 flex flex-col gap-3 transition hover:border-slate-600/50"
        >
          <!-- Шапка -->
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-2.5 min-w-0">
              <ItemSlot :item="recipe.output" :count="recipe.output_count" size="sm" />
              <div class="min-w-0">
                <p class="text-sm font-bold text-slate-100 truncate leading-tight capitalize">
                  {{ outputDisplayName(recipe.output) }}
                </p>
                <p class="text-xs text-slate-500 truncate font-mono leading-tight mt-0.5">
                  {{ recipe.output }}
                </p>
              </div>
            </div>
            <div class="flex flex-col items-end gap-1 shrink-0">
              <span class="text-xs px-2 py-0.5 rounded-full font-semibold"
                :class="recipe.type === 'shaped'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'"
              >{{ recipe.type === 'shaped' ? t('recipes.typeShaped') : t('recipes.typeShapeless') }}</span>
              <span class="text-xs px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-400 border border-slate-600/40">
                {{ recipe.category }}
              </span>
            </div>
          </div>

          <!-- Разделитель -->
          <div class="border-t border-slate-700/40" />

          <!-- Сетка крафта -->
          <CraftingGrid :recipe="recipe" />

          <!-- Кнопки действий -->
          <div class="flex items-center justify-between gap-2 pt-0.5">
            <p class="text-xs text-slate-600 truncate font-mono flex-1">{{ recipe.id }}</p>

            <!-- "Используется в" — кнопка → модал -->
            <button
              v-if="getRecipesByIngredient(recipe.output).length > 0"
              @click="usedInItem = recipe.output"
              class="shrink-0 flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg bg-slate-700/40 hover:bg-slate-700/70 border border-slate-600/30 hover:border-slate-500/50 text-slate-400 hover:text-slate-200 transition"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              {{ getRecipesByIngredient(recipe.output).length }}
            </button>

            <!-- Дерево -->
            <button
              @click="treeRecipe = recipe"
              class="shrink-0 flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 hover:border-violet-500/40 text-violet-400 hover:text-violet-300 transition"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="5" r="3"/><path d="M12 8v8"/><circle cx="5" cy="19" r="3"/><circle cx="19" cy="19" r="3"/><path d="M12 16l-7 3M12 16l7 3"/>
              </svg>
              Дерево
            </button>
          </div>
        </div>
      </div>

    </div>
  </section>

  <!-- Модалки -->
  <RecipeTreeModal :recipe="treeRecipe" @close="treeRecipe = null" />
  <UsedInModal
    :item="usedInItem"
    @close="usedInItem = null"
    @open-tree="r => { usedInItem = null; treeRecipe = r }"
  />
</template>
