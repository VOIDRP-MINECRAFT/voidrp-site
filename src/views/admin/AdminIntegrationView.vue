<script setup>
// «Интеграция» — подключение сервера к VoidRP: статус, что сделать, установка по шагам,
// плагины, опись сервера, обновления и (админам платформы) релизы. Данные — из отчётов
// наших плагинов (раз в 30 с); страница обновляется сама.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authState, hasPermission } from '../../stores/authStore'
import { toastError } from '../../services/toast'
import { getIntegration, getNotifyPrefs, runSelftest } from '../../services/integrationApi'
import { ago } from './integration/util'
import IntOverview from './integration/IntOverview.vue'
import IntInstall from './integration/IntInstall.vue'
import IntPlugins from './integration/IntPlugins.vue'
import IntServer from './integration/IntServer.vue'
import IntUpdates from './integration/IntUpdates.vue'
import IntReleases from './integration/IntReleases.vue'

const route = useRoute()
const router = useRouter()
const data = ref(null)
const notify = ref(null)
const loading = ref(true)
const now = ref(Date.now())
const canConfig = computed(() => hasPermission('integration.config'))
const isPlatformAdmin = computed(() => !!authState.user?.is_admin)

async function load(silent = false) {
  if (!silent) loading.value = !data.value
  try {
    data.value = await getIntegration(authState.accessToken)
  } catch (e) {
    if (!silent) toastError(e?.message || 'Не удалось загрузить')
  } finally {
    loading.value = false
  }
}
async function loadNotify() {
  try { notify.value = await getNotifyPrefs() } catch { notify.value = null }
}

// ── Сводка ──
const server = computed(() => data.value?.server || {})
const ours = computed(() => (data.value?.items || []).filter((i) => i.kind === 'ours' && !i.client_side))
const outdated = computed(() => ours.value.filter((i) => i.outdated))
const required = computed(() => data.value?.required || [])
const requiredOk = computed(() => required.value.length > 0 && required.value.every((r) => r.ok))
const reports = computed(() => data.value?.reports || [])
const freshReports = computed(() => reports.value.filter((r) => r.fresh))
const lastReport = computed(() => reports.value.map((r) => r.reported_at).sort().pop() || null)
const serverIssues = computed(() => (data.value?.inventory?.issues || []).filter((x) => x.level !== 'info').length)

const state = computed(() => {
  if (!reports.value.length) return { kind: 'new', title: 'Сервер ещё не подключён', text: 'Плагины VoidRP пока не отчитывались. Начните с вкладки «Установка».' }
  if (!freshReports.value.length) return { kind: 'err', title: 'Нет связи с сервером', text: `Последний отчёт ${ago(lastReport.value, now.value)} — сервер выключен или плагины не достучаются до VoidRP.` }
  if (!requiredOk.value) return { kind: 'warn', title: 'Подключение не завершено', text: `Не работает: ${required.value.filter((r) => !r.ok).map((r) => r.label).join('; ')}.` }
  return {
    kind: 'ok',
    title: 'Сервер подключён',
    text: server.value.is_external && (server.value.maintenance || !server.value.is_visible)
      ? 'Обязательные модули работают — сервер можно открывать игрокам.'
      : 'Вход, мониторинг и остальное работают через VoidRP.',
  }
})
const MODULE_KEYS = ['auth', 'monitoring', 'perms', 'chat', 'console', 'log', 'punishments', 'item_bans', 'anticheat']
const modulesOn = computed(() => MODULE_KEYS.filter((k) => freshReports.value.some((r) => r.modules?.[k]?.ok)).length)

// ── Вкладки (в адресе, чтобы ссылка открывала нужную) ──
const TABS = computed(() => [
  { key: 'overview', label: 'Обзор', badge: todo.value.filter((t) => t.level !== 'info').length || null },
  { key: 'install', label: 'Установка' },
  { key: 'plugins', label: 'Плагины', badge: outdated.value.length || null },
  { key: 'server', label: 'Сервер', badge: serverIssues.value || null },
  { key: 'updates', label: 'Обновления' },
  ...(isPlatformAdmin.value ? [{ key: 'releases', label: 'Релизы' }] : []),
])
const tab = ref(String(route.query.tab || ''))
function go(key) {
  tab.value = key
  router.replace({ query: { ...route.query, tab: key } })
}

// ── Что сделать, по важности ──
const todo = computed(() => {
  const d = data.value
  if (!d) return []
  const out = []
  const issues = d.inventory?.issues || []
  if (!server.value.server_core) out.push({ level: 'warn', title: 'Не указано ядро сервера', text: 'Владелец проекта задаёт его в «Серверах» — от него зависит, какие плагины ставить.' })
  if (reports.value.length && !freshReports.value.length) out.push({ level: 'err', title: 'Сервер не отвечает', text: `Последний отчёт ${ago(lastReport.value, now.value)}. Запустите проверку сервера.`, tab: 'server', action: 'Проверка' })
  // Молчит весь сервер — причина одна, модули по отдельности не перечисляем.
  if (!reports.value.length || freshReports.value.length) {
    for (const r of required.value.filter((x) => !x.ok)) out.push({ level: 'err', title: `Не работает: ${r.label}`, tab: 'install', action: 'Установка' })
  }
  for (const p of d.secret?.old_secret_plugins || []) out.push({ level: 'warn', title: `${p} ещё на старом секрете`, text: 'Перезапустите сервер, пока старый секрет действует.', tab: 'updates', action: 'Подробнее' })
  for (const x of issues.filter((i) => i.level === 'err')) out.push({ level: 'err', title: x.text, tab: 'server', action: 'Сервер' })
  for (const it of outdated.value) {
    const important = it.changes_since_installed?.some((c) => c.important)
    out.push({
      level: important ? 'err' : 'warn',
      title: `Обновите ${it.name}: ${it.installed.version} → ${it.latest.version}`,
      text: d.settings?.auto_update ? 'Автообновление скачает её само — встанет при перезапуске.' : important ? 'Важное обновление.' : '',
      tab: 'plugins', action: 'Что изменится',
    })
  }
  for (const x of issues.filter((i) => i.level === 'warn')) out.push({ level: 'warn', title: x.text, tab: 'server', action: 'Сервер' })
  for (const t of d.tips || []) out.push({ level: 'warn', title: t.text })
  if (server.value.is_external && requiredOk.value && !d.settings?.auto_update) out.push({ level: 'info', title: 'Включите автообновление', text: 'Плагины VoidRP будут обновляться сами при перезапуске.', tab: 'updates', action: 'Включить' })
  if (notify.value && !notify.value.platform_admin && !notify.value.telegram_linked) out.push({ level: 'info', title: 'Привяжите Telegram', text: 'Бот напишет об обновлениях и о том, что сервер перестал отвечать.', tab: 'updates', action: 'Как' })
  for (const x of issues.filter((i) => i.level === 'info')) out.push({ level: 'info', title: x.text, tab: 'server', action: 'Сервер' })
  return out
})

// Без выбранной вкладки: не подключён — «Установка», иначе «Обзор».
watch(data, (d) => {
  if (d && !tab.value) tab.value = (d.reports || []).length ? 'overview' : 'install'
})

// ── Проверка связи ──
const selftest = ref(null)
const checking = ref(false)
async function check() {
  checking.value = true
  selftest.value = null
  try {
    selftest.value = (await runSelftest()).output || '(пустой ответ)'
  } catch (e) {
    toastError(e?.message || 'Сервер не ответил')
  } finally {
    checking.value = false
  }
}

let timer = null
onMounted(() => {
  load()
  loadNotify()
  timer = setInterval(() => { if (!document.hidden) { now.value = Date.now(); load(true) } }, 15000)
})
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <div class="adm-page">
    <div class="adm-page__head">
      <div>
        <h1 class="adm-title">Интеграция</h1>
        <p class="adm-sub">Подключение сервера «{{ server.name || '…' }}» к VoidRP: вход, мониторинг, права и обновления</p>
      </div>
    </div>

    <div v-if="loading" class="adm-card adm-card--pad"><div class="adm-skel" style="height: 300px" /></div>

    <template v-else-if="data">
      <!-- Статус -->
      <section class="ig-hero" :class="`ig-hero--${state.kind}`">
        <div class="ig-hero__main">
          <span class="ig-hero__icon">{{ state.kind === 'ok' ? '✓' : state.kind === 'new' ? '…' : '!' }}</span>
          <div class="ig-hero__text">
            <div class="ig-hero__title">{{ state.title }}</div>
            <div class="ig-hero__sub">{{ state.text }}</div>
            <div class="ig-hero__meta">
              <span>{{ server.core_label || 'ядро не указано' }}</span>
              <span class="adm-badge">{{ server.is_external ? 'внешний сервер' : 'наш сервер' }}</span>
            </div>
          </div>
          <button class="adm-btn adm-btn--sm ig-hero__check" :disabled="checking" @click="check">{{ checking ? 'Спрашиваю сервер…' : 'Проверить связь' }}</button>
        </div>
        <div class="ig-stats">
          <div class="ig-stat">
            <span class="ig-stat__label">Модули</span>
            <span class="ig-stat__val">{{ modulesOn }} <small>из {{ MODULE_KEYS.length }}</small></span>
            <span class="ig-bar"><span class="ig-bar__fill" :style="{ width: `${Math.round((modulesOn / MODULE_KEYS.length) * 100)}%` }" /></span>
          </div>
          <div class="ig-stat">
            <span class="ig-stat__label">Плагины VoidRP</span>
            <span class="ig-stat__val">{{ ours.filter((i) => i.installed).length }}
              <small v-if="outdated.length" class="ig-warn">· {{ outdated.length }} устар.</small>
              <small v-else-if="ours.some((i) => i.installed)">· актуальны</small>
            </span>
          </div>
          <div class="ig-stat">
            <span class="ig-stat__label">Последний отчёт</span>
            <span class="ig-stat__val ig-stat__val--sm">{{ lastReport ? ago(lastReport, now) : '—' }}</span>
          </div>
          <div class="ig-stat">
            <span class="ig-stat__label">Автообновление</span>
            <span class="ig-stat__val ig-stat__val--sm" :class="{ 'ig-ok': data.settings?.auto_update }">{{ data.settings?.auto_update ? 'включено' : 'выключено' }}</span>
          </div>
        </div>
        <pre v-if="selftest" class="ig-selftest">{{ selftest }}</pre>
      </section>

      <!-- Вкладки -->
      <nav class="ig-tabs">
        <button v-for="t in TABS" :key="t.key" class="ig-tab" :class="{ 'ig-tab--on': tab === t.key }" @click="go(t.key)">
          {{ t.label }}<span v-if="t.badge" class="ig-tab__badge">{{ t.badge }}</span>
        </button>
      </nav>

      <IntOverview v-if="tab === 'overview'" :data="data" :todo="todo" :now="now" @go="go" />
      <IntInstall v-else-if="tab === 'install'" :data="data" :now="now" :can-config="canConfig" />
      <IntPlugins v-else-if="tab === 'plugins'" :data="data" :now="now" :can-config="canConfig" />
      <IntServer v-else-if="tab === 'server'" :data="data" :now="now" />
      <IntUpdates v-else-if="tab === 'updates'" :data="data" :notify="notify" :can-config="canConfig" @reload="load(true)" @notify="notify = $event" />
      <IntReleases v-else-if="tab === 'releases' && isPlatformAdmin" @reload="load(true)" />
    </template>
  </div>
</template>

<style scoped>
.ig-hero {
  border-radius: var(--adm-r); border: 1px solid var(--adm-line); background: var(--adm-card);
  padding: 1.1rem 1.2rem 1.1rem 1.4rem; margin-bottom: 1rem; display: flex; flex-direction: column; gap: 1rem;
  position: relative; overflow: hidden;
}
.ig-hero::before { content: ''; position: absolute; inset: 0 auto 0 0; width: 4px; background: var(--adm-line-strong); }
.ig-hero--ok::before { background: var(--adm-ok); }
.ig-hero--warn::before { background: var(--adm-warn); }
.ig-hero--err::before { background: var(--adm-err); }
.ig-hero--ok { background: linear-gradient(100deg, color-mix(in srgb, var(--adm-ok) 7%, var(--adm-card)) 0%, var(--adm-card) 55%); }
.ig-hero--warn { background: linear-gradient(100deg, color-mix(in srgb, var(--adm-warn) 8%, var(--adm-card)) 0%, var(--adm-card) 55%); }
.ig-hero--err { background: linear-gradient(100deg, color-mix(in srgb, var(--adm-err) 8%, var(--adm-card)) 0%, var(--adm-card) 55%); }
.ig-hero__main { display: flex; gap: 0.95rem; align-items: center; flex-wrap: wrap; }
.ig-hero__icon {
  flex-shrink: 0; width: 3rem; height: 3rem; border-radius: 999px; display: grid; place-items: center;
  font-size: 1.3rem; font-weight: 800; background: var(--adm-card-2); color: var(--adm-dim); border: 1px solid var(--adm-line);
}
.ig-hero--ok .ig-hero__icon { color: var(--adm-ok); background: color-mix(in srgb, var(--adm-ok) 15%, transparent); border-color: color-mix(in srgb, var(--adm-ok) 40%, transparent); }
.ig-hero--warn .ig-hero__icon { color: var(--adm-warn); background: color-mix(in srgb, var(--adm-warn) 15%, transparent); border-color: color-mix(in srgb, var(--adm-warn) 40%, transparent); }
.ig-hero--err .ig-hero__icon { color: var(--adm-err); background: color-mix(in srgb, var(--adm-err) 15%, transparent); border-color: color-mix(in srgb, var(--adm-err) 40%, transparent); }
.ig-hero__text { flex: 1; min-width: 14rem; }
.ig-hero__title { font-size: 1.2rem; font-weight: 800; color: var(--adm-text); }
.ig-hero__sub { font-size: 0.88rem; color: var(--adm-dim); margin-top: 0.15rem; line-height: 1.45; }
.ig-hero__meta { display: flex; gap: 0.5rem; align-items: center; margin-top: 0.45rem; font-size: 0.78rem; color: var(--adm-dim); }
.ig-hero__check { align-self: flex-start; }

.ig-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.6rem; }
@media (max-width: 760px) { .ig-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.ig-stat { display: flex; flex-direction: column; gap: 0.2rem; padding: 0.6rem 0.75rem; border-radius: var(--adm-r-sm); background: var(--adm-card-2); border: 1px solid var(--adm-line); }
.ig-stat__label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--adm-faint); }
.ig-stat__val { font-size: 1.15rem; font-weight: 800; color: var(--adm-text); }
.ig-stat__val small { font-size: 0.78rem; font-weight: 600; color: var(--adm-dim); }
.ig-stat__val--sm { font-size: 0.95rem; }
.ig-warn { color: var(--adm-warn) !important; }
.ig-ok { color: var(--adm-ok); }
.ig-bar { height: 4px; border-radius: 4px; background: var(--adm-line); overflow: hidden; margin-top: 0.15rem; }
.ig-bar__fill { display: block; height: 100%; background: var(--adm-acc); border-radius: 4px; transition: width 0.3s; }
.ig-selftest { margin: 0; padding: 0.65rem 0.75rem; font-family: var(--adm-mono); font-size: 0.76rem; background: var(--adm-card-2); border: 1px solid var(--adm-line); border-radius: var(--adm-r-sm); color: var(--adm-text); white-space: pre-wrap; }

.ig-tabs { display: flex; gap: 0.25rem; margin-bottom: 1rem; border-bottom: 1px solid var(--adm-line); overflow-x: auto; }
.ig-tab {
  position: relative; border: 0; background: none; padding: 0.6rem 0.9rem; font-size: 0.88rem; font-weight: 600;
  color: var(--adm-dim); cursor: pointer; white-space: nowrap; display: inline-flex; align-items: center; gap: 0.4rem;
}
.ig-tab:hover { color: var(--adm-text); }
.ig-tab--on { color: var(--adm-text); }
.ig-tab--on::after { content: ''; position: absolute; left: 0.6rem; right: 0.6rem; bottom: -1px; height: 2px; border-radius: 2px; background: var(--adm-acc); }
.ig-tab__badge { min-width: 1.15rem; height: 1.15rem; padding: 0 0.3rem; border-radius: 999px; font-size: 0.7rem; font-weight: 800; display: inline-grid; place-items: center; background: color-mix(in srgb, var(--adm-warn) 22%, transparent); color: var(--adm-warn); }
</style>
