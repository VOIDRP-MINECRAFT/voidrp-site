<script setup>
// «Установка»: мастер подключения по шагам — ядро → установка (командой, архивом или вручную)
// → живая проверка отчётов → готово. Шаги отмечаются сами по отчётам плагинов.
import { computed, ref, watch } from 'vue'
import { toastError, toastSuccess } from '../../../services/toast'
import { downloadBundle, downloadConfig, downloadRelease, issueInstallToken } from '../../../services/integrationApi'
import { copyText } from './util'

const props = defineProps({
  data: { type: Object, required: true },
  now: { type: Number, required: true },
  canConfig: { type: Boolean, default: false },
})

const server = computed(() => props.data.server || {})
const required = computed(() => props.data.required || [])
const requiredOk = computed(() => required.value.length > 0 && required.value.every((r) => r.ok))
const ours = computed(() => (props.data.items || []).filter((i) => i.kind === 'ours' && !i.client_side))
const thirdParty = computed(() => Object.fromEntries((props.data.items || []).filter((i) => i.kind === 'third_party').map((i) => [i.key, i])))
const anyInstalled = computed(() => ours.value.some((i) => i.installed))

const steps = computed(() => [
  { key: 'core', title: 'Ядро сервера', done: !!server.value.server_core },
  { key: 'install', title: 'Установка', done: anyInstalled.value },
  { key: 'check', title: 'Проверка', done: requiredOk.value },
  { key: 'ready', title: 'Готово', done: requiredOk.value && (!server.value.is_external || (!server.value.maintenance && server.value.is_visible)) },
])
const firstOpen = computed(() => steps.value.find((s) => !s.done)?.key || 'ready')
const step = ref(firstOpen.value)
// Следуем за прогрессом, пока человек сам не выбрал шаг.
const picked = ref(false)
watch(firstOpen, (k) => { if (!picked.value) step.value = k })
function pick(k) { step.value = k; picked.value = true }

const method = ref('cmd')
const busy = ref('')
const install = ref(null)
async function getInstall() {
  busy.value = 'install'
  try { install.value = await issueInstallToken() } catch (e) { toastError(e?.message || 'Не удалось получить команду') } finally { busy.value = '' }
}
const installLeft = computed(() => {
  if (!install.value) return ''
  const s = Math.max(0, Math.round((new Date(install.value.expires_at).getTime() - props.now) / 1000))
  return s > 0 ? `действует ещё ${Math.ceil(s / 60)} мин` : 'устарела — получите новую'
})
async function zip() {
  busy.value = 'zip'
  try { await downloadBundle(server.value.slug); toastSuccess('Архив скачан — распакуйте его в папку сервера') } catch (e) { toastError(e?.message || 'Не удалось собрать архив') } finally { busy.value = '' }
}
async function dl(r) {
  busy.value = `r:${r.id}`
  try { await downloadRelease(r.id, r.filename) } catch (e) { toastError(e?.message || 'Не удалось скачать') } finally { busy.value = '' }
}
async function cfg(it) {
  busy.value = `c:${it.key}`
  try {
    await downloadConfig(it.key, it.config_path.split('/').pop())
    toastSuccess(`Конфиг ${it.name} скачан — положите его в ${it.config_path}`)
  } catch (e) { toastError(e?.message || 'Не удалось скачать конфиг') } finally { busy.value = '' }
}
const folder = computed(() => (server.value.auth_method === 'mod' ? 'mods' : 'plugins'))
</script>

<template>
  <div class="in">
    <!-- Шаги -->
    <ol class="in-steps">
      <li v-for="(s, i) in steps" :key="s.key" class="in-step" :class="{ 'in-step--done': s.done, 'in-step--cur': step === s.key }" @click="pick(s.key)">
        <span class="in-step__num">{{ s.done ? '✓' : i + 1 }}</span>
        <span class="in-step__title">{{ s.title }}</span>
      </li>
    </ol>

    <!-- 1. Ядро -->
    <section v-if="step === 'core'" class="adm-card in-pane">
      <h3 class="in-h">Ядро и версия</h3>
      <template v-if="server.server_core">
        <p>Сервер: <b>{{ server.core_label }}</b><template v-if="server.core_reported">, сам он сообщает: <code>{{ server.core_reported }}</code></template>.</p>
        <p class="in-muted">{{ server.auth_method === 'mod' ? 'Сервер на модах: вход через мод voidrp-auth-bridge, он же стоит у игроков в паке.' : 'Сервер на плагинах: вход через VoidRpAuth, мониторинг и права — через VoidRpPerms.' }}</p>
        <button class="adm-btn adm-btn--acc adm-btn--sm" @click="pick('install')">Дальше — установка</button>
      </template>
      <p v-else>Ядро сервера ещё не указано. Владелец проекта задаёт его в разделе «Серверы» (Paper, Folia, NeoForge…) — от этого зависит, какие плагины ставить.</p>
    </section>

    <!-- 2. Установка -->
    <section v-else-if="step === 'install'" class="in-pane-wrap">
      <div class="in-methods">
        <button class="in-method" :class="{ 'in-method--on': method === 'cmd' }" @click="method = 'cmd'">
          <span class="in-method__title">Одной командой</span>
          <span class="in-method__sub">Есть консоль Linux. Рекомендуем.</span>
        </button>
        <button class="in-method" :class="{ 'in-method--on': method === 'zip' }" @click="method = 'zip'">
          <span class="in-method__title">Архивом</span>
          <span class="in-method__sub">Только веб-панель хостинга.</span>
        </button>
        <button class="in-method" :class="{ 'in-method--on': method === 'manual' }" @click="method = 'manual'">
          <span class="in-method__title">Вручную</span>
          <span class="in-method__sub">Скачать файлы по одному.</span>
        </button>
      </div>

      <section v-if="method === 'cmd'" class="adm-card in-pane">
        <h3 class="in-h">Установка одной командой</h3>
        <p class="in-muted">Выполните в папке сервера (где лежит <code>server.properties</code>). Скрипт проверит Java и связь с VoidRP, поставит наши плагины и нужные им (LuckPerms и другие) с проверкой контрольных сумм, запишет конфиги с секретом и сохранит заменённые файлы в <code>voidrp-backup/</code>. На работающем сервере плагины встанут при перезапуске.</p>
        <template v-if="canConfig">
          <button v-if="!install" class="adm-btn adm-btn--acc" :disabled="busy === 'install'" @click="getInstall">{{ busy === 'install' ? 'Готовлю…' : 'Получить команду' }}</button>
          <template v-else>
            <div class="in-cmd"><code>{{ install.command }}</code><button class="adm-btn adm-btn--sm" @click="copyText(install.command)">Копировать</button></div>
            <div class="in-cmd"><code>{{ install.command_all }}</code><button class="adm-btn adm-btn--sm" @click="copyText(install.command_all)">Копировать</button></div>
            <p class="in-muted">Вторая — вместе с античитом (VoidRpGuard, GrimAC, CoreProtect). Ссылка одноразовая, {{ installLeft }}; она даёт секрет сервера — не пересылайте её.</p>
          </template>
          <p class="in-muted in-small">Понадобится пароль от аккаунта: команда содержит доступ к секрету сервера.</p>
        </template>
        <p v-else class="in-note">Команду получают те, у кого есть право «Интеграция: скачивать готовые конфиги». Его выдаёт владелец проекта.</p>
      </section>

      <section v-else-if="method === 'zip'" class="adm-card in-pane">
        <h3 class="in-h">Установка архивом</h3>
        <ol class="in-ol">
          <li>Скачайте архив — в нём наши плагины, нужные им сторонние плагины и конфиги с секретом.</li>
          <li>Остановите сервер и распакуйте архив в его папку (там, где <code>server.properties</code>) с заменой файлов — через файловый менеджер панели хостинга.</li>
          <li>Если в <code>{{ folder }}/</code> уже были старые версии этих плагинов под другими именами — удалите их.</li>
          <li>Запустите сервер.</li>
        </ol>
        <button v-if="canConfig" class="adm-btn adm-btn--acc" :disabled="busy === 'zip'" @click="zip">{{ busy === 'zip' ? 'Собираю архив…' : 'Скачать архив' }}</button>
        <p v-else class="in-note">Архив с конфигами скачивают те, у кого есть право «Интеграция: скачивать готовые конфиги».</p>
      </section>

      <section v-else class="adm-card in-pane">
        <h3 class="in-h">Вручную</h3>
        <ol class="in-ol">
          <li>Остановите сервер.</li>
          <li>Скачайте плагины ниже и положите их в <code>{{ folder }}/</code>. Туда же — сторонние плагины по ссылкам.</li>
          <li>Скачайте конфиги и положите по указанным путям — секрет и адрес уже вписаны.</li>
          <li>Запустите сервер.</li>
        </ol>
        <div class="in-files">
          <div v-for="it in ours.filter((i) => i.required || i.installed)" :key="it.key" class="in-file">
            <div class="in-file__name">{{ it.name }} <span class="adm-badge" :class="it.required ? 'adm-badge--acc' : ''">{{ it.required ? 'обязательный' : 'по желанию' }}</span></div>
            <div class="in-file__acts">
              <button v-if="it.latest" class="adm-btn adm-btn--sm" :disabled="busy === `r:${it.latest.id}`" @click="dl(it.latest)">{{ it.latest.filename }} · {{ it.latest.version }}</button>
              <span v-else class="in-muted">сборки нет</span>
              <button v-if="it.has_config && canConfig" class="adm-btn adm-btn--sm" :disabled="busy === `c:${it.key}`" @click="cfg(it)">Конфиг → {{ it.config_path }}</button>
            </div>
            <div v-if="it.needs?.length" class="in-file__deps">
              Нужны: <a v-for="n in it.needs.filter((x) => thirdParty[x])" :key="n" :href="thirdParty[n].url" target="_blank" rel="noopener">{{ thirdParty[n].name }} {{ thirdParty[n].version }}</a>
            </div>
          </div>
        </div>
      </section>
      <div class="in-next"><button class="adm-btn adm-btn--acc adm-btn--sm" @click="pick('check')">Установил — проверить</button></div>
    </section>

    <!-- 3. Проверка -->
    <section v-else-if="step === 'check'" class="adm-card in-pane">
      <h3 class="in-h">Проверка подключения</h3>
      <p class="in-muted">Страница обновляется сама. После запуска сервера отчёты приходят меньше чем через минуту.</p>
      <ul class="in-checks">
        <li v-for="r in required" :key="r.key" class="in-check" :class="r.ok ? 'in-check--ok' : 'in-check--wait'">
          <span class="in-check__mark">{{ r.ok ? '✓' : '' }}</span>
          <div>
            <div class="in-check__title">{{ r.label }}</div>
            <div class="in-muted">{{ r.ok ? `Работает: ${r.plugin} ${r.version || ''}` : 'Ждём отчёт от сервера…' }}</div>
          </div>
        </li>
      </ul>
      <details v-if="!requiredOk" class="in-help">
        <summary>Долго не становится зелёным?</summary>
        <ul>
          <li>Посмотрите строки плагина в логе: «HTTP 401» — неверный секрет в конфиге, «ConnectException» — сервер не достучался до {{ data.api_url }} (откройте исходящий 443).</li>
          <li>Запустите проверку сервера (вкладка «Сервер») — она найдёт частые причины и покажет отчёт здесь.</li>
          <li>VoidRpPerms должен быть 0.4.0 или новее, VoidRpAuth — 1.2.0 или новее.</li>
        </ul>
      </details>
      <button v-if="requiredOk" class="adm-btn adm-btn--acc adm-btn--sm" @click="pick('ready')">Дальше</button>
    </section>

    <!-- 4. Готово -->
    <section v-else class="adm-card in-pane in-ready">
      <template v-if="requiredOk">
        <div class="in-ready__icon">✓</div>
        <h3 class="in-h">Сервер подключён к VoidRP</h3>
        <p v-if="server.is_external && (server.maintenance || !server.is_visible)" class="in-muted">Обязательные модули работают — владелец проекта может снять техработы и показать сервер в лаунчере.</p>
        <p v-else class="in-muted">Игроки входят через аккаунт VoidRP, мониторинг и права работают из админки.</p>
        <p class="in-muted">Дальше: включите автообновление и уведомления в Telegram — вкладка «Обновления».</p>
      </template>
      <template v-else>
        <h3 class="in-h">Ещё не всё</h3>
        <p class="in-muted">Не работают: {{ required.filter((r) => !r.ok).map((r) => r.label).join('; ') }}.</p>
        <button class="adm-btn adm-btn--sm" @click="pick('check')">К проверке</button>
      </template>
    </section>

    <!-- Вопросы -->
    <section class="adm-card in-faq">
      <div class="adm-card__head"><div class="adm-card__title">Частые вопросы</div></div>
      <dl>
        <dt>Что такое секрет сервера?</dt>
        <dd>Пароль, по которому VoidRP узнаёт ваш сервер; он вписан в конфиги. Если файл утёк — владелец проекта сменит секрет в «Серверах» (сразу или плавно, без простоя).</dd>
        <dt>Нужен ли online-mode?</dt>
        <dd>Нет, нужен <code>online-mode=false</code>: игроки VoidRP играют без лицензии, а VoidRpAuth проверяет каждого по аккаунту.</dd>
        <dt>Как обновлять плагины?</dt>
        <dd>Проще всего — включить автообновление (вкладка «Обновления»). Вручную: положите новую версию в <code>plugins/update/</code> под тем же именем, что и старый jar, — Paper заменит его при перезапуске.</dd>
        <dt>У меня Pterodactyl / другая панель без консоли</dt>
        <dd>Выберите установку архивом: распакуйте его через файловый менеджер панели.</dd>
      </dl>
    </section>
  </div>
</template>

<style scoped>
.in { display: flex; flex-direction: column; gap: 1rem; }
.in-muted { color: var(--adm-dim); font-size: 0.84rem; line-height: 1.5; margin: 0; }
.in-small { font-size: 0.76rem; }
.in-note { margin: 0; font-size: 0.82rem; color: var(--adm-dim); }
.in code { font-family: var(--adm-mono); font-size: 0.8em; background: var(--adm-card-2); padding: 0.05rem 0.3rem; border-radius: 4px; }

.in-steps { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.5rem; counter-reset: s; }
@media (max-width: 640px) { .in-steps { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.in-step { display: flex; align-items: center; gap: 0.6rem; padding: 0.65rem 0.8rem; border-radius: var(--adm-r); border: 1px solid var(--adm-line); background: var(--adm-card); cursor: pointer; transition: border-color 0.15s; }
.in-step:hover { border-color: var(--adm-line-strong); }
.in-step__num { flex-shrink: 0; width: 1.8rem; height: 1.8rem; border-radius: 999px; display: grid; place-items: center; font-weight: 800; font-size: 0.85rem; background: var(--adm-card-2); color: var(--adm-dim); border: 1px solid var(--adm-line); }
.in-step__title { font-weight: 700; font-size: 0.86rem; color: var(--adm-text); }
.in-step--done .in-step__num { background: color-mix(in srgb, var(--adm-ok) 16%, transparent); color: var(--adm-ok); border-color: color-mix(in srgb, var(--adm-ok) 40%, transparent); }
.in-step--cur { border-color: var(--adm-acc-line); box-shadow: 0 0 0 1px var(--adm-acc-line) inset; }
.in-step--cur .in-step__num { background: var(--adm-acc-soft); color: var(--adm-acc-text); border-color: var(--adm-acc-line); }

.in-pane-wrap { display: flex; flex-direction: column; gap: 0.8rem; }
.in-pane { padding: 1.1rem 1.2rem; display: flex; flex-direction: column; gap: 0.7rem; align-items: flex-start; }
.in-pane p { margin: 0; color: var(--adm-text); font-size: 0.88rem; line-height: 1.5; }
.in-h { margin: 0; font-size: 1.02rem; font-weight: 800; color: var(--adm-text); }

.in-methods { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.6rem; }
@media (max-width: 640px) { .in-methods { grid-template-columns: minmax(0, 1fr); } }
.in-method { text-align: left; display: flex; flex-direction: column; gap: 0.2rem; padding: 0.8rem 0.9rem; border-radius: var(--adm-r); border: 1px solid var(--adm-line); background: var(--adm-card); cursor: pointer; color: var(--adm-text); }
.in-method:hover { border-color: var(--adm-line-strong); }
.in-method--on { border-color: var(--adm-acc-line); background: var(--adm-acc-soft); }
.in-method__title { font-weight: 800; font-size: 0.9rem; }
.in-method__sub { font-size: 0.78rem; color: var(--adm-dim); }

.in-cmd { display: flex; gap: 0.5rem; align-items: center; width: 100%; }
.in-cmd code { flex: 1; min-width: 0; overflow-x: auto; white-space: nowrap; padding: 0.55rem 0.7rem; border-radius: var(--adm-r-sm); background: var(--adm-card-2); border: 1px solid var(--adm-line); color: var(--adm-text); font-size: 0.8rem; }
.in-ol { margin: 0; padding-left: 1.3rem; display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.86rem; color: var(--adm-text); line-height: 1.5; }
.in-files { display: flex; flex-direction: column; gap: 0.5rem; width: 100%; }
.in-file { padding: 0.65rem 0.75rem; border-radius: var(--adm-r-sm); background: var(--adm-card-2); border: 1px solid var(--adm-line); display: flex; flex-direction: column; gap: 0.4rem; }
.in-file__name { font-weight: 700; color: var(--adm-text); display: flex; gap: 0.45rem; align-items: center; }
.in-file__acts { display: flex; gap: 0.4rem; flex-wrap: wrap; }
.in-file__deps { font-size: 0.78rem; color: var(--adm-dim); display: flex; gap: 0.5rem; flex-wrap: wrap; }
.in-file__deps a { color: var(--adm-acc-text); }
.in-next { display: flex; justify-content: flex-end; }

.in-checks { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; width: 100%; }
.in-check { display: flex; gap: 0.75rem; align-items: center; padding: 0.7rem 0.8rem; border-radius: var(--adm-r-sm); border: 1px solid var(--adm-line); background: var(--adm-card-2); }
.in-check__mark { flex-shrink: 0; width: 1.8rem; height: 1.8rem; border-radius: 999px; display: grid; place-items: center; font-weight: 800; }
.in-check--ok .in-check__mark { color: var(--adm-ok); background: color-mix(in srgb, var(--adm-ok) 16%, transparent); border: 1px solid color-mix(in srgb, var(--adm-ok) 40%, transparent); }
.in-check--wait .in-check__mark { border: 2px solid var(--adm-line-strong); border-top-color: var(--adm-acc); animation: in-spin 1s linear infinite; }
@keyframes in-spin { to { transform: rotate(360deg); } }
.in-check__title { font-weight: 700; font-size: 0.86rem; color: var(--adm-text); }
.in-help summary { cursor: pointer; font-size: 0.84rem; color: var(--adm-acc-text); }
.in-help ul { margin: 0.4rem 0 0; padding-left: 1.2rem; font-size: 0.83rem; color: var(--adm-dim); line-height: 1.5; }

.in-ready { align-items: center; text-align: center; padding: 1.6rem; }
.in-ready__icon { width: 3rem; height: 3rem; border-radius: 999px; display: grid; place-items: center; font-size: 1.3rem; font-weight: 800; color: var(--adm-ok); background: color-mix(in srgb, var(--adm-ok) 16%, transparent); border: 1px solid color-mix(in srgb, var(--adm-ok) 40%, transparent); }

.in-faq dl { margin: 0; padding: 0 1rem 1rem; }
.in-faq dt { font-weight: 700; color: var(--adm-text); margin-top: 0.75rem; font-size: 0.88rem; }
.in-faq dd { margin: 0.2rem 0 0; color: var(--adm-dim); font-size: 0.84rem; line-height: 1.5; }
</style>
