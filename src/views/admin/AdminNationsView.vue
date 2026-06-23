<script setup>
import { onMounted, ref, computed } from 'vue'
import { apiRequest, buildAuthHeaders } from '../../services/apiBase'
import { authState } from '../../stores/authStore'

const token = () => authState.accessToken

const nations = ref([])
const loading = ref(true)
const search = ref('')
const filterPolicy = ref('')

async function load() {
  loading.value = true
  try {
    const data = await apiRequest('/nations/', { headers: buildAuthHeaders(token()) })
    nations.value = data?.items || (Array.isArray(data) ? data : [])
  } catch {
    nations.value = []
  } finally {
    loading.value = false
  }
}

const filtered = computed(() => {
  let list = nations.value
  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter(n =>
      n.title.toLowerCase().includes(q) ||
      n.tag.toLowerCase().includes(q) ||
      n.slug.toLowerCase().includes(q)
    )
  }
  if (filterPolicy.value) {
    list = list.filter(n => n.recruitment_policy === filterPolicy.value)
  }
  return list
})

const policyLabel = p => ({ open: 'Открытый', invite: 'Инвайт', request: 'Заявка' }[p] || p)

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

onMounted(load)
</script>

<template>
  <div class="ap">
    <div class="ap__header">
      <div>
        <h1 class="ap__title">Государства</h1>
        <p class="ap__sub">{{ filtered.length }} из {{ nations.length }}</p>
      </div>
      <button class="btn btn--ghost btn--sm" :disabled="loading" @click="load">Обновить</button>
    </div>

    <!-- Summary cards -->
    <div v-if="!loading && nations.length" class="stats-row">
      <div class="stat">
        <div class="stat__l">Всего государств</div>
        <div class="stat__v">{{ nations.length }}</div>
      </div>
      <div class="stat stat--accent">
        <div class="stat__l">Суммарно участников</div>
        <div class="stat__v">{{ nations.reduce((s, n) => s + (n.stats?.members_count || 0), 0) }}</div>
      </div>
      <div class="stat">
        <div class="stat__l">Открытый набор</div>
        <div class="stat__v">{{ nations.filter(n => n.recruitment_policy === 'open').length }}</div>
      </div>
      <div class="stat">
        <div class="stat__l">В альянсах</div>
        <div class="stat__v">{{ nations.filter(n => n.alliance_summary).length }}</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="filters">
      <input v-model="search" class="inp" placeholder="Название, тег, слаг..." />
      <select v-model="filterPolicy" class="sel">
        <option value="">Набор: все</option>
        <option value="open">Открытый</option>
        <option value="request">Заявка</option>
        <option value="invite">Инвайт</option>
      </select>
    </div>

    <!-- Table -->
    <div class="table-wrap">
      <div v-if="loading" class="skel skel--tall" />
      <table v-else-if="filtered.length" class="tbl">
        <thead>
          <tr>
            <th>Название</th>
            <th>Тег</th>
            <th>Слаг</th>
            <th>Участники</th>
            <th>Заявки</th>
            <th>Набор</th>
            <th>Публичное</th>
            <th>Альянс</th>
            <th>Создано</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="n in filtered" :key="n.id">
            <td class="tbl__name">
              <div class="nation-name">
                <div
                  v-if="n.accent_color"
                  class="nation-dot"
                  :style="{ background: n.accent_color }"
                />
                {{ n.title }}
              </div>
            </td>
            <td>
              <span class="tag-chip" :style="n.accent_color ? { borderColor: n.accent_color + '55', color: n.accent_color } : {}">
                {{ n.tag }}
              </span>
            </td>
            <td class="tbl__slug">{{ n.slug }}</td>
            <td class="tbl__num">{{ n.stats?.members_count ?? 0 }}</td>
            <td class="tbl__num">
              <span v-if="n.stats?.pending_requests_count" class="badge badge--yellow">
                {{ n.stats.pending_requests_count }}
              </span>
              <span v-else class="tbl__zero">—</span>
            </td>
            <td>
              <span class="badge"
                :class="n.recruitment_policy === 'open' ? 'badge--green' : n.recruitment_policy === 'invite' ? 'badge--red' : 'badge--dim'"
              >{{ policyLabel(n.recruitment_policy) }}</span>
            </td>
            <td>
              <span class="badge" :class="n.is_public ? 'badge--dim' : 'badge--red'">
                {{ n.is_public ? 'Да' : 'Скрытое' }}
              </span>
            </td>
            <td>
              <span v-if="n.alliance_summary" class="alliance-chip">
                [{{ n.alliance_summary.tag }}] {{ n.alliance_summary.title }}
              </span>
              <span v-else class="tbl__zero">—</span>
            </td>
            <td class="tbl__date">{{ formatDate(n.created_at) }}</td>
            <td>
              <a :href="`/nation/${n.slug}`" target="_blank" class="link">↗</a>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty">Нет государств</div>
    </div>
  </div>
</template>

<style scoped>
*, *::before, *::after { box-sizing: border-box; }

.ap { padding: 1.75rem 1.5rem 3rem; }

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
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
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

.stat--accent {
  border-color: rgba(124,58,237,0.2);
  background: linear-gradient(145deg, #130f22 0%, #0d0a1d 100%);
}

.stat--accent:hover { border-color: rgba(124,58,237,0.35); box-shadow: 0 8px 20px rgba(124,58,237,0.1); }
.stat__l { font-size: .75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: #3d4f6e; margin-bottom: 0.3rem; }
.stat__v { font-size: 1.5rem; font-weight: 900; color: #e2e8f0; }
.stat--accent .stat__v { color: #c4b5fd; }

/* Filters */
.filters { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.85rem; }

.inp, .sel {
  padding: 0.42rem 0.75rem;
  background: #0d1422;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  color: #e2e8f0;
  font-size: 0.8rem;
  outline: none;
  transition: border-color 0.13s;
}
.inp { flex: 1; min-width: 180px; }
.inp:focus, .sel:focus { border-color: rgba(124,58,237,0.45); }
.sel option { background: #0d1422; }

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
}
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.btn--ghost { background: rgba(255,255,255,0.05); color: #94a3b8; }
.btn--ghost:hover:not(:disabled) { background: rgba(255,255,255,0.09); }
.btn--sm { padding: 0.38rem 0.75rem; font-size: 0.78rem; }

/* Table */
.table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; border-radius: 14px; border: 1px solid rgba(255,255,255,0.06); background: #0a1020; }

.tbl { width: 100%; border-collapse: collapse; font-size: 0.79rem; white-space: nowrap; }

.tbl thead th {
  padding: 0.58rem 0.85rem;
  text-align: left;
  font-size: .75rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #2d3e5c;
  background: linear-gradient(0deg, #0a1020 0%, #0d1428 100%);
  border-bottom: 1px solid rgba(255,255,255,0.05);
}

.tbl tbody tr { border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.1s; }
.tbl tbody tr:last-child { border-bottom: none; }
.tbl tbody tr:hover { background: rgba(124,58,237,0.04); }
.tbl td { padding: 0.55rem 0.85rem; color: #64748b; vertical-align: middle; }

.tbl__name { font-weight: 800; color: #e2e8f0 !important; min-width: 130px; }
.tbl__slug { color: #334155 !important; font-family: monospace; font-size: .75rem; }
.tbl__date { color: #334155 !important; font-size: .75rem; }
.tbl__num { text-align: center; color: #94a3b8 !important; font-weight: 700; }
.tbl__zero { color: #1e293b; }

.nation-name { display: flex; align-items: center; gap: 0.45rem; }

.nation-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

.tag-chip {
  display: inline-block;
  padding: 0.15rem 0.45rem;
  border-radius: 5px;
  font-size: .75rem;
  font-weight: 900;
  background: rgba(124,58,237,0.1);
  color: #c4b5fd;
  border: 1px solid rgba(124,58,237,0.2);
  font-family: monospace;
}

.alliance-chip { font-size: .75rem; color: #64748b; font-style: italic; }

.badge { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 999px; font-size: .75rem; font-weight: 800; }
.badge--green { background: rgba(34,197,94,0.1); color: #86efac; }
.badge--yellow { background: rgba(234,179,8,0.1); color: #fde047; }
.badge--red { background: rgba(239,68,68,0.1); color: #fca5a5; }
.badge--dim { background: rgba(100,116,139,0.08); color: #475569; }

.link { color: #818cf8; text-decoration: none; font-weight: 700; font-size: 0.9rem; }
.link:hover { color: #a5b4fc; }

/* Skeleton */
.skel {
  border-radius: 12px;
  background: linear-gradient(90deg, #0d1422 25%, #121929 50%, #0d1422 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
}
.skel--tall { height: 260px; }

@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

.empty { color: #334155; font-size: 0.83rem; padding: 2rem; text-align: center; }

@media (max-width: 600px) { .ap { padding: 1rem 0.75rem 2rem; } }
</style>
