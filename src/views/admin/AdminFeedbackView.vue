<script setup>
import { onMounted, ref, computed } from 'vue'
import { adminListFeedback, adminDeleteFeedback } from '../../services/adminApi'
import { authState } from '../../stores/authStore'

const token = () => authState.accessToken

const items = ref([])
const loading = ref(true)
const deletingId = ref(null)
const search = ref('')
const filterType = ref('')

async function load() {
  loading.value = true
  try {
    const data = await adminListFeedback(token())
    items.value = data?.items || []
  } catch {
    items.value = []
  } finally {
    loading.value = false
  }
}

async function remove(id) {
  if (!confirm('Удалить это обращение?')) return
  deletingId.value = id
  try {
    await adminDeleteFeedback(token(), id)
    items.value = items.value.filter(i => i.id !== id)
  } catch {
    // ignore
  } finally {
    deletingId.value = null
  }
}

const filtered = computed(() => {
  let list = items.value
  if (filterType.value) list = list.filter(i => i.type === filterType.value)
  if (!search.value) return list
  const q = search.value.toLowerCase()
  return list.filter(i =>
    i.title.toLowerCase().includes(q) ||
    i.user_login.toLowerCase().includes(q) ||
    (i.user_nickname || '').toLowerCase().includes(q) ||
    (i.body || '').toLowerCase().includes(q),
  )
})

const TYPE_META = {
  suggestion: { label: 'Предложение', cls: 'adm-badge--acc' },
  bug:        { label: 'Баг',          cls: 'adm-badge--err' },
  complaint:  { label: 'Жалоба',       cls: 'adm-badge--warn' },
}

function typeMeta(type) {
  return TYPE_META[type] ?? { label: type, cls: '' }
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

onMounted(load)
</script>

<template>
  <div class="adm-page" style="max-width: 860px">
    <div class="adm-page__head">
      <div>
        <h1 class="adm-title">Обращения игроков</h1>
        <p class="adm-sub">{{ filtered.length }} из {{ items.length }} · со всех серверов, источник помечен</p>
      </div>
      <button class="adm-btn" :disabled="loading" @click="load">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
        Обновить
      </button>
    </div>

    <!-- Stats -->
    <div v-if="!loading && items.length" class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div class="adm-kpi"><div><div class="adm-kpi__val">{{ items.length }}</div><div class="adm-kpi__label">Всего</div></div></div>
      <div class="adm-kpi"><div><div class="adm-kpi__val" style="color: var(--adm-acc-text)">{{ items.filter(i => i.type === 'suggestion').length }}</div><div class="adm-kpi__label">Предложения</div></div></div>
      <div class="adm-kpi"><div><div class="adm-kpi__val" style="color: #fca5a5">{{ items.filter(i => i.type === 'bug').length }}</div><div class="adm-kpi__label">Баги</div></div></div>
      <div class="adm-kpi"><div><div class="adm-kpi__val" style="color: #fdba74">{{ items.filter(i => i.type === 'complaint').length }}</div><div class="adm-kpi__label">Жалобы</div></div></div>
    </div>

    <!-- Filters -->
    <div class="filters">
      <input v-model="search" class="adm-input" style="max-width: 400px" placeholder="Заголовок, логин, ник, описание..." />
      <div class="adm-tabs">
        <button class="adm-tab" :class="{ 'adm-tab--active': filterType === '' }" @click="filterType = ''">Все</button>
        <button class="adm-tab" :class="{ 'adm-tab--active': filterType === 'suggestion' }" @click="filterType = filterType === 'suggestion' ? '' : 'suggestion'">Предложения</button>
        <button class="adm-tab" :class="{ 'adm-tab--active': filterType === 'bug' }" @click="filterType = filterType === 'bug' ? '' : 'bug'">Баги</button>
        <button class="adm-tab" :class="{ 'adm-tab--active': filterType === 'complaint' }" @click="filterType = filterType === 'complaint' ? '' : 'complaint'">Жалобы</button>
      </div>
    </div>

    <!-- Content -->
    <div v-if="loading" class="adm-skel" style="height: 260px" />

    <div v-else-if="filtered.length" class="cards">
      <div v-for="item in filtered" :key="item.id" class="adm-card adm-card--pad adm-card--hover">
        <div class="card__top">
          <div class="card__meta">
            <span class="adm-badge" :class="typeMeta(item.type).cls">{{ typeMeta(item.type).label }}</span>
            <span class="card__login">{{ item.user_login }}</span>
            <span v-if="item.user_nickname" class="card__nick adm-mono">{{ item.user_nickname }}</span>
            <span v-if="item.server_name" class="adm-badge adm-badge--acc">{{ item.server_name }}</span>
            <span class="card__date adm-num">{{ formatDate(item.created_at) }}</span>
          </div>
          <button class="adm-btn adm-btn--danger adm-btn--sm" :disabled="deletingId === item.id" @click="remove(item.id)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            Удалить
          </button>
        </div>

        <p class="card__title">{{ item.title }}</p>

        <p v-if="item.body" class="card__body">{{ item.body }}</p>
      </div>
    </div>

    <div v-else class="adm-empty">
      <div class="adm-empty__title">Нет обращений</div>
      <div class="adm-empty__sub">Игроки отправляют обращения из лаунчера</div>
    </div>
  </div>
</template>

<style scoped>
.filters { display: flex; flex-direction: column; gap: 0.6rem; align-items: flex-start; }

.cards { display: flex; flex-direction: column; gap: 0.65rem; }

.card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.55rem;
  flex-wrap: wrap;
}
.card__meta { display: flex; align-items: center; flex-wrap: wrap; gap: 0.5rem; }
.card__login { font-size: 0.8rem; font-weight: 700; color: var(--adm-acc-text); }
.card__nick { font-size: 0.74rem; color: var(--adm-dim); }
.card__date { font-size: 0.7rem; color: var(--adm-faint); }

.card__title { font-size: 0.88rem; font-weight: 700; color: var(--adm-text); margin: 0 0 0.35rem; }

.card__body {
  margin: 0;
  font-size: 0.78rem;
  color: var(--adm-mut);
  line-height: 1.55;
  background: rgba(148, 163, 184, 0.03);
  border-left: 2px solid var(--adm-line-strong);
  padding: 0.4rem 0.65rem;
  border-radius: 0 6px 6px 0;
}
</style>
