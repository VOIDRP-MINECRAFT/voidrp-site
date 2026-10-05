<script setup>
// «Интеграция» — что поставить на внешний сервер, чтобы он работал с VoidRP, и работает ли уже.
// Статусы — из отчётов наших плагинов (раз в 30 с). Вход и мониторинг обязательны: без них
// внешний сервер нельзя открыть игрокам.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { authState, hasPermission } from '../../stores/authStore'
import { toastError, toastSuccess } from '../../services/toast'
import {
  downloadBundle, downloadConfig, downloadRelease, getIntegration, getNotifyPrefs, issueInstallToken, listReleases,
  patchRelease, runSelftest, saveIntegrationSettings, saveNotifyPrefs, syncReleases,
} from '../../services/integrationApi'
import { confirmDialog } from '../../composables/useConfirm'

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
const apiHost = computed(() => { try { return new URL(data.value?.api_url).host } catch { return 'api.void-rp.ru' } })
const ours = computed(() => (data.value?.items || []).filter((i) => i.kind === 'ours'))
const thirdParty = computed(() => Object.fromEntries((data.value?.items || []).filter((i) => i.kind === 'third_party').map((i) => [i.key, i])))
const requiredOk = computed(() => (data.value?.required || []).every((r) => r.ok))
const moduleOf = (key) => {
  for (const r of data.value?.reports || []) {
    if (r.fresh && r.modules?.[key]?.ok) return r
  }
  return null
}
// Модуль, который плагин прислал выключенным, — с его объяснением почему.
const moduleOff = (key) => {
  for (const r of data.value?.reports || []) {
    const m = r.modules?.[key]
    if (r.fresh && m && !m.ok) return { plugin: r.plugin, detail: m.detail }
  }
  return null
}

// Чек-лист — настоящая последовательность подключения.
const steps = computed(() => {
  const d = data.value
  if (!d) return []
  const req = Object.fromEntries(d.required.map((r) => [r.key, r]))
  const perms = moduleOf('perms')
  const chat = moduleOf('chat')
  const chatOff = moduleOff('chat')
  const anticheat = moduleOf('anticheat')
  const grim = moduleOf('grim')
  const grimOff = moduleOff('grim')
  const consoleM = moduleOf('console')
  const consoleOff = moduleOff('console')
  const logM = moduleOf('log')
  const logOff = moduleOff('log')
  const punish = moduleOf('punishments')
  const punishOff = moduleOff('punishments')
  const itemBans = moduleOf('item_bans')
  const itemBansOff = moduleOff('item_bans')
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
      title: 'Права в игре',
      ok: !!perms,
      optional: true,
      text: perms ? `Работает: ${perms.plugin} ${perms.version || ''}. Группы и префиксы — в разделе «Права в игре».` : 'Тот же VoidRpPerms и LuckPerms. Права настраиваются в разделе «Права в игре».',
    },
    {
      title: 'Чат с префиксами',
      ok: !!chat,
      optional: true,
      warn: !chat && !!chatOff,
      text: chat ? `Работает: ${chat.plugin} ${chat.version || ''}` : chatOff ? `Выключен: ${chatOff.detail || 'без пояснения'}` : 'Делает VoidRpPerms 0.3.0+, если на сервере нет другого чат-плагина.',
    },
    {
      title: 'Консоль, лог и чат без RCON',
      ok: !!(consoleM && logM),
      optional: true,
      warn: !!(consoleOff || logOff),
      text: consoleM && logM
        ? `Работает: ${consoleM.plugin} ${consoleM.version || ''}. Консоль, лог и чат — в «Мониторинге»; RCON можно выключить.`
        : consoleOff || logOff
          ? `Выключено: ${(consoleOff || logOff).detail || 'без пояснения'}`
          : 'VoidRpPerms 0.5.0+: команды из админки идут через него, лог и чат сервера видны в «Мониторинге».',
    },
    {
      title: 'Баны и муты',
      ok: !!punish,
      optional: true,
      warn: !punish && !!punishOff,
      text: punish
        ? `Работает: ${punish.plugin} ${punish.version || ''}. Выдаются в «Наказаниях», EssentialsX не нужен.`
        : punishOff ? `Выключено: ${punishOff.detail || 'без пояснения'}` : 'VoidRpPerms 0.5.0+ держит баны и муты из «Наказаний» сам, без EssentialsX.',
    },
    {
      title: 'Бан предметов',
      ok: !!itemBans,
      optional: true,
      warn: !itemBans && !!itemBansOff,
      text: itemBans
        ? `Работает: ${itemBans.plugin} ${itemBans.version || ''}. ${server.value.item_bans_enabled ? 'Список — в разделе «Бан предметов».' : 'Раздел «Бан предметов» включает владелец в «Серверах».'}`
        : itemBansOff ? `Выключено: ${itemBansOff.detail || 'без пояснения'}` : 'VoidRpPerms 0.5.0+ удаляет у игроков предметы из списка «Бан предметов».',
    },
    {
      title: 'Античит',
      ok: !!anticheat,
      optional: true,
      warn: !!anticheat && !grim,
      text: anticheat
        ? `Работает: ${anticheat.plugin} ${anticheat.version || ''}${grim ? ' · GrimAC подключён' : ` · GrimAC: ${grimOff?.detail || 'не подключён — флаги движения и боя не пишутся'}`}`
        : 'По желанию: VoidRpGuard 0.2.0+ с GrimAC и CoreProtect.',
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

// ── Установка одной командой ──
const install = ref(null)
async function getInstall() {
  busy.value = 'install'
  try { install.value = await issueInstallToken() } catch (e) { toastError(e?.message || 'Не удалось получить команду') } finally { busy.value = '' }
}
const installLeft = computed(() => {
  if (!install.value) return ''
  const s = Math.max(0, Math.round((new Date(install.value.expires_at).getTime() - now.value) / 1000))
  return s > 0 ? `действует ещё ${Math.ceil(s / 60)} мин` : 'устарела — получите новую'
})
async function copy(text) {
  try { await navigator.clipboard.writeText(text); toastSuccess('Скопировано') } catch { toastError('Не удалось скопировать — выделите и скопируйте вручную') }
}
async function zip() {
  busy.value = 'zip'
  try { await downloadBundle(server.value.slug); toastSuccess('Архив скачан — распакуйте его в папку сервера') } catch (e) { toastError(e?.message || 'Не удалось собрать архив') } finally { busy.value = '' }
}

// ── Проверка связи, опись сервера, автообновление ──
const selftest = ref(null)
async function check() {
  busy.value = 'selftest'
  selftest.value = null
  try { selftest.value = (await runSelftest()).output || '(пустой ответ)' } catch (e) { toastError(e?.message || 'Сервер не ответил') } finally { busy.value = '' }
}
const inv = computed(() => data.value?.inventory || null)
const showPlugins = ref(false)
async function setAuto(patch) {
  busy.value = 'settings'
  try {
    await saveIntegrationSettings({ ...(data.value?.settings || {}), ...patch })
    await load(true)
    toastSuccess(patch.auto_update === false ? 'Автообновление выключено' : 'Сохранено')
  } catch (e) { toastError(e?.message || 'Не удалось сохранить') } finally { busy.value = '' }
}

// ── Уведомления в Telegram ──
const notify = ref(null)
const notifyBusy = ref(false)
async function loadNotify() {
  try { notify.value = await getNotifyPrefs() } catch { notify.value = null }
}
async function setNotify(patch) {
  if (!notify.value) return
  const prefs = { ...notify.value.prefs, ...patch }
  notifyBusy.value = true
  try {
    notify.value = { ...notify.value, ...(await saveNotifyPrefs(prefs)) }
    toastSuccess('Сохранено')
  } catch (e) { toastError(e?.message || 'Не удалось сохранить') } finally { notifyBusy.value = false }
}

// ── Релизы (админы платформы) ──
const isPlatformAdmin = computed(() => !!authState.user?.is_admin)
const rel = ref(null)
const relBusy = ref('')
async function loadReleases() {
  if (!isPlatformAdmin.value) return
  try { rel.value = await listReleases() } catch (e) { toastError(e?.message || 'Не удалось загрузить релизы') }
}
async function changeRelease(plugin, r, patch, ask) {
  if (ask && !(await confirmDialog(ask))) return
  relBusy.value = r.id
  try {
    await patchRelease(r.id, patch)
    await Promise.all([loadReleases(), load(true)])
  } catch (e) { toastError(e?.message || 'Не удалось изменить релиз') } finally { relBusy.value = '' }
}
const yankAsk = (plugin, r) => ({
  title: 'Отозвать сборку',
  message: `${plugin.name} ${r.version} пропадёт со страницы у всех серверов, и о ней никто не получит уведомлений. Вернуть можно здесь же.`,
  confirmLabel: 'Отозвать', danger: true,
})
async function syncNow() {
  relBusy.value = 'sync'
  try {
    const res = await syncReleases()
    toastSuccess(res.added?.length ? `Новые сборки: ${res.added.map((a) => `${a.plugin} ${a.version}`).join(', ')}` : 'Новых релизов на GitHub нет')
    await Promise.all([loadReleases(), load(true)])
  } catch (e) { toastError(e?.message || 'GitHub не ответил') } finally { relBusy.value = '' }
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
const MODULE_NAMES = {
  auth: 'вход', monitoring: 'мониторинг', perms: 'права', chat: 'чат', anticheat: 'античит', grim: 'GrimAC',
  console: 'консоль', log: 'лог и чат', item_bans: 'бан предметов', punishments: 'наказания',
}

let timer = null
onMounted(() => {
  load()
  loadNotify()
  loadReleases()
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
          <div class="adm-card__head">
            <div class="adm-card__title">Подключение</div>
            <span class="it-muted">обновляется само</span>
            <button class="adm-btn adm-btn--sm it-check" :disabled="busy === 'selftest'" @click="check">{{ busy === 'selftest' ? 'Спрашиваю сервер…' : 'Проверить связь' }}</button>
          </div>
          <pre v-if="selftest" class="it-selftest">{{ selftest }}</pre>
          <ol class="it-steplist">
            <li v-for="(s, i) in steps" :key="i" class="it-step" :class="{ 'it-step--ok': s.ok && !s.warn, 'it-step--warn': s.warn, 'it-step--opt': s.optional && !s.ok && !s.warn }">
              <span class="it-step__num">{{ s.warn ? '!' : s.ok ? '✓' : i + 1 }}</span>
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
            <li>Быстрее всего — командой из блока ниже. Вручную: остановите сервер.</li>
            <li>Скачайте ниже обязательные плагины и положите их в папку <code>plugins</code>. Туда же — LuckPerms нужной версии по ссылке.</li>
            <li>Скачайте готовые конфиги (кнопка «Конфиг», нужен пароль) и положите по указанным путям — секрет и адрес уже вписаны.</li>
            <li>Запустите сервер. В логе должны появиться <code>[VoidRpAuth] VoidRpAuth включён</code> и <code>[VoidRpPerms] Связь с админкой включена</code>.</li>
            <li>Меньше чем через минуту пункты «Вход» и «Мониторинг» слева станут зелёными.</li>
            <li>Выключите RCON (<code>enable-rcon=false</code>): консоль, мониторинг и наказания идут через VoidRpPerms.</li>
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

      <!-- Установка одной командой -->
      <section class="adm-card it-quick">
        <div class="adm-card__head"><div class="adm-card__title">Установка и обслуживание из консоли Linux</div></div>
        <div class="it-quick__body">
          <div class="it-quick__block">
            <div class="it-quick__label">Подключить сервер одной командой</div>
            <p class="it-muted">Выполните в папке сервера: скрипт проверит Java и связь, поставит наши плагины и нужные им (LuckPerms и др.) с проверкой контрольных сумм, запишет конфиги с секретом и сохранит старые файлы в <code>voidrp-backup/</code>. На работающем сервере плагины встанут при перезапуске.</p>
            <template v-if="canConfig">
              <button v-if="!install" class="adm-btn adm-btn--acc adm-btn--sm" :disabled="busy === 'install'" @click="getInstall">Получить команду (нужен пароль)</button>
              <template v-else>
                <div class="it-cmd"><code>{{ install.command }}</code><button class="adm-btn adm-btn--sm" @click="copy(install.command)">Копировать</button></div>
                <div class="it-cmd"><code>{{ install.command_all }}</code><button class="adm-btn adm-btn--sm" @click="copy(install.command_all)">Копировать</button></div>
                <p class="it-muted">Вторая — вместе с необязательными (античит). Ссылка одноразовая, {{ installLeft }}; внутри она даёт секрет сервера, не пересылайте её.</p>
              </template>
            </template>
            <p v-else class="it-muted">Команду получают те, у кого есть право «Интеграция: скачивать готовые конфиги».</p>
          </div>
          <div class="it-quick__block">
            <div class="it-quick__label">Обновить наши плагины</div>
            <p class="it-muted">Берёт секрет из конфига плагина — ссылка не нужна, можно поставить в cron. С <code>--dry-run</code> только покажет, что обновится.</p>
            <div class="it-cmd"><code>{{ data.scripts?.update }}</code><button class="adm-btn adm-btn--sm" @click="copy(data.scripts?.update)">Копировать</button></div>
          </div>
          <div class="it-quick__block">
            <div class="it-quick__label">Проверить сервер</div>
            <p class="it-muted">Java, DNS, связь с API, часы, открытый наружу RCON, версии плагинов и мешающие плагины (AuthMe, SkinsRestorer…). С <code>--send</code> отчёт появится здесь.</p>
            <div class="it-cmd"><code>{{ data.scripts?.doctor }}</code><button class="adm-btn adm-btn--sm" @click="copy(data.scripts?.doctor)">Копировать</button></div>
            <details v-if="data.doctor" class="it-doctor">
              <summary>Последний отчёт · {{ ago(data.doctor.at) }}</summary>
              <pre>{{ data.doctor.text }}</pre>
            </details>
          </div>
          <div v-if="canConfig" class="it-quick__block">
            <div class="it-quick__label">Автообновление</div>
            <p class="it-muted">VoidRpPerms 0.6.0+ сам скачивает новые сборки наших плагинов (и проверенные версии LuckPerms, GrimAC…) в <code>plugins/update/</code>, проверяет контрольные суммы — новая версия встаёт при следующем перезапуске. Ничего не перезагружается на ходу.</p>
            <label class="adm-check"><input type="checkbox" :checked="data.settings?.auto_update" :disabled="busy === 'settings'" @change="setAuto({ auto_update: $event.target.checked })" /> Обновлять наши плагины сами</label>
            <label v-if="data.settings?.auto_update" class="adm-check"><input type="checkbox" :checked="data.settings?.beta" :disabled="busy === 'settings'" @change="setAuto({ beta: $event.target.checked })" /> Брать и бета-сборки</label>
          </div>
          <div v-if="canConfig" class="it-quick__block">
            <div class="it-quick__label">Нет консоли, только веб-панель хостинга?</div>
            <p class="it-muted">Скачайте всё одним архивом (плагины, зависимости, конфиги) и распакуйте его в папку сервера через файловый менеджер панели.</p>
            <button class="adm-btn adm-btn--sm" :disabled="busy === 'zip'" @click="zip">{{ busy === 'zip' ? 'Собираю…' : 'Скачать архив' }}</button>
          </div>
        </div>
      </section>

      <!-- Что стоит на сервере -->
      <section v-if="inv" class="adm-card it-inv">
        <div class="adm-card__head"><div class="adm-card__title">Что стоит на сервере</div><span class="it-muted">по отчёту VoidRpPerms · {{ ago(inv.at) }} · Java {{ inv.java }}</span></div>
        <div class="it-inv__body">
          <div v-if="!inv.issues.length" class="it-inv__ok"><span class="adm-dot adm-dot--ok" /> Конфликтов и недостающих плагинов не видно.</div>
          <div v-for="(x, i) in inv.issues" :key="i" class="it-inv__issue" :class="`it-inv__issue--${x.level}`">
            <span class="adm-dot" :class="x.level === 'err' ? 'adm-dot--err' : x.level === 'warn' ? 'adm-dot--warn' : ''" /><span>{{ x.text }}</span>
          </div>
          <button class="it-versions-btn" @click="showPlugins = !showPlugins">{{ showPlugins ? 'Скрыть плагины' : `Все плагины (${inv.plugins.length})` }}</button>
          <div v-if="showPlugins" class="it-inv__list">
            <span v-for="p in inv.plugins" :key="p.name" class="it-inv__plugin" :class="{ 'it-inv__plugin--off': !p.enabled }" :title="p.file">{{ p.name }} <b>{{ p.version }}</b></span>
          </div>
        </div>
      </section>

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
              <span v-if="it.outdated" class="adm-badge" :class="it.changes_since_installed?.some((c) => c.important) ? 'adm-badge--err' : 'adm-badge--warn'">есть {{ it.latest.version }} — обновите</span>
            </template>
            <template v-else>
              <span class="adm-dot" /><span class="it-muted">На сервере не найден</span>
            </template>
          </div>

          <div v-if="it.outdated && it.changes_since_installed?.length" class="it-changes">
            <div class="it-changes__title">Что изменится при обновлении до {{ it.latest.version }}</div>
            <div v-for="c in it.changes_since_installed" :key="c.version" class="it-changes__item">
              <b>{{ c.version }}</b> <span v-if="c.important" class="adm-badge adm-badge--err">важное</span>
              <div v-if="c.changelog" class="it-ver__log">{{ c.changelog }}</div>
            </div>
          </div>

          <div class="it-card__paths adm-mono">
            <span v-if="it.client_side">клиентский пак: {{ it.install_as }}</span>
            <span v-else>{{ it.install_as }}</span>
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
                <span v-if="r.channel === 'beta'" class="adm-badge adm-badge--warn">бета</span>
                <span v-if="r.important" class="adm-badge adm-badge--err">важное</span>
                <a v-if="r.source_url" class="it-gh" :href="r.source_url" target="_blank" rel="noopener">GitHub</a>
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

      <!-- Уведомления в Telegram -->
      <section v-if="notify" class="adm-card it-notify">
        <div class="adm-card__head"><div class="adm-card__title">Уведомления в Telegram</div></div>
        <div class="it-notify__body">
          <p v-if="notify.platform_admin" class="it-muted">Вы админ платформы и видите все серверы — вам приходит плашка в админке, а сообщения в Telegram получают те, кто ведёт этот сервер.</p>
          <template v-else>
            <p v-if="notify.telegram_linked" class="it-notify__linked"><span class="adm-dot adm-dot--ok" /> Telegram привязан<template v-if="notify.telegram_username"> (@{{ notify.telegram_username }})</template>. @voidrp_bot напишет об обновлениях наших плагинов, которые подходят серверу, и о том, что сервер перестал отвечать.</p>
            <p v-else class="it-notify__linked"><span class="adm-dot adm-dot--warn" /> Telegram не привязан. Напишите <a href="https://t.me/voidrp_bot" target="_blank" rel="noopener">@voidrp_bot</a> команду /start и откройте ссылку из ответа — уведомления начнут приходить сами.</p>
            <div class="it-notify__row">
              <span>Обновления плагинов</span>
              <div class="adm-tabs">
                <button v-for="o in [['all', 'все'], ['important', 'только важные'], ['none', 'не присылать']]" :key="o[0]" class="adm-tab" :class="{ 'adm-tab--active': notify.prefs.releases === o[0] }" :disabled="notifyBusy" @click="setNotify({ releases: o[0] })">{{ o[1] }}</button>
              </div>
            </div>
            <label class="adm-check"><input type="checkbox" :checked="notify.prefs.beta" :disabled="notifyBusy" @change="setNotify({ beta: $event.target.checked })" /> Бета-сборки тоже</label>
            <label class="adm-check"><input type="checkbox" :checked="notify.prefs.health" :disabled="notifyBusy" @change="setNotify({ health: $event.target.checked })" /> Когда вход или мониторинг сервера перестали отвечать (и когда снова заработали)</label>
          </template>
        </div>
      </section>

      <!-- Релизы: админы платформы -->
      <section v-if="isPlatformAdmin && rel" class="adm-card it-rel">
        <div class="adm-card__head">
          <div class="adm-card__title">Релизы плагинов <span class="adm-badge">админы платформы</span></div>
          <button class="adm-btn adm-btn--sm" :disabled="relBusy === 'sync'" @click="syncNow">{{ relBusy === 'sync' ? 'Проверяю…' : 'Проверить GitHub сейчас' }}</button>
        </div>
        <p class="it-muted it-rel__hint">Новые релизы с GitHub приходят сами раз в 10 минут. Выпустить: <code>scripts/release_plugin.sh &lt;папка&gt; -m "что изменилось"</code> (с <code>--important</code> — важное). Стабильная сборка сразу становится рекомендуемой, и серверы со старой получают уведомление.</p>
        <div v-for="p in rel.plugins" :key="p.key" class="it-rel__plugin">
          <div class="it-rel__name">{{ p.name }} <a v-if="p.repo_url" class="it-gh" :href="p.repo_url" target="_blank" rel="noopener">{{ p.repo }}</a></div>
          <div v-if="!p.releases.length" class="it-muted">Сборок пока нет.</div>
          <div v-for="r in p.releases" :key="r.id" class="it-rel__row" :class="{ 'it-rel__row--yanked': r.yanked }">
            <b>{{ r.version }}</b>
            <span class="it-muted">MC {{ r.mc_versions.join(', ') }} · {{ r.platforms.join(', ') }} · {{ fmtDate(r.published_at) }} · {{ r.source === 'github' ? 'GitHub' : 'вручную' }}</span>
            <span v-if="r.recommended" class="adm-badge adm-badge--ok">рекомендуем</span>
            <span v-if="r.channel === 'beta'" class="adm-badge adm-badge--warn">бета</span>
            <span v-if="r.important" class="adm-badge adm-badge--err">важное</span>
            <span v-if="r.yanked" class="adm-badge">отозвана</span>
            <span class="it-rel__acts">
              <button v-if="!r.recommended && !r.yanked" class="adm-btn adm-btn--sm" :disabled="relBusy === r.id" @click="changeRelease(p, r, { recommended: true })">Рекомендовать</button>
              <button class="adm-btn adm-btn--sm" :disabled="relBusy === r.id" @click="changeRelease(p, r, { important: !r.important })">{{ r.important ? 'Не важное' : 'Важное' }}</button>
              <button v-if="!r.yanked" class="adm-btn adm-btn--sm adm-btn--danger" :disabled="relBusy === r.id" @click="changeRelease(p, r, { yanked: true }, yankAsk(p, r))">Отозвать</button>
              <button v-else class="adm-btn adm-btn--sm" :disabled="relBusy === r.id" @click="changeRelease(p, r, { yanked: false })">Вернуть</button>
            </span>
          </div>
        </div>
      </section>

      <!-- Частые вопросы -->
      <section class="adm-card it-faq">
        <div class="adm-card__head"><div class="adm-card__title">Частые вопросы</div></div>
        <dl>
          <dt>Что такое секрет сервера?</dt>
          <dd>Пароль, по которому бэкенд VoidRP узнаёт ваш сервер. Он вписан в конфиги. Если файл утёк, попросите владельца проекта перевыпустить секрет в «Серверах» и скачайте конфиги заново.</dd>
          <dt>Нужен ли online-mode?</dt>
          <dd>Нет: игроки VoidRP играют без лицензии, и VoidRpAuth проверяет каждого по аккаунту. Без VoidRpAuth в offline-mode любой может зайти под чужим ником.</dd>
          <dt>Как обновить плагин?</dt>
          <dd>Скачайте новую версию и положите её в <code>plugins/update/</code> под тем же именем, что и старый jar: Paper сам заменит его при следующем перезапуске. Конфиг менять не нужно — если в новой версии появились настройки, это будет написано в списке изменений. О новых версиях пишет @voidrp_bot, если привязан Telegram.</dd>
          <dt>Пункт не становится зелёным</dt>
          <dd>Проверьте строки плагина в логе сервера: «HTTP 401» — неверный секрет в конфиге, «ConnectException» — сервер не может достучаться до {{ apiHost }} (разрешите исходящие соединения на порт 443).</dd>
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
.it-step--warn .it-step__num { background: color-mix(in srgb, var(--adm-warn) 18%, transparent); color: var(--adm-warn); border-color: color-mix(in srgb, var(--adm-warn) 45%, transparent); }
.it-step__title { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; font-weight: 700; color: var(--adm-text); }
.it-step__text { margin-top: 0.15rem; font-size: 0.84rem; color: var(--adm-dim); }

.it-howto__list { list-style: decimal; margin: 0; padding: 0.25rem 1.2rem 0.5rem 2.4rem; display: flex; flex-direction: column; gap: 0.45rem; font-size: 0.86rem; color: var(--adm-text); }
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

.it-check { margin-left: auto; }
.it-selftest { margin: 0 1rem 0.5rem; padding: 0.6rem; font-family: var(--adm-mono); font-size: 0.74rem; background: var(--adm-card-2); border: 1px solid var(--adm-line); border-radius: var(--adm-r-sm); color: var(--adm-text); white-space: pre-wrap; }
.it-inv { margin-bottom: 1rem; }
.it-inv__body { padding: 0 1rem 1rem; display: flex; flex-direction: column; gap: 0.45rem; font-size: 0.85rem; color: var(--adm-text); }
.it-inv__ok, .it-inv__issue { display: flex; gap: 0.5rem; align-items: baseline; line-height: 1.45; }
.it-inv__list { display: flex; flex-wrap: wrap; gap: 0.35rem; }
.it-inv__plugin { font-size: 0.76rem; padding: 0.15rem 0.5rem; border-radius: 999px; border: 1px solid var(--adm-line); background: var(--adm-card-2); color: var(--adm-text); }
.it-inv__plugin--off { opacity: 0.5; text-decoration: line-through; }
.it-quick { margin-bottom: 1rem; }
.it-quick__body { padding: 0 1rem 1rem; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr)); gap: 1rem 1.4rem; }
.it-quick__block { display: flex; flex-direction: column; gap: 0.45rem; align-items: flex-start; }
.it-quick__label { font-weight: 700; color: var(--adm-text); font-size: 0.9rem; }
.it-quick__block p { margin: 0; line-height: 1.45; }
.it-quick code { font-family: var(--adm-mono); font-size: 0.78rem; }
.it-quick p code { background: var(--adm-card-2); padding: 0.05rem 0.3rem; border-radius: 4px; }
.it-cmd { display: flex; gap: 0.5rem; align-items: center; width: 100%; }
.it-cmd code { flex: 1; min-width: 0; overflow-x: auto; white-space: nowrap; padding: 0.45rem 0.6rem; border-radius: var(--adm-r-sm); background: var(--adm-card-2); border: 1px solid var(--adm-line); color: var(--adm-text); }
.it-doctor { width: 100%; }
.it-doctor summary { cursor: pointer; font-size: 0.82rem; color: var(--adm-acc-text); }
.it-doctor pre { margin: 0.4rem 0 0; padding: 0.6rem; max-height: 22rem; overflow: auto; font-family: var(--adm-mono); font-size: 0.74rem; background: var(--adm-card-2); border-radius: var(--adm-r-sm); color: var(--adm-text); white-space: pre-wrap; }
.it-changes { border: 1px solid color-mix(in srgb, var(--adm-warn) 35%, transparent); border-radius: var(--adm-r-sm); padding: 0.55rem 0.7rem; background: var(--adm-card-2); }
.it-changes__title { font-size: 0.8rem; font-weight: 700; color: var(--adm-text); margin-bottom: 0.3rem; }
.it-changes__item { font-size: 0.82rem; color: var(--adm-text); margin-top: 0.35rem; }
.it-ver__log { white-space: pre-line; }
.it-gh { font-size: 0.74rem; color: var(--adm-acc-text); text-decoration: none; }
.it-gh:hover { text-decoration: underline; }

.it-notify, .it-rel { margin-top: 1rem; }
.it-notify__body { padding: 0 1rem 1rem; display: flex; flex-direction: column; gap: 0.6rem; font-size: 0.86rem; color: var(--adm-text); }
.it-notify__body p { margin: 0; }
.it-notify__linked { display: flex; gap: 0.5rem; align-items: baseline; line-height: 1.45; }
.it-notify__linked a { color: var(--adm-acc-text); }
.it-notify__row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem; }
.it-rel__hint { padding: 0 1rem; margin: 0 0 0.5rem; line-height: 1.45; }
.it-rel__hint code { font-family: var(--adm-mono); font-size: 0.8em; background: var(--adm-card-2); padding: 0.05rem 0.3rem; border-radius: 4px; }
.it-rel__plugin { padding: 0.6rem 1rem; border-top: 1px solid var(--adm-line); }
.it-rel__name { font-weight: 800; color: var(--adm-text); display: flex; gap: 0.5rem; align-items: baseline; margin-bottom: 0.3rem; }
.it-rel__row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.45rem; padding: 0.3rem 0; font-size: 0.84rem; color: var(--adm-text); }
.it-rel__row--yanked { opacity: 0.55; }
.it-rel__acts { margin-left: auto; display: flex; gap: 0.35rem; flex-wrap: wrap; }

.it-faq { margin-top: 1rem; }
.it-faq dl { margin: 0; padding: 0 1rem 1rem; }
.it-faq dt { font-weight: 700; color: var(--adm-text); margin-top: 0.75rem; font-size: 0.9rem; }
.it-faq dd { margin: 0.2rem 0 0; color: var(--adm-dim); font-size: 0.86rem; line-height: 1.45; }
</style>
