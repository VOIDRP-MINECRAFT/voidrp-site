<script setup>
import { onMounted, reactive, ref } from 'vue'
import { authState } from '../../stores/authStore'
import { toastSuccess, toastError } from '../../services/toast'
import {
  listServers,
  createServer,
  updateServer,
  deleteServer,
  regenerateSecret,
  uploadServerImage,
} from '../../services/adminServersApi'

const token = () => authState.accessToken

const servers = ref([])
const loading = ref(true)
const saving = ref(false)

// null = list mode; 'new' = create; object = editing existing
const editing = ref(null)
const form = reactive({})
const iconInput = ref(null)
const bannerInput = ref(null)

const BLANK = {
  slug: '', name: '', description: '', icon_url: '', banner_url: '',
  sort_order: 0, is_visible: true, is_default: false,
  host: '', port: 25565, mc_version: '1.21.1', loader: 'neoforge',
  java_version: 21, neoforge_version: '',
  pack_root: '', pack_base_url: '', manifest_url: '',
  runtime_seed_url: '', runtime_manifest_url: '',
  pack_version: '1.0.0', min_launcher_version: '0.1.0',
  status_host: '', status_port: null, max_players: 100,
  whitelist_mode: 'public', maintenance: false,
  map_url: '',
  accent_color: '',
  easydonate_server_id: null,
  features: { nations: true, economy: true, shop: true, alliances: true, battlepass: true, quests: true, leaderboards: true, map: true },
}

const FEATURE_LABELS = {
  nations: 'Государства',
  economy: 'Экономика / рынок',
  shop: 'Магазин (донат)',
  alliances: 'Альянсы',
  battlepass: 'Battle Pass',
  quests: 'Квесты',
  leaderboards: 'Рейтинги',
  map: 'Карта',
}

async function load() {
  loading.value = true
  try {
    servers.value = await listServers(token())
  } catch (e) {
    toastError(e.message || 'Ошибка загрузки')
  } finally {
    loading.value = false
  }
}

function startCreate() {
  Object.assign(form, structuredClone(BLANK))
  editing.value = 'new'
}

function startEdit(server) {
  Object.assign(form, structuredClone(BLANK), server)
  // Merge features so keys the server row doesn't have yet default to enabled.
  form.features = { ...structuredClone(BLANK).features, ...(server.features || {}) }
  editing.value = server
}

function cancel() {
  editing.value = null
}

function buildPayload() {
  const p = { ...form }
  // Normalize empty strings to null for nullable fields
  for (const k of ['description', 'icon_url', 'banner_url', 'neoforge_version',
    'pack_root', 'pack_base_url', 'manifest_url', 'runtime_seed_url', 'runtime_manifest_url',
    'status_host', 'map_url', 'accent_color']) {
    if (p[k] === '') p[k] = null
  }
  if (p.status_port === '' || p.status_port === undefined) p.status_port = null
  if (p.easydonate_server_id === '' || p.easydonate_server_id === undefined || Number.isNaN(p.easydonate_server_id)) p.easydonate_server_id = null
  return p
}

async function save() {
  saving.value = true
  try {
    if (editing.value === 'new') {
      const created = await createServer(token(), buildPayload())
      toastSuccess(`Сервер «${created.name}» создан`)
    } else {
      const p = buildPayload()
      delete p.slug
      delete p.game_auth_secret
      const updated = await updateServer(token(), editing.value.id, p)
      toastSuccess(`Сервер «${updated.name}» сохранён`)
    }
    editing.value = null
    await load()
  } catch (e) {
    toastError(e.message || 'Ошибка сохранения')
  } finally {
    saving.value = false
  }
}

async function remove(server) {
  if (!confirm(`Удалить сервер «${server.name}»? Данные этого сервера удалятся каскадно.`)) return
  try {
    await deleteServer(token(), server.id)
    toastSuccess('Сервер удалён')
    await load()
  } catch (e) {
    toastError(e.message || 'Ошибка удаления')
  }
}

async function regen(server) {
  if (!confirm('Сгенерировать новый секрет? Плагины этого сервера перестанут работать до обновления конфига.')) return
  try {
    const updated = await regenerateSecret(token(), server.id)
    if (editing.value && editing.value.id === server.id) editing.value = updated
    await load()
    toastSuccess('Новый секрет сгенерирован')
  } catch (e) {
    toastError(e.message || 'Ошибка')
  }
}

async function onImage(kind, event) {
  const file = event.target.files?.[0]
  if (!file || !editing.value || editing.value === 'new') return
  try {
    const updated = await uploadServerImage(token(), editing.value.id, kind, file)
    form[kind === 'icon' ? 'icon_url' : 'banner_url'] = kind === 'icon' ? updated.icon_url : updated.banner_url
    toastSuccess('Изображение загружено')
    await load()
  } catch (e) {
    toastError(e.message || 'Ошибка загрузки')
  } finally {
    event.target.value = ''
  }
}

function copySecret(secret) {
  navigator.clipboard?.writeText(secret).then(() => toastSuccess('Секрет скопирован'))
}

onMounted(load)
</script>

<template>
  <div class="ap">
    <div class="ap__header">
      <div>
        <h1 class="ap__title">Серверы</h1>
        <p class="ap__sub">Управление серверами: витрина, подключение, модпак, статус, секрет</p>
      </div>
      <button v-if="!editing" class="btn btn--primary" @click="startCreate">+ Добавить сервер</button>
    </div>

    <!-- LIST -->
    <template v-if="!editing">
      <div v-if="loading" class="skel" />
      <div v-else-if="!servers.length" class="empty">Пока нет серверов.</div>
      <div v-else class="srv-list">
        <div v-for="s in servers" :key="s.id" class="srv-card">
          <img v-if="s.icon_url" :src="s.icon_url" class="srv-card__icon" alt="" />
          <div v-else class="srv-card__icon srv-card__icon--ph">{{ s.name.charAt(0) }}</div>
          <div class="srv-card__main">
            <div class="srv-card__title">
              {{ s.name }}
              <span v-if="s.is_default" class="tag tag--violet">по умолчанию</span>
              <span v-if="!s.is_visible" class="tag tag--gray">скрыт</span>
              <span v-if="s.maintenance" class="tag tag--yellow">тех.работы</span>
            </div>
            <div class="srv-card__meta">{{ s.slug }} · {{ s.host }}:{{ s.port }} · MC {{ s.mc_version }}/{{ s.loader }}</div>
          </div>
          <div class="srv-card__actions">
            <button class="btn btn--ghost btn--sm" @click="startEdit(s)">Изменить</button>
            <button class="btn btn--ghost btn--sm btn--danger" @click="remove(s)">Удалить</button>
          </div>
        </div>
      </div>
    </template>

    <!-- FORM -->
    <template v-else>
      <div class="form">
        <div class="form__bar">
          <button class="btn btn--ghost btn--sm" @click="cancel">← Назад</button>
          <div class="form__bar-title">{{ editing === 'new' ? 'Новый сервер' : `Редактирование: ${form.name}` }}</div>
          <button class="btn btn--primary btn--sm" :disabled="saving" @click="save">
            {{ saving ? 'Сохраняю…' : 'Сохранить' }}
          </button>
        </div>

        <!-- Витрина -->
        <div class="sec">Витрина</div>
        <div class="grid">
          <label class="fld"><span>Slug (URL-идентификатор)</span>
            <input v-model="form.slug" :disabled="editing !== 'new'" placeholder="voidrp" /></label>
          <label class="fld"><span>Название</span><input v-model="form.name" placeholder="VoidRP" /></label>
          <label class="fld fld--wide"><span>Описание</span>
            <textarea v-model="form.description" rows="2" placeholder="Хардкорный RP-сервер…" /></label>
          <label class="fld"><span>Порядок сортировки</span><input v-model.number="form.sort_order" type="number" /></label>
          <div class="fld fld--row">
            <label class="chk"><input v-model="form.is_visible" type="checkbox" /> Виден на сайте/лаунчере</label>
            <label class="chk"><input v-model="form.is_default" type="checkbox" /> Сервер по умолчанию</label>
          </div>
        </div>

        <div v-if="editing !== 'new'" class="grid">
          <div class="fld"><span>Иконка</span>
            <div class="img-row">
              <img v-if="form.icon_url" :src="form.icon_url" class="img-prev" alt="" />
              <button class="btn btn--ghost btn--sm" @click="iconInput.click()">Загрузить</button>
              <input ref="iconInput" type="file" accept="image/*" hidden @change="(e) => onImage('icon', e)" />
            </div>
          </div>
          <div class="fld"><span>Баннер</span>
            <div class="img-row">
              <img v-if="form.banner_url" :src="form.banner_url" class="img-prev img-prev--wide" alt="" />
              <button class="btn btn--ghost btn--sm" @click="bannerInput.click()">Загрузить</button>
              <input ref="bannerInput" type="file" accept="image/*" hidden @change="(e) => onImage('banner', e)" />
            </div>
          </div>
        </div>
        <p v-else class="hint">Иконку и баннер можно загрузить после создания сервера.</p>

        <!-- Подключение -->
        <div class="sec">Подключение</div>
        <div class="grid">
          <label class="fld"><span>Host</span><input v-model="form.host" placeholder="void-rp.ru" /></label>
          <label class="fld"><span>Port</span><input v-model.number="form.port" type="number" /></label>
          <label class="fld"><span>Версия MC</span><input v-model="form.mc_version" placeholder="1.21.1" /></label>
          <label class="fld"><span>Загрузчик</span><input v-model="form.loader" placeholder="neoforge" /></label>
          <label class="fld"><span>Java</span><input v-model.number="form.java_version" type="number" /></label>
          <label class="fld"><span>NeoForge версия</span><input v-model="form.neoforge_version" placeholder="21.1.x" /></label>
        </div>

        <!-- Модпак -->
        <div class="sec">Модпак</div>
        <div class="grid">
          <label class="fld"><span>Pack root (на сервере)</span><input v-model="form.pack_root" placeholder="/home/…/pack/voidrp" /></label>
          <label class="fld"><span>Pack base URL</span><input v-model="form.pack_base_url" placeholder="https://void-rp.ru/launcher/pack/voidrp" /></label>
          <label class="fld"><span>Manifest URL</span><input v-model="form.manifest_url" placeholder="https://…/manifests/voidrp.json" /></label>
          <label class="fld"><span>Runtime seed URL</span><input v-model="form.runtime_seed_url" placeholder="https://…/launcher/runtime/runtime-seed.json" /></label>
          <label class="fld"><span>Runtime manifest URL</span><input v-model="form.runtime_manifest_url" placeholder="https://…/launcher/runtime/runtime-windows.json (или base URL)" /></label>
          <label class="fld"><span>Версия пака</span><input v-model="form.pack_version" placeholder="1.0.0" /></label>
          <label class="fld"><span>Мин. версия лаунчера</span><input v-model="form.min_launcher_version" placeholder="0.1.0" /></label>
        </div>

        <!-- Статус -->
        <div class="sec">Статус и доступ</div>
        <div class="grid">
          <label class="fld"><span>Status host (для пинга)</span><input v-model="form.status_host" placeholder="= host" /></label>
          <label class="fld"><span>Status port</span><input v-model.number="form.status_port" type="number" placeholder="= port" /></label>
          <label class="fld"><span>Макс. игроков</span><input v-model.number="form.max_players" type="number" /></label>
          <label class="fld"><span>Режим доступа</span>
            <select v-model="form.whitelist_mode">
              <option value="public">Открытый</option>
              <option value="whitelist">Вайтлист</option>
              <option value="invite">По приглашению</option>
            </select>
          </label>
          <div class="fld fld--row">
            <label class="chk"><input v-model="form.maintenance" type="checkbox" /> Тех. работы</label>
          </div>
        </div>

        <!-- Фичи / вкладки -->
        <div class="sec">Функции сервера (вкладки на сайте и в лаунчере)</div>
        <div class="grid">
          <label class="fld fld--wide"><span>Ссылка на веб-карту (Bluemap/Dynmap)</span>
            <input v-model="form.map_url" placeholder="https://map.void-rp.ru" /></label>
          <label class="fld"><span>EasyDonate server ID (магазин доната)</span>
            <input v-model.number="form.easydonate_server_id" type="number" placeholder="напр. 12345" /></label>
          <label class="fld"><span>Акцентный цвет темы (тонирует сайт/лаунчер)</span>
            <span class="accent-row">
              <input
                type="color"
                class="accent-pick"
                :value="form.accent_color || '#7c3aed'"
                @input="form.accent_color = $event.target.value"
              />
              <input v-model="form.accent_color" placeholder="#7c3aed (пусто = фиолетовый)" />
              <button v-if="form.accent_color" type="button" class="btn btn--ghost btn--sm" @click="form.accent_color = ''">Сброс</button>
            </span></label>
        </div>
        <div class="features">
          <label v-for="(label, key) in FEATURE_LABELS" :key="key" class="feature-chk">
            <input type="checkbox" v-model="form.features[key]" />
            <span>{{ label }}</span>
          </label>
        </div>
        <p class="hint">Выключенные функции скрывают соответствующие вкладки/разделы на сайте и в лаунчере для этого сервера.</p>

        <!-- Секрет -->
        <template v-if="editing !== 'new'">
          <div class="sec">Секрет авторизации (X-Game-Auth-Secret)</div>
          <div class="secret-row">
            <code class="secret">{{ editing.game_auth_secret }}</code>
            <button class="btn btn--ghost btn--sm" @click="copySecret(editing.game_auth_secret)">Копировать</button>
            <button class="btn btn--ghost btn--sm btn--danger" @click="regen(editing)">Перегенерировать</button>
          </div>
          <p class="hint">Этот секрет плагины/моды сервера шлют в заголовке для атрибуции данных.</p>
        </template>
      </div>
    </template>
  </div>
</template>

<style scoped>
*, *::before, *::after { box-sizing: border-box; }
.ap { padding: 1.75rem 1.5rem 3rem; max-width: 920px; }
.ap__header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
.ap__title { font-size: 1.4rem; font-weight: 800; color: #e2e8f0; margin: 0; }
.ap__sub { font-size: 0.75rem; color: #475569; margin: 0.15rem 0 0; }

.btn { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.45rem 0.85rem; border-radius: 8px; font-size: 0.8rem; font-weight: 700; cursor: pointer; border: none; transition: background 0.13s; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn--primary { background: #7c3aed; color: #fff; }
.btn--primary:hover:not(:disabled) { background: #6d28d9; }
.btn--ghost { background: rgba(255,255,255,0.05); color: #94a3b8; }
.btn--ghost:hover:not(:disabled) { background: rgba(255,255,255,0.09); }
.btn--sm { padding: 0.35rem 0.65rem; font-size: 0.76rem; }
.btn--danger { color: #fca5a5; }
.btn--danger:hover:not(:disabled) { background: rgba(239,68,68,0.12); }

.skel { height: 120px; border-radius: 14px; background: linear-gradient(90deg,#0d1422 25%,#121929 50%,#0d1422 75%); background-size: 200% 100%; animation: shimmer 1.4s infinite; }
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
.empty { color: #475569; font-size: 0.85rem; padding: 1.5rem 0; }

/* List */
.srv-list { display: flex; flex-direction: column; gap: 0.65rem; }
.srv-card { display: flex; align-items: center; gap: 0.9rem; padding: 0.85rem 1rem; border-radius: 14px; background: linear-gradient(145deg,#0f1628,#0a1020); border: 1px solid rgba(255,255,255,0.07); }
.srv-card__icon { width: 2.75rem; height: 2.75rem; border-radius: 10px; object-fit: cover; flex-shrink: 0; }
.srv-card__icon--ph { display: flex; align-items: center; justify-content: center; background: #1a1440; color: #a78bfa; font-weight: 900; font-size: 1.2rem; }
.srv-card__main { flex: 1; min-width: 0; }
.srv-card__title { font-size: 0.95rem; font-weight: 800; color: #e2e8f0; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.srv-card__meta { font-size: 0.75rem; color: #475569; margin-top: 0.15rem; }
.srv-card__actions { display: flex; gap: 0.4rem; flex-shrink: 0; }
.tag { font-size: 0.65rem; font-weight: 800; padding: 0.1rem 0.45rem; border-radius: 999px; }
.tag--violet { color: #c4b5fd; background: rgba(139,92,246,0.15); }
.tag--gray { color: #94a3b8; background: rgba(148,163,184,0.12); }
.tag--yellow { color: #fde047; background: rgba(234,179,8,0.12); }

/* Form */
.form__bar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1.25rem; padding-bottom: 0.85rem; border-bottom: 1px solid rgba(255,255,255,0.07); }
.form__bar-title { font-size: 0.95rem; font-weight: 800; color: #cbd5e1; flex: 1; text-align: center; }
.sec { font-size: 0.72rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.07em; color: #64748b; margin: 1.5rem 0 0.75rem; padding-left: 0.6rem; border-left: 3px solid #7c3aed; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 0.85rem; }
.fld { display: flex; flex-direction: column; gap: 0.3rem; }
.fld--wide { grid-column: 1 / -1; }
.fld--row { flex-direction: row; align-items: center; gap: 1.25rem; flex-wrap: wrap; }
.fld > span { font-size: 0.72rem; font-weight: 700; color: #64748b; }
.fld input, .fld textarea, .fld select { background: #0a1020; border: 1px solid rgba(255,255,255,0.09); border-radius: 8px; padding: 0.5rem 0.65rem; color: #e2e8f0; font-size: 0.85rem; font-family: inherit; }
.fld input:focus, .fld textarea:focus, .fld select:focus { outline: none; border-color: rgba(139,92,246,0.5); }
.fld input:disabled { opacity: 0.55; }
.accent-row { display: flex; align-items: center; gap: 0.5rem; }
.accent-row input:not(.accent-pick) { flex: 1; min-width: 0; }
.accent-pick {
  width: 2.4rem; height: 2.4rem; flex-shrink: 0; padding: 0.2rem !important;
  cursor: pointer; border-radius: 8px;
}
.chk { display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.82rem; color: #cbd5e1; cursor: pointer; }
.img-row { display: flex; align-items: center; gap: 0.6rem; }
.img-prev { width: 2.75rem; height: 2.75rem; border-radius: 8px; object-fit: cover; }
.img-prev--wide { width: 5rem; }
.hint { font-size: 0.75rem; color: #475569; margin: 0.5rem 0 0; }
.features { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.85rem; }
.feature-chk {
  display: inline-flex; align-items: center; gap: 0.45rem;
  padding: 0.5rem 0.75rem; border-radius: 10px; cursor: pointer;
  background: #0a1020; border: 1px solid rgba(255,255,255,0.09);
  font-size: 0.82rem; color: #cbd5e1;
}
.feature-chk:has(input:checked) { border-color: rgba(139,92,246,0.5); background: rgba(139,92,246,0.1); color: #e2e8f0; }
.secret-row { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
.secret { flex: 1; min-width: 220px; font-family: monospace; font-size: 0.78rem; color: #86efac; background: #0a1020; border: 1px solid rgba(255,255,255,0.09); border-radius: 8px; padding: 0.5rem 0.65rem; overflow-x: auto; white-space: nowrap; }
</style>
