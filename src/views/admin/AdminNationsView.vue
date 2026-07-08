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
  <div class="adm-page">
    <div class="adm-page__head">
      <div>
        <h1 class="adm-title">Государства</h1>
        <p class="adm-sub">{{ filtered.length }} из {{ nations.length }} · на выбранном сервере</p>
      </div>
      <button class="adm-btn" :disabled="loading" @click="load">Обновить</button>
    </div>

    <!-- Summary cards -->
    <div v-if="!loading && nations.length" class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div class="adm-kpi"><div><div class="adm-kpi__val">{{ nations.length }}</div><div class="adm-kpi__label">Всего государств</div></div></div>
      <div class="adm-kpi adm-kpi--acc"><div><div class="adm-kpi__val" style="color: var(--adm-acc-text)">{{ nations.reduce((s, n) => s + (n.stats?.members_count || 0), 0) }}</div><div class="adm-kpi__label">Суммарно участников</div></div></div>
      <div class="adm-kpi"><div><div class="adm-kpi__val">{{ nations.filter(n => n.recruitment_policy === 'open').length }}</div><div class="adm-kpi__label">Открытый набор</div></div></div>
      <div class="adm-kpi"><div><div class="adm-kpi__val">{{ nations.filter(n => n.alliance_summary).length }}</div><div class="adm-kpi__label">В альянсах</div></div></div>
    </div>

    <!-- Filters -->
    <div class="filters">
      <input v-model="search" class="adm-input filters__search" placeholder="Название, тег, слаг..." />
      <select v-model="filterPolicy" class="adm-select" style="width: auto">
        <option value="">Набор: все</option>
        <option value="open">Открытый</option>
        <option value="request">Заявка</option>
        <option value="invite">Инвайт</option>
      </select>
    </div>

    <!-- Table -->
    <div v-if="loading" class="adm-skel" style="height: 260px" />
    <div v-else-if="filtered.length" class="adm-table-wrap">
      <div class="adm-table-scroll">
        <table class="adm-table" style="white-space: nowrap">
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
              <td class="cell-name">
                <div class="nation-name">
                  <div v-if="n.accent_color" class="nation-dot" :style="{ background: n.accent_color }" />
                  {{ n.title }}
                </div>
              </td>
              <td>
                <span class="tag-chip adm-mono" :style="n.accent_color ? { borderColor: n.accent_color + '55', color: n.accent_color } : {}">
                  {{ n.tag }}
                </span>
              </td>
              <td class="cell-dim adm-mono">{{ n.slug }}</td>
              <td class="adm-num" style="text-align: center; color: var(--adm-mut)">{{ n.stats?.members_count ?? 0 }}</td>
              <td style="text-align: center">
                <span v-if="n.stats?.pending_requests_count" class="adm-badge adm-badge--warn">
                  {{ n.stats.pending_requests_count }}
                </span>
                <span v-else class="cell-zero">—</span>
              </td>
              <td>
                <span class="adm-badge"
                  :class="n.recruitment_policy === 'open' ? 'adm-badge--ok' : n.recruitment_policy === 'invite' ? 'adm-badge--err' : ''"
                >{{ policyLabel(n.recruitment_policy) }}</span>
              </td>
              <td>
                <span class="adm-badge" :class="n.is_public ? '' : 'adm-badge--err'">
                  {{ n.is_public ? 'Да' : 'Скрытое' }}
                </span>
              </td>
              <td>
                <span v-if="n.alliance_summary" class="alliance-chip">
                  [{{ n.alliance_summary.tag }}] {{ n.alliance_summary.title }}
                </span>
                <span v-else class="cell-zero">—</span>
              </td>
              <td class="cell-dim adm-num">{{ formatDate(n.created_at) }}</td>
              <td>
                <a :href="`/nation/${n.slug}`" target="_blank" class="link">↗</a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <div v-else class="adm-empty">
      <div class="adm-empty__title">Нет государств</div>
      <div class="adm-empty__sub">На этом сервере ещё не создано ни одного государства</div>
    </div>
  </div>
</template>

<style scoped>
.filters { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.filters__search { flex: 1; min-width: 180px; max-width: 400px; }

.cell-name { font-weight: 800; color: var(--adm-text); min-width: 130px; }
.cell-dim { color: var(--adm-dim); font-size: 0.75rem; }
.cell-zero { color: var(--adm-faint); }

.nation-name { display: flex; align-items: center; gap: 0.45rem; }
.nation-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

.tag-chip {
  display: inline-block;
  padding: 0.15rem 0.45rem;
  border-radius: 5px;
  font-size: 0.72rem;
  font-weight: 900;
  background: var(--adm-acc-soft);
  color: var(--adm-acc-text);
  border: 1px solid var(--adm-acc-line);
}

.alliance-chip { font-size: 0.74rem; color: var(--adm-mut); font-style: italic; }

.link { color: var(--adm-info); text-decoration: none; font-weight: 700; font-size: 0.9rem; }
.link:hover { opacity: 0.8; }
</style>
