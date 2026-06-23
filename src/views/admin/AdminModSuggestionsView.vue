<script setup>
import { onMounted, ref, computed } from 'vue'
import { adminListModSuggestions, adminDeleteModSuggestion } from '../../services/adminApi'
import { authState } from '../../stores/authStore'

const token = () => authState.accessToken

const items = ref([])
const loading = ref(true)
const deletingId = ref(null)
const search = ref('')

async function load() {
  loading.value = true
  try {
    const data = await adminListModSuggestions(token())
    items.value = data?.items || []
  } catch {
    items.value = []
  } finally {
    loading.value = false
  }
}

async function remove(id) {
  if (!confirm('Удалить это предложение?')) return
  deletingId.value = id
  try {
    await adminDeleteModSuggestion(token(), id)
    items.value = items.value.filter(i => i.id !== id)
  } catch {
    // ignore
  } finally {
    deletingId.value = null
  }
}

const filtered = computed(() => {
  if (!search.value) return items.value
  const q = search.value.toLowerCase()
  return items.value.filter(i =>
    i.url.toLowerCase().includes(q) ||
    i.user_login.toLowerCase().includes(q) ||
    (i.user_nickname || '').toLowerCase().includes(q) ||
    (i.comment || '').toLowerCase().includes(q),
  )
})

function domainBadge(url) {
  if (url.includes('modrinth.com')) return { label: 'Modrinth', cls: 'badge--green' }
  if (url.includes('curseforge.com')) return { label: 'CurseForge', cls: 'badge--orange' }
  if (url.includes('minecraft-inside.ru')) return { label: 'MC-Inside', cls: 'badge--blue' }
  return { label: 'Другое', cls: 'badge--dim' }
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
  <div class="ap">
    <div class="ap__header">
      <div>
        <h1 class="ap__title">Предложения модов</h1>
        <p class="ap__sub">{{ filtered.length }} из {{ items.length }}</p>
      </div>
      <button class="btn btn--ghost btn--sm" :disabled="loading" @click="load">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
        Обновить
      </button>
    </div>

    <!-- Stats -->
    <div v-if="!loading && items.length" class="stats-row">
      <div class="stat">
        <div class="stat__l">Всего</div>
        <div class="stat__v">{{ items.length }}</div>
      </div>
      <div class="stat">
        <div class="stat__l">Modrinth</div>
        <div class="stat__v stat__v--green">{{ items.filter(i => i.url.includes('modrinth.com')).length }}</div>
      </div>
      <div class="stat">
        <div class="stat__l">CurseForge</div>
        <div class="stat__v stat__v--orange">{{ items.filter(i => i.url.includes('curseforge.com')).length }}</div>
      </div>
      <div class="stat">
        <div class="stat__l">MC-Inside</div>
        <div class="stat__v stat__v--blue">{{ items.filter(i => i.url.includes('minecraft-inside.ru')).length }}</div>
      </div>
    </div>

    <!-- Search -->
    <div class="filters">
      <input v-model="search" class="inp" placeholder="Логин, ник, ссылка, комментарий..." />
    </div>

    <!-- Content -->
    <div v-if="loading" class="skel skel--tall" />

    <div v-else-if="filtered.length" class="cards">
      <div v-for="item in filtered" :key="item.id" class="card">
        <div class="card__top">
          <div class="card__meta">
            <span class="badge" :class="domainBadge(item.url).cls">{{ domainBadge(item.url).label }}</span>
            <span class="card__login">{{ item.user_login }}</span>
            <span v-if="item.user_nickname" class="card__nick">{{ item.user_nickname }}</span>
            <span class="card__date">{{ formatDate(item.created_at) }}</span>
          </div>
          <button
            class="btn btn--danger btn--xs"
            :disabled="deletingId === item.id"
            @click="remove(item.id)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            Удалить
          </button>
        </div>

        <a :href="item.url" target="_blank" rel="noopener noreferrer" class="card__url">
          {{ item.url }}
          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="card__url-icon"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </a>

        <p v-if="item.comment" class="card__comment">{{ item.comment }}</p>
      </div>
    </div>

    <div v-else class="empty">Нет предложений</div>
  </div>
</template>

<style scoped>
*, *::before, *::after { box-sizing: border-box; }

.ap { padding: 1.75rem 1.5rem 3rem; max-width: 800px; }

.ap__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 1.1rem;
  gap: 1rem;
}

.ap__title { font-size: 1.4rem; font-weight: 800; color: #e2e8f0; margin: 0; }
.ap__sub { font-size: 0.75rem; color: #475569; margin: 0.15rem 0 0; }

/* Stats */
.stats-row {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1.1rem;
}

.stat {
  background: linear-gradient(145deg, #0f1628 0%, #0a1020 100%);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 13px;
  padding: 0.95rem 1rem;
  transition: transform 0.15s, border-color 0.15s, box-shadow 0.15s;
}

.stat:hover {
  transform: translateY(-2px);
  border-color: rgba(255,255,255,0.1);
  box-shadow: 0 8px 20px rgba(0,0,0,0.25);
}

.stat__l { font-size: .75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: #3d4f6e; margin-bottom: 0.3rem; }
.stat__v { font-size: 1.5rem; font-weight: 900; color: #e2e8f0; }
.stat__v--green { color: #86efac; }
.stat__v--orange { color: #fdba74; }
.stat__v--blue { color: #93c5fd; }

/* Filters */
.filters { margin-bottom: 1rem; }
.inp {
  width: 100%;
  max-width: 400px;
  padding: 0.42rem 0.75rem;
  background: #0d1422;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  color: #e2e8f0;
  font-size: 0.8rem;
  outline: none;
  transition: border-color 0.13s;
}
.inp:focus { border-color: rgba(124,58,237,0.45); }

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.42rem 0.85rem;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  border: none;
  transition: background 0.13s;
  white-space: nowrap;
}
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.btn--ghost { background: rgba(255,255,255,0.05); color: #94a3b8; }
.btn--ghost:hover:not(:disabled) { background: rgba(255,255,255,0.09); }
.btn--danger { background: rgba(239,68,68,0.12); color: #fca5a5; }
.btn--danger:hover:not(:disabled) { background: rgba(239,68,68,0.22); }
.btn--sm { padding: 0.38rem 0.75rem; font-size: 0.78rem; }
.btn--xs { padding: 0.28rem 0.6rem; font-size: .75rem; }

/* Cards */
.cards { display: flex; flex-direction: column; gap: 0.65rem; }

.card {
  background: linear-gradient(145deg, #0f1628 0%, #0a1020 100%);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 14px;
  padding: 1rem 1.1rem;
  transition: border-color 0.15s, transform 0.15s, box-shadow 0.15s;
}

.card:hover {
  border-color: rgba(255,255,255,0.1);
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(0,0,0,0.25);
}

.card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.55rem;
  flex-wrap: wrap;
}

.card__meta { display: flex; align-items: center; flex-wrap: wrap; gap: 0.5rem; }
.card__login { font-size: 0.8rem; font-weight: 700; color: #c4b5fd; }
.card__nick { font-size: 0.75rem; color: #64748b; }
.card__date { font-size: 0.7rem; color: #334155; }

.card__url {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.78rem;
  color: #818cf8;
  text-decoration: none;
  word-break: break-all;
  transition: color 0.13s;
}
.card__url:hover { color: #a5b4fc; }
.card__url-icon { flex-shrink: 0; }

.card__comment {
  margin-top: 0.55rem;
  font-size: 0.78rem;
  color: #64748b;
  line-height: 1.5;
  background: rgba(255,255,255,0.02);
  border-left: 2px solid rgba(255,255,255,0.07);
  padding: 0.4rem 0.65rem;
  border-radius: 0 6px 6px 0;
}

/* Badges */
.badge { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 999px; font-size: .75rem; font-weight: 800; }
.badge--green { background: rgba(34,197,94,0.1); color: #86efac; }
.badge--orange { background: rgba(249,115,22,0.1); color: #fdba74; }
.badge--blue { background: rgba(59,130,246,0.1); color: #93c5fd; }
.badge--dim { background: rgba(100,116,139,0.08); color: #475569; }

/* Skeleton */
.skel {
  border-radius: 12px;
  background: linear-gradient(90deg, #0d1422 25%, #121929 50%, #0d1422 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
}
.skel--tall { height: 260px; }

@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

.empty { color: #334155; font-size: 0.83rem; padding: 2rem 0; text-align: center; }

@media (max-width: 600px) { .ap { padding: 1rem 0.75rem 2rem; } }
</style>
