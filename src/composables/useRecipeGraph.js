import recipesData from '../data/recipes.json'

const recipes = recipesData.recipes

// Index: output item → recipe
const byOutput = {}
// Index: ingredient item → recipes[]
const byIngredient = {}

for (const r of recipes) {
  if (!r.output || r.output.includes('${')) continue
  byOutput[r.output] = r

  const ings = r.type === 'shaped'
    ? Object.values(r.keys ?? {})
    : (r.inputs ?? [])

  for (const ing of ings) {
    if (!ing || ing.startsWith('#')) continue
    ;(byIngredient[ing] ??= []).push(r)
  }
}

function getIngredientCounts(recipe) {
  const counts = {}
  if (recipe.type === 'shaped') {
    const pattern = recipe.pattern.join('')
    for (const [key, ing] of Object.entries(recipe.keys ?? {})) {
      const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const n = (pattern.match(new RegExp(escaped, 'g')) ?? []).length
      counts[ing] = (counts[ing] ?? 0) + n
    }
  } else {
    for (const ing of recipe.inputs ?? []) {
      if (ing) counts[ing] = (counts[ing] ?? 0) + 1
    }
  }
  return counts
}

export function useRecipeGraph() {
  function getRecipeByOutput(item) {
    return byOutput[item] ?? null
  }

  function getRecipesByIngredient(item) {
    return byIngredient[item] ?? []
  }

  // Build dependency tree node (recursive)
  function buildTree(item, qty = 1, depth = 0, visited = new Set()) {
    const recipe = byOutput[item]
    const node = { item, qty, recipe: recipe ?? null, children: [], expanded: depth < 2 }

    if (!recipe || depth >= 12 || visited.has(item)) return node

    const seen = new Set(visited)
    seen.add(item)
    const outCount = recipe.output_count || 1
    const mult = Math.ceil(qty / outCount)
    const counts = getIngredientCounts(recipe)

    for (const [ing, n] of Object.entries(counts)) {
      node.children.push(buildTree(ing, n * mult, depth + 1, seen))
    }
    return node
  }

  // Flat list of base resources (no recipe) with total quantities
  function calcBaseResources(item, qty = 1) {
    const totals = new Map()

    function traverse(item, qty, depth, visited) {
      if (depth > 15 || visited.has(item)) {
        totals.set(item, (totals.get(item) ?? 0) + qty)
        return
      }
      const recipe = byOutput[item]
      if (!recipe) {
        totals.set(item, (totals.get(item) ?? 0) + qty)
        return
      }
      const seen = new Set(visited)
      seen.add(item)
      const outCount = recipe.output_count || 1
      const mult = Math.ceil(qty / outCount)
      const counts = getIngredientCounts(recipe)
      for (const [ing, n] of Object.entries(counts)) {
        traverse(ing, n * mult, depth + 1, seen)
      }
    }

    traverse(item, qty, 0, new Set())
    return [...totals.entries()].sort((a, b) => b[1] - a[1])
  }

  return { getRecipeByOutput, getRecipesByIngredient, buildTree, calcBaseResources }
}
