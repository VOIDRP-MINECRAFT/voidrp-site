<script setup>
// Настройки одного сервера: вкладки слева, панель «Сохранить» снизу появляется, когда есть
// изменения. Вкладка — в адресе (?edit=<slug>&tab=…), так что ссылку можно переслать.
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { authState } from '../../../stores/authStore'
import { confirmDialog } from '../../../composables/useConfirm'
import { toastError, toastSuccess } from '../../../services/toast'
import { deleteServer, pingAddress, regenerateSecret, updateServer, uploadServerImage } from '../../../services/adminServersApi'
import SrvToggle from './SrvToggle.vue'
import SrvSeg from './SrvSeg.vue'
import {
  ACCENTS, CORE_LABELS, FEATURE_GROUPS, PLATFORM_FIELDS, TAB_FIELDS, VISIBILITY,
  address, buildPayload, changedKeys, clone, toForm, visibilityOf, visibilityPatch,
} from './shared'

const props = defineProps({
  server: { type: Object, required: true },
  status: { type: Object, default: null },
  platform: { type: Boolean, default: false },
  tab: { type: String, default: 'general' },
})
const emit = defineEmits(['close', 'saved', 'deleted', 'tab'])
const token = () => authState.accessToken

const form = reactive(toForm(props.server))
const base = ref(toForm(props.server))
const changed = computed(() => changedKeys(form, base.value))
const dirty = computed(() => changed.value.length > 0)
defineExpose({ dirty })

watch(() => props.server, (s) => {
  // A new row from the server (after save / image upload): rebase without losing edits elsewhere.
  const fresh = toForm(s)
  const edits = changedKeys(form, base.value)
  base.value = fresh
  for (const k of Object.keys(fresh)) if (!edits.includes(k)) form[k] = clone(fresh[k])
})

const TABS = computed(() => [
  { key: 'general', label: 'Основное' },
  { key: 'look', label: 'Оформление' },
  { key: 'connection', label: 'Подключение' },
  { key: 'pack', label: 'Сборка и лаунчер' },
  { key: 'features', label: 'Функции' },
  { key: 'channels', label: 'Новости и магазин' },
  { key: 'machine', label: form.is_external ? 'RCON и лог' : 'Машина', lock: !props.platform },
  { key: 'secret', label: 'Секрет и удаление' },
])
const tabDirty = (key) => (TAB_FIELDS[key] || []).some((f) => changed.value.includes(f))
const current = computed(() => (TABS.value.some((t) => t.key === props.tab) ? props.tab : 'general'))
const locked = (field) => !props.platform && PLATFORM_FIELDS.includes(field)

// ── Основное ──
const visibility = computed({
  get: () => visibilityOf(form),
  set: (m) => Object.assign(form, visibilityPatch(m)),
})
const ACCESS = [['public', 'Открытый'], ['whitelist', 'Вайтлист'], ['invite', 'По приглашению']]

// ── Оформление ──
const drag = ref('')
const uploading = ref('')
const iconInput = ref(null)
const bannerInput = ref(null)
async function upload(kind, file) {
  if (!file) return
  uploading.value = kind
  try {
    const updated = await uploadServerImage(token(), props.server.id, kind, file)
    toastSuccess(kind === 'icon' ? 'Иконка загружена' : 'Баннер загружен')
    emit('saved', updated, { quiet: true })
  } catch (e) {
    toastError(e?.message || 'Не удалось загрузить')
  } finally {
    uploading.value = ''
  }
}
function onDrop(kind, e) {
  drag.value = ''
  upload(kind, e.dataTransfer?.files?.[0])
}

// ── Подключение ──
const ping = ref(null)
const pinging = ref(false)
async function checkPing() {
  const host = (form.status_host || form.host || '').trim()
  const port = Number(form.status_port || form.port || 25565)
  if (!host) { toastError('Сначала укажите адрес'); return }
  pinging.value = true
  try {
    ping.value = { ...(await pingAddress(token(), host, port)), host, port }
  } catch (e) {
    ping.value = { online: false, error: e?.message, host, port }
  } finally {
    pinging.value = false
  }
}
const advancedConn = ref(!!(props.server.status_host || props.server.status_port))
const advancedPack = ref(false)

// ── Каналы ──
function addTg(cat) { form.news_channels[cat].telegram.push({ chat_id: '', thread_id: null }) }
function addDc(cat) { form.news_channels[cat].discord.push('') }

// ── Секрет ──
const showSecret = ref(false)
async function copy(text, what = 'Скопировано') {
  try { await navigator.clipboard.writeText(text); toastSuccess(what) } catch { toastError('Не удалось скопировать — выделите вручную') }
}
async function regen(mode) {
  const ok = await confirmDialog(mode === 'smooth'
    ? { title: 'Сменить секрет плавно', message: 'Старый секрет будет действовать ещё сутки. VoidRpPerms 0.6.2+ сам впишет новый в конфиги плагинов VoidRP; остальные подхватят его при перезапуске сервера. Админы сервера получат сообщение в Telegram.', confirmLabel: 'Сменить плавно' }
    : { title: 'Сменить секрет сразу', message: 'Старый секрет перестанет работать немедленно — плагины и моды сервера отключатся от VoidRP, пока в их конфиги не впишут новый. Так делают, если секрет утёк.', confirmLabel: 'Сменить сразу', danger: true })
  if (!ok) return
  try {
    const updated = await regenerateSecret(token(), props.server.id, mode)
    emit('saved', updated, { quiet: true })
    toastSuccess('Новый секрет создан')
  } catch (e) { toastError(e?.message || 'Не удалось сменить секрет') }
}
async function remove() {
  const ok = await confirmDialog({ title: 'Удалить сервер', message: `Удалить «${props.server.name}»? Все игровые данные этого сервера удалятся каскадно и безвозвратно.`, confirmLabel: 'Удалить навсегда', danger: true })
  if (!ok) return
  try {
    await deleteServer(token(), props.server.id)
    toastSuccess('Сервер удалён')
    base.value = toForm(form) // nothing left to guard
    emit('deleted')
  } catch (e) { toastError(e?.message || 'Не удалось удалить') }
}

// ── Сохранение ──
const saving = ref(false)
async function save() {
  if (!dirty.value || saving.value) return
  if (!form.name.trim()) { toastError('Укажите название'); emit('tab', 'general'); return }
  saving.value = true
  try {
    const p = buildPayload(form)
    const send = {}
    for (const k of changed.value) if (k in p) send[k] = p[k]
    if (changed.value.includes('easydonate_shop_key_clear')) send.easydonate_shop_key = form.easydonate_shop_key_clear ? '' : p.easydonate_shop_key
    delete send.slug
    delete send.game_auth_secret
    if (!props.platform) for (const k of PLATFORM_FIELDS) delete send[k]
    const updated = await updateServer(token(), props.server.id, send)
    base.value = toForm(updated)
    Object.assign(form, toForm(updated))
    toastSuccess('Сохранено')
    emit('saved', updated, { quiet: true })
  } catch (e) {
    toastError(e?.message || 'Не удалось сохранить')
  } finally {
    saving.value = false
  }
}
function reset() { Object.assign(form, clone(base.value)) }
function onKey(e) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save() }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

const stateChip = computed(() => {
  if (form.maintenance) return { cls: 'maint', text: 'техработы' }
  if (!props.status) return { cls: 'unknown', text: 'проверяем…' }
  return props.status.online ? { cls: 'up', text: `онлайн ${props.status.players_online}/${props.status.players_max}` } : { cls: 'down', text: 'офлайн' }
})
const FIELD_NAMES = {
  name: 'название', description: 'описание', sort_order: 'порядок', is_visible: 'видимость', staff_only: 'видимость', whitelist_mode: 'доступ',
  max_players: 'макс. игроков', maintenance: 'техработы', is_default: 'по умолчанию', accent_color: 'цвет', host: 'адрес', port: 'порт',
  mc_version: 'версия MC', loader: 'загрузчик', java_version: 'Java', neoforge_version: 'NeoForge', server_core: 'ядро', is_external: 'внешний',
  ticket_hostname: 'пропуск в адресе', status_host: 'адрес статуса', status_port: 'порт статуса', features: 'функции', map_url: 'карта',
  news_channels: 'каналы новостей', easydonate_server_id: 'EasyDonate', easydonate_shop_key: 'ключ магазина', easydonate_shop_key_clear: 'ключ магазина',
}
const changedLabel = computed(() => {
  const names = [...new Set(changed.value.map((k) => FIELD_NAMES[k] || k))]
  return names.length <= 3 ? names.join(', ') : `${names.slice(0, 3).join(', ')} и ещё ${names.length - 3}`
})
</script>

<template>
  <div class="ed">
    <!-- Шапка -->
    <header class="ed-head" :style="form.accent_color ? { '--ed-acc': form.accent_color } : null">
      <button type="button" class="adm-btn adm-btn--sm adm-btn--ghost ed-back" @click="emit('close')">← Все серверы</button>
      <div class="ed-head__id">
        <img v-if="form.icon_url" :src="form.icon_url" alt="" class="ed-head__icon" />
        <div v-else class="ed-head__icon ed-head__icon--ph">{{ (form.name || '?').charAt(0) }}</div>
        <div class="ed-head__text">
          <h1 class="ed-head__name">{{ form.name || 'Без названия' }}</h1>
          <div class="ed-head__meta">
            <span class="ed-state" :class="`ed-state--${stateChip.cls}`"><i />{{ stateChip.text }}</span>
            <code>{{ server.slug }}</code>
            <span v-if="address(form)" class="ed-head__addr">{{ address(form) }}</span>
          </div>
        </div>
      </div>
      <a :href="`/status/${server.slug}`" target="_blank" rel="noopener" class="adm-btn adm-btn--sm">Статус ↗</a>
    </header>

    <div class="ed-body">
      <nav class="ed-nav" aria-label="Разделы настроек">
        <button v-for="t in TABS" :key="t.key" type="button" class="ed-nav__item" :class="{ 'ed-nav__item--on': current === t.key }" @click="emit('tab', t.key)">
          <span>{{ t.label }}</span>
          <span v-if="tabDirty(t.key)" class="ed-nav__dot" title="Есть несохранённые изменения" />
          <svg v-else-if="t.lock" class="ed-nav__lock" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" aria-label="только для админов платформы"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
        </button>
      </nav>

      <div class="ed-pane">
        <!-- ОСНОВНОЕ -->
        <template v-if="current === 'general'">
          <section class="ed-sec">
            <h2>Витрина</h2>
            <div class="ed-grid">
              <label class="adm-field ed-wide"><span>Название</span><input v-model="form.name" class="adm-input" maxlength="64" /></label>
              <label class="adm-field ed-wide"><span>Описание</span><textarea v-model="form.description" class="adm-textarea" rows="2" placeholder="Одна-две строки для каталога" /></label>
              <label class="adm-field"><span>Slug</span><input :value="server.slug" class="adm-input" disabled /><small class="ed-note">Адрес в ссылках, после создания не меняется</small></label>
              <label class="adm-field"><span>Порядок в каталоге</span><input v-model.number="form.sort_order" type="number" class="adm-input" /><small class="ed-note">Меньше — выше</small></label>
            </div>
          </section>
          <section class="ed-sec">
            <h2>Кто видит и кто заходит</h2>
            <div class="ed-row">
              <div class="ed-ctl"><span class="ed-label">Кому виден</span><SrvSeg v-model="visibility" :options="VISIBILITY" label="Кому виден" /></div>
              <p class="ed-note">{{ VISIBILITY.find((v) => v[0] === visibility)?.[2] }}</p>
            </div>
            <div class="ed-row">
              <div class="ed-ctl"><span class="ed-label">Доступ</span><SrvSeg v-model="form.whitelist_mode" :options="ACCESS" label="Режим доступа" /></div>
              <label class="adm-field ed-narrow"><span>Макс. игроков</span><input v-model.number="form.max_players" type="number" min="1" class="adm-input" /></label>
            </div>
            <div class="ed-toggles">
              <SrvToggle v-model="form.maintenance" label="Технические работы" hint="Игроки видят «техработы» и не заходят; админы заходят" />
              <SrvToggle v-model="form.is_default" label="Сервер по умолчанию" :disabled="locked('is_default') || form.is_external"
                         :hint="form.is_external ? 'Внешний сервер не может быть основным' : 'Его выбирают сайт и лаунчер, пока игрок не выбрал другой'" />
            </div>
          </section>
        </template>

        <!-- ОФОРМЛЕНИЕ -->
        <template v-else-if="current === 'look'">
          <div class="ed-look">
            <section class="ed-sec">
              <h2>Иконка и баннер</h2>
              <div class="ed-drops">
                <div class="ed-drop ed-drop--icon" :class="{ 'ed-drop--over': drag === 'icon' }" @dragover.prevent="drag = 'icon'" @dragleave="drag = ''" @drop.prevent="onDrop('icon', $event)">
                  <img v-if="form.icon_url" :src="form.icon_url" alt="Иконка" />
                  <div class="ed-drop__text">
                    <b>Иконка</b>
                    <span>Квадрат от 128×128, PNG/JPG/WebP. Перетащите сюда или</span>
                    <button type="button" class="adm-btn adm-btn--sm" :disabled="uploading === 'icon'" @click="iconInput.click()">{{ uploading === 'icon' ? 'Загружаю…' : 'Выбрать файл' }}</button>
                  </div>
                  <input ref="iconInput" type="file" accept="image/png,image/jpeg,image/webp" hidden @change="upload('icon', $event.target.files?.[0]); $event.target.value = ''" />
                </div>
                <div class="ed-drop ed-drop--banner" :class="{ 'ed-drop--over': drag === 'banner' }" @dragover.prevent="drag = 'banner'" @dragleave="drag = ''" @drop.prevent="onDrop('banner', $event)">
                  <div class="ed-drop__banner" :style="form.banner_url ? { backgroundImage: `url(${form.banner_url})` } : null" />
                  <div class="ed-drop__text">
                    <b>Баннер</b>
                    <span>Широкий, от 1200 px. Перетащите сюда или</span>
                    <button type="button" class="adm-btn adm-btn--sm" :disabled="uploading === 'banner'" @click="bannerInput.click()">{{ uploading === 'banner' ? 'Загружаю…' : 'Выбрать файл' }}</button>
                  </div>
                  <input ref="bannerInput" type="file" accept="image/png,image/jpeg,image/webp" hidden @change="upload('banner', $event.target.files?.[0]); $event.target.value = ''" />
                </div>
              </div>
              <p class="ed-note">Картинки сохраняются сразу, без кнопки «Сохранить».</p>
            </section>
            <section class="ed-sec">
              <h2>Цвет сервера</h2>
              <p class="ed-note">Тонирует сайт и лаунчер, пока выбран этот сервер.</p>
              <div class="ed-swatches">
                <button v-for="c in ACCENTS" :key="c" type="button" class="ed-swatch" :class="{ 'ed-swatch--on': (form.accent_color || '#7c3aed').toLowerCase() === c }" :style="{ background: c }" :title="c" :aria-label="`Цвет ${c}`" @click="form.accent_color = c === '#7c3aed' ? '' : c" />
                <label class="ed-swatch ed-swatch--custom" :class="{ 'ed-swatch--on': form.accent_color && !ACCENTS.includes(form.accent_color.toLowerCase()) }" title="Свой цвет">
                  <input type="color" :value="form.accent_color || '#7c3aed'" @input="form.accent_color = $event.target.value" />
                  <span>+</span>
                </label>
                <code class="ed-hex">{{ form.accent_color || 'фиолетовый по умолчанию' }}</code>
              </div>
            </section>
            <section class="ed-sec ed-preview-sec">
              <h2>Так сервер выглядит в каталоге</h2>
              <div class="pv" :style="form.accent_color ? { '--pv-acc': form.accent_color } : null">
                <div class="pv__banner" :style="form.banner_url ? { backgroundImage: `url(${form.banner_url})` } : null">
                  <div class="pv__shade" />
                  <span class="pv__status"><i />{{ form.maintenance ? 'Тех. работы' : 'Онлайн' }}</span>
                  <div class="pv__id">
                    <img v-if="form.icon_url" :src="form.icon_url" alt="" />
                    <div>
                      <div class="pv__name">{{ form.name || 'Название' }}</div>
                      <div class="pv__tags"><span>MC {{ form.mc_version }}</span><span v-if="form.loader">{{ form.loader }}</span></div>
                    </div>
                  </div>
                </div>
                <div class="pv__body">
                  <p>{{ form.description || 'Описание сервера появится здесь.' }}</p>
                  <div class="pv__bar"><span :style="{ width: '35%' }" /></div>
                  <button type="button" class="pv__btn" tabindex="-1">Выбрать сервер</button>
                </div>
              </div>
            </section>
          </div>
        </template>

        <!-- ПОДКЛЮЧЕНИЕ -->
        <template v-else-if="current === 'connection'">
          <section class="ed-sec">
            <h2>Адрес для игроков</h2>
            <div class="ed-grid">
              <label class="adm-field ed-wide2"><span>Хост</span><input v-model.trim="form.host" class="adm-input" placeholder="play.example.ru" /></label>
              <label class="adm-field"><span>Порт</span><input v-model.number="form.port" type="number" class="adm-input" /></label>
            </div>
            <div class="ed-ping">
              <button type="button" class="adm-btn adm-btn--sm" :disabled="pinging" @click="checkPing">{{ pinging ? 'Проверяю…' : 'Проверить пинг' }}</button>
              <span v-if="ping" class="ed-ping__res" :class="ping.online ? 'ed-ok' : 'ed-err'">
                <template v-if="ping.online">✓ {{ ping.host }}:{{ ping.port }} отвечает за {{ ping.latency_ms }} мс · {{ ping.version }} · {{ ping.players_online }}/{{ ping.players_max }}</template>
                <template v-else>✕ {{ ping.host }}:{{ ping.port }} не ответил<template v-if="!form.is_external">. Свой публичный адрес с нашей машины может не пинговаться — для статуса задайте внутренний адрес в «Дополнительно».</template></template>
              </span>
            </div>
            <button type="button" class="ed-more" :aria-expanded="advancedConn" @click="advancedConn = !advancedConn">{{ advancedConn ? '▾' : '▸' }} Дополнительно: отдельный адрес для статуса</button>
            <div v-if="advancedConn" class="ed-grid">
              <label class="adm-field"><span>Хост статуса</span><input v-model.trim="form.status_host" class="adm-input" placeholder="= хост" /></label>
              <label class="adm-field"><span>Порт статуса</span><input v-model.number="form.status_port" type="number" class="adm-input" placeholder="= порт" /></label>
              <p class="ed-note ed-wide">Онлайн на сайте берётся пингом игрового порта. Отдельный адрес нужен, только если сервер не виден по публичному (например, свой сервер на этой же машине).</p>
            </div>
          </section>
          <section class="ed-sec">
            <h2>Что запускает сервер и клиент</h2>
            <div class="ed-grid">
              <label class="adm-field"><span>Ядро сервера <svg v-if="locked('server_core')" class="ed-lock" viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg></span>
                <select v-model="form.server_core" class="adm-select" :disabled="locked('server_core')">
                  <option value="">не указано</option>
                  <option v-for="(l, k) in CORE_LABELS" :key="k" :value="k">{{ l }}</option>
                </select>
              </label>
              <label class="adm-field"><span>Версия Minecraft</span><input v-model.trim="form.mc_version" class="adm-input" placeholder="1.21.1" /></label>
              <label class="adm-field"><span>Клиент в лаунчере</span>
                <select v-model="form.loader" class="adm-select">
                  <option value="neoforge">NeoForge</option>
                  <option value="fabric">Fabric</option>
                  <option value="vanilla">Ванилла</option>
                </select>
              </label>
              <label class="adm-field"><span>Java</span><input v-model.number="form.java_version" type="number" class="adm-input" /></label>
              <label v-if="form.loader === 'neoforge'" class="adm-field"><span>Версия NeoForge</span><input v-model.trim="form.neoforge_version" class="adm-input" placeholder="21.1.x" /></label>
            </div>
            <div class="ed-toggles">
              <SrvToggle v-model="form.is_external" label="Внешний сервер" :disabled="locked('is_external')"
                         hint="Сервер партнёра на чужой машине: подключается через плагины VoidRP, откроется вкладка «Интеграция»" />
              <SrvToggle v-model="form.ticket_hostname" label="Пропуск в адресе подключения"
                         hint="Лаунчер подключает к «<пропуск>.<хост>». Нужна wildcard-запись DNS, иначе сервер станет недоступен" />
            </div>
          </section>
        </template>

        <!-- СБОРКА -->
        <template v-else-if="current === 'pack'">
          <section class="ed-sec">
            <h2>Версии</h2>
            <div class="ed-grid">
              <label class="adm-field"><span>Версия сборки</span><input v-model.trim="form.pack_version" class="adm-input" placeholder="1.0.0" /></label>
              <label class="adm-field"><span>Мин. версия лаунчера</span><input v-model.trim="form.min_launcher_version" class="adm-input" placeholder="0.1.0" /><small class="ed-note">Старые лаунчеры попросят обновиться</small></label>
            </div>
          </section>
          <section class="ed-sec">
            <h2>Откуда лаунчер берёт сборку</h2>
            <div class="ed-grid">
              <label class="adm-field ed-wide"><span>Адрес файлов сборки</span><input v-model.trim="form.pack_base_url" class="adm-input" placeholder="https://void-rp.ru/launcher/pack/<slug>" /></label>
              <label class="adm-field ed-wide"><span>Манифест</span><input v-model.trim="form.manifest_url" class="adm-input" placeholder="https://…/manifests/<slug>.json" /></label>
            </div>
            <button type="button" class="ed-more" :aria-expanded="advancedPack" @click="advancedPack = !advancedPack">{{ advancedPack ? '▾' : '▸' }} Дополнительно: Java-рантайм, папка и скрипт сборки</button>
            <div v-if="advancedPack" class="ed-grid">
              <label class="adm-field ed-wide"><span>Runtime seed</span><input v-model.trim="form.runtime_seed_url" class="adm-input" placeholder="пусто = общий" /></label>
              <label class="adm-field ed-wide"><span>Runtime manifest</span><input v-model.trim="form.runtime_manifest_url" class="adm-input" placeholder="пусто = общий; не .json — база + файл платформы" /></label>
              <label class="adm-field ed-wide"><span>Папка сборки на машине <svg v-if="locked('pack_root')" class="ed-lock" viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg></span><input v-model.trim="form.pack_root" class="adm-input" :disabled="locked('pack_root')" /></label>
              <label class="adm-field ed-wide"><span>Скрипт пересборки манифеста <svg v-if="locked('manifest_build_script')" class="ed-lock" viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg></span><input v-model.trim="form.manifest_build_script" class="adm-input" :disabled="locked('manifest_build_script')" placeholder="пусто = стандартный генератор" /></label>
              <p v-if="!platform" class="ed-note ed-wide">Поля с замком меняет владелец платформы.</p>
            </div>
          </section>
        </template>

        <!-- ФУНКЦИИ -->
        <template v-else-if="current === 'features'">
          <p class="ed-lead">Выключенная функция прячет свою вкладку на сайте и в лаунчере для этого сервера.</p>
          <section v-for="g in FEATURE_GROUPS" :key="g.title" class="ed-sec">
            <h2>{{ g.title }}</h2>
            <div class="ed-feats">
              <SrvToggle v-for="f in g.items" :key="f[0]" v-model="form.features[f[0]]" :label="f[1]" :hint="f[2]" class="ed-feat" />
            </div>
          </section>
          <section class="ed-sec">
            <h2>Веб-карта</h2>
            <label class="adm-field"><span>Ссылка на BlueMap / Dynmap</span><input v-model.trim="form.map_url" class="adm-input" placeholder="https://map.example.ru" :disabled="!form.features.map" /></label>
          </section>
        </template>

        <!-- НОВОСТИ И МАГАЗИН -->
        <template v-else-if="current === 'channels'">
          <section v-for="c in [{ key: 'update', label: 'Каналы «Обновлений»' }, { key: 'media', label: 'Каналы «Новостей»' }]" :key="c.key" class="ed-sec">
            <h2>{{ c.label }}</h2>
            <div class="ed-chan">
              <div class="ed-chan__head"><b>Telegram</b><span class="ed-note">chat_id и, если в группе темы, номер темы</span></div>
              <div v-for="(t, i) in form.news_channels[c.key].telegram" :key="`tg${i}`" class="ed-chan__row">
                <input v-model.trim="t.chat_id" class="adm-input" placeholder="@channel или -100…" aria-label="chat_id" />
                <input v-model.number="t.thread_id" type="number" class="adm-input ed-chan__thread" placeholder="тема" aria-label="Номер темы" />
                <button type="button" class="adm-btn adm-btn--sm adm-btn--danger" aria-label="Убрать" @click="form.news_channels[c.key].telegram.splice(i, 1)">✕</button>
              </div>
              <button type="button" class="ed-add" @click="addTg(c.key)">+ Telegram-канал</button>
            </div>
            <div class="ed-chan">
              <div class="ed-chan__head"><b>Discord</b><span class="ed-note">адрес вебхука канала</span></div>
              <div v-for="(w, i) in form.news_channels[c.key].discord" :key="`dc${i}`" class="ed-chan__row">
                <input v-model.trim="form.news_channels[c.key].discord[i]" class="adm-input" placeholder="https://discord.com/api/webhooks/…" aria-label="Вебхук Discord" />
                <button type="button" class="adm-btn adm-btn--sm adm-btn--danger" aria-label="Убрать" @click="form.news_channels[c.key].discord.splice(i, 1)">✕</button>
              </div>
              <button type="button" class="ed-add" @click="addDc(c.key)">+ Discord-вебхук</button>
            </div>
          </section>
          <section class="ed-sec">
            <h2>Магазин EasyDonate</h2>
            <div class="ed-grid">
              <label class="adm-field"><span>ID сервера в магазине</span><input v-model.number="form.easydonate_server_id" type="number" class="adm-input" placeholder="12345" /></label>
              <label class="adm-field"><span>Ключ магазина</span>
                <input v-model="form.easydonate_shop_key" type="password" autocomplete="new-password" class="adm-input" :disabled="form.easydonate_shop_key_clear"
                       :placeholder="server.easydonate_shop_key_set ? 'задан — впишите новый, чтобы заменить' : 'не задан — общий магазин'" />
              </label>
            </div>
            <label v-if="server.easydonate_shop_key_set" class="adm-check"><input v-model="form.easydonate_shop_key_clear" type="checkbox" /> Убрать свой ключ и вернуться к общему магазину</label>
          </section>
        </template>

        <!-- МАШИНА -->
        <template v-else-if="current === 'machine'">
          <div v-if="!platform" class="ed-lockbox">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
            <span>Эти настройки меняет владелец платформы. Здесь только посмотреть.</span>
          </div>
          <section v-if="!form.is_external" class="ed-sec">
            <h2>Служба и файлы</h2>
            <div class="ed-grid">
              <label class="adm-field"><span>systemd-юнит</span><input v-model.trim="form.systemd_unit" class="adm-input" :disabled="locked('systemd_unit')" placeholder="youer.service" /></label>
              <label class="adm-field"><span>Папка сервера</span><input v-model.trim="form.data_dir" class="adm-input" :disabled="locked('data_dir')" placeholder="= WorkingDirectory юнита" /></label>
              <label class="adm-field ed-wide"><span>Лог</span><input v-model.trim="form.log_path" class="adm-input" :disabled="locked('log_path')" placeholder="= <папка>/logs/latest.log" /></label>
            </div>
            <p class="ed-note">Юнит нужен для CPU/RAM/диска и статуса службы в «Мониторинге».</p>
          </section>
          <section class="ed-sec">
            <h2>RCON</h2>
            <p v-if="form.is_external" class="ed-note">У внешнего сервера консоль, лог и наказания идут через VoidRpPerms 0.5+. RCON нужен, только если плагина ещё нет — и тогда закройте порт фаерволом.</p>
            <div class="ed-grid">
              <label class="adm-field"><span>Хост</span><input v-model.trim="form.rcon_host" class="adm-input" :disabled="locked('rcon_host')" placeholder="127.0.0.1" /></label>
              <label class="adm-field"><span>Порт</span><input v-model.number="form.rcon_port" type="number" class="adm-input" :disabled="locked('rcon_port')" placeholder="25575" /></label>
              <label class="adm-field"><span>Пароль</span><input v-model="form.rcon_password" type="password" autocomplete="new-password" class="adm-input" :disabled="locked('rcon_password')" placeholder="из server.properties" /></label>
              <label v-if="form.is_external" class="adm-field ed-wide"><span>Ссылка на лог</span><input v-model.trim="form.log_path" class="adm-input" :disabled="locked('log_path')" placeholder="https://… (если партнёр отдаёт latest.log)" /></label>
            </div>
          </section>
        </template>

        <!-- СЕКРЕТ -->
        <template v-else-if="current === 'secret'">
          <section class="ed-sec">
            <h2>Секрет сервера</h2>
            <p class="ed-note">Плагины и моды сервера шлют его в каждом запросе к VoidRP. Не показывайте его в стримах и скриншотах.</p>
            <div class="ed-secret">
              <code>{{ showSecret ? server.game_auth_secret : '•'.repeat(32) }}</code>
              <button type="button" class="adm-btn adm-btn--sm" @click="showSecret = !showSecret">{{ showSecret ? 'Скрыть' : 'Показать' }}</button>
              <button type="button" class="adm-btn adm-btn--sm" @click="copy(server.game_auth_secret, 'Секрет скопирован')">Копировать</button>
            </div>
            <div class="ed-secret-acts">
              <div>
                <button type="button" class="adm-btn adm-btn--sm" @click="regen('smooth')">Сменить плавно</button>
                <span class="ed-note">старый работает ещё сутки, VoidRpPerms впишет новый сам</span>
              </div>
              <div>
                <button type="button" class="adm-btn adm-btn--sm adm-btn--danger" @click="regen('now')">Сменить сразу</button>
                <span class="ed-note">если секрет утёк: старый перестанет работать немедленно</span>
              </div>
            </div>
          </section>
          <section v-if="platform && !server.is_default" class="ed-sec ed-danger">
            <h2>Удаление</h2>
            <p class="ed-note">Удалятся сервер и все его игровые данные: государства, экономика, статистика, Battle Pass. Отменить нельзя.</p>
            <button type="button" class="adm-btn adm-btn--danger" @click="remove">Удалить «{{ server.name }}»</button>
          </section>
          <p v-else-if="server.is_default" class="ed-note">Сервер по умолчанию удалить нельзя — сначала сделайте основным другой.</p>
        </template>
      </div>
    </div>

    <!-- Панель сохранения -->
    <Transition name="ed-bar">
      <div v-if="dirty" class="ed-bar" role="region" aria-label="Несохранённые изменения">
        <span class="ed-bar__text"><b>Изменено:</b> {{ changedLabel }}</span>
        <span class="ed-bar__acts">
          <button type="button" class="adm-btn adm-btn--sm adm-btn--ghost" :disabled="saving" @click="reset">Отменить</button>
          <button type="button" class="adm-btn adm-btn--acc" :disabled="saving" @click="save">{{ saving ? 'Сохраняю…' : 'Сохранить' }}<kbd>Ctrl+S</kbd></button>
        </span>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.ed { --ed-acc: var(--adm-acc); display: flex; flex-direction: column; gap: 1rem; padding-bottom: 5rem; }
.ed-head { display: flex; align-items: center; gap: 0.9rem; flex-wrap: wrap; padding: 0.9rem 1rem; border-radius: var(--adm-r); border: 1px solid var(--adm-line); background: linear-gradient(100deg, color-mix(in srgb, var(--ed-acc) 14%, var(--adm-card)), var(--adm-card) 60%); }
.ed-back { order: -1; }
.ed-head__id { display: flex; gap: 0.75rem; align-items: center; flex: 1; min-width: 14rem; }
.ed-head__icon { width: 3rem; height: 3rem; border-radius: 12px; object-fit: cover; flex: none; }
.ed-head__icon--ph { display: grid; place-items: center; background: color-mix(in srgb, var(--ed-acc) 30%, #0c1220); color: #fff; font-weight: 900; font-size: 1.3rem; }
.ed-head__text { min-width: 0; }
.ed-head__name { margin: 0; font-size: 1.2rem; font-weight: 900; color: var(--adm-text); }
.ed-head__meta { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; font-size: 0.78rem; color: var(--adm-dim); margin-top: 0.15rem; }
.ed-head__meta code { font-family: var(--adm-mono); }
.ed-head__addr { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.ed-state { display: inline-flex; align-items: center; gap: 0.3rem; font-weight: 700; color: var(--adm-mut); }
.ed-state i { width: 7px; height: 7px; border-radius: 50%; background: var(--adm-dim); }
.ed-state--up { color: var(--adm-ok); } .ed-state--up i { background: var(--adm-ok); }
.ed-state--down { color: var(--adm-err); } .ed-state--down i { background: var(--adm-err); }
.ed-state--maint { color: var(--adm-warn); } .ed-state--maint i { background: var(--adm-warn); }

.ed-body { display: grid; grid-template-columns: 200px minmax(0, 1fr); gap: 1rem; align-items: start; }
.ed-nav { position: sticky; top: 1rem; display: flex; flex-direction: column; gap: 2px; padding: 0.35rem; border-radius: var(--adm-r); background: var(--adm-card); border: 1px solid var(--adm-line); }
.ed-nav__item { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; padding: 0.55rem 0.7rem; border-radius: var(--adm-r-sm); border: 0; background: none; color: var(--adm-mut); font: inherit; font-size: 0.84rem; font-weight: 600; cursor: pointer; text-align: left; }
.ed-nav__item:hover { color: var(--adm-text); background: rgba(148, 163, 184, 0.06); }
.ed-nav__item--on { color: var(--adm-text); background: var(--adm-acc-soft); box-shadow: inset 2px 0 0 var(--adm-acc); }
.ed-nav__dot { width: 7px; height: 7px; border-radius: 50%; background: var(--adm-warn); flex: none; }
.ed-nav__lock { color: var(--adm-dim); flex: none; }
@media (max-width: 860px) {
  .ed-body { grid-template-columns: minmax(0, 1fr); }
  .ed-nav { position: static; flex-direction: row; overflow-x: auto; scrollbar-width: none; }
  .ed-nav__item { white-space: nowrap; flex: none; }
  .ed-nav__item--on { box-shadow: inset 0 -2px 0 var(--adm-acc); }
}

.ed-pane { display: flex; flex-direction: column; gap: 1rem; min-width: 0; }
.ed-sec { padding: 1rem 1.1rem 1.1rem; border-radius: var(--adm-r); background: var(--adm-card); border: 1px solid var(--adm-line); display: flex; flex-direction: column; gap: 0.85rem; min-width: 0; }
.ed-sec h2 { margin: 0; font-size: 0.92rem; font-weight: 800; color: var(--adm-text); }
.ed-lead { margin: 0; color: var(--adm-mut); font-size: 0.85rem; }
.ed-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 210px), 1fr)); gap: 0.85rem; }
.ed-wide { grid-column: 1 / -1; }
.ed-wide2 { grid-column: span 2; }
@media (max-width: 560px) { .ed-wide2 { grid-column: 1 / -1; } }
.ed-narrow { max-width: 10rem; }
.ed-note { margin: 0; font-size: 0.75rem; color: var(--adm-dim); line-height: 1.45; }
.ed-label { font-size: 0.63rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: var(--adm-dim); }
.ed-row { display: flex; gap: 1rem; align-items: flex-end; flex-wrap: wrap; }
.ed-row .ed-note { flex: 1; min-width: 12rem; padding-bottom: 0.45rem; }
.ed-ctl { display: flex; flex-direction: column; gap: 0.35rem; }
.ed-toggles { display: flex; flex-direction: column; gap: 0.85rem; padding-top: 0.2rem; }
.ed-lock { vertical-align: -1px; color: var(--adm-dim); }
.ed-more { align-self: flex-start; border: 0; background: none; padding: 0; color: var(--adm-acc-text); font: inherit; font-size: 0.8rem; font-weight: 600; cursor: pointer; }
.ed-ping { display: flex; gap: 0.7rem; align-items: center; flex-wrap: wrap; }
.ed-ping__res { font-size: 0.8rem; line-height: 1.4; flex: 1; min-width: 12rem; }
.ed-ok { color: var(--adm-ok); }
.ed-err { color: var(--adm-err); }

.ed-look { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 1rem; align-items: start; }
.ed-look > .ed-sec:not(.ed-preview-sec) { grid-column: 1; }
.ed-preview-sec { grid-column: 2; grid-row: 1 / span 2; position: sticky; top: 1rem; }
@media (max-width: 1100px) { .ed-look { grid-template-columns: minmax(0, 1fr); } .ed-preview-sec { grid-column: 1; grid-row: auto; position: static; } }
.ed-drops { display: grid; grid-template-columns: 1fr 1.6fr; gap: 0.8rem; }
@media (max-width: 640px) { .ed-drops { grid-template-columns: 1fr; } }
.ed-drop { display: flex; gap: 0.8rem; align-items: center; padding: 0.8rem; border-radius: var(--adm-r-sm); border: 1.5px dashed var(--adm-line-strong); background: #080c16; transition: border-color 0.14s, background 0.14s; min-width: 0; }
.ed-drop--over { border-color: var(--adm-acc); background: var(--adm-acc-soft); }
.ed-drop img { width: 4rem; height: 4rem; border-radius: 12px; object-fit: cover; flex: none; }
.ed-drop--banner, .ed-drop--icon { flex-direction: column; align-items: stretch; }
.ed-drop--icon img { align-self: flex-start; }
.ed-drop__banner { height: 70px; border-radius: 8px; background: linear-gradient(135deg, color-mix(in srgb, var(--ed-acc) 50%, #12152b), #0b0e1c); background-size: cover; background-position: center; }
.ed-drop__text { display: flex; flex-direction: column; gap: 0.3rem; align-items: flex-start; font-size: 0.75rem; color: var(--adm-dim); min-width: 0; }
.ed-drop__text b { color: var(--adm-text); font-size: 0.85rem; }
.ed-swatches { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
.ed-swatch { width: 2rem; height: 2rem; border-radius: 50%; border: 2px solid transparent; cursor: pointer; padding: 0; box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.25); position: relative; }
.ed-swatch--on { border-color: #fff; box-shadow: 0 0 0 2px var(--adm-acc-line); }
.ed-swatch--custom { display: grid; place-items: center; background: conic-gradient(#ef4444, #f59e0b, #22c55e, #06b6d4, #3b82f6, #a855f7, #ef4444); color: #fff; font-weight: 900; overflow: hidden; }
.ed-swatch--custom input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.ed-hex { font-family: var(--adm-mono); font-size: 0.75rem; color: var(--adm-dim); }

.pv { --pv-acc: #7c3aed; border-radius: 16px; overflow: hidden; border: 1px solid rgba(148, 163, 184, 0.13); background: linear-gradient(180deg, rgba(19, 25, 43, 0.95), rgba(10, 14, 26, 0.95)); }
.pv__banner { position: relative; height: 120px; display: flex; align-items: flex-end; padding: 0.8rem; background: linear-gradient(135deg, #241a5c, #12152b 60%); background-size: cover; background-position: center; }
.pv__shade { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(10, 14, 26, 0.1), rgba(13, 16, 32, 0.95)); }
.pv__status { position: absolute; top: 0.6rem; right: 0.6rem; display: inline-flex; gap: 0.3rem; align-items: center; font-size: 0.68rem; font-weight: 800; padding: 0.2rem 0.5rem; border-radius: 999px; background: rgba(6, 9, 17, 0.72); color: #86efac; }
.pv__status i { width: 6px; height: 6px; border-radius: 50%; background: #22c55e; }
.pv__id { position: relative; display: flex; gap: 0.6rem; align-items: center; }
.pv__id img { width: 2.6rem; height: 2.6rem; border-radius: 10px; object-fit: cover; }
.pv__name { font-weight: 900; color: #f1f5ff; }
.pv__tags { display: flex; gap: 0.3rem; margin-top: 0.15rem; }
.pv__tags span { font-size: 0.62rem; font-weight: 700; padding: 0.08rem 0.4rem; border-radius: 5px; background: rgba(255, 255, 255, 0.1); color: #cbd5f5; }
.pv__body { padding: 0.8rem; display: flex; flex-direction: column; gap: 0.6rem; }
.pv__body p { margin: 0; font-size: 0.78rem; color: #8896b5; line-height: 1.45; }
.pv__bar { height: 4px; border-radius: 4px; background: rgba(148, 163, 184, 0.15); overflow: hidden; }
.pv__bar span { display: block; height: 100%; background: var(--pv-acc); }
.pv__btn { border: 0; border-radius: 10px; padding: 0.55rem; font-weight: 800; font-size: 0.8rem; color: #fff; background: var(--pv-acc); cursor: default; font-family: inherit; }

.ed-feats { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr)); gap: 0.9rem 1.2rem; }
.ed-chan { display: flex; flex-direction: column; gap: 0.45rem; }
.ed-chan + .ed-chan { padding-top: 0.6rem; border-top: 1px solid var(--adm-line); }
.ed-chan__head { display: flex; gap: 0.6rem; align-items: baseline; flex-wrap: wrap; font-size: 0.84rem; color: var(--adm-text); }
.ed-chan__row { display: flex; gap: 0.4rem; align-items: center; }
.ed-chan__row .adm-input { flex: 1; min-width: 0; }
.ed-chan__row .ed-chan__thread { flex: 0 0 6.5rem; }
.ed-add { align-self: flex-start; border: 1px dashed var(--adm-acc-line); background: transparent; color: var(--adm-acc-text); border-radius: var(--adm-r-sm); padding: 0.3rem 0.65rem; font: inherit; font-size: 0.76rem; font-weight: 700; cursor: pointer; }
.ed-add:hover { background: var(--adm-acc-soft); }
.ed-lockbox { display: flex; gap: 0.6rem; align-items: center; padding: 0.7rem 0.9rem; border-radius: var(--adm-r-sm); background: var(--adm-card-2); border: 1px solid var(--adm-line); color: var(--adm-mut); font-size: 0.82rem; }
.ed-secret { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
.ed-secret code { flex: 1; min-width: 12rem; font-family: var(--adm-mono); font-size: 0.78rem; color: #6ee7b7; background: #080c16; border: 1px solid var(--adm-line-strong); border-radius: var(--adm-r-sm); padding: 0.5rem 0.65rem; overflow-x: auto; white-space: nowrap; }
.ed-secret-acts { display: flex; flex-direction: column; gap: 0.5rem; }
.ed-secret-acts > div { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; }
.ed-danger { border-color: rgba(248, 113, 113, 0.3); background: linear-gradient(180deg, rgba(248, 113, 113, 0.05), var(--adm-card)); }
.ed-danger .adm-btn { align-self: flex-start; }

.ed-bar { position: fixed; left: 50%; bottom: calc(1rem + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); z-index: 40; width: min(760px, calc(100vw - 2rem)); display: flex; gap: 0.8rem; align-items: center; justify-content: space-between; flex-wrap: wrap; padding: 0.65rem 0.75rem 0.65rem 1rem; border-radius: 14px; background: var(--adm-card-2); border: 1px solid var(--adm-acc-line); box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5); }
.ed-bar__text { font-size: 0.82rem; color: var(--adm-mut); min-width: 0; flex: 1; }
.ed-bar__text b { color: var(--adm-text); }
.ed-bar__acts { display: flex; gap: 0.4rem; }
.ed-bar kbd { font-family: var(--adm-mono); font-size: 0.62rem; padding: 0.05rem 0.3rem; border-radius: 4px; background: rgba(255, 255, 255, 0.18); margin-left: 0.2rem; }
@media (max-width: 560px) { .ed-bar kbd { display: none; } }
.ed-bar-enter-active, .ed-bar-leave-active { transition: transform 0.2s, opacity 0.2s; }
.ed-bar-enter-from, .ed-bar-leave-to { opacity: 0; transform: translate(-50%, 1rem); }
@media (prefers-reduced-motion: reduce) { .ed-bar-enter-active, .ed-bar-leave-active { transition: none; } }
</style>
