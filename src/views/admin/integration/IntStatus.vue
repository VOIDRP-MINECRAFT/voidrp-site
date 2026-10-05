<script setup>
// «Статус»: публичная страница сервера, бейдж и виджет для сайта, Discord, форума.
import { computed, ref } from 'vue'
import { toastError, toastSuccess } from '../../../services/toast'
import { saveIntegrationSettings } from '../../../services/integrationApi'
import { copyText } from './util'

const props = defineProps({
  data: { type: Object, required: true },
  canConfig: { type: Boolean, default: false },
})
const emit = defineEmits(['reload'])

const page = computed(() => props.data.status_page || {})
const name = computed(() => props.data.server?.name || 'Сервер')
const busy = ref(false)
const theme = ref('dark')
const lang = ref('ru')
const widgetUrl = computed(() => `${page.value.url}?embed=1${theme.value === 'light' ? '&theme=light' : ''}${lang.value === 'en' ? '&lang=en' : ''}`)
const bust = ref(Date.now())

const MODES = [
  ['auto', 'Авто', 'открыт, пока сервер виден игрокам в каталоге'],
  ['on', 'Всегда', 'даже пока сервер скрыт или в техработах'],
  ['off', 'Выключен', 'страница, бейдж и JSON отвечают «закрыто»'],
]
async function setMode(mode) {
  busy.value = true
  try {
    await saveIntegrationSettings({ ...props.data.settings, public_status: mode === 'auto' ? 'auto' : mode === 'on' })
    emit('reload')
    bust.value = Date.now()
    toastSuccess('Сохранено')
  } catch (e) { toastError(e?.message || 'Не удалось сохранить') } finally { busy.value = false }
}

const codes = computed(() => [
  { key: 'link', title: 'Ссылка на страницу', hint: 'Для описания сервера, мониторингов, соцсетей.', code: page.value.url },
  { key: 'md', title: 'Бейдж — Markdown', hint: 'GitHub, Modrinth, README. Discord показывает картинку по ссылке на бейдж.', code: `[![${name.value}](${page.value.badge})](${page.value.url})` },
  { key: 'html', title: 'Бейдж — HTML', hint: 'Любой сайт или форум с HTML.', code: `<a href="${page.value.url}"><img src="${page.value.badge}" alt="${name.value}"></a>` },
  { key: 'bb', title: 'Бейдж — BBCode', hint: 'Форумы на phpBB, XenForo, IPB.', code: `[url=${page.value.url}][img]${page.value.badge}[/img][/url]` },
  { key: 'iframe', title: 'Виджет — iframe', hint: 'Карточка с онлайном и полосой за 30 дней, обновляется сама.', code: `<iframe src="${widgetUrl.value}" width="460" height="100" style="border:0;max-width:100%" loading="lazy" title="${name.value}"></iframe>` },
  { key: 'json', title: 'JSON для своего сайта', hint: 'Онлайн, TPS, доступность и сбои. Открыт для любых сайтов (CORS), кэш 30 секунд.', code: `fetch('${page.value.json}').then(r => r.json()).then(s => console.log(s.online, s.players, s.uptime_30d))` },
])
async function copy(c) {
  await copyText(c.code)
}
</script>

<template>
  <div class="ss">
    <section class="adm-card">
      <div class="adm-card__head">
        <div class="adm-card__title">Публичный статус</div>
        <span class="adm-badge" :class="page.on ? 'adm-badge--ok' : ''">{{ page.on ? 'открыт' : 'закрыт' }}</span>
      </div>
      <div class="ss-pad">
        <p class="ss-muted">
          Страница без входа: работает ли сервер, сколько игроков, доступность за сутки, неделю и месяц, сбои.
          Её можно дать игрокам, вставить на свой сайт и в Discord. Секретов и внутренностей на ней нет.
        </p>
        <div class="ss-modes" role="radiogroup" aria-label="Режим публичного статуса">
          <button v-for="m in MODES" :key="m[0]" role="radio" :aria-checked="page.mode === m[0]" class="ss-mode" :class="{ 'ss-mode--on': page.mode === m[0] }"
                  :disabled="!canConfig || busy" @click="setMode(m[0])">
            <b>{{ m[1] }}</b><span>{{ m[2] }}</span>
          </button>
        </div>
        <p v-if="!canConfig" class="ss-muted">Менять режим может тот, у кого есть право «Интеграция — настройка».</p>
        <a v-if="page.on" :href="page.url" target="_blank" rel="noopener" class="adm-btn adm-btn--primary ss-open">Открыть страницу ↗</a>
      </div>
    </section>

    <template v-if="page.on">
      <section class="adm-card">
        <div class="adm-card__head"><div class="adm-card__title">Как это выглядит</div></div>
        <div class="ss-pad ss-preview">
          <div>
            <div class="ss-label">Бейдж</div>
            <img :src="`${page.badge}?t=${bust}`" :alt="name" class="ss-badge" />
          </div>
          <div class="ss-widget">
            <div class="ss-label">
              Виджет
              <span class="adm-tabs ss-mini">
                <button class="adm-tab" :class="{ 'adm-tab--active': theme === 'dark' }" @click="theme = 'dark'">тёмный</button>
                <button class="adm-tab" :class="{ 'adm-tab--active': theme === 'light' }" @click="theme = 'light'">светлый</button>
              </span>
              <span class="adm-tabs ss-mini">
                <button class="adm-tab" :class="{ 'adm-tab--active': lang === 'ru' }" @click="lang = 'ru'">RU</button>
                <button class="adm-tab" :class="{ 'adm-tab--active': lang === 'en' }" @click="lang = 'en'">EN</button>
              </span>
            </div>
            <div class="ss-frame" :class="{ 'ss-frame--light': theme === 'light' }">
              <iframe :key="widgetUrl + bust" :src="widgetUrl" width="460" height="100" title="Виджет статуса" loading="lazy" />
            </div>
          </div>
        </div>
      </section>

      <section class="adm-card">
        <div class="adm-card__head"><div class="adm-card__title">Код для вставки</div></div>
        <ul class="ss-codes">
          <li v-for="c in codes" :key="c.key" class="ss-code">
            <div class="ss-code__head">
              <div>
                <div class="ss-code__title">{{ c.title }}</div>
                <div class="ss-muted">{{ c.hint }}</div>
              </div>
              <button class="adm-btn adm-btn--sm" @click="copy(c)">Копировать</button>
            </div>
            <code class="ss-code__text">{{ c.code }}</code>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<style scoped>
.ss { display: flex; flex-direction: column; gap: 1rem; }
.ss-pad { padding: 0 1rem 1rem; display: flex; flex-direction: column; gap: 0.8rem; }
.ss-muted { color: var(--adm-dim); font-size: 0.82rem; line-height: 1.45; margin: 0; }
.ss-modes { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: 0.5rem; }
.ss-mode { text-align: left; display: flex; flex-direction: column; gap: 0.2rem; padding: 0.7rem 0.85rem; border-radius: var(--adm-r-sm); border: 1px solid var(--adm-line); background: var(--adm-card-2); color: var(--adm-text); cursor: pointer; }
.ss-mode span { font-size: 0.76rem; color: var(--adm-dim); }
.ss-mode--on { border-color: var(--adm-acc-line); background: var(--adm-acc-soft); box-shadow: inset 0 0 0 1px var(--adm-acc-line); }
.ss-mode:disabled { cursor: default; opacity: 0.75; }
.ss-open { align-self: flex-start; }
.ss-preview { flex-direction: row; flex-wrap: wrap; gap: 1.5rem; align-items: flex-start; }
.ss-label { font-size: 0.75rem; font-weight: 700; color: var(--adm-faint); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.45rem; display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; }
.ss-mini { text-transform: none; letter-spacing: 0; }
.ss-badge { display: block; height: 22px; }
.ss-widget { flex: 1; min-width: 0; }
.ss-frame { padding: 0.8rem; border-radius: var(--adm-r-sm); background: #0a0d18; border: 1px solid var(--adm-line); max-width: 100%; overflow: hidden; }
.ss-frame--light { background: #f1f3f8; }
.ss-frame iframe { border: 0; display: block; max-width: 100%; }
.ss-codes { list-style: none; margin: 0; padding: 0 1rem 1rem; display: flex; flex-direction: column; gap: 0.6rem; }
.ss-code { padding: 0.7rem 0.8rem; border-radius: var(--adm-r-sm); background: var(--adm-card-2); border: 1px solid var(--adm-line); display: flex; flex-direction: column; gap: 0.45rem; }
.ss-code__head { display: flex; justify-content: space-between; gap: 0.8rem; align-items: flex-start; }
.ss-code__title { font-weight: 700; font-size: 0.86rem; color: var(--adm-text); }
.ss-code__text { font-size: 0.76rem; color: var(--adm-text); background: var(--adm-card); border: 1px solid var(--adm-line); border-radius: 6px; padding: 0.45rem 0.55rem; overflow-x: auto; white-space: nowrap; display: block; }
</style>
