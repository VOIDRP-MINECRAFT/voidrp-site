<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { authState } from '../../stores/authStore'
import { getAuditLog } from '../../services/adminSecurityApi'
import { toastError } from '../../services/toast'

const token = () => authState.accessToken

const PAGE_SIZE = 50
const items = ref([])
const total = ref(0)
const categories = ref([])
const loading = ref(false)

const q = ref('')
const category = ref('')
const days = ref(30)
const page = ref(1)

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))
const rangeFrom = computed(() => (total.value === 0 ? 0 : (page.value - 1) * PAGE_SIZE + 1))
const rangeTo = computed(() => Math.min(page.value * PAGE_SIZE, total.value))

let searchTimer = null
function onSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { page.value = 1; load() }, 350)
}

async function load() {
  loading.value = true
  try {
    const res = await getAuditLog(token(), {
      q: q.value.trim(), category: category.value, days: days.value,
      limit: PAGE_SIZE, offset: (page.value - 1) * PAGE_SIZE,
    })
    items.value = res.items || []
    total.value = res.total || 0
    if (res.categories) categories.value = res.categories
  } catch (e) {
    toastError('Не удалось загрузить журнал')
  } finally {
    loading.value = false
  }
}

function goToPage(p) {
  const np = Math.min(Math.max(1, p), totalPages.value)
  if (np === page.value) return
  page.value = np
  load()
}

const CAT = {
  monitoring: { label: 'Мониторинг', cls: 'adm-badge--info' },
  punishment: { label: 'Наказание', cls: 'adm-badge--err' },
  anticheat: { label: 'Античит', cls: 'adm-badge--warn' },
  news: { label: 'Новости', cls: '' },
  market: { label: 'Рынок', cls: '' },
  moderators: { label: 'Модерация', cls: '' },
  server: { label: 'Сервер', cls: '' },
}
function cat(c) { return CAT[c] || { label: c, cls: '' } }
function fmtTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ru', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
function metaSummary(m) {
  if (!m) return ''
  const parts = []
  if (m.command) parts.push(`cmd: ${m.command}`)
  if (m.reason) parts.push(`причина: ${m.reason}`)
  if (m.duration_seconds) parts.push(`срок: ${Math.round(m.duration_seconds / 3600)}ч`)
  if (m.scope) parts.push(m.scope === 'global' ? 'глобально' : 'сервер')
  if (m.rcon_error) parts.push(`⚠ RCON: ${m.rcon_error}`)
  return parts.join(' · ')
}

let poll = null
function onVisibility() {
  if (document.hidden) { clearInterval(poll); poll = null }
  else if (!poll) { load(); poll = setInterval(load, 30000) }
}
onMounted(() => { load(); poll = setInterval(load, 30000); document.addEventListener('visibilitychange', onVisibility) })
onBeforeUnmount(() => { clearInterval(poll); document.removeEventListener('visibilitychange', onVisibility) })
</script>

<template>
  <div class="adm-page">
    <div class="adm-page__head">
      <div>
        <h1 class="adm-title">Журнал действий</h1>
        <p class="adm-sub">Кто из персонала что делал — баны, RCON, перезапуски, вердикты · всего {{ total.toLocaleString('ru') }}</p>
      </div>
      <div class="adm-head-actions">
        <button class="adm-btn" :disabled="loading" @click="load">Обновить</button>
      </div>
    </div>

    <div class="aud-filters">
      <input v-model="q" class="adm-input" placeholder="Поиск: кто · действие · цель…" @input="onSearch" />
      <select v-model="category" class="adm-select" @change="page = 1; load()">
        <option value="">Все категории</option>
        <option v-for="c in categories" :key="c" :value="c">{{ cat(c).label }}</option>
      </select>
      <select v-model.number="days" class="adm-select" @change="page = 1; load()">
        <option :value="1">Сутки</option>
        <option :value="7">7 дней</option>
        <option :value="30">30 дней</option>
        <option :value="90">90 дней</option>
        <option :value="0">Всё время</option>
      </select>
    </div>

    <div v-if="!items.length && !loading" class="adm-empty">
      <div class="adm-empty__title">Записей нет</div>
      <div class="adm-empty__sub">Действия персонала появятся здесь по мере работы в панели.</div>
    </div>

    <div v-else class="adm-table-wrap">
      <div class="adm-table-scroll">
        <table class="adm-table">
          <thead>
            <tr>
              <th>Время</th><th>Категория</th><th>Кто</th><th>Действие</th><th>Цель</th><th>Сервер</th><th>Детали</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="it in items" :key="it.id">
              <td class="adm-num aud-time">{{ fmtTime(it.created_at) }}</td>
              <td><span class="adm-badge" :class="cat(it.category).cls">{{ cat(it.category).label }}</span></td>
              <td class="aud-actor">{{ it.actor_name }}</td>
              <td class="adm-mono aud-action">{{ it.action }}</td>
              <td class="aud-target">{{ it.target_label || it.target_id || '—' }}</td>
              <td class="aud-dim">{{ it.server_name || '—' }}</td>
              <td class="aud-meta">{{ metaSummary(it.meta) || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="totalPages > 1" class="adm-pager">
      <span class="adm-pager__info">{{ rangeFrom }}–{{ rangeTo }} из {{ total.toLocaleString('ru') }}</span>
      <div class="adm-head-actions">
        <button class="adm-btn adm-btn--sm" :disabled="page <= 1" @click="goToPage(page - 1)">← Назад</button>
        <span class="adm-pager__info">{{ page }} / {{ totalPages }}</span>
        <button class="adm-btn adm-btn--sm" :disabled="page >= totalPages" @click="goToPage(page + 1)">Вперёд →</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.aud-filters { display: flex; gap: 0.6rem; flex-wrap: wrap; }
.aud-filters .adm-input { max-width: 320px; }
.aud-filters .adm-select { max-width: 170px; }
.aud-time { color: var(--adm-dim); white-space: nowrap; font-size: 0.76rem; }
.aud-actor { font-weight: 700; color: var(--adm-text); }
.aud-action { color: var(--adm-mut); }
.aud-target { color: var(--adm-text); max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.aud-dim { color: var(--adm-dim); font-size: 0.76rem; }
.aud-meta { color: var(--adm-dim); font-size: 0.74rem; max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
