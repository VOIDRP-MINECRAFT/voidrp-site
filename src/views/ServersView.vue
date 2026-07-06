<script setup>
import { onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { serverState, activeServer, fetchServers, setActiveServer } from '../stores/serverStore'

const { t } = useI18n()
const router = useRouter()

onMounted(() => fetchServers())

const servers = computed(() =>
  [...serverState.list].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
)

function statusMeta(s) {
  if (s.maintenance) return { label: t('servers.maintenance'), cls: 'is-maint' }
  return s.status?.online
    ? { label: t('servers.online'), cls: 'is-online' }
    : { label: t('servers.offline'), cls: 'is-offline' }
}

function whitelistLabel(mode) {
  if (mode === 'whitelist') return t('servers.whitelist')
  if (mode === 'invite') return t('servers.invite')
  return t('servers.public')
}

function address(s) {
  return s.port && s.port !== 25565 ? `${s.host}:${s.port}` : s.host
}

function fillPct(s) {
  if (!s.status?.online || !s.status.players_max) return 0
  return Math.min(100, Math.round((s.status.players_online / s.status.players_max) * 100))
}

function choose(s) {
  setActiveServer(s.slug)
  router.push('/')
}

async function copyAddress(s) {
  try {
    await navigator.clipboard?.writeText(address(s))
  } catch {
    /* ignore */
  }
}
</script>

<template>
  <section class="servers-page">
    <div class="container-shell">
      <header class="servers-hero">
        <div class="servers-hero__kicker">VoidRP</div>
        <h1 class="servers-hero__title">{{ t('servers.pageTitle') }}</h1>
        <p class="servers-hero__sub">{{ t('servers.pageSubtitle') }}</p>
      </header>

      <!-- Loading -->
      <div v-if="serverState.loading && !servers.length" class="servers-grid">
        <div v-for="n in 2" :key="n" class="scard scard--skel" />
      </div>

      <!-- Empty -->
      <div v-else-if="!servers.length" class="servers-empty">
        {{ t('servers.empty') }}
      </div>

      <!-- Grid -->
      <div v-else class="servers-grid">
        <article
          v-for="s in servers"
          :key="s.slug"
          class="scard"
          :class="{ 'scard--active': activeServer?.slug === s.slug }"
        >
          <!-- Banner -->
          <div class="scard__banner">
            <div
              class="scard__banner-img"
              :style="s.banner_url ? { backgroundImage: `url(${s.banner_url})` } : {}"
            />
            <div class="scard__banner-overlay" />
            <span class="scard__status" :class="statusMeta(s).cls">
              <span class="scard__status-dot" />{{ statusMeta(s).label }}
            </span>
            <div class="scard__identity">
              <div class="scard__icon">
                <img v-if="s.icon_url" :src="s.icon_url" :alt="s.name" />
                <span v-else>{{ s.name.charAt(0) }}</span>
              </div>
              <div class="scard__identity-text">
                <h2 class="scard__name">{{ s.name }}</h2>
                <div class="scard__tags">
                  <span class="scard__chip">MC {{ s.mc_version }}</span>
                  <span class="scard__chip">{{ s.loader }}</span>
                  <span class="scard__chip scard__chip--muted">{{ whitelistLabel(s.whitelist_mode) }}</span>
                </div>
              </div>
              <span v-if="activeServer?.slug === s.slug" class="scard__selected">{{ t('servers.selected') }}</span>
            </div>
          </div>

          <!-- Body -->
          <div class="scard__body">
            <p class="scard__desc">{{ s.description || ' ' }}</p>

            <!-- Players bar -->
            <div class="scard__players">
              <div class="scard__players-head">
                <span>{{ t('servers.players') }}</span>
                <span class="scard__players-count" :class="{ 'is-live': s.status?.online }">
                  <template v-if="s.status?.online">{{ s.status.players_online }} / {{ s.status.players_max }}</template>
                  <template v-else>—</template>
                </span>
              </div>
              <div class="scard__players-track">
                <div class="scard__players-fill" :style="{ width: fillPct(s) + '%' }" />
              </div>
            </div>

            <!-- Address -->
            <button type="button" class="scard__address" :title="t('servers.connect')" @click="copyAddress(s)">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <span class="scard__address-value">{{ address(s) }}</span>
            </button>

            <button
              type="button"
              class="scard__cta"
              :class="{ 'scard__cta--active': activeServer?.slug === s.slug }"
              @click="choose(s)"
            >
              {{ activeServer?.slug === s.slug ? t('servers.play') : t('servers.select') }}
            </button>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
*, *::before, *::after { box-sizing: border-box; }

.servers-page { padding: 2.5rem 0 4rem; }

.servers-hero { text-align: center; margin-bottom: 2rem; }
.servers-hero__kicker {
  font-size: 0.72rem; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase;
  color: #7c6bd6; margin-bottom: 0.5rem;
}
.servers-hero__title { font-size: clamp(1.6rem, 3vw, 2.2rem); font-weight: 900; color: #f1f5ff; margin: 0; }
.servers-hero__sub { margin: 0.6rem auto 0; max-width: 34rem; font-size: 0.95rem; color: #8896b5; }

.servers-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
  gap: 1.5rem;
  align-items: start;
}

.scard {
  display: flex;
  flex-direction: column;
  border-radius: 20px;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.13);
  background: linear-gradient(180deg, rgba(19, 25, 43, 0.9), rgba(10, 14, 26, 0.92));
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}
.scard:hover { transform: translateY(-3px); border-color: rgba(139, 92, 246, 0.3); }
.scard--active { border-color: rgba(139, 92, 246, 0.5); box-shadow: 0 0 0 1px rgba(139, 92, 246, 0.35), 0 20px 50px rgba(0, 0, 0, 0.3); }
.scard--skel { height: 360px; opacity: 0.4; animation: pulse 1.5s ease-in-out infinite; }
@keyframes pulse { 50% { opacity: 0.2; } }

/* Banner */
.scard__banner { position: relative; padding: 1.1rem 1.25rem; min-height: 128px; display: flex; align-items: flex-end; }
.scard__banner-img {
  position: absolute; inset: 0;
  background: linear-gradient(135deg, #241a5c 0%, #12152b 60%, #0b0e1c 100%);
  background-size: cover; background-position: center;
}
.scard__banner-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(180deg, rgba(10, 14, 26, 0.15) 0%, rgba(10, 14, 26, 0.55) 55%, rgba(13, 16, 32, 0.95) 100%);
}

.scard__status {
  position: absolute; top: 0.85rem; right: 0.9rem; z-index: 2;
  display: inline-flex; align-items: center; gap: 0.4rem;
  padding: 0.28rem 0.65rem; border-radius: 999px;
  font-size: 0.72rem; font-weight: 800;
  background: rgba(6, 9, 17, 0.72); backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.scard__status-dot { width: 7px; height: 7px; border-radius: 50%; }
.is-online { color: #86efac; } .is-online .scard__status-dot { background: #22c55e; box-shadow: 0 0 8px rgba(34, 197, 94, 0.7); }
.is-offline { color: #fca5a5; } .is-offline .scard__status-dot { background: #ef4444; }
.is-maint { color: #fde047; } .is-maint .scard__status-dot { background: #eab308; }

.scard__identity { position: relative; z-index: 2; display: flex; align-items: center; gap: 0.8rem; width: 100%; min-width: 0; }
.scard__icon {
  width: 3.25rem; height: 3.25rem; border-radius: 14px; flex-shrink: 0; overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.14); background: rgba(12, 16, 30, 0.85);
  display: flex; align-items: center; justify-content: center;
  color: #a78bfa; font-weight: 900; font-size: 1.35rem;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.35);
}
.scard__icon img { width: 100%; height: 100%; object-fit: cover; }
.scard__identity-text { min-width: 0; flex: 1; }
.scard__name {
  font-size: 1.15rem; font-weight: 800; color: #f4f7ff; margin: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
}
.scard__tags { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.35rem; }
.scard__chip {
  font-size: 0.68rem; font-weight: 700; padding: 0.14rem 0.5rem; border-radius: 999px;
  color: #c9d6f0; background: rgba(255, 255, 255, 0.08); backdrop-filter: blur(4px);
}
.scard__chip--muted { color: #94a3b8; background: rgba(148, 163, 184, 0.1); }
.scard__selected {
  align-self: flex-start; flex-shrink: 0;
  font-size: 0.66rem; font-weight: 800; padding: 0.2rem 0.55rem; border-radius: 999px;
  color: #c4b5fd; background: rgba(139, 92, 246, 0.2); border: 1px solid rgba(139, 92, 246, 0.35);
}

/* Body */
.scard__body { display: flex; flex-direction: column; gap: 0.9rem; padding: 1.15rem 1.25rem 1.35rem; flex: 1; }
.scard__desc {
  margin: 0; font-size: 0.87rem; line-height: 1.5; color: #9aa7c4; min-height: 2.6em;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}

.scard__players { display: flex; flex-direction: column; gap: 0.4rem; }
.scard__players-head { display: flex; align-items: baseline; justify-content: space-between; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #5b6a8c; }
.scard__players-count { font-size: 0.9rem; font-weight: 800; color: #64748b; text-transform: none; letter-spacing: 0; }
.scard__players-count.is-live { color: #86efac; }
.scard__players-track { height: 6px; border-radius: 999px; background: rgba(255, 255, 255, 0.07); overflow: hidden; }
.scard__players-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #22c55e, #86efac); transition: width 0.5s ease; }

.scard__address {
  display: flex; align-items: center; gap: 0.55rem; width: 100%;
  padding: 0.6rem 0.8rem; border-radius: 11px; cursor: pointer;
  border: 1px solid rgba(255, 255, 255, 0.08); background: rgba(255, 255, 255, 0.03);
  color: #8ea0c4; font-size: 0.82rem; font-family: ui-monospace, monospace;
  transition: border-color 0.15s ease, color 0.15s ease;
}
.scard__address:hover { border-color: rgba(139, 92, 246, 0.35); color: #cdd8ef; }
.scard__address-value { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.scard__cta {
  margin-top: auto; width: 100%; padding: 0.72rem; border: none; border-radius: 12px;
  font-size: 0.9rem; font-weight: 800; cursor: pointer;
  color: #e5e7ff; background: rgba(255, 255, 255, 0.07);
  transition: background 0.15s ease, transform 0.1s ease;
}
.scard__cta:hover { background: rgba(255, 255, 255, 0.12); }
.scard__cta:active { transform: scale(0.99); }
.scard__cta--active { color: #fff; background: linear-gradient(135deg, #7c3aed, #6366f1); }
.scard__cta--active:hover { background: linear-gradient(135deg, #6d28d9, #4f46e5); }

.servers-empty {
  padding: 3.5rem 2rem; text-align: center; color: #64748b; font-size: 0.95rem;
  border: 1px dashed rgba(148, 163, 184, 0.2); border-radius: 20px;
}
</style>
