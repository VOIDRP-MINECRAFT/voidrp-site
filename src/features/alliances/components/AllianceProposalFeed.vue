<script setup>
const props = defineProps({
  items: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  canVote: { type: Boolean, default: false },
  votingDisabled: { type: Boolean, default: false },
})

const emit = defineEmits(['vote'])

function statusLabel(item) {
  const status = String(item?.status || '').toLowerCase()
  const executionStatus = String(item?.execution_status || '').toLowerCase()

  if (status === 'executed') return 'Исполнено'
  if (status === 'approved' && executionStatus === 'executed') return 'Исполнено'
  if (status === 'approved' && executionStatus === 'failed') return 'Одобрено, но не исполнено'
  if (status === 'approved') return 'Одобрено'
  if (status === 'rejected') return 'Отклонено'
  if (status === 'expired') return 'Закрыто'
  return 'Открыто'
}

function typeLabel(value) {
  switch (String(value || '').toLowerCase()) {
    case 'set_policy':
      return 'Изменение правил'
    case 'accept_member':
      return 'Принять участника'
    case 'remove_member':
      return 'Исключить участника'
    case 'transfer':
      return 'Перевод средств'
    default:
      return 'Решение союза'
  }
}

function voteSummary(item) {
  const votes = Array.isArray(item?.votes) ? item.votes : []
  const yes = votes.filter((v) => String(v?.vote || '').toLowerCase() === 'yes').length
  const no = votes.filter((v) => String(v?.vote || '').toLowerCase() === 'no').length
  const veto = votes.filter((v) => String(v?.vote || '').toLowerCase() === 'veto').length
  return `За: ${yes} · Против: ${no} · Вето: ${veto}`
}

function canVoteForItem(item) {
  return props.canVote && !props.votingDisabled && String(item?.status || '').toLowerCase() === 'open'
}

function vote(id, value) {
  emit('vote', { id, vote: value })
}
</script>

<template>
  <section class="surface-card p-4 md:p-5">
    <div class="section-kicker !mb-2">Решения</div>
    <h2 class="text-xl font-black text-slate-50 md:text-2xl">Предложения союза</h2>

    <div v-if="loading" class="mt-5 space-y-3">
      <div class="skeleton h-28 rounded-[22px]"></div>
      <div class="skeleton h-28 rounded-[22px]"></div>
    </div>

    <div v-else-if="!items.length" class="action-card mt-5 text-sm text-slate-400">
      Пока нет предложений.
    </div>

    <div v-else class="mt-5 space-y-3">
      <article v-for="item in items" :key="item.id" class="action-card">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <span class="footer-chip">{{ typeLabel(item.proposal_type) }}</span>
              <span class="footer-chip">{{ statusLabel(item) }}</span>
            </div>
            <p class="mt-3 font-semibold text-slate-100">{{ item.title }}</p>
            <p v-if="item.description" class="mt-2 text-sm leading-6 text-slate-400">{{ item.description }}</p>
            <p class="mt-3 text-xs leading-5 text-slate-500">{{ voteSummary(item) }}</p>
            <p v-if="item.execution_result" class="mt-2 text-xs leading-5 text-slate-500">{{ item.execution_result }}</p>
          </div>

          <div v-if="canVoteForItem(item)" class="flex shrink-0 flex-wrap gap-2">
            <button type="button" class="btn btn-primary btn-sm" @click="vote(item.id, 'yes')">За</button>
            <button type="button" class="btn btn-outline btn-sm" @click="vote(item.id, 'no')">Против</button>
            <button type="button" class="btn btn-ghost btn-sm" @click="vote(item.id, 'veto')">Вето</button>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>
