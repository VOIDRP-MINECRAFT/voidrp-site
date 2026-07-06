<script setup>
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { serverState, activeServer, fetchServers, setActiveServer } from '../stores/serverStore'

const { t } = useI18n()
const router = useRouter()

onMounted(() => fetchServers())

function statusLabel(s) {
  if (s.maintenance) return t('servers.maintenance')
  return s.status?.online ? t('servers.online') : t('servers.offline')
}

function statusClass(s) {
  if (s.maintenance) return 'is-maint'
  return s.status?.online ? 'is-online' : 'is-offline'
}

function whitelistLabel(mode) {
  if (mode === 'whitelist') return t('servers.whitelist')
  if (mode === 'invite') return t('servers.invite')
  return t('servers.public')
}

function choose(s) {
  setActiveServer(s.slug)
  router.push('/')
}
</script>

<template>
  <section class="py-9 md:py-12">
    <div class="container-shell">
      <div class="mb-6 text-center">
        <div class="section-kicker">VoidRP</div>
        <h1 class="section-title">{{ t('servers.pageTitle') }}</h1>
        <p class="section-subtitle mx-auto max-w-2xl">{{ t('servers.pageSubtitle') }}</p>
      </div>

      <div v-if="serverState.loading && !serverState.list.length" class="server-grid">
        <div v-for="n in 2" :key="n" class="server-card server-card--skel" />
      </div>

      <div v-else-if="!serverState.list.length" class="empty-box surface-card">
        {{ t('servers.empty') }}
      </div>

      <div v-else class="server-grid">
        <article
          v-for="s in serverState.list"
          :key="s.slug"
          class="server-card surface-card"
          :class="{ 'server-card--active': activeServer?.slug === s.slug }"
        >
          <div class="server-card__banner" :style="s.banner_url ? { backgroundImage: `url(${s.banner_url})` } : {}">
            <span class="server-card__status" :class="statusClass(s)">
              <span class="dot" />{{ statusLabel(s) }}
            </span>
          </div>

          <div class="server-card__body">
            <div class="server-card__head">
              <img v-if="s.icon_url" :src="s.icon_url" :alt="s.name" class="server-card__icon" />
              <div class="server-card__title-wrap">
                <h2 class="server-card__title">{{ s.name }}</h2>
                <div class="server-card__meta">MC {{ s.mc_version }} · {{ s.loader }}</div>
              </div>
              <span v-if="activeServer?.slug === s.slug" class="server-card__badge">{{ t('servers.selected') }}</span>
            </div>

            <p v-if="s.description" class="server-card__desc">{{ s.description }}</p>

            <div class="server-card__stats">
              <div class="stat">
                <div class="stat__l">{{ t('servers.players') }}</div>
                <div class="stat__v" :class="{ 'is-green': s.status?.online }">
                  <template v-if="s.status?.online">{{ s.status.players_online }}/{{ s.status.players_max }}</template>
                  <template v-else>—</template>
                </div>
              </div>
              <div class="stat">
                <div class="stat__l">{{ t('servers.connect') }}</div>
                <div class="stat__v stat__v--sm">{{ s.host }}<template v-if="s.port !== 25565">:{{ s.port }}</template></div>
              </div>
              <div class="stat">
                <div class="stat__l">{{ whitelistLabel(s.whitelist_mode) }}</div>
                <div class="stat__v stat__v--sm">{{ s.max_players }}</div>
              </div>
            </div>

            <button
              type="button"
              class="btn btn-primary server-card__cta"
              :disabled="activeServer?.slug === s.slug"
              @click="choose(s)"
            >
              {{ activeServer?.slug === s.slug ? t('servers.selected') : t('servers.select') }}
            </button>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.server-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.25rem;
}
.server-card { overflow: hidden; padding: 0; display: flex; flex-direction: column; }
.server-card--active { border-color: rgba(139, 92, 246, 0.45); box-shadow: 0 0 0 1px rgba(139,92,246,0.25); }
.server-card--skel { height: 320px; opacity: 0.4; }

.server-card__banner {
  height: 96px;
  background: linear-gradient(135deg, #1a1440 0%, #0d1020 100%);
  background-size: cover;
  background-position: center;
  position: relative;
}
.server-card__status {
  position: absolute; top: 0.6rem; right: 0.6rem;
  display: inline-flex; align-items: center; gap: 0.35rem;
  padding: 0.25rem 0.6rem; border-radius: 999px;
  font-size: 0.72rem; font-weight: 800;
  background: rgba(7,11,20,0.75); backdrop-filter: blur(6px);
}
.server-card__status .dot { width: 7px; height: 7px; border-radius: 50%; }
.is-online { color: #86efac; } .is-online .dot { background: #22c55e; box-shadow: 0 0 8px rgba(34,197,94,0.7); }
.is-offline { color: #fca5a5; } .is-offline .dot { background: #ef4444; }
.is-maint { color: #fde047; } .is-maint .dot { background: #eab308; }

.server-card__body { padding: 1.1rem 1.25rem 1.35rem; display: flex; flex-direction: column; gap: 0.85rem; flex: 1; }
.server-card__head { display: flex; align-items: center; gap: 0.75rem; margin-top: -2.5rem; }
.server-card__icon {
  width: 3rem; height: 3rem; border-radius: 12px; object-fit: cover;
  border: 2px solid rgba(7,11,20,0.9); background: #0d1020;
}
.server-card__title-wrap { flex: 1; min-width: 0; padding-top: 2rem; }
.server-card__title { font-size: 1.1rem; font-weight: 800; color: #e5eefc; margin: 0; }
.server-card__meta { font-size: 0.75rem; color: #64748b; margin-top: 0.1rem; }
.server-card__badge {
  align-self: flex-start; padding: 0.2rem 0.55rem; border-radius: 999px;
  font-size: 0.68rem; font-weight: 800; color: #c4b5fd;
  background: rgba(139,92,246,0.15); border: 1px solid rgba(139,92,246,0.3);
}
.server-card__desc { font-size: 0.85rem; color: #94a3b8; line-height: 1.5; margin: 0; }

.server-card__stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.6rem; }
.stat { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 0.55rem 0.65rem; }
.stat__l { font-size: 0.66rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; }
.stat__v { font-size: 1.1rem; font-weight: 900; color: #e2e8f0; margin-top: 0.15rem; line-height: 1.1; }
.stat__v--sm { font-size: 0.82rem; word-break: break-all; }
.is-green { color: #86efac; }

.server-card__cta { width: 100%; margin-top: auto; }

.empty-box { padding: 2.5rem; text-align: center; color: #64748b; }
</style>
