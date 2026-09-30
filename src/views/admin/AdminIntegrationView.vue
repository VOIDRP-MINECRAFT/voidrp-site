<script setup>
// «Интеграция» — что поставить на внешний сервер, чтобы он работал с VoidRP, и работает ли уже.
// Статусы — из отчётов наших плагинов (раз в 30 с). Вход и мониторинг обязательны: без них
// внешний сервер нельзя открыть игрокам.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { authState, hasPermission } from '../../stores/authStore'
import { toastError, toastSuccess } from '../../services/toast'
import { downloadConfig, downloadRelease, getIntegration } from '../../services/integrationApi'

const data = ref(null)
const loading = ref(true)
const canConfig = computed(() => hasPermission('integration.config'))

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

const server = computed(() => data.value?.server || {})
const ours = computed(() => (data.value?.items || []).filter((i) => i.kind === 'ours'))
const thirdParty = computed(() => Object.fromEntries((data.value?.items || []).filter((i) => i.kind === 'third_party').map((i) => [i.key, i])))
const requiredOk = computed(() => (data.value?.required || []).every((r) => r.ok))
const moduleOf = (key) => {
  for (const r of data.value?.reports || []) {
    if (r.fresh && r.modules?.[key]?.ok) return r
  }
  return null
}

// Чек-лист — настоящая последовательность подключения.
const steps = computed(() => {
  const d = data.value
  if (!d) return []
  const req = Object.fromEntries(d.required.map((r) => [r.key, r]))
  const perms = moduleOf('perms')
  const anticheat = moduleOf('anticheat')
  return [
    {
      title: 'Ядро сервера',
      ok: !!server.value.server_core,
      text: server.value.server_core
        ? `${server.value.core_label}${server.value.core_reported ? ` · сервер сообщает: ${server.value.core_reported}` : ''}`
        : 'Не указано — владелец задаёт его в «Серверах». От ядра зависит, какой вход ставить.',
    },
    {
      title: 'Вход через аккаунт VoidRP',
      required: true,
      ok: req.auth?.ok,
      text: req.auth?.ok ? `Работает: ${req.auth.plugin} ${req.auth.version || ''}` : authHint.value,
    },
    {
      title: 'Мониторинг',
      required: true,
      ok: req.monitoring?.ok,
      text: req.monitoring?.ok ? `Работает: ${req.monitoring.plugin} ${req.monitoring.version || ''}` : 'Поставьте VoidRpPerms 0.4.0 или новее — он присылает TPS, игроков и память.',
    },
    {
      title: 'Права в игре и чат с префиксами',
      ok: !!perms,
      optional: true,
      text: perms ? `Работает: ${perms.plugin} ${perms.version || ''}` : 'Тот же VoidRpPerms и LuckPerms. Права настраиваются в разделе «Права в игре».',
    },
    {
      title: 'Античит',
      ok: !!anticheat,
      optional: true,
      text: anticheat ? `Работает: ${anticheat.plugin} ${anticheat.version || ''}` : 'По желанию: VoidRpGuard с GrimAC и CoreProtect.',
    },
  ]
})
const authHint = computed(() => server.value.auth_method === 'mod'
  ? 'Поставьте мод voidrp-auth-bridge на сервер (его же получат игроки в паке).'
  : 'Поставьте VoidRpAuth — без него на сервере в offline-mode можно зайти под чужим ником.')

// ── Действия ──
const busy = ref('')
async function dl(item, release) {
  busy.value = `r:${release.id}`
  try {
    await downloadRelease(release.id, release.filename)
  } catch (e) { toastError(e?.message || 'Не удалось скачать') } finally { busy.value = '' }
}
async function cfg(item) {
  busy.value = `c:${item.key}`
  try {
    await downloadConfig(item.key, item.config_path.split('/').pop())
    toastSuccess(`Конфиг ${item.name} скачан — положите его в ${item.config_path}`)
  } catch (e) { toastError(e?.message || 'Не удалось скачать конфиг') } finally { busy.value = '' }
}
const openVersions = ref(new Set())
function toggleVersions(key) {
  const s = new Set(openVersions.value)
  s.has(key) ? s.delete(key) : s.add(key)
  openVersions.value = s
}

// ── Вспомогательное ──
const now = ref(Date.now())
function ago(iso) {
  if (!iso) return ''
  const s = Math.max(0, Math.round((now.value - new Date(iso).getTime()) / 1000))
  if (s < 60) return `${s} с назад`
  if (s < 3600) return `${Math.floor(s / 60)} мин назад`
  if (s < 86400) return `${Math.floor(s / 3600)} ч назад`
  return `${Math.floor(s / 86400)} дн назад`
}
const fmtSize = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} МБ` : `${Math.max(1, Math.round(b / 1024))} КБ`)
const fmtDate = (v) => (v ? new Date(v).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '')
const MODULE_NAMES = { auth: 'вход', monitoring: 'мониторинг', perms: 'права', chat: 'чат', anticheat: 'античит' }

let timer = null
onMounted(() => {
  load()
  timer = setInterval(() => { if (!document.hidden) { now.value = Date.now(); load(true) } }, 15000)
})
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <div class="adm-page">
    <div class="adm-page__head">
      <div>
        <h1 class="adm-title">Интеграция</h1>
        <p class="adm-sub">Что поставить на сервер «{{ server.name || '…' }}», чтобы он работал с VoidRP: вход, мониторинг, права и остальное</p>
      </div>
    </div>

    <div v-if="loading" class="adm-card adm-card--pad"><div class="adm-skel" style="height: 260px" /></div>

    <template v-else-if="data">
      <div v-if="server.is_external" class="it-banner" :class="requiredOk ? 'it-banner--ok' : 'it-banner--err'">
        <span class="adm-dot" :class="requiredOk ? 'adm-dot--ok' : 'adm-dot--err'" />
        <span v-if="requiredOk">Обязательные модули работают — сервер можно открывать игрокам.</span>
        <span v-else>Сервер нельзя открыть игрокам (снять техработы или показать в лаунчере), пока не работают: <b>{{ data.missing_required.join('; ') }}</b>.</span>
      </div>
      <div v-else class="it-banner">
        <span class="adm-dot" />
        <span>Этот сервер стоит на нашей машине, плагины на нём ставим мы. Страница показывает, что уже работает.</span>
      </div>

      <div class="it-grid">
        <!-- Чек-лист -->
        <section class="adm-card it-steps">
          <div class="adm-card__head"><div class="adm-card__title">Подключение</div><span class="it-muted">обновляется само</span></div>
          <ol class="it-steplist">
            <li v-for="(s, i) in steps" :key="i" class="it-step" :class="{ 'it-step--ok': s.ok, 'it-step--opt': s.optional && !s.ok }">
              <span class="it-step__num">{{ s.ok ? '✓' : i + 1 }}</span>
              <div class="it-step__body">
                <div class="it-step__title">
                  {{ s.title }}
                  <span v-if="s.required" class="adm-badge" :class="s.ok ? 'adm-badge--ok' : 'adm-badge--err'">обязательно</span>
                  <span v-else-if="s.optional" class="adm-badge">по желанию</span>
                </div>
                <div class="it-step__text">{{ s.text }}</div>
              </div>
            </li>
          </ol>
        </section>

        <!-- Как установить -->
        <section class="adm-card it-howto">
          <div class="adm-card__head"><div class="adm-card__title">Как установить</div></div>
          <ol v-if="server.auth_method !== 'mod'" class="it-howto__list">
            <li>Остановите сервер.</li>
            <li>Скачайте ниже обязательные плагины и положите их в папку <code>plugins</code>. Туда же — LuckPerms нужной версии по ссылке.</li>
            <li>Скачайте готовые конфиги (кнопка «Конфиг», нужен пароль) и положите по указанным путям — секрет и адрес уже вписаны.</li>
            <li>Запустите сервер. В логе должны появиться <code>[VoidRpAuth] VoidRpAuth включён</code> и <code>[VoidRpPerms] Связь с админкой включена</code>.</li>
            <li>Меньше чем через минуту пункты «Вход» и «Мониторинг» слева станут зелёными.</li>
            <li>Закройте RCON фаерволом: мониторингу он больше не нужен.</li>
          </ol>
          <ol v-else class="it-howto__list">
            <li>Остановите сервер.</li>
            <li>Положите мод voidrp-auth-bridge под версию Minecraft сервера в папку <code>mods</code>. В клиентский пак игроков его добавим мы.</li>
            <li>Скачайте конфиг <code>config/voidrp-auth-bridge.properties</code> (кнопка «Конфиг», нужен пароль).</li>
            <li>Запустите сервер. В логе будет <code>Auth bridge settings: … secret=set</code>.</li>
            <li>Когда пункты «Вход» и «Мониторинг» станут зелёными, сервер можно открывать.</li>
          </ol>
          <p v-if="!canConfig" class="it-note">Конфиги с секретом скачивают те, у кого есть право «Интеграция: скачивать готовые конфиги». Его выдаёт владелец проекта.</p>
        </section>
      </div>

      <!-- Подсказки с сервера -->
      <div v-for="(t, i) in data.tips" :key="i" class="it-banner it-banner--warn">
        <span class="adm-dot adm-dot--warn" /><span>{{ t.text }}</span>
      </div>

      <!-- Плагины -->
      <h2 class="it-h2">Плагины и моды VoidRP</h2>
      <div class="it-cards">
        <article v-for="it in ours" :key="it.key" class="adm-card it-card" :class="{ 'it-card--req': it.required }">
          <div class="it-card__head">
            <div>
              <div class="it-card__name">{{ it.name }}
                <span class="adm-badge" :class="it.required ? 'adm-badge--acc' : ''">{{ it.required ? 'обязательный' : 'по желанию' }}</span>
              </div>
              <div class="it-card__mods">модули: {{ it.modules.map((m) => MODULE_NAMES[m] || m).join(', ') }}</div>
            </div>
            <div class="it-card__actions">
              <button v-if="it.latest" class="adm-btn adm-btn--acc adm-btn--sm" :disabled="busy === `r:${it.latest.id}`" @click="dl(it, it.latest)">
                Скачать {{ it.latest.version }}
              </button>
              <button v-if="it.has_config && canConfig" class="adm-btn adm-btn--sm" :disabled="busy === `c:${it.key}`" @click="cfg(it)">Конфиг</button>
            </div>
          </div>
          <p class="it-card__summary">{{ it.summary }}</p>

          <div class="it-card__state">
            <template v-if="it.installed">
              <span class="adm-dot" :class="it.installed.fresh ? 'adm-dot--ok' : 'adm-dot--warn'" />
              <span>На сервере {{ it.installed.version }} · отчёт {{ ago(it.installed.reported_at) }}<template v-if="!it.installed.fresh"> — сервер молчит</template></span>
              <span v-if="it.outdated" class="adm-badge adm-badge--warn">есть {{ it.latest.version }} — обновите</span>
            </template>
            <template v-else>
              <span class="adm-dot" /><span class="it-muted">На сервере не найден</span>
            </template>
          </div>

          <div class="it-card__paths adm-mono">
            <span>{{ it.install_as }}</span>
            <span v-if="it.config_path">{{ it.config_path }}</span>
          </div>

          <div v-if="it.needs?.length" class="it-card__needs">
            <span class="it-muted">Нужны:</span>
            <a v-for="n in it.needs" :key="n" class="it-dep" :href="thirdParty[n]?.url" target="_blank" rel="noopener">
              {{ thirdParty[n]?.name || n }} {{ thirdParty[n]?.version }}
            </a>
          </div>

          <button v-if="it.releases?.length" class="it-versions-btn" @click="toggleVersions(it.key)">
            {{ openVersions.has(it.key) ? 'Скрыть версии' : `Все версии (${it.releases.length})` }}
          </button>
          <div v-if="openVersions.has(it.key)" class="it-versions">
            <div v-for="r in it.releases" :key="r.id" class="it-ver">
              <div class="it-ver__head">
                <b>{{ r.version }}</b>
                <span v-if="r.recommended" class="adm-badge adm-badge--ok">рекомендуем</span>
                <span class="it-muted">{{ fmtDate(r.published_at) }} · MC {{ r.mc_versions.join(', ') }} · {{ r.platforms.join(', ') }} · {{ fmtSize(r.size) }}</span>
                <button class="adm-btn adm-btn--sm it-ver__dl" :disabled="busy === `r:${r.id}`" @click="dl(it, r)">{{ r.filename }}</button>
              </div>
              <div v-if="r.changelog" class="it-ver__log">{{ r.changelog }}</div>
              <div class="it-ver__sha adm-mono" title="Контрольная сумма SHA-256 файла">sha256 {{ r.sha256 }}</div>
            </div>
          </div>
          <div v-else-if="!it.releases?.length" class="it-muted it-small">Сборок пока нет.</div>
        </article>
      </div>

      <!-- Частые вопросы -->
      <section class="adm-card it-faq">
        <div class="adm-card__head"><div class="adm-card__title">Частые вопросы</div></div>
        <dl>
          <dt>Что такое секрет сервера?</dt>
          <dd>Пароль, по которому бэкенд VoidRP узнаёт ваш сервер. Он вписан в конфиги. Если файл утёк, попросите владельца проекта перевыпустить секрет в «Серверах» и скачайте конфиги заново.</dd>
          <dt>Нужен ли online-mode?</dt>
          <dd>Нет: игроки VoidRP играют без лицензии, и VoidRpAuth проверяет каждого по аккаунту. Без VoidRpAuth в offline-mode любой может зайти под чужим ником.</dd>
          <dt>Как обновить плагин?</dt>
          <dd>Скачайте новую версию, замените jar в <code>plugins</code> и перезапустите сервер. Конфиг менять не нужно.</dd>
          <dt>Пункт не становится зелёным</dt>
          <dd>Проверьте строки плагина в логе сервера: «HTTP 401» — неверный секрет в конфиге, «ConnectException» — сервер не может достучаться до api.void-rp.ru (разрешите исходящие соединения на порт 443).</dd>
        </dl>
      </section>
    </template>
  </div>
</template>

<style scoped>
.it-muted { color: var(--adm-dim); font-size: 0.8rem; }
.it-small { margin-top: 0.4rem; }
.it-banner {
  display: flex; align-items: center; gap: 0.6rem; padding: 0.75rem 0.95rem; margin-bottom: 1rem;
  border: 1px solid var(--adm-line); border-radius: var(--adm-r); background: var(--adm-card);
  font-size: 0.88rem; color: var(--adm-text);
}
.it-banner > span:last-child { flex: 1 1 18rem; min-width: 0; }
.it-banner--ok { border-color: color-mix(in srgb, var(--adm-ok) 45%, transparent); }
.it-banner--err { border-color: color-mix(in srgb, var(--adm-err) 50%, transparent); }
.it-banner--warn { border-color: color-mix(in srgb, var(--adm-warn) 45%, transparent); }

.it-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 1rem; margin-bottom: 1rem; }
@media (max-width: 1000px) { .it-grid { grid-template-columns: minmax(0, 1fr); } }

.it-steplist { list-style: none; margin: 0; padding: 0.25rem 1rem 1rem; display: flex; flex-direction: column; gap: 0.2rem; }
.it-step { display: flex; gap: 0.75rem; padding: 0.6rem 0; border-bottom: 1px solid var(--adm-line); }
.it-step:last-child { border-bottom: 0; }
.it-step__num {
  flex-shrink: 0; width: 1.7rem; height: 1.7rem; border-radius: 999px; display: grid; place-items: center;
  font-size: 0.8rem; font-weight: 800; background: var(--adm-card-2); color: var(--adm-dim); border: 1px solid var(--adm-line);
}
.it-step--ok .it-step__num { background: color-mix(in srgb, var(--adm-ok) 18%, transparent); color: var(--adm-ok); border-color: color-mix(in srgb, var(--adm-ok) 45%, transparent); }
.it-step--opt { opacity: 0.8; }
.it-step__title { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; font-weight: 700; color: var(--adm-text); }
.it-step__text { margin-top: 0.15rem; font-size: 0.84rem; color: var(--adm-dim); }

.it-howto__list { margin: 0; padding: 0.25rem 1.2rem 0.5rem 2.4rem; display: flex; flex-direction: column; gap: 0.45rem; font-size: 0.86rem; color: var(--adm-text); }
.it-howto code, .it-faq code { font-family: var(--adm-mono); font-size: 0.8em; background: var(--adm-card-2); padding: 0.05rem 0.3rem; border-radius: 4px; }
.it-note { margin: 0 1rem 1rem; font-size: 0.8rem; color: var(--adm-dim); }

.it-h2 { font-size: 1.05rem; font-weight: 800; color: var(--adm-text); margin: 1.4rem 0 0.7rem; }
.it-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 420px), 1fr)); gap: 1rem; }
.it-card { padding: 1rem; display: flex; flex-direction: column; gap: 0.6rem; }
.it-card--req { border-color: var(--adm-acc-line); }
.it-card__head { display: flex; justify-content: space-between; gap: 0.75rem; align-items: flex-start; flex-wrap: wrap; }
.it-card__name { display: flex; align-items: center; gap: 0.45rem; font-size: 1.05rem; font-weight: 800; color: var(--adm-text); }
.it-card__mods { font-size: 0.76rem; color: var(--adm-dim); margin-top: 0.1rem; }
.it-card__actions { display: flex; gap: 0.4rem; flex-wrap: wrap; }
.it-card__summary { margin: 0; font-size: 0.86rem; color: var(--adm-text); line-height: 1.45; }
.it-card__state { display: flex; flex-wrap: wrap; align-items: center; gap: 0.45rem; font-size: 0.84rem; color: var(--adm-text); }
.it-card__paths { display: flex; flex-wrap: wrap; gap: 0.3rem 0.9rem; font-size: 0.74rem; color: var(--adm-dim); }
.it-card__needs { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; }
.it-dep {
  font-size: 0.76rem; padding: 0.15rem 0.5rem; border-radius: 999px; border: 1px solid var(--adm-line);
  color: var(--adm-acc-text); text-decoration: none; background: var(--adm-card-2);
}
.it-dep:hover { border-color: var(--adm-acc-line); }
.it-versions-btn { align-self: flex-start; border: 0; background: none; padding: 0; color: var(--adm-acc-text); font-size: 0.8rem; cursor: pointer; }
.it-versions { display: flex; flex-direction: column; gap: 0.5rem; border-top: 1px solid var(--adm-line); padding-top: 0.6rem; }
.it-ver__head { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; font-size: 0.84rem; color: var(--adm-text); }
.it-ver__dl { margin-left: auto; }
.it-ver__log { font-size: 0.82rem; color: var(--adm-text); margin-top: 0.2rem; }
.it-ver__sha { font-size: 0.7rem; color: var(--adm-faint); word-break: break-all; margin-top: 0.15rem; }

.it-faq { margin-top: 1rem; }
.it-faq dl { margin: 0; padding: 0 1rem 1rem; }
.it-faq dt { font-weight: 700; color: var(--adm-text); margin-top: 0.75rem; font-size: 0.9rem; }
.it-faq dd { margin: 0.2rem 0 0; color: var(--adm-dim); font-size: 0.86rem; line-height: 1.45; }
</style>
