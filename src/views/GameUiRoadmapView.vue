<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import '../assets/gui-premium.css'
import { setWebguiToken, getGuideRoadmap, getGuideProgress } from '../services/gameUiApi.js'
import { useWebGuiToken } from '../composables/useWebGui.js'
import GameUiSidebar from '../components/GameUiSidebar.vue'
import GameUiStarfield from '../components/GameUiStarfield.vue'
import GameUiTopBar from '../components/GameUiTopBar.vue'
import GuiIcon from '../components/GuiIcon.vue'
import ItemIcon from '../components/ItemIcon.vue'

// Путеводитель: where the player is on the pack's progression and what to do next.
// A stage counts as done when its epoch is unlocked (a later main epoch implies it) or when
// every key item of it has been in the player's inventory. Steps tick off by those items.
const { t, locale } = useI18n()
const token = useWebGuiToken()
setWebguiToken(token)

const roadmap = ref(null)
const progress = ref({ tiers: [], items: [] })
const loading = ref(true)
const error = ref('')
const selectedId = ref(null)

const lang = computed(() => ((locale.value || 'ru').startsWith('en') ? 'en' : 'ru'))
const tx = (o) => (o ? o[lang.value] || o.ru || '' : '')

onMounted(async () => {
  try {
    const [road, prog] = await Promise.all([getGuideRoadmap(), token ? getGuideProgress().catch(() => null) : null])
    roadmap.value = road
    if (prog) progress.value = prog
  } catch (e) {
    error.value = e.message || t('gameUiRoadmap.loadError')
  } finally {
    loading.value = false
  }
})

const tiers = computed(() => new Set(progress.value.tiers || []))
const items = computed(() => new Set(progress.value.items || []))

// Main stages with status. Stages after the last one confirmed by an epoch count as not
// implied; stages before a done-by-epoch stage are done too (you can't skip the line).
const stages = computed(() => {
  const list = roadmap.value?.stages || []
  const own = list.map((st) => {
    const have = st.steps.filter((s) => items.value.has(s.item)).length
    const byEpoch = Boolean(st.epoch && tiers.value.has(st.epoch))
    return { ...st, have, total: st.steps.length, done: byEpoch || have === st.steps.length }
  })
  let lastDone = -1
  own.forEach((st, i) => { if (st.done) lastDone = i })
  return own.map((st, i) => {
    const done = st.done || i < lastDone
    return { ...st, done, index: i }
  })
})
const currentIndex = computed(() => {
  const i = stages.value.findIndex((st) => !st.done)
  return i === -1 ? stages.value.length - 1 : i
})
const allDone = computed(() => stages.value.length > 0 && stages.value.every((st) => st.done))
const doneCount = computed(() => stages.value.filter((st) => st.done).length)
const overallPct = computed(() => (stages.value.length ? Math.round((doneCount.value / stages.value.length) * 100) : 0))

const selected = computed(() => {
  const id = selectedId.value
  return stages.value.find((st) => st.id === id)
    || branches.value.find((b) => b.id === id)
    || stages.value[currentIndex.value]
})

function stepState(block, step) {
  if (items.value.has(step.item) || block.done) return 'done'
  const firstTodo = block.steps.find((s) => !items.value.has(s.item))
  return firstTodo && firstTodo.item === step.item ? 'next' : 'todo'
}

const nextStep = computed(() => {
  const st = stages.value[currentIndex.value]
  if (!st || allDone.value) return null
  const step = st.steps.find((s) => !items.value.has(s.item)) || st.steps[st.steps.length - 1]
  return { stage: st, step }
})

const branches = computed(() => (roadmap.value?.branches || []).map((b) => {
  const have = b.steps.filter((s) => items.value.has(s.item)).length
  const done = Boolean(b.epoch && tiers.value.has(b.epoch)) || have === b.steps.length
  return { ...b, have, total: b.steps.length, done, branch: true }
}))

function select(id) {
  selectedId.value = id
}
</script>

<template>
  <section class="gp-shell">
    <GameUiStarfield />
    <GameUiSidebar current="roadmap" />
    <GameUiTopBar :title="t('gameUiNav.roadmap')" />

    <div class="gp-wrap gp-wrap--wide gp-wrap--app">
      <div v-if="loading" class="gp-center"><span class="gp-spinner"></span></div>
      <div v-else-if="error" class="gp-center"><div class="gp-card gp-state"><span class="gp-state-ico"><GuiIcon name="alert" :size="30" /></span><span class="gp-state-text">{{ error }}</span></div></div>

      <template v-else-if="roadmap">
        <!-- where you are + the one next thing to do -->
        <header class="rm-hero">
          <div class="rm-where">
            <p class="rm-kicker">{{ t('gameUiRoadmap.title') }}</p>
            <h1 class="rm-stage">
              <template v-if="allDone">{{ t('gameUiRoadmap.allDone') }}</template>
              <template v-else>{{ tx(stages[currentIndex].title) }}</template>
            </h1>
            <p class="rm-count">{{ t('gameUiRoadmap.stageOf', { n: Math.min(currentIndex + 1, stages.length), total: stages.length }) }}</p>
            <div class="rm-bar" role="progressbar" :aria-valuenow="overallPct" aria-valuemin="0" aria-valuemax="100">
              <div class="rm-bar__fill" :style="{ width: Math.max(overallPct, 2) + '%' }"></div>
            </div>
            <p v-if="!token" class="rm-note">{{ t('gameUiRoadmap.noToken') }}</p>
          </div>

          <div v-if="nextStep" class="rm-next">
            <p class="rm-next__label">{{ t('gameUiRoadmap.nextStep') }}</p>
            <div class="rm-next__body">
              <span class="rm-next__icon"><ItemIcon :itemKey="nextStep.step.item" :size="56" /></span>
              <div class="rm-next__text">
                <p class="rm-next__title">{{ tx(nextStep.step.title) }}</p>
                <p class="rm-next__hint">{{ tx(nextStep.step.hint) }}</p>
              </div>
            </div>
          </div>
        </header>

        <div class="rm-grid">
          <!-- the whole line -->
          <nav class="rm-line gp-panel" :aria-label="t('gameUiRoadmap.stagesAria')">
            <button v-for="st in stages" :key="st.id" type="button" class="rm-line__item"
                    :class="{ done: st.done, current: st.index === currentIndex && !allDone, active: selected && selected.id === st.id }"
                    @click="select(st.id)">
              <span class="rm-line__dot" aria-hidden="true">
                <GuiIcon v-if="st.done" name="check" :size="13" />
                <span v-else>{{ st.index + 1 }}</span>
              </span>
              <span class="rm-line__name">{{ tx(st.title) }}</span>
              <span class="rm-line__count">{{ st.done ? '' : st.have + '/' + st.total }}</span>
            </button>
          </nav>

          <!-- selected stage -->
          <section v-if="selected" class="rm-detail gp-panel">
            <div class="rm-detail__head">
              <div>
                <p class="rm-detail__tag">
                  <template v-if="selected.branch">{{ t('gameUiRoadmap.branch') }}</template>
                  <template v-else-if="selected.done">{{ t('gameUiRoadmap.stageDone') }}</template>
                  <template v-else-if="selected.index === currentIndex">{{ t('gameUiRoadmap.youAreHere') }}</template>
                  <template v-else>{{ t('gameUiRoadmap.ahead') }}</template>
                </p>
                <h2 class="rm-detail__title">{{ tx(selected.title) }}</h2>
              </div>
              <span class="rm-detail__count">{{ selected.have }}/{{ selected.total }}</span>
            </div>
            <p class="rm-detail__summary">{{ tx(selected.summary) }}</p>

            <ol class="rm-steps">
              <li v-for="step in selected.steps" :key="step.item" class="rm-step" :class="stepState(selected, step)">
                <span class="rm-step__icon"><ItemIcon :itemKey="step.item" :size="36" /></span>
                <span class="rm-step__text">
                  <span class="rm-step__title">
                    {{ tx(step.title) }}
                    <span v-if="step.gate" class="rm-step__gate">{{ t('gameUiRoadmap.gate') }}</span>
                  </span>
                  <span class="rm-step__hint">{{ tx(step.hint) }}</span>
                </span>
                <span class="rm-step__state" aria-hidden="true">
                  <GuiIcon v-if="stepState(selected, step) === 'done'" name="check" :size="16" />
                  <span v-else-if="stepState(selected, step) === 'next'" class="rm-step__now">{{ t('gameUiRoadmap.now') }}</span>
                </span>
              </li>
            </ol>
            <p class="rm-detail__quest"><GuiIcon name="quest" :size="14" />{{ tx(selected.questbook) }}</p>
          </section>
        </div>

        <!-- optional branches -->
        <section class="rm-branches">
          <h2 class="rm-branches__title">{{ t('gameUiRoadmap.branches') }}</h2>
          <p class="rm-branches__sub">{{ t('gameUiRoadmap.branchesSub') }}</p>
          <div class="rm-branches__grid">
            <button v-for="b in branches" :key="b.id" type="button" class="rm-branch"
                    :class="{ done: b.done, active: selected && selected.id === b.id }" @click="select(b.id)">
              <span class="rm-branch__icon"><ItemIcon :itemKey="b.steps[b.steps.length - 1].item" :size="32" /></span>
              <span class="rm-branch__text">
                <span class="rm-branch__name">{{ tx(b.title) }}</span>
                <span class="rm-branch__count">{{ b.done ? t('gameUiRoadmap.stageDone') : b.have + '/' + b.total }}</span>
              </span>
            </button>
          </div>
        </section>
      </template>
    </div>
  </section>
</template>

<style scoped>
.rm-hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 460px); gap: 16px; margin-bottom: 16px; }
.rm-where, .rm-next { border-radius: 18px; padding: 22px 24px; background: rgba(16, 18, 34, 0.78); border: 1px solid var(--gp-line); }
.rm-kicker { margin: 0; font-size: 0.85rem; font-weight: 700; color: var(--gp-violet-2); }
.rm-stage { margin: 6px 0 0; font-size: 2rem; line-height: 1.1; font-weight: 900; color: #f4f7ff; letter-spacing: -0.01em; }
.rm-count { margin: 8px 0 14px; font-size: 0.9rem; color: var(--gp-ink-soft); }
.rm-bar { height: 10px; border-radius: 999px; background: rgba(255, 255, 255, 0.08); overflow: hidden; }
.rm-bar__fill { height: 100%; border-radius: inherit; background: linear-gradient(90deg, #7c6bff, #c084fc); }
.rm-note { margin: 12px 0 0; font-size: 0.82rem; color: var(--gp-ink-dim); }

.rm-next { border-color: rgba(52, 211, 153, 0.35); background: linear-gradient(160deg, rgba(52, 211, 153, 0.1), rgba(16, 18, 34, 0.82)); }
.rm-next__label { margin: 0 0 12px; font-size: 0.85rem; font-weight: 800; color: var(--gp-green); }
.rm-next__body { display: flex; gap: 16px; align-items: center; }
.rm-next__icon { flex: none; width: 76px; height: 76px; border-radius: 16px; display: grid; place-items: center; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(52, 211, 153, 0.35); }
.rm-next__text { min-width: 0; }
.rm-next__title { margin: 0; font-size: 1.2rem; font-weight: 800; color: #f4f7ff; }
.rm-next__hint { margin: 4px 0 0; font-size: 0.92rem; line-height: 1.45; color: var(--gp-ink-soft); }

.rm-grid { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 16px; align-items: start; }
.rm-line { display: flex; flex-direction: column; gap: 2px; padding: 10px; }
.rm-line__item {
  display: grid; grid-template-columns: 26px minmax(0, 1fr) auto; align-items: center; gap: 10px;
  padding: 9px 10px; border-radius: 10px; border: 1px solid transparent; background: transparent;
  font: inherit; color: var(--gp-ink-soft); text-align: left; cursor: pointer;
}
.rm-line__item:hover { background: rgba(255, 255, 255, 0.04); }
.rm-line__item.active { background: rgba(139, 123, 255, 0.14); border-color: rgba(139, 123, 255, 0.4); color: #f4f7ff; }
.rm-line__item:focus-visible, .rm-branch:focus-visible { outline: 2px solid var(--gp-violet); outline-offset: 2px; }
.rm-line__dot { width: 26px; height: 26px; border-radius: 999px; display: grid; place-items: center; font-size: 0.76rem; font-weight: 800; background: rgba(255, 255, 255, 0.06); color: var(--gp-ink-dim); }
.rm-line__item.done .rm-line__dot { background: rgba(52, 211, 153, 0.18); color: var(--gp-green); }
.rm-line__item.current .rm-line__dot { background: linear-gradient(135deg, #7c6bff, #c084fc); color: #fff; }
.rm-line__item.current { color: #f4f7ff; font-weight: 700; }
.rm-line__name { font-size: 0.92rem; line-height: 1.25; }
.rm-line__count { font-size: 0.78rem; color: var(--gp-ink-dim); font-variant-numeric: tabular-nums; }

.rm-detail { padding: 22px 24px; }
.rm-detail__head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
.rm-detail__tag { margin: 0; font-size: 0.85rem; font-weight: 700; color: var(--gp-violet-2); }
.rm-detail__title { margin: 4px 0 0; font-size: 1.5rem; font-weight: 900; color: #f4f7ff; }
.rm-detail__count { font-size: 1rem; font-weight: 800; color: var(--gp-ink-soft); font-variant-numeric: tabular-nums; }
.rm-detail__summary { margin: 10px 0 16px; max-width: 72ch; font-size: 0.95rem; line-height: 1.55; color: #cfd6ee; }
.rm-steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.rm-step { display: grid; grid-template-columns: 48px minmax(0, 1fr) auto; gap: 14px; align-items: center; padding: 10px 14px; border-radius: 12px; background: rgba(255, 255, 255, 0.025); border: 1px solid var(--gp-line); }
.rm-step.done { opacity: 0.62; }
.rm-step.next { border-color: rgba(52, 211, 153, 0.5); background: rgba(52, 211, 153, 0.07); }
.rm-step__icon { width: 48px; height: 48px; border-radius: 10px; display: grid; place-items: center; background: rgba(0, 0, 0, 0.28); }
.rm-step__text { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.rm-step__title { font-size: 0.98rem; font-weight: 700; color: #eef2ff; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.rm-step__gate { font-size: 0.72rem; font-weight: 800; color: var(--gp-gold); padding: 2px 8px; border-radius: 999px; background: rgba(251, 191, 36, 0.12); border: 1px solid rgba(251, 191, 36, 0.35); }
.rm-step__hint { font-size: 0.86rem; line-height: 1.4; color: var(--gp-ink-soft); }
.rm-step__state { color: var(--gp-green); display: grid; place-items: center; }
.rm-step__now { font-size: 0.78rem; font-weight: 800; color: var(--gp-green); white-space: nowrap; }
.rm-detail__quest { display: flex; align-items: center; gap: 7px; margin: 16px 0 0; font-size: 0.85rem; color: var(--gp-ink-dim); }

.rm-branches { margin-top: 20px; }
.rm-branches__title { margin: 0; font-size: 1.1rem; font-weight: 800; color: #eef2ff; }
.rm-branches__sub { margin: 4px 0 12px; font-size: 0.88rem; color: var(--gp-ink-soft); }
.rm-branches__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
.rm-branch { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 14px; border: 1px solid var(--gp-line); background: rgba(16, 18, 34, 0.7); font: inherit; color: inherit; text-align: left; cursor: pointer; }
.rm-branch:hover { border-color: rgba(139, 123, 255, 0.4); }
.rm-branch.active { border-color: rgba(139, 123, 255, 0.6); background: rgba(139, 123, 255, 0.12); }
.rm-branch.done { border-color: rgba(52, 211, 153, 0.4); }
.rm-branch__icon { width: 42px; height: 42px; flex: none; border-radius: 10px; display: grid; place-items: center; background: rgba(0, 0, 0, 0.28); }
.rm-branch__text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.rm-branch__name { font-size: 0.92rem; font-weight: 700; color: #eef2ff; }
.rm-branch__count { font-size: 0.8rem; color: var(--gp-ink-dim); }

@media (max-width: 1000px) {
  .rm-hero, .rm-grid { grid-template-columns: minmax(0, 1fr); }
}
</style>
