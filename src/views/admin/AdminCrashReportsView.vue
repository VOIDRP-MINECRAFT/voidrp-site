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
  if (code === 0) return { text: 'Норм', cls: 'adm-badge--ok' }
  if (code === 1) return { text: `Код ${code}`, cls: 'adm-badge--warn' }
  return { text: `Код ${code}`, cls: 'adm-badge--err' }
}

onMounted(load)
</script>

<template>
  <div class="adm-page" style="max-width: 960px">
    <div class="adm-page__head">
      <div>
        <h1 class="adm-title">Краши лаунчера</h1>
        <p class="adm-sub">{{ filtered.length }} из {{ items.length }}</p>
      </div>
      <button class="adm-btn" :disabled="loading" @click="load">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
        Обновить
      </button>
    </div>

    <input v-model="search" class="adm-input" style="max-width: 320px" placeholder="Ник игрока..." />

    <div v-if="loading" class="adm-skel" style="height: 260px" />

    <div v-else-if="filtered.length" class="cards">
      <div v-for="item in filtered" :key="item.id" class="adm-card adm-card--hover" style="padding: 0.85rem 1.1rem">
        <div class="card__top">
          <div class="card__meta">
            <span class="nick adm-mono">{{ item.player_nickname }}</span>
            <span class="adm-badge" :class="exitCodeLabel(item.exit_code).cls">
              {{ exitCodeLabel(item.exit_code).text }}
            </span>
            <span class="date adm-num">{{ formatDate(item.created_at) }}</span>
          </div>
          <div class="card__actions">
            <button
              v-if="item.crash_report"
              class="adm-btn adm-btn--sm"
              @click="expandedId = expandedId === item.id ? null : item.id"
            >
              {{ expandedId === item.id ? 'Свернуть' : 'Лог' }}
            </button>
            <button class="adm-btn adm-btn--danger adm-btn--sm" :disabled="deletingId === item.id" @click="remove(item.id)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              Удалить
            </button>
          </div>
        </div>

        <pre v-if="expandedId === item.id && item.crash_report" class="crash-log adm-mono">{{ item.crash_report }}</pre>
        <p v-else-if="!item.crash_report" class="no-log">Лог недоступен (OOM или нет crash-report файла)</p>
      </div>
    </div>

    <div v-else class="adm-empty">
      <div class="adm-empty__title">Крашей нет</div>
      <div class="adm-empty__sub">Лаунчер присылает отчёт, когда игра завершается с ошибкой</div>
    </div>
  </div>
</template>

<style scoped>
.cards { display: flex; flex-direction: column; gap: 0.65rem; }

.card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.card__meta { display: flex; align-items: center; gap: 0.55rem; flex-wrap: wrap; }
.card__actions { display: flex; align-items: center; gap: 0.4rem; }

.nick { font-size: 0.86rem; font-weight: 700; color: var(--adm-acc-text); }
.date { font-size: 0.7rem; color: var(--adm-faint); }

.crash-log {
  margin: 0.75rem 0 0;
  padding: 0.75rem;
  background: #05080f;
  border: 1px solid var(--adm-line);
  border-radius: 8px;
  font-size: 0.7rem;
  color: var(--adm-mut);
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 400px;
  overflow-y: auto;
}

.no-log { margin: 0.5rem 0 0; font-size: 0.74rem; color: var(--adm-faint); }
</style>
