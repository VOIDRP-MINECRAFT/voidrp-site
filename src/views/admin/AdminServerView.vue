<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { getServerStatus } from '../../services/adminApi'
import { authState } from '../../stores/authStore'

const token = () => authState.accessToken

const server = ref(null)
const loading = ref(true)
const lastUpdated = ref(null)
let timer = null

async function load() {
  loading.value = true
  try {
    server.value = await getServerStatus(token())
    lastUpdated.value = new Date()
  } catch {
    server.value = { online: false, reason: 'Ошибка запроса' }
  } finally {
    loading.value = false
  }
}

function timeAgo(date) {
  if (!date) return ''
  const s = Math.floor((Date.now() - date.getTime()) / 1000)
  return s < 60 ? `${s} сек. назад` : `${Math.floor(s / 60)} мин. назад`
}

onMounted(() => { load(); timer = setInterval(load, 30_000) })
onUnmounted(() => clearInterval(timer))
</script>

<template>
  <div class="ap">
    <div class="ap__header">
      <div>
        <h1 class="ap__title">Статус сервера</h1>
        <p class="ap__sub">Автообновление каждые 30 секунд</p>
      </div>
      <div class="ap__header-right">
        <span v-if="lastUpdated" class="updated">{{ timeAgo(lastUpdated) }}</span>
        <button class="btn btn--ghost btn--sm" :disabled="loading" @click="load">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          Обновить
        </button>
      </div>
    </div>

    <div v-if="loading && !server" class="skel skel--banner" />

    <template v-else-if="server">
      <!-- Status banner -->
      <div class="banner" :class="server.online ? 'banner--online' : 'banner--offline'">
        <div class="banner__dot" />
        <div class="banner__body">
          <div class="banner__title">{{ server.online ? 'Сервер онлайн' : 'Сервер офлайн' }}</div>
          <div class="banner__sub">
            <template v-if="server.online">{{ server.version }} · пинг {{ server.latency_ms }} мс</template>
            <template v-else>{{ server.reason || 'Сервер недоступен' }}</template>
          </div>
        </div>
        <div v-if="server.online" class="banner__fill-bar">
          <div class="fill-bar">
            <div class="fill-bar__track">
              <div
                class="fill-bar__fill"
                :style="{ width: server.players_max > 0 ? (server.players_online / server.players_max * 100) + '%' : '0%' }"
              />
            </div>
            <span class="fill-bar__label">{{ server.players_online }}/{{ server.players_max }}</span>
          </div>
        </div>
      </div>

      <!-- Stat cards -->
      <div v-if="server.online" class="stats-row">
        <div class="stat">
          <div class="stat__l">Онлайн</div>
          <div class="stat__v stat__v--green">{{ server.players_online }}</div>
          <div class="stat__sub">из {{ server.players_max }} слотов</div>
        </div>
        <div class="stat">
          <div class="stat__l">Заполненность</div>
          <div class="stat__v">{{ server.players_max > 0 ? Math.round(server.players_online / server.players_max * 100) : 0 }}%</div>
        </div>
        <div class="stat">
          <div class="stat__l">Пинг</div>
          <div class="stat__v"
            :class="server.latency_ms < 50 ? 'stat__v--green' : server.latency_ms < 150 ? 'stat__v--yellow' : 'stat__v--red'"
          >{{ server.latency_ms }} мс</div>
        </div>
        <div class="stat">
          <div class="stat__l">Версия</div>
          <div class="stat__v stat__v--sm">{{ server.version || '—' }}</div>
        </div>
      </div>

      <!-- Player list -->
      <template v-if="server.online">
        <div class="section-label">
          Список игроков
          <span class="section-label__note">(показывает до 12 игроков)</span>
        </div>
        <div v-if="server.players_sample?.length" class="players-grid">
          <div v-for="p in server.players_sample" :key="p.id" class="player-chip">
            <div class="player-chip__av">{{ p.name.charAt(0).toUpperCase() }}</div>
            <span>{{ p.name }}</span>
          </div>
        </div>
        <div v-else class="empty">
          {{ server.players_online > 0 ? 'Список игроков скрыт сервером' : 'Нет игроков онлайн' }}
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
*, *::before, *::after { box-sizing: border-box; }

.ap { padding: 1.75rem 1.5rem 3rem; max-width: 720px; }

.ap__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 1.25rem;
  gap: 1rem;
  flex-wrap: wrap;
}

.ap__title { font-size: 1.4rem; font-weight: 800; color: #e2e8f0; margin: 0; }
.ap__sub { font-size: 0.75rem; color: #334155; margin: 0.15rem 0 0; }
.ap__header-right { display: flex; align-items: center; gap: 0.6rem; }

.updated { font-size: .75rem; color: #334155; }

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.38rem 0.75rem;
  border-radius: 8px;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  border: none;
  transition: background 0.13s;
}
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.btn--ghost { background: rgba(255,255,255,0.05); color: #94a3b8; }
.btn--ghost:hover:not(:disabled) { background: rgba(255,255,255,0.09); }
.btn--sm { padding: 0.3rem 0.65rem; font-size: 0.75rem; }

/* Banner */
.banner {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.1rem 1.35rem;
  border-radius: 16px;
  border: 1px solid;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.banner--online {
  background: linear-gradient(90deg, rgba(34,197,94,0.1) 0%, rgba(34,197,94,0.03) 100%);
  border-color: rgba(34,197,94,0.25);
  box-shadow: 0 4px 24px rgba(34,197,94,0.07);
}
.banner--offline { background: rgba(239,68,68,0.05); border-color: rgba(239,68,68,0.18); }

.banner__dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.banner--online .banner__dot {
  background: #22c55e;
  box-shadow: 0 0 10px rgba(34,197,94,0.6);
  animation: pulse 2s infinite;
}

.banner--offline .banner__dot { background: #ef4444; }

@keyframes pulse {
  0%, 100% { box-shadow: 0 0 7px rgba(34,197,94,0.5); }
  50% { box-shadow: 0 0 16px rgba(34,197,94,0.85); }
}

.banner__body { flex: 1; min-width: 0; }

.banner__title { font-size: 1rem; font-weight: 800; }
.banner--online .banner__title { color: #86efac; }
.banner--offline .banner__title { color: #fca5a5; }

.banner__sub { font-size: 0.78rem; color: #475569; margin-top: 0.15rem; }

.banner__fill-bar { flex-shrink: 0; }

.fill-bar { display: flex; align-items: center; gap: 0.6rem; }

.fill-bar__track {
  width: 120px;
  height: 6px;
  border-radius: 999px;
  background: rgba(255,255,255,0.08);
  overflow: hidden;
}

.fill-bar__fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #22c55e, #86efac);
  transition: width 0.4s ease;
}

.fill-bar__label { font-size: 0.78rem; font-weight: 800; color: #86efac; white-space: nowrap; }

/* Stats */
.stats-row {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1.75rem;
}

.stat {
  background: linear-gradient(145deg, #0f1628 0%, #0a1020 100%);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 14px;
  padding: 1.1rem 1.1rem;
  transition: transform 0.15s, border-color 0.15s, box-shadow 0.15s;
}

.stat:hover {
  transform: translateY(-2px);
  border-color: rgba(255,255,255,0.1);
  box-shadow: 0 8px 24px rgba(0,0,0,0.3);
}

.stat__l { font-size: .75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: #3d4f6e; margin-bottom: 0.35rem; }
.stat__v { font-size: 1.75rem; font-weight: 900; color: #e2e8f0; line-height: 1; }
.stat__v--sm { font-size: 1rem; margin-top: 0.3rem; }
.stat__v--green { color: #86efac; }
.stat__v--yellow { color: #fde047; }
.stat__v--red { color: #fca5a5; }
.stat__sub { font-size: .75rem; color: #2d3e5c; margin-top: 0.2rem; }

/* Section label */
.section-label {
  font-size: .75rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #3d4f6e;
  margin-bottom: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.section-label::before {
  content: '';
  display: inline-block;
  width: 3px;
  height: 13px;
  border-radius: 2px;
  background: linear-gradient(180deg, #7c3aed, #4f46e5);
  flex-shrink: 0;
}

.section-label__note { font-style: italic; font-weight: 500; text-transform: none; letter-spacing: 0; color: #1e2d45; font-size: .75rem; }

/* Players */
.players-grid { display: flex; flex-wrap: wrap; gap: 0.5rem; }

.player-chip {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.32rem 0.7rem 0.32rem 0.35rem;
  background: rgba(34,197,94,0.07);
  border: 1px solid rgba(34,197,94,0.15);
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 700;
  color: #86efac;
}

.player-chip__av {
  width: 1.35rem;
  height: 1.35rem;
  border-radius: 50%;
  background: rgba(34,197,94,0.18);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: .75rem;
  font-weight: 900;
}

/* Skeleton */
.skel {
  border-radius: 14px;
  background: linear-gradient(90deg, #0d1422 25%, #121929 50%, #0d1422 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
}
.skel--banner { height: 72px; margin-bottom: 1.5rem; }

@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

.empty { color: #334155; font-size: 0.82rem; }

@media (max-width: 600px) { .ap { padding: 1rem 0.75rem 2rem; } }
</style>
