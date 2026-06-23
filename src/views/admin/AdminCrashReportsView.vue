<script setup>
import { onMounted, ref, computed } from 'vue'
import { adminListCrashes, adminDeleteCrash } from '../../services/adminCrashesApi'
import { authState } from '../../stores/authStore'

const token = () => authState.accessToken

const items = ref([])
const loading = ref(true)
const deletingId = ref(null)
const search = ref('')
const expandedId = ref(null)

async function load() {
  loading.value = true
  try {
    const data = await adminListCrashes(token())
    items.value = data?.items || []
  } catch {
    items.value = []
  } finally {
    loading.value = false
  }
}

async function remove(id) {
  if (!confirm('Удалить этот краш-репорт?')) return
  deletingId.value = id
  try {
    await adminDeleteCrash(token(), id)
    items.value = items.value.filter(i => i.id !== id)
    if (expandedId.value === id) expandedId.value = null
  } catch {
    // ignore
  } finally {
    deletingId.value = null
  }
}

const filtered = computed(() => {
  if (!search.value) return items.value
  const q = search.value.toLowerCase()
  return items.value.filter(i => i.player_nickname.toLowerCase().includes(q))
})

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function exitCodeLabel(code) {
  if (code === 0) return { text: 'Норм', cls: 'badge--green' }
  if (code === 1) return { text: `Код ${code}`, cls: 'badge--orange' }
  return { text: `Код ${code}`, cls: 'badge--red' }
}

onMounted(load)
</script>

<template>
  <div class="ap">
    <div class="ap__header">
      <div>
        <h1 class="ap__title">Краши лаунчера</h1>
        <p class="ap__sub">{{ filtered.length }} из {{ items.length }}</p>
      </div>
      <button class="btn btn--ghost btn--sm" :disabled="loading" @click="load">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
        Обновить
      </button>
    </div>

    <div class="filters">
      <input v-model="search" class="inp" placeholder="Ник игрока..." />
    </div>

    <div v-if="loading" class="skel skel--tall" />

    <div v-else-if="filtered.length" class="cards">
      <div v-for="item in filtered" :key="item.id" class="card">
        <div class="card__top">
          <div class="card__meta">
            <span class="nick">{{ item.player_nickname }}</span>
            <span class="badge" :class="exitCodeLabel(item.exit_code).cls">
              {{ exitCodeLabel(item.exit_code).text }}
            </span>
            <span class="date">{{ formatDate(item.created_at) }}</span>
          </div>
          <div class="card__actions">
            <button
              v-if="item.crash_report"
              class="btn btn--ghost btn--xs"
              @click="expandedId = expandedId === item.id ? null : item.id"
            >
              {{ expandedId === item.id ? 'Свернуть' : 'Лог' }}
            </button>
            <button
              class="btn btn--danger btn--xs"
              :disabled="deletingId === item.id"
              @click="remove(item.id)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              Удалить
            </button>
          </div>
        </div>

        <pre v-if="expandedId === item.id && item.crash_report" class="crash-log">{{ item.crash_report }}</pre>
        <p v-else-if="!item.crash_report" class="no-log">Лог недоступен (OOM или нет crash-report файла)</p>
      </div>
    </div>

    <div v-else class="empty">Крашей нет</div>
  </div>
</template>

<style scoped>
*, *::before, *::after { box-sizing: border-box; }

.ap { padding: 1.75rem 1.5rem 3rem; max-width: 900px; }

.ap__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 1.1rem;
  gap: 1rem;
}

.ap__title { font-size: 1.4rem; font-weight: 800; color: #e2e8f0; margin: 0; }
.ap__sub { font-size: 0.75rem; color: #475569; margin: 0.15rem 0 0; }

.filters { margin-bottom: 1rem; }
.inp {
  width: 100%;
  max-width: 320px;
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

.cards { display: flex; flex-direction: column; gap: 0.65rem; }

.card {
  background: linear-gradient(145deg, #0f1628 0%, #0a1020 100%);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 14px;
  padding: 0.85rem 1.1rem;
  transition: border-color 0.15s, transform 0.15s;
}

.card:hover { border-color: rgba(255,255,255,0.1); transform: translateY(-1px); }

.card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.card__meta { display: flex; align-items: center; gap: 0.55rem; flex-wrap: wrap; }
.card__actions { display: flex; align-items: center; gap: 0.4rem; }

.nick { font-size: 0.88rem; font-weight: 700; color: #c4b5fd; }
.date { font-size: 0.7rem; color: #334155; }

.badge {
  display: inline-block;
  padding: 0.13rem 0.5rem;
  border-radius: 999px;
  font-size: .72rem;
  font-weight: 800;
}
.badge--green  { background: rgba(34,197,94,0.10);  color: #86efac; }
.badge--orange { background: rgba(249,115,22,0.10); color: #fdba74; }
.badge--red    { background: rgba(239,68,68,0.10);  color: #fca5a5; }

.crash-log {
  margin: 0.75rem 0 0;
  padding: 0.75rem;
  background: #060c18;
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 8px;
  font-size: 0.7rem;
  color: #64748b;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 400px;
  overflow-y: auto;
}

.no-log {
  margin: 0.5rem 0 0;
  font-size: 0.75rem;
  color: #334155;
}

.skel {
  border-radius: 12px;
  background: linear-gradient(90deg, #0d1422 25%, #121929 50%, #0d1422 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
}
.skel--tall { height: 260px; }
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

.empty { color: #334155; font-size: 0.83rem; padding: 2rem 0; text-align: center; }
</style>
