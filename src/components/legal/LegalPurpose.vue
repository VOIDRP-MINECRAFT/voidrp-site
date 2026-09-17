<script setup>
// One processing purpose of the privacy policy, described by the same fixed set of parameters
// (goal, subjects, data, legal basis, actions, recipients, term, destruction), so each purpose can
// be read on its own.
defineProps({
  id: { type: String, default: undefined },
  number: { type: String, required: true },
  title: { type: String, required: true },
  rows: { type: Object, required: true },
})

const LABELS = [
  ['goal', 'Цель'],
  ['subjects', 'Чьи данные'],
  ['data', 'Какие данные'],
  ['basis', 'Правовое основание'],
  ['actions', 'Действия и способ'],
  ['recipients', 'Кто получает доступ'],
  ['term', 'Срок обработки и хранения'],
  ['destroy', 'Прекращение и уничтожение'],
]
</script>

<template>
  <div :id="id" class="lp">
    <h3 class="lp__title"><span class="lp__num">{{ number }}</span>{{ title }}</h3>
    <dl class="lp__grid">
      <template v-for="[key, label] in LABELS" :key="key">
        <div v-if="rows[key]" class="lp__row">
          <dt>{{ label }}</dt>
          <dd>{{ rows[key] }}</dd>
        </div>
      </template>
    </dl>
  </div>
</template>

<style scoped>
.lp { margin: 18px 0 0; border-radius: 14px; border: 1px solid rgba(255, 255, 255, 0.1); background: rgba(255, 255, 255, 0.02); overflow: hidden; scroll-margin-top: 96px; }
.lp__title { display: flex; gap: 10px; align-items: baseline; margin: 0; padding: 14px 16px; font-size: 1.02rem; font-weight: 800; line-height: 1.35; color: #f6f4fc; background: rgba(139, 92, 246, 0.08); border-bottom: 1px solid rgba(255, 255, 255, 0.08); }
.lp__num { flex: none; font-size: 0.85rem; font-weight: 800; color: #c4b5fd; font-variant-numeric: tabular-nums; }
.lp__grid { margin: 0; }
.lp__row { display: grid; grid-template-columns: 190px minmax(0, 1fr); gap: 4px 16px; padding: 10px 16px; border-top: 1px solid rgba(255, 255, 255, 0.06); }
.lp__row:first-child { border-top: 0; }
.lp__row dt { font-size: 0.86rem; font-weight: 700; line-height: 1.55; color: #9d99b6; }
.lp__row dd { margin: 0; font-size: 0.95rem; line-height: 1.6; color: #d2cee3; }
@media (max-width: 640px) {
  .lp__row { grid-template-columns: minmax(0, 1fr); }
}
@media print {
  .lp { border-color: #999; background: none; }
  .lp__title, .lp__row dd { color: #000 !important; background: none; }
  .lp__row dt { color: #333 !important; }
}
</style>
