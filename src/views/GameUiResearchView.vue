<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import '../assets/gui-premium.css'
import { getResearchOverview, purchaseResearch, setWebguiToken } from '../services/gameUiApi.js'
import { useWebGuiToken, useActionToast } from '../composables/useWebGui.js'
import GameUiSidebar from '../components/GameUiSidebar.vue'
import GameUiStarfield from '../components/GameUiStarfield.vue'
import GameUiTopBar from '../components/GameUiTopBar.vue'
import GuiIcon from '../components/GuiIcon.vue'
import CountUp from '../components/CountUp.vue'

const { t } = useI18n()
const token = useWebGuiToken()
setWebguiToken(token)
const { toast, show } = useActionToast()

const overview = ref(null)
const loading = ref(false)
const error = ref(null)
const buying = ref(null)
const selectedKey = ref(null)

const canManage = computed(() => ['leader', 'officer'].includes(overview.value?.role))
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI']

// Map research node keys → real Minecraft item textures (Type C assets), no emoji.
const NODE_ART = {
  market_guilds: 'emerald',
  capital_workshops: 'crafting_table',
  labor_exchange: 'bell',
  academy: 'enchanting_table',
  gathering_industry: 'diamond',
  central_bank: 'gold_ingot',
}
function nodeArt(key) { return `/item-icons/minecraft/${NODE_ART[key] || 'book'}.png` }

// Derive a tier per node from its requires-chain depth.
const tiers = computed(() => {
  const nodes = overview.value?.nodes || []
  const byKey = Object.fromEntries(nodes.map(n => [n.key, n]))
  const depth = (n, seen = new Set()) => {
    if (!n.requires || !byKey[n.requires] || seen.has(n.key)) return 0
    seen.add(n.key)
    return 1 + depth(byKey[n.requires], seen)
  }
  const groups = {}
  for (const n of nodes) {
    const d = depth(n)
    ;(groups[d] ||= []).push(n)
  }
  return Object.keys(groups).sort((a, b) => a - b).map(d => ({ tier: Number(d), nodes: groups[d] }))
})

const selected = computed(() => (overview.value?.nodes || []).find(n => n.key === selectedKey.value) || null)

watch(overview, (o) => {
  if (o?.nodes?.length && !overview.value?.nodes?.find(n => n.key === selectedKey.value)) {
    selectedKey.value = o.nodes[0].key
  }
})

// ── SVG connectors between a node and its `requires` parent ─────────────────
const treeRef = ref(null)
const links = ref([])
const nodeEls = new Map()
let ro = null
function setNodeRef(key, el) { if (el) nodeEls.set(key, el); else nodeEls.delete(key) }
function computeLinks() {
  const tree = treeRef.value
  if (!tree || !overview.value) { links.value = []; return }
  const tr = tree.getBoundingClientRect()
  const out = []
  for (const n of overview.value.nodes) {
    if (!n.requires) continue
    const c = nodeEls.get(n.key), p = nodeEls.get(n.requires)
    if (!c || !p) continue
    const cb = c.getBoundingClientRect(), pb = p.getBoundingClientRect()
    out.push({
      x1: pb.left - tr.left + pb.width / 2, y1: pb.top - tr.top + pb.height,
      x2: cb.left - tr.left + cb.width / 2, y2: cb.top - tr.top,
      active: n.key === selectedKey.value || n.requires === selectedKey.value,
    })
  }
  links.value = out
}
function linkPath(l) {
  const dy = Math.max(18, (l.y2 - l.y1) * 0.5)
  return `M ${l.x1} ${l.y1} C ${l.x1} ${l.y1 + dy} ${l.x2} ${l.y2 - dy} ${l.x2} ${l.y2}`
}
function scheduleLinks() { nextTick(() => requestAnimationFrame(computeLinks)) }
watch(selectedKey, scheduleLinks)
watch(overview, scheduleLinks)
onMounted(() => {
  ro = new ResizeObserver(scheduleLinks)
  if (treeRef.value) ro.observe(treeRef.value)
  window.addEventListener('resize', scheduleLinks)
})
onBeforeUnmount(() => { ro?.disconnect(); window.removeEventListener('resize', scheduleLinks) })

async function load() {
  loading.value = true
  try {
    overview.value = await getResearchOverview()
    if (!selectedKey.value && overview.value?.nodes?.length) selectedKey.value = overview.value.nodes[0].key
    error.value = null
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
onMounted(load)

function money(v) {
  if (v == null || Number.isNaN(Number(v))) return '0'
  return Number(v).toLocaleString('ru-RU', { maximumFractionDigits: 0 })
}
function roleLabel(r) {
  return { leader: t('gameUiResearch.roleLeader'), officer: t('gameUiResearch.roleOfficer'), member: t('gameUiResearch.roleMember') }[r] || r
}
function effect(unit, value) {
  if (value == null) return '—'
  if (unit === 'percent') return `+${value}%`
  if (unit === 'level') return `${t('gameUiResearch.levelShort')} ${Math.round(value)}`
  if (unit === 'count') return `+${Math.round(value)}`
  return String(value)
}
function nodeStatus(n) {
  if (n.level >= n.max_level) return 'maxed'
  if (n.locked) return 'locked'
  if (n.level > 0) return 'active'
  return 'available'
}

async function buy(node) {
  if (!node || buying.value || node.locked || node.level >= node.max_level) return
  buying.value = node.key
  try {
    const res = await purchaseResearch(node.key)
    show(res.message || t('gameUiResearch.bought'), true)
    await load()
  } catch (e) {
    show(e.message || t('gameUiResearch.buyFail'), false)
  } finally {
    buying.value = null
  }
}
</script>

<template>
  <section class="gp-shell">
    <GameUiStarfield />
    <GameUiSidebar current="research" />
    <GameUiTopBar :title="t('gameUiNav.research')" />

    <div class="gp-wrap gp-wrap--wide gp-wrap--app">
      <div v-if="!token" class="gp-center"><div class="gp-card gp-state"><span class="gp-state-ico"><GuiIcon name="lock" :size="30" /></span><span class="gp-state-text">{{ t('gameUiResearch.tokenError') }}</span></div></div>
      <div v-else-if="loading && !overview" class="tech gp-grow">
        <div class="gp-panel"><div class="gp-skel gp-skel-row" style="width:30%;height:16px"></div><div class="gp-grid gp-grid--3" style="margin-top:20px"><div v-for="i in 6" :key="i" class="gp-skel" style="height:120px"></div></div></div>
        <div class="gp-panel"><div class="gp-skel" style="height:90px;border-radius:14px"></div><div class="gp-skel" style="height:210px;border-radius:14px;margin-top:14px"></div></div>
      </div>
      <div v-else-if="error" class="gp-center"><div class="gp-card gp-state"><span class="gp-state-ico"><GuiIcon name="alert" :size="30" /></span><span class="gp-state-text">{{ error }}</span></div></div>

      <template v-else-if="overview">
        <div class="tech gp-grow">
          <!-- TREE -->
          <div class="gp-panel tree-panel">
            <div class="gp-phead">
              <span class="gp-phead-ic"><GuiIcon name="tech" :size="16" /></span>
              <span class="gp-phead-tt">{{ t('gameUiResearch.tree') }}</span>
              <span class="gp-phead-sp"></span>
              <span class="gp-pill gp-pill--violet">{{ overview.nation_title }}</span>
            </div>

            <div ref="treeRef" class="tree">
              <svg class="tree-links" aria-hidden="true">
                <path v-for="(l, i) in links" :key="i" :d="linkPath(l)" class="tree-link" :class="{ active: l.active }" />
              </svg>
              <div v-for="row in tiers" :key="row.tier" class="tier-row">
                <div class="tier-mark">{{ ROMAN[row.tier] }}</div>
                <div class="tier-nodes gp-stagger">
                  <button
                    v-for="node in row.nodes" :key="node.key"
                    :ref="el => setNodeRef(node.key, el)"
                    class="hex" :class="[nodeStatus(node), { sel: node.key === selectedKey }]"
                    @click="selectedKey = node.key"
                  >
                    <span class="hex-ic"><img :src="nodeArt(node.key)" alt="" @error="$event.target.style.display='none'" /></span>
                    <span class="hex-lv gp-num">{{ node.level }}/{{ node.max_level }}</span>
                    <span class="hex-name">{{ node.title }}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- DETAIL -->
          <div class="detail">
            <div class="gp-panel res-hero">
              <div class="res-hero-top">
                <GuiIcon name="sparkles" :size="18" />
                <span class="gp-label">{{ t('gameUiResearch.treasury') }}</span>
              </div>
              <div class="gp-metric gp-metric--gold"><CountUp :value="overview.treasury_balance" :format="money" /></div>
              <span class="gp-pill gp-pill--violet role-pill">{{ roleLabel(overview.role) }}</span>
            </div>

            <div v-if="selected" class="gp-panel node-detail" :class="nodeStatus(selected)">
              <div class="nd-head">
                <span class="nd-ic"><img :src="nodeArt(selected.key)" alt="" @error="$event.target.style.display='none'" /></span>
                <div class="nd-id">
                  <div class="nd-title">{{ selected.title }}</div>
                  <div class="nd-cat">{{ selected.category }} · {{ t('gameUiResearch.levelShort') }} {{ selected.level }}/{{ selected.max_level }}</div>
                </div>
              </div>
              <div class="pips">
                <span v-for="i in selected.max_level" :key="i" class="pip" :class="{ on: i <= selected.level }"></span>
              </div>
              <p class="nd-desc">{{ selected.description }}</p>

              <div class="nd-eff">
                <span class="nd-eff-lbl">{{ t('gameUiResearch.effect') }}</span>
                <div class="nd-eff-vals">
                  <span class="eff-cur gp-num">{{ effect(selected.effect_unit, selected.current_effect) }}</span>
                  <template v-if="selected.next_effect != null">
                    <GuiIcon name="arrowRight" :size="14" class="eff-arr" />
                    <span class="eff-next gp-num">{{ effect(selected.effect_unit, selected.next_effect) }}</span>
                  </template>
                </div>
              </div>

              <div class="nd-cost" v-if="selected.next_cost != null">
                <span class="nd-cost-lbl">{{ t('gameUiResearch.cost') }}</span>
                <span class="nd-cost-val gp-num"><GuiIcon name="coins" :size="15" />{{ money(selected.next_cost) }}</span>
              </div>

              <button
                v-if="selected.level < selected.max_level"
                class="gp-btn gp-btn--primary gp-btn--full nd-buy"
                :disabled="!selected.can_afford || !canManage || selected.locked || buying === selected.key"
                @click="buy(selected)"
              >
                <span v-if="buying === selected.key" class="gp-spinner" style="width:15px;height:15px;border-width:2px"></span>
                <template v-else>
                  <GuiIcon name="zap" :size="15" />
                  <span v-if="selected.locked">{{ selected.lock_reason || t('gameUiResearch.locked') }}</span>
                  <span v-else>{{ t('gameUiResearch.research') }}</span>
                </template>
              </button>
              <div v-else class="nd-maxed"><GuiIcon name="check" :size="16" />{{ t('gameUiResearch.max') }}</div>

              <div v-if="!canManage" class="note"><GuiIcon name="lock" :size="13" />{{ t('gameUiResearch.manageNote') }}</div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <transition name="gp-toast">
      <div v-if="toast" class="gp-toast" :class="toast.ok ? 'gp-toast--ok' : 'gp-toast--err'">
        <GuiIcon :name="toast.ok ? 'check' : 'alert'" :size="16" /><span>{{ toast.text }}</span>
      </div>
    </transition>
  </section>
</template>

<style scoped>
.tech { display: grid; grid-template-columns: minmax(0,1fr) 320px; gap: 16px; align-items: start; }
@media (max-width: 900px) { .tech { grid-template-columns: 1fr; } }

/* tree */
.tree-panel { min-height: 360px; }
.tree { position: relative; display: flex; flex-direction: column; gap: 18px; padding: 6px 4px; }
.tree-links { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; overflow: visible; }
.tree-link { fill: none; stroke: rgba(139,123,255,0.35); stroke-width: 2; stroke-linecap: round; transition: stroke 0.2s, stroke-width 0.2s; }
.tree-link.active { stroke: var(--gp-violet-2); stroke-width: 2.5; filter: drop-shadow(0 0 5px rgba(139,123,255,0.7)); }
.tier-row { position: relative; z-index: 1; display: grid; grid-template-columns: 40px 1fr; align-items: center; gap: 10px; }
.tier-mark {
  width: 34px; height: 34px; display: grid; place-items: center; border-radius: 10px;
  font-family: 'JetBrains Mono', monospace; font-weight: 800; font-size: 0.9rem; color: var(--gp-violet-2);
  background: rgba(139,123,255,0.1); border: 1px solid rgba(139,123,255,0.24);
}
.tier-nodes { display: flex; flex-wrap: wrap; gap: 12px; }

.hex {
  position: relative; width: 116px; padding: 12px 10px; cursor: pointer;
  display: flex; flex-direction: column; align-items: center; gap: 5px;
  border-radius: 14px; border: 1px solid var(--gp-line);
  background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.006));
  color: inherit; font-family: inherit; transition: transform 0.12s, border-color 0.15s, box-shadow 0.15s;
}
.hex:hover { transform: translateY(-2px); }
.hex-ic { width: 42px; height: 42px; display: grid; place-items: center; border-radius: 12px; border: 1px solid rgba(139,123,255,0.26); background: linear-gradient(135deg, rgba(139,123,255,0.2), rgba(217,70,239,0.08)); }
.hex-ic img { width: 26px; height: 26px; image-rendering: pixelated; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.5)); }
.hex-lv { font-family: 'Silkscreen', 'JetBrains Mono', monospace; font-size: 0.74rem; font-weight: 700; color: #b9c4e6; }
.hex-name { font-size: 0.68rem; font-weight: 700; color: #dbe2f6; text-align: center; line-height: 1.2; }
.hex.available .hex-ic { border-color: rgba(139,123,255,0.4); }
.hex.active { border-color: rgba(139,123,255,0.4); }
.hex.active .hex-ic { box-shadow: 0 0 16px -2px rgba(139,123,255,0.7); }
.hex.active .hex-lv { color: #c9beff; }
.hex.maxed { border-color: rgba(52,211,153,0.35); }
.hex.maxed .hex-ic { border-color: rgba(52,211,153,0.5); background: linear-gradient(135deg, rgba(52,211,153,0.22), rgba(52,211,153,0.05)); }
.hex.maxed .hex-lv { color: #6ee7b7; }
.hex.locked { opacity: 0.5; }
.hex.locked .hex-ic { filter: grayscale(0.6); }
.hex.sel { border-color: var(--gp-violet-2); box-shadow: 0 0 0 1px var(--gp-violet-2), 0 14px 30px -18px rgba(139,123,255,0.8); }

/* detail */
.detail { display: flex; flex-direction: column; gap: 14px; position: sticky; top: 74px; }
.res-hero { align-items: flex-start; gap: 6px; }
.res-hero-top { display: flex; align-items: center; gap: 8px; color: var(--gp-gold); }
.res-hero .gp-metric { margin: 2px 0; }
.role-pill { align-self: flex-start; }

.node-detail { gap: 11px; }
.nd-head { display: flex; align-items: center; gap: 12px; }
.nd-ic { width: 50px; height: 50px; flex-shrink: 0; display: grid; place-items: center; border-radius: 14px; border: 1px solid rgba(139,123,255,0.3); background: linear-gradient(135deg, rgba(139,123,255,0.24), rgba(217,70,239,0.1)); }
.nd-ic img { width: 30px; height: 30px; image-rendering: pixelated; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5)); }
.node-detail.maxed .nd-ic { border-color: rgba(52,211,153,0.5); background: linear-gradient(135deg, rgba(52,211,153,0.22), rgba(52,211,153,0.05)); }
.nd-id { min-width: 0; }
.nd-title { font-size: 1.05rem; font-weight: 800; color: #f2f5ff; }
.nd-cat { font-size: 0.66rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--gp-ink-dim); margin-top: 2px; }
.pips { display: flex; gap: 4px; }
.pip { flex: 1; height: 6px; border-radius: 999px; background: rgba(255,255,255,0.09); }
.pip.on { background: linear-gradient(90deg, #7c6bff, #b45cf0); box-shadow: 0 0 8px rgba(139,123,255,0.55); }
.nd-desc { font-size: 0.8rem; line-height: 1.55; color: var(--gp-ink-soft); }

.nd-eff, .nd-cost { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-radius: 11px; border: 1px solid var(--gp-line); background: rgba(0,0,0,0.2); }
.nd-eff-lbl, .nd-cost-lbl { font-size: 0.68rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--gp-ink-dim); }
.nd-eff-vals { display: flex; align-items: center; gap: 7px; font-size: 0.86rem; font-weight: 800; }
.eff-cur { color: #d3dbf3; } .eff-arr { color: var(--gp-ink-dim); } .eff-next { color: var(--gp-green); }
.nd-cost-val { display: flex; align-items: center; gap: 6px; font-size: 0.92rem; font-weight: 800; color: var(--gp-gold); }
.nd-cost-val svg { color: var(--gp-gold); }
.nd-buy { margin-top: 2px; }
.nd-maxed { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 11px; border-radius: 11px; font-size: 0.85rem; font-weight: 800; color: #6ee7b7; background: rgba(52,211,153,0.1); border: 1px solid rgba(52,211,153,0.28); }
.note { display: flex; align-items: center; gap: 7px; font-size: 0.72rem; color: #c9beff; background: rgba(139, 123, 255, 0.1); border: 1px solid rgba(139, 123, 255, 0.22); border-radius: 10px; padding: 8px 11px; }
</style>
