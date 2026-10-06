<script setup>
// «Партнёрам»: зачем подключать свой сервер к VoidRP, как это сделать, кто уже подключён
// (с живым статусом), наши плагины с последними версиями и лента сборок.
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { apiRequest } from '../services/apiBase'
import { serverState, fetchServers } from '../stores/serverStore'
import { siteConfig } from '../config.site'

const { t, tm, rt, locale } = useI18n()
const releases = ref([])
const statuses = ref({})
const openLog = ref(null)

const API = (import.meta.env.VITE_API_BASE_URL || 'https://api.void-rp.ru/api/v1').replace(/\/$/, '')
const rssUrl = `${API.startsWith('http') ? API : 'https://api.void-rp.ru/api/v1'}/integration/releases.rss`

const partners = computed(() => serverState.list.filter((s) => s.is_external))
const ICONS = ['👥', '🔑', '🖥', '📈', '🛡', '🔁']

const plugins = computed(() => {
  const seen = new Map()
  for (const r of releases.value) if (!seen.has(r.plugin)) seen.set(r.plugin, r)
  return [...seen.values()]
})

onMounted(async () => {
  try {
    const d = await apiRequest('/integration/releases', { serverScope: false, toast: false })
    releases.value = d.releases || []
  } catch { releases.value = [] }
  await fetchServers()
  for (const s of partners.value) {
    apiRequest(`/status/${s.slug}`, { serverScope: false, toast: false })
      .then((d) => { statuses.value = { ...statuses.value, [s.slug]: d } })
      .catch(() => {})
  }
})

const fmtDate = (iso) => new Date(iso).toLocaleDateString(locale.value === 'en' ? 'en-GB' : 'ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
const pct = (v) => (v == null ? '—' : `${v >= 99.995 ? '100' : v.toFixed(1)}%`)
const barKind = (u) => (u == null ? 'empty' : u >= 99.5 ? 'good' : u >= 95 ? 'partial' : 'bad')
</script>

<template>
  <section class="pt">
    <div class="container-shell">
      <header class="pt-hero">
        <div class="pt-kicker">{{ t('partners.kicker') }}</div>
        <h1 class="pt-title">{{ t('partners.title') }}</h1>
        <p class="pt-sub">{{ t('partners.subtitle') }}</p>
        <div class="pt-cta">
          <a :href="siteConfig.telegramUrl" target="_blank" rel="noreferrer" class="pt-btn pt-btn--primary">{{ t('partners.cta') }} · Telegram</a>
          <a :href="siteConfig.discordUrl" target="_blank" rel="noreferrer" class="pt-btn">Discord</a>
        </div>
        <p class="pt-hint">{{ t('partners.ctaHint') }}</p>
      </header>

      <h2 class="pt-h2">{{ t('partners.whyTitle') }}</h2>
      <div class="pt-why">
        <article v-for="(w, i) in tm('partners.why')" :key="i" class="pt-card">
          <div class="pt-card__icon" aria-hidden="true">{{ ICONS[i] }}</div>
          <h3>{{ rt(w[0]) }}</h3>
          <p>{{ rt(w[1]) }}</p>
        </article>
      </div>

      <h2 class="pt-h2">{{ t('partners.howTitle') }}</h2>
      <ol class="pt-how">
        <li v-for="(h, i) in tm('partners.how')" :key="i" class="pt-step">
          <span class="pt-step__n">{{ i + 1 }}</span>
          <div><h3>{{ rt(h[0]) }}</h3><p>{{ rt(h[1]) }}</p></div>
        </li>
      </ol>
      <div class="pt-term" aria-hidden="true">
        <div class="pt-term__bar"><i /><i /><i /></div>
        <pre><span class="pt-dim">$</span> curl -fsSL https://api.void-rp.ru/api/v1/i/<span class="pt-acc">••••</span> | bash
<span class="pt-ok">✔</span> Java 21
<span class="pt-ok">✔</span> связь с https://api.void-rp.ru/api/v1 есть
<span class="pt-ok">✔</span> VoidRpAuth: VoidRpAuth-1.4.0.jar
<span class="pt-ok">✔</span> VoidRpPerms: VoidRpPerms-0.7.0.jar
<span class="pt-ok">✔</span> конфиг plugins/VoidRpPerms/config.yml (с секретом сервера)

Готово. Перезапустите сервер — меньше чем через минуту в «Интеграции» загорятся «Вход» и «Мониторинг».</pre>
      </div>

      <h2 class="pt-h2">{{ t('partners.serversTitle') }}</h2>
      <div v-if="!partners.length" class="pt-empty">{{ t('partners.serversEmpty') }}</div>
      <div v-else class="pt-servers">
        <article v-for="s in partners" :key="s.slug" class="pt-srv">
          <img v-if="s.icon_url" :src="s.icon_url" alt="" class="pt-srv__icon" />
          <div class="pt-srv__main">
            <div class="pt-srv__name">{{ s.name }}</div>
            <div class="pt-srv__line">
              <span class="pt-dot" :class="s.status?.online ? 'pt-dot--up' : 'pt-dot--down'" />
              <span v-if="s.status?.online">{{ s.status.players_online }}/{{ s.status.players_max }}</span>
              <span v-if="statuses[s.slug]" class="pt-muted">· {{ pct(statuses[s.slug].uptime_30d) }} {{ t('partners.uptime') }}</span>
            </div>
            <div v-if="statuses[s.slug]" class="pt-bars">
              <i v-for="b in statuses[s.slug].bars_30d" :key="b.day" :class="`pt-bar--${barKind(b.uptime)}`" />
            </div>
          </div>
          <RouterLink v-if="statuses[s.slug]" :to="`/status/${s.slug}`" class="pt-btn pt-btn--sm">{{ t('partners.status') }}</RouterLink>
        </article>
      </div>

      <h2 class="pt-h2">{{ t('partners.pluginsTitle') }}</h2>
      <p class="pt-muted">{{ t('partners.pluginsHint') }} <a :href="rssUrl" target="_blank" rel="noopener" class="pt-link">{{ t('partners.rss') }}</a></p>
      <div v-if="!plugins.length" class="pt-empty">{{ t('partners.loading') }}</div>
      <div v-else class="pt-plugins">
        <article v-for="p in plugins" :key="p.plugin" class="pt-plugin">
          <div class="pt-plugin__head">
            <div>
              <div class="pt-plugin__name">{{ p.name }}</div>
              <div class="pt-muted">{{ t('partners.latest') }} <b class="pt-strong">{{ p.version }}</b> · {{ fmtDate(p.published_at) }}</div>
            </div>
            <a v-if="p.url" :href="p.url" target="_blank" rel="noopener" class="pt-btn pt-btn--sm">GitHub</a>
          </div>
          <div class="pt-tags">
            <span v-for="c in p.platforms" :key="c" class="pt-tag">{{ c }}</span>
            <span v-for="m in p.mc_versions" :key="m" class="pt-tag pt-tag--mc">{{ m }}</span>
          </div>
          <button v-if="p.changelog" class="pt-link pt-log-btn" @click="openLog = openLog === p.plugin ? null : p.plugin">{{ t('partners.changelog') }} {{ openLog === p.plugin ? '▴' : '▾' }}</button>
          <pre v-if="openLog === p.plugin" class="pt-log">{{ p.changelog }}</pre>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.pt { padding: 2.5rem 0 4rem; color: #e6ebff; }
.pt-hero { text-align: center; max-width: 46rem; margin: 0 auto 2.5rem; }
.pt-kicker { font-size: 0.72rem; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; color: #a78bfa; }
.pt-title { margin: 0.5rem 0 0; font-size: clamp(1.7rem, 4vw, 2.6rem); font-weight: 900; color: #f5f7ff; line-height: 1.15; }
.pt-sub { margin: 0.8rem auto 0; color: #a3aecb; font-size: 1.02rem; max-width: 38rem; }
.pt-cta { display: flex; gap: 0.6rem; justify-content: center; flex-wrap: wrap; margin-top: 1.4rem; }
.pt-hint { margin-top: 0.7rem; color: #7d89a8; font-size: 0.85rem; }
.pt-btn { display: inline-flex; align-items: center; justify-content: center; padding: 0.7rem 1.2rem; border-radius: 12px; border: 1px solid rgba(148, 163, 184, 0.2); background: rgba(19, 25, 43, 0.85); color: #e6ebff; font-weight: 700; text-decoration: none; transition: border-color 0.15s, transform 0.15s; white-space: nowrap; }
.pt-btn:hover { border-color: rgba(139, 92, 246, 0.6); transform: translateY(-1px); }
.pt-btn--primary { background: linear-gradient(135deg, #7c3aed, #6d28d9); border-color: transparent; color: #fff; }
.pt-btn--sm { padding: 0.4rem 0.75rem; font-size: 0.8rem; border-radius: 9px; }
.pt-h2 { font-size: 1.3rem; font-weight: 900; margin: 2.6rem 0 1rem; color: #f5f7ff; }
.pt-muted { color: #8b97b6; font-size: 0.88rem; }
.pt-strong { color: #e6ebff; }
.pt-link { color: #a78bfa; font-weight: 700; text-decoration: none; background: none; border: 0; padding: 0; cursor: pointer; font-size: inherit; }
.pt-link:hover { text-decoration: underline; }
.pt-empty { color: #8b97b6; padding: 1rem 0; }

.pt-why { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr)); gap: 0.9rem; }
.pt-card { padding: 1.1rem 1.15rem; border-radius: 18px; border: 1px solid rgba(148, 163, 184, 0.13); background: linear-gradient(180deg, rgba(19, 25, 43, 0.9), rgba(10, 14, 26, 0.92)); }
.pt-card__icon { width: 2.4rem; height: 2.4rem; border-radius: 12px; display: grid; place-items: center; font-size: 1.2rem; background: rgba(139, 92, 246, 0.14); border: 1px solid rgba(139, 92, 246, 0.3); }
.pt-card h3 { margin: 0.7rem 0 0.3rem; font-size: 1rem; font-weight: 800; color: #f5f7ff; }
.pt-card p { margin: 0; color: #a3aecb; font-size: 0.88rem; line-height: 1.5; }

.pt-how { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 0.9rem; counter-reset: s; }
.pt-step { display: flex; gap: 0.8rem; padding: 1rem; border-radius: 16px; border: 1px solid rgba(148, 163, 184, 0.13); background: rgba(19, 25, 43, 0.6); }
.pt-step__n { flex: none; width: 2rem; height: 2rem; border-radius: 999px; display: grid; place-items: center; font-weight: 900; background: #7c3aed; color: #fff; }
.pt-step h3 { margin: 0.15rem 0 0.25rem; font-size: 0.95rem; font-weight: 800; color: #f5f7ff; }
.pt-step p { margin: 0; color: #a3aecb; font-size: 0.85rem; line-height: 1.45; }
.pt-term { margin-top: 1rem; border-radius: 14px; overflow: hidden; border: 1px solid rgba(148, 163, 184, 0.15); background: #070a14; }
.pt-term__bar { display: flex; gap: 6px; padding: 0.55rem 0.8rem; background: rgba(255, 255, 255, 0.04); }
.pt-term__bar i { width: 10px; height: 10px; border-radius: 50%; background: #334155; }
.pt-term pre { margin: 0; padding: 0.9rem 1rem 1.1rem; font-size: 0.8rem; line-height: 1.6; color: #cbd5f5; overflow-x: auto; white-space: pre; }
.pt-dim { color: #64748b; }
.pt-acc { color: #a78bfa; }
.pt-ok { color: #22c55e; }

.pt-servers { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr)); gap: 0.8rem; }
.pt-srv { display: flex; align-items: center; gap: 0.8rem; padding: 0.85rem 1rem; border-radius: 16px; border: 1px solid rgba(148, 163, 184, 0.13); background: rgba(19, 25, 43, 0.75); }
.pt-srv__icon { width: 48px; height: 48px; border-radius: 12px; object-fit: cover; }
.pt-srv__main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.25rem; }
.pt-srv__name { font-weight: 800; color: #f5f7ff; }
.pt-srv__line { display: flex; gap: 0.4rem; align-items: center; font-size: 0.82rem; flex-wrap: wrap; }
.pt-dot { width: 8px; height: 8px; border-radius: 50%; }
.pt-dot--up { background: #22c55e; box-shadow: 0 0 8px rgba(34, 197, 94, 0.6); }
.pt-dot--down { background: #ef4444; }
.pt-bars { display: flex; gap: 2px; height: 12px; }
.pt-bars i { flex: 1; border-radius: 2px; background: rgba(148, 163, 184, 0.22); }
.pt-bars .pt-bar--good { background: #22c55e; }
.pt-bars .pt-bar--partial { background: #eab308; }
.pt-bars .pt-bar--bad { background: #ef4444; }

.pt-plugins { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); gap: 0.8rem; margin-top: 0.8rem; }
.pt-plugin { padding: 0.95rem 1rem; border-radius: 16px; border: 1px solid rgba(148, 163, 184, 0.13); background: rgba(19, 25, 43, 0.75); display: flex; flex-direction: column; gap: 0.55rem; }
.pt-plugin__head { display: flex; justify-content: space-between; gap: 0.6rem; align-items: flex-start; }
.pt-plugin__name { font-weight: 800; color: #f5f7ff; }
.pt-tags { display: flex; gap: 0.3rem; flex-wrap: wrap; }
.pt-tag { font-size: 0.7rem; font-weight: 700; padding: 0.15rem 0.45rem; border-radius: 6px; background: rgba(139, 92, 246, 0.14); color: #c4b5fd; }
.pt-tag--mc { background: rgba(34, 197, 94, 0.12); color: #86efac; }
.pt-log-btn { align-self: flex-start; font-size: 0.82rem; }
.pt-log { margin: 0; padding: 0.6rem 0.7rem; border-radius: 10px; background: #070a14; color: #cbd5f5; font-size: 0.76rem; white-space: pre-wrap; max-height: 260px; overflow: auto; }
</style>
