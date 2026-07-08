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
  if (url.includes('modrinth.com')) return { label: 'Modrinth', cls: 'adm-badge--ok' }
  if (url.includes('curseforge.com')) return { label: 'CurseForge', cls: 'adm-badge--warn' }
  if (url.includes('minecraft-inside.ru')) return { label: 'MC-Inside', cls: 'adm-badge--info' }
  return { label: 'Другое', cls: '' }
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
        <h1 class="adm-title">Предложения модов</h1>
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
      <div class="adm-kpi"><div><div class="adm-kpi__val" style="color: #6ee7b7">{{ items.filter(i => i.url.includes('modrinth.com')).length }}</div><div class="adm-kpi__label">Modrinth</div></div></div>
      <div class="adm-kpi"><div><div class="adm-kpi__val" style="color: #fdba74">{{ items.filter(i => i.url.includes('curseforge.com')).length }}</div><div class="adm-kpi__label">CurseForge</div></div></div>
      <div class="adm-kpi"><div><div class="adm-kpi__val" style="color: #93c5fd">{{ items.filter(i => i.url.includes('minecraft-inside.ru')).length }}</div><div class="adm-kpi__label">MC-Inside</div></div></div>
    </div>

    <!-- Search -->
    <input v-model="search" class="adm-input" style="max-width: 400px" placeholder="Логин, ник, ссылка, комментарий..." />

    <!-- Content -->
    <div v-if="loading" class="adm-skel" style="height: 260px" />

    <div v-else-if="filtered.length" class="cards">
      <div v-for="item in filtered" :key="item.id" class="adm-card adm-card--pad adm-card--hover">
        <div class="card__top">
          <div class="card__meta">
            <span class="adm-badge" :class="domainBadge(item.url).cls">{{ domainBadge(item.url).label }}</span>
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

        <a :href="item.url" target="_blank" rel="noopener noreferrer" class="card__url">
          {{ item.url }}
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="shrink-0"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </a>

        <p v-if="item.comment" class="card__comment">{{ item.comment }}</p>
      </div>
    </div>

    <div v-else class="adm-empty">
      <div class="adm-empty__title">Нет предложений</div>
      <div class="adm-empty__sub">Игроки отправляют предложения модов из лаунчера</div>
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
  margin-bottom: 0.55rem;
  flex-wrap: wrap;
}
.card__meta { display: flex; align-items: center; flex-wrap: wrap; gap: 0.5rem; }
.card__login { font-size: 0.8rem; font-weight: 700; color: var(--adm-acc-text); }
.card__nick { font-size: 0.74rem; color: var(--adm-dim); }
.card__date { font-size: 0.7rem; color: var(--adm-faint); }

.card__url {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.78rem;
  color: var(--adm-info);
  text-decoration: none;
  word-break: break-all;
  transition: opacity 0.13s;
}
.card__url:hover { opacity: 0.8; }

.card__comment {
  margin-top: 0.55rem;
  font-size: 0.78rem;
  color: var(--adm-mut);
  line-height: 1.5;
  background: rgba(148, 163, 184, 0.03);
  border-left: 2px solid var(--adm-line-strong);
  padding: 0.4rem 0.65rem;
  border-radius: 0 6px 6px 0;
}
</style>
