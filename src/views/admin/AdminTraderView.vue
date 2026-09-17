<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { authState, hasPermission } from '../../stores/authStore'
import { activeServer } from '../../stores/serverStore'
import { confirmDialog } from '../../composables/useConfirm'
import { toastError, toastSuccess } from '../../services/toast'
import {
  traderCatalog, traderCatalogBulk, traderCatalogCreate, traderCatalogDelete, traderCatalogUpdate,
  traderEndVisit, traderForceVisit, traderPreview, traderSaveSettings, traderStatus,
  traderTransactions, traderVisit, traderVisits,
} from '../../services/traderAdminApi'
import ItemIcon from '../../components/ItemIcon.vue'

const token = () => authState.accessToken
const canManage = computed(() => hasPermission('trader.manage'))

const tab = ref('overview')
const TABS = [
  { key: 'overview', label: 'Обзор' },
  { key: 'catalog', label: 'Каталог' },
  { key: 'visits', label: 'Визиты' },
  { key: 'trades', label: 'Сделки' },
  { key: 'settings', label: 'Настройки' },
]

const KIND = { normal: 'Обычный', weekend: 'Выходного дня', elite: 'Элитный' }
const PHASE = { early: 'Ранняя', mid: 'Мид-гейм', end: 'Эндгейм' }
const RARITY = { 1: '★', 2: '★★', 3: '★★★' }
const STATUS = { pending: 'в процессе', done: 'готово', failed: 'не прошла', expired: 'истекла' }

const money = (v) => Number(v || 0).toLocaleString('ru-RU', { maximumFractionDigits: 2 })
const dt = (v) => (v ? new Date(v).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—')

// ── overview ──────────────────────────────────────────────────────────────
const status = ref(null)
const loading = ref(true)
async function loadStatus() {
  try {
    status.value = await traderStatus(token())
  } catch (e) {
    toastError(e.message || 'Не удалось загрузить статус скупщика')
  } finally {
    loading.value = false
  }
}
const catalogSummary = computed(() => {
  const out = {}
  for (const row of status.value?.catalog || []) {
    out[row.phase] = out[row.phase] || { 1: 0, 2: 0, 3: 0 }
    out[row.phase][row.rarity] = row.count
  }
  return out
})

const forcing = ref(false)
async function forceVisit(kind) {
  if (!(await confirmDialog({ title: 'Вызвать скупщика', message: `Скупщик (${KIND[kind].toLowerCase()}) появится на спавне через несколько секунд. Игроки в сети получат уведомление.`, confirmLabel: 'Вызвать' }))) return
  forcing.value = true
  try {
    await traderForceVisit(token(), kind)
    toastSuccess('Скупщик вызван')
    await loadStatus()
  } catch (e) { toastError(e.message || 'Не удалось вызвать') } finally { forcing.value = false }
}
async function endVisit() {
  const v = status.value?.active
  if (!v) return
  if (!(await confirmDialog({ title: 'Завершить визит', message: 'Скупщик уйдёт со спавна. Сделки в процессе завершатся по ответу сервера.', confirmLabel: 'Завершить', danger: true }))) return
  try {
    await traderEndVisit(token(), v.id)
    toastSuccess('Визит завершён')
    await loadStatus()
  } catch (e) { toastError(e.message || 'Ошибка') }
}

const preview = ref(null)
const previewing = ref(false)
async function runPreview(kind) {
  previewing.value = true
  try {
    preview.value = await traderPreview(token(), kind)
  } catch (e) { toastError(e.message || 'Ошибка') } finally { previewing.value = false }
}
const previewTotals = computed(() => {
  const s = preview.value?.slots || []
  return {
    buy: s.filter((x) => x.side === 'buy').reduce((a, x) => a + x.value, 0),
    sell: s.filter((x) => x.side === 'sell').reduce((a, x) => a + x.value, 0),
  }
})

// ── settings ──────────────────────────────────────────────────────────────
const cfg = ref(null)
const phaseForm = ref({ mid_unlocked: false, end_unlocked: false })
const savingCfg = ref(false)
watch(status, (s) => {
  if (!s || cfg.value) return
  cfg.value = JSON.parse(JSON.stringify(s.config))
  phaseForm.value = { mid_unlocked: Boolean(s.phases.mid_unlocked_at), end_unlocked: Boolean(s.phases.end_unlocked_at) }
})
async function saveSettings() {
  savingCfg.value = true
  try {
    await traderSaveSettings(token(), cfg.value, phaseForm.value)
    toastSuccess('Настройки сохранены')
    cfg.value = null
    await loadStatus()
  } catch (e) { toastError(e.message || 'Не удалось сохранить') } finally { savingCfg.value = false }
}

// ── catalog ───────────────────────────────────────────────────────────────
const cat = ref({ items: [], total: 0, page: 1, per_page: 50 })
const catQ = ref('')
const catRarity = ref('')
const catPhase = ref('')
const catEnabled = ref('')
const catLoading = ref(false)
const selectedIds = ref(new Set())
let searchTimer = null

async function loadCatalog(page = 1) {
  catLoading.value = true
  try {
    cat.value = await traderCatalog(token(), {
      q: catQ.value.trim(), rarity: catRarity.value, phase: catPhase.value, enabled: catEnabled.value, page, per_page: 50,
    })
    selectedIds.value = new Set()
  } catch (e) { toastError(e.message || 'Ошибка каталога') } finally { catLoading.value = false }
}
watch(catQ, () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => loadCatalog(1), 300) })
watch([catRarity, catPhase, catEnabled], () => loadCatalog(1))
const catPages = computed(() => Math.max(1, Math.ceil(cat.value.total / cat.value.per_page)))

function toggleSel(id) {
  const s = new Set(selectedIds.value)
  s.has(id) ? s.delete(id) : s.add(id)
  selectedIds.value = s
}
function toggleAll() {
  const all = cat.value.items.map((i) => i.id)
  selectedIds.value = selectedIds.value.size === all.length ? new Set() : new Set(all)
}
async function bulk(patch, label) {
  if (!selectedIds.value.size) return
  try {
    const res = await traderCatalogBulk(token(), { ids: [...selectedIds.value], ...patch })
    toastSuccess(`${label}: ${res.updated}`)
    await loadCatalog(cat.value.page)
  } catch (e) { toastError(e.message || 'Ошибка') }
}
const bulkMult = ref(1)
async function toggleItem(item) {
  try {
    const upd = await traderCatalogUpdate(token(), item.id, { enabled: !item.enabled })
    Object.assign(item, upd)
  } catch (e) { toastError(e.message || 'Ошибка') }
}

const blank = () => ({ id: null, item_key: '', display_name: '', rarity: 1, phase: 'early', unit_value: 1, can_buy: true, can_sell: true, qty_min: null, qty_max: null, enabled: true, note: '' })
const form = ref(blank())
const modal = ref(false)
const pickerOpen = ref(false)
const pickerQ = ref('')
const itemCatalog = ref([])
async function loadItemCatalog() {
  if (itemCatalog.value.length) return
  try {
    const r = await fetch('/item_catalog.json', { cache: 'force-cache' })
    itemCatalog.value = await r.json()
  } catch { itemCatalog.value = [] }
}
const pickerResults = computed(() => {
  const q = pickerQ.value.trim().toLowerCase()
  const out = []
  for (const it of itemCatalog.value) {
    if (!q || it.id.includes(q) || it.name.toLowerCase().includes(q)) { out.push(it); if (out.length >= 60) break }
  }
  return out
})
function openCreate() { form.value = blank(); pickerOpen.value = true; pickerQ.value = ''; modal.value = true; loadItemCatalog() }
function openEdit(item) { form.value = { ...item, note: item.note || '' }; pickerOpen.value = false; modal.value = true }
function pickItem(it) { form.value.item_key = it.id; form.value.display_name = form.value.display_name || it.name; pickerOpen.value = false }
async function saveItem() {
  const f = form.value
  if (!f.item_key || !f.display_name.trim()) { toastError('Выберите предмет и укажите название'); return }
  const body = {
    display_name: f.display_name.trim(), rarity: Number(f.rarity), phase: f.phase, unit_value: Number(f.unit_value),
    can_buy: f.can_buy, can_sell: f.can_sell, enabled: f.enabled, note: f.note.trim() || null,
    qty_min: f.qty_min ? Number(f.qty_min) : null, qty_max: f.qty_max ? Number(f.qty_max) : null,
  }
  try {
    if (f.id) await traderCatalogUpdate(token(), f.id, body)
    else await traderCatalogCreate(token(), { item_key: f.item_key, ...body })
    toastSuccess(f.id ? 'Предмет обновлён' : 'Предмет добавлен')
    modal.value = false
    await loadCatalog(cat.value.page)
  } catch (e) { toastError(e.message || 'Не удалось сохранить') }
}
async function removeItem(item) {
  if (!(await confirmDialog({ title: 'Удалить из каталога', message: `Убрать «${item.display_name}»? Уже выпавшие лоты не изменятся.`, confirmLabel: 'Удалить', danger: true }))) return
  try {
    await traderCatalogDelete(token(), item.id)
    await loadCatalog(cat.value.page)
  } catch (e) { toastError(e.message || 'Ошибка') }
}

// ── visits & trades ──────────────────────────────────────────────────────
const visits = ref({ items: [], total: 0, page: 1, per_page: 20 })
async function loadVisits(page = 1) {
  try { visits.value = await traderVisits(token(), { page, per_page: 20 }) } catch (e) { toastError(e.message || 'Ошибка') }
}
const visitPages = computed(() => Math.max(1, Math.ceil(visits.value.total / visits.value.per_page)))
const visitDetail = ref(null)
async function openVisit(v) {
  try { visitDetail.value = await traderVisit(token(), v.id) } catch (e) { toastError(e.message || 'Ошибка') }
}

const trades = ref({ items: [], total: 0, page: 1, per_page: 50 })
const tradePlayer = ref('')
let tradeTimer = null
async function loadTrades(page = 1) {
  try { trades.value = await traderTransactions(token(), { player: tradePlayer.value.trim(), page, per_page: 50 }) } catch (e) { toastError(e.message || 'Ошибка') }
}
watch(tradePlayer, () => { clearTimeout(tradeTimer); tradeTimer = setTimeout(() => loadTrades(1), 300) })
const tradePages = computed(() => Math.max(1, Math.ceil(trades.value.total / trades.value.per_page)))

watch(tab, (t) => {
  if (t === 'catalog' && !cat.value.items.length) loadCatalog(1)
  if (t === 'visits') loadVisits(1)
  if (t === 'trades') loadTrades(1)
})

let poll = null
function onVisibility() { if (!document.hidden && tab.value === 'overview') loadStatus() }
onMounted(() => {
  loadStatus()
  poll = setInterval(() => { if (!document.hidden && tab.value === 'overview') loadStatus() }, 15000)
  document.addEventListener('visibilitychange', onVisibility)
})
onUnmounted(() => { clearInterval(poll); document.removeEventListener('visibilitychange', onVisibility) })
</script>

<template>
  <div class="adm-page">
    <div class="adm-head-actions">
      <div>
        <h1 class="adm-title">Скупщик</h1>
        <p class="adm-sub">Странствующий торговец на спавне «{{ activeServer?.name || 'сервера' }}»: общие лоты на всех, торговля только правым кликом по NPC.</p>
      </div>
    </div>

    <div class="adm-tabs">
      <button v-for="tb in TABS" :key="tb.key" class="adm-tab" :class="{ 'adm-tab--active': tab === tb.key }" @click="tab = tb.key">{{ tb.label }}</button>
    </div>

    <div v-if="loading" class="adm-empty">Загрузка…</div>

    <!-- ═══ overview ═══ -->
    <template v-else-if="tab === 'overview' && status">
      <div v-if="!status.config.enabled" class="tr-alert">Скупщик выключен — включите его во вкладке «Настройки», когда проверите каталог и цены.</div>

      <div class="tr-cards">
        <div class="adm-card adm-card--pad">
          <p class="adm-label">Сейчас</p>
          <template v-if="status.active">
            <p class="tr-big">{{ KIND[status.active.kind] }} скупщик на спавне</p>
            <p class="adm-sub">До {{ dt(status.active.ends_at) }} · стадии: {{ status.active.phases.map((p) => PHASE[p]).join(', ') }}</p>
            <p class="adm-sub">Выплачено игрокам {{ money(status.active.paid_out) }} из бюджета {{ money(status.active.payout_budget) }} · получено {{ money(status.active.earned) }} · сделок {{ status.active.trades }}, игроков {{ status.active.players }}</p>
            <button v-if="canManage" class="adm-btn adm-btn--danger adm-btn--sm" style="margin-top:10px" @click="endVisit">Завершить визит</button>
          </template>
          <template v-else>
            <p class="tr-big">Скупщика нет</p>
            <p class="adm-sub">Следующий визит: {{ dt(status.next_start) }}</p>
          </template>
          <div v-if="canManage && !status.active" class="tr-row">
            <button class="adm-btn adm-btn--acc adm-btn--sm" :disabled="forcing" @click="forceVisit('normal')">Вызвать обычного</button>
            <button class="adm-btn adm-btn--ghost adm-btn--sm" :disabled="forcing" @click="forceVisit('weekend')">Выходного дня</button>
            <button class="adm-btn adm-btn--ghost adm-btn--sm" :disabled="forcing" @click="forceVisit('elite')">Элитного</button>
          </div>
        </div>

        <div class="adm-card adm-card--pad">
          <p class="adm-label">Стадии по среднему уровню Battle Pass</p>
          <p class="tr-big">{{ status.phases.avg_bp_level }} <span class="adm-sub">ур. у {{ status.phases.active_players }} активных игроков</span></p>
          <p class="adm-sub">Мид-гейм: {{ status.phases.mid_unlocked_at ? 'открыт ' + dt(status.phases.mid_unlocked_at) : 'откроется на ' + status.config.mid_avg_bp_level + ' ур.' }}</p>
          <p class="adm-sub">Эндгейм: {{ status.phases.end_unlocked_at ? 'открыт ' + dt(status.phases.end_unlocked_at) : 'откроется на ' + status.config.end_avg_bp_level + ' ур.' }}</p>
          <p class="adm-sub">Нужно минимум {{ status.config.min_active_players }} активных за {{ status.config.active_days }} дн.</p>
        </div>

        <div class="adm-card adm-card--pad">
          <p class="adm-label">Каталог (включённые)</p>
          <table class="tr-mini">
            <thead><tr><th></th><th>★</th><th>★★</th><th>★★★</th></tr></thead>
            <tbody>
              <tr v-for="ph in ['early', 'mid', 'end']" :key="ph">
                <td>{{ PHASE[ph] }}</td>
                <td v-for="r in [1, 2, 3]" :key="r" :class="{ zero: !(catalogSummary[ph] && catalogSummary[ph][r]) }">{{ (catalogSummary[ph] && catalogSummary[ph][r]) || 0 }}</td>
              </tr>
            </tbody>
          </table>
          <p class="adm-sub">Каждые {{ status.config.interval_minutes }} мин на {{ status.config.duration_minutes }} мин · бюджет выплат {{ money(status.config.payout_budget) }}</p>
        </div>
      </div>

      <div class="adm-card adm-card--pad" style="margin-top:14px">
        <div class="adm-head-actions">
          <div>
            <p class="adm-label">Пробный бросок</p>
            <p class="adm-sub">Как выпадет визит с текущим каталогом и настройками. Ничего не сохраняется.</p>
          </div>
          <div class="tr-row" style="margin:0">
            <button class="adm-btn adm-btn--ghost adm-btn--sm" :disabled="previewing" @click="runPreview('normal')">Обычный</button>
            <button class="adm-btn adm-btn--ghost adm-btn--sm" :disabled="previewing" @click="runPreview('weekend')">Выходного дня</button>
            <button class="adm-btn adm-btn--ghost adm-btn--sm" :disabled="previewing" @click="runPreview('elite')">Элитный</button>
          </div>
        </div>
        <template v-if="preview">
          <p class="adm-sub" style="margin:8px 0">{{ KIND[preview.kind] }} · стадии {{ preview.phases.map((p) => PHASE[p]).join(', ') }} · скупка на {{ money(previewTotals.buy) }} (бюджет {{ money(preview.payout_budget) }}) · продажа на {{ money(previewTotals.sell) }}</p>
          <div class="tr-preview">
            <div v-for="side in ['buy', 'sell']" :key="side">
              <p class="adm-label">{{ side === 'buy' ? 'Скупает' : 'Продаёт' }}</p>
              <div class="tr-pgrid">
                <div v-for="s in preview.slots.filter((x) => x.side === side)" :key="side + s.slot" class="tr-pslot" :class="'r' + s.rarity" :title="`${s.display_name} · ${s.qty} × ${money(s.unit_price)}`">
                  <ItemIcon :itemKey="s.item_key" :size="28" />
                  <span>{{ s.qty }}</span>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </template>

    <!-- ═══ catalog ═══ -->
    <template v-else-if="tab === 'catalog'">
      <div class="tr-toolbar">
        <input v-model="catQ" class="adm-input" placeholder="Поиск по названию или ID…" style="max-width:280px" />
        <select v-model="catRarity" class="adm-select"><option value="">Все редкости</option><option v-for="r in [1, 2, 3]" :key="r" :value="r">{{ RARITY[r] }}</option></select>
        <select v-model="catPhase" class="adm-select"><option value="">Все стадии</option><option v-for="(l, k) in PHASE" :key="k" :value="k">{{ l }}</option></select>
        <select v-model="catEnabled" class="adm-select"><option value="">Вкл и выкл</option><option value="true">Включённые</option><option value="false">Выключенные</option></select>
        <span class="adm-sub">{{ cat.total }} предметов</span>
        <button v-if="canManage" class="adm-btn adm-btn--acc adm-btn--sm" style="margin-left:auto" @click="openCreate">+ Добавить</button>
      </div>
      <div v-if="canManage && selectedIds.size" class="tr-bulk">
        <span>Выбрано {{ selectedIds.size }}</span>
        <button class="adm-btn adm-btn--ok adm-btn--sm" @click="bulk({ enabled: true }, 'Включено')">Включить</button>
        <button class="adm-btn adm-btn--ghost adm-btn--sm" @click="bulk({ enabled: false }, 'Выключено')">Выключить</button>
        <select class="adm-select" @change="bulk({ phase: $event.target.value }, 'Стадия изменена'); $event.target.value = ''"><option value="">Стадия…</option><option v-for="(l, k) in PHASE" :key="k" :value="k">{{ l }}</option></select>
        <select class="adm-select" @change="bulk({ rarity: Number($event.target.value) }, 'Редкость изменена'); $event.target.value = ''"><option value="">Редкость…</option><option v-for="r in [1, 2, 3]" :key="r" :value="r">{{ RARITY[r] }}</option></select>
        <input v-model.number="bulkMult" class="adm-input" type="number" step="0.1" min="0.1" style="width:80px" />
        <button class="adm-btn adm-btn--ghost adm-btn--sm" @click="bulk({ value_mult: bulkMult }, 'Цены умножены')">× цену</button>
      </div>
      <div class="adm-table-wrap">
        <table class="adm-table">
          <thead><tr>
            <th v-if="canManage"><input type="checkbox" :checked="cat.items.length && selectedIds.size === cat.items.length" @change="toggleAll" /></th>
            <th></th><th>Предмет</th><th>Редкость</th><th>Стадия</th><th class="ar">Ценность</th><th>Скупает / продаёт</th><th class="ar">Кол-во</th><th>Статус</th><th></th>
          </tr></thead>
          <tbody>
            <tr v-if="catLoading"><td colspan="10" class="adm-empty">Загрузка…</td></tr>
            <tr v-else-if="!cat.items.length"><td colspan="10" class="adm-empty">Ничего не найдено</td></tr>
            <template v-else>
            <tr v-for="it in cat.items" :key="it.id" :class="{ 'tr-off': !it.enabled }">
              <td v-if="canManage"><input type="checkbox" :checked="selectedIds.has(it.id)" @change="toggleSel(it.id)" /></td>
              <td><ItemIcon :itemKey="it.item_key" :size="26" /></td>
              <td><div>{{ it.display_name }}</div><div class="adm-mono tr-id">{{ it.item_key }}</div></td>
              <td class="tr-stars" :class="'r' + it.rarity">{{ RARITY[it.rarity] }}</td>
              <td>{{ PHASE[it.phase] }}</td>
              <td class="ar adm-num">{{ money(it.unit_value) }}</td>
              <td>{{ it.can_buy ? 'да' : '—' }} / {{ it.can_sell ? 'да' : '—' }}</td>
              <td class="ar adm-num">{{ it.qty_min ? `${it.qty_min}–${it.qty_max}` : 'по редкости' }}</td>
              <td><button class="adm-btn adm-btn--sm" :class="it.enabled ? 'adm-btn--ok' : 'adm-btn--ghost'" :disabled="!canManage" @click="toggleItem(it)">{{ it.enabled ? 'вкл' : 'выкл' }}</button></td>
              <td class="ar"><template v-if="canManage"><button class="adm-btn adm-btn--ghost adm-btn--sm" @click="openEdit(it)">✎</button> <button class="adm-btn adm-btn--danger adm-btn--sm" @click="removeItem(it)">✕</button></template></td>
            </tr>
            </template>
          </tbody>
        </table>
      </div>
      <div v-if="catPages > 1" class="adm-pager">
        <span class="adm-pager__info">Стр. {{ cat.page }} / {{ catPages }} · всего {{ cat.total }}</span>
        <div class="adm-head-actions">
          <button class="adm-btn adm-btn--sm" :disabled="cat.page <= 1" @click="loadCatalog(cat.page - 1)">← Назад</button>
          <button class="adm-btn adm-btn--sm" :disabled="cat.page >= catPages" @click="loadCatalog(cat.page + 1)">Вперёд →</button>
        </div>
      </div>
    </template>

    <!-- ═══ visits ═══ -->
    <template v-else-if="tab === 'visits'">
      <div class="adm-table-wrap">
        <table class="adm-table">
          <thead><tr><th>Начало</th><th>Тип</th><th>Стадии</th><th class="ar">Выплачено</th><th class="ar">Бюджет</th><th class="ar">Получено</th><th class="ar">Игроков</th><th class="ar">Сделок</th><th>Кто</th><th></th></tr></thead>
          <tbody>
            <tr v-if="!visits.items.length"><td colspan="10" class="adm-empty">Визитов ещё не было</td></tr>
            <tr v-for="v in visits.items" :key="v.id">
              <td>{{ dt(v.starts_at) }}</td>
              <td>{{ KIND[v.kind] }}</td>
              <td>{{ v.phases.map((p) => PHASE[p]).join(', ') }}</td>
              <td class="ar adm-num">{{ money(v.paid_out) }}</td>
              <td class="ar adm-num">{{ money(v.payout_budget) }}</td>
              <td class="ar adm-num">{{ money(v.earned) }}</td>
              <td class="ar adm-num">{{ v.players }}</td>
              <td class="ar adm-num">{{ v.trades }}</td>
              <td>{{ v.source === 'admin' ? v.created_by : 'расписание' }}</td>
              <td class="ar"><button class="adm-btn adm-btn--ghost adm-btn--sm" @click="openVisit(v)">Лоты</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="visitPages > 1" class="adm-pager">
        <span class="adm-pager__info">Стр. {{ visits.page }} / {{ visitPages }}</span>
        <div class="adm-head-actions">
          <button class="adm-btn adm-btn--sm" :disabled="visits.page <= 1" @click="loadVisits(visits.page - 1)">← Назад</button>
          <button class="adm-btn adm-btn--sm" :disabled="visits.page >= visitPages" @click="loadVisits(visits.page + 1)">Вперёд →</button>
        </div>
      </div>
    </template>

    <!-- ═══ trades ═══ -->
    <template v-else-if="tab === 'trades'">
      <div class="tr-toolbar"><input v-model="tradePlayer" class="adm-input" placeholder="Ник игрока…" style="max-width:240px" /><span class="adm-sub">{{ trades.total }} сделок</span></div>
      <div class="adm-table-wrap">
        <table class="adm-table">
          <thead><tr><th>Время</th><th>Игрок</th><th>Сделка</th><th>Предмет</th><th class="ar">Кол-во</th><th class="ar">Цена</th><th class="ar">Сумма</th><th>Статус</th></tr></thead>
          <tbody>
            <tr v-if="!trades.items.length"><td colspan="8" class="adm-empty">Сделок нет</td></tr>
            <tr v-for="x in trades.items" :key="x.id">
              <td>{{ dt(x.created_at) }}</td>
              <td>{{ x.player_name }}</td>
              <td>{{ x.side === 'buy' ? 'сдал' : 'купил' }}</td>
              <td><span class="tr-item"><ItemIcon :itemKey="x.item_key" :size="20" /><span class="adm-mono tr-id">{{ x.item_key }}</span></span></td>
              <td class="ar adm-num">{{ x.qty_done }}<span v-if="x.qty_done !== x.qty_requested" class="adm-sub"> / {{ x.qty_requested }}</span></td>
              <td class="ar adm-num">{{ money(x.unit_price) }}</td>
              <td class="ar adm-num">{{ money(x.total) }}</td>
              <td :title="x.error || ''"><span class="adm-badge" :class="{ 'adm-badge--ok': x.status === 'done', 'adm-badge--err': x.status === 'failed' || x.status === 'expired', 'adm-badge--info': x.status === 'pending' }">{{ STATUS[x.status] }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="tradePages > 1" class="adm-pager">
        <span class="adm-pager__info">Стр. {{ trades.page }} / {{ tradePages }}</span>
        <div class="adm-head-actions">
          <button class="adm-btn adm-btn--sm" :disabled="trades.page <= 1" @click="loadTrades(trades.page - 1)">← Назад</button>
          <button class="adm-btn adm-btn--sm" :disabled="trades.page >= tradePages" @click="loadTrades(trades.page + 1)">Вперёд →</button>
        </div>
      </div>
    </template>

    <!-- ═══ settings ═══ -->
    <template v-else-if="tab === 'settings' && cfg">
      <fieldset class="tr-set" :disabled="!canManage">
        <section class="adm-card adm-card--pad">
          <p class="adm-label">Основное</p>
          <label class="adm-check"><input v-model="cfg.enabled" type="checkbox" /> Скупщик включён</label>
          <div class="tr-fields">
            <label class="adm-field"><span class="adm-label">Мир</span><input v-model="cfg.spawn.world" class="adm-input" /></label>
            <label class="adm-field"><span class="adm-label">X</span><input v-model.number="cfg.spawn.x" class="adm-input" type="number" step="0.5" /></label>
            <label class="adm-field"><span class="adm-label">Y</span><input v-model.number="cfg.spawn.y" class="adm-input" type="number" step="0.5" /></label>
            <label class="adm-field"><span class="adm-label">Z</span><input v-model.number="cfg.spawn.z" class="adm-input" type="number" step="0.5" /></label>
            <label class="adm-field"><span class="adm-label">Поворот (yaw)</span><input v-model.number="cfg.spawn.yaw" class="adm-input" type="number" /></label>
            <label class="adm-field"><span class="adm-label">Радиус торговли, блоков</span><input v-model.number="cfg.interact_radius" class="adm-input" type="number" min="2" max="32" /></label>
          </div>
          <p class="adm-sub">Точку удобнее ставить в игре: встаньте на место и выполните <code>/vrgs trader here</code>.</p>
        </section>

        <section class="adm-card adm-card--pad">
          <p class="adm-label">Расписание (время {{ cfg.timezone }})</p>
          <div class="tr-fields">
            <label class="adm-field"><span class="adm-label">Приходит каждые, мин</span><input v-model.number="cfg.interval_minutes" class="adm-input" type="number" min="10" /></label>
            <label class="adm-field"><span class="adm-label">Стоит, мин</span><input v-model.number="cfg.duration_minutes" class="adm-input" type="number" min="1" /></label>
            <label class="adm-field"><span class="adm-label">Сдвиг от полуночи, мин</span><input v-model.number="cfg.offset_minutes" class="adm-input" type="number" min="0" /></label>
            <label class="adm-field"><span class="adm-label">Уведомление заранее, мин</span><input v-model.number="cfg.announce_before_minutes" class="adm-input" type="number" min="0" /></label>
            <label class="adm-field"><span class="adm-label">Сессия после клика, мин</span><input v-model.number="cfg.session_minutes" class="adm-input" type="number" min="1" /></label>
          </div>
        </section>

        <section class="adm-card adm-card--pad">
          <p class="adm-label">Лоты</p>
          <div class="tr-fields">
            <label class="adm-field"><span class="adm-label">Слотов скупки</span><input v-model.number="cfg.slots_buy" class="adm-input" type="number" min="0" max="54" /></label>
            <label class="adm-field"><span class="adm-label">Слотов продажи</span><input v-model.number="cfg.slots_sell" class="adm-input" type="number" min="0" max="54" /></label>
            <label class="adm-field"><span class="adm-label">Доля одного игрока, %</span><input v-model.number="cfg.player_share_pct" class="adm-input" type="number" min="1" max="100" /></label>
            <label class="adm-field"><span class="adm-label">Лимит ★★ на визит</span><input v-model.number="cfg.cap_rarity2" class="adm-input" type="number" min="0" /></label>
            <label class="adm-field"><span class="adm-label">Лимит ★★★ на визит</span><input v-model.number="cfg.cap_rarity3" class="adm-input" type="number" min="0" /></label>
          </div>
          <div class="tr-fields">
            <label v-for="(w, i) in cfg.weights_normal" :key="'n' + i" class="adm-field"><span class="adm-label">Шанс {{ RARITY[i + 1] }}, % (обычный)</span><input v-model.number="cfg.weights_normal[i]" class="adm-input" type="number" min="0" step="0.5" /></label>
            <label v-for="(w, i) in cfg.weights_weekend" :key="'w' + i" class="adm-field"><span class="adm-label">Шанс {{ RARITY[i + 1] }}, % (выходные)</span><input v-model.number="cfg.weights_weekend[i]" class="adm-input" type="number" min="0" step="0.5" /></label>
          </div>
          <div class="tr-fields">
            <label v-for="r in [1, 2, 3]" :key="'q' + r" class="adm-field"><span class="adm-label">Кол-во {{ RARITY[r] }}: от–до</span>
              <span class="tr-pair"><input v-model.number="cfg['qty_rarity' + r][0]" class="adm-input" type="number" min="1" /><input v-model.number="cfg['qty_rarity' + r][1]" class="adm-input" type="number" min="1" /></span>
            </label>
            <label class="adm-field"><span class="adm-label">Множитель кол-ва в выходные</span><input v-model.number="cfg.weekend_qty_mult" class="adm-input" type="number" min="1" step="0.1" /></label>
          </div>
        </section>

        <section class="adm-card adm-card--pad">
          <p class="adm-label">Элитный скупщик</p>
          <div class="tr-fields">
            <label class="adm-field"><span class="adm-label">Шанс вместо обычного, %</span><input v-model.number="cfg.elite_chance_pct" class="adm-input" type="number" min="0" step="0.5" /></label>
            <label class="adm-field"><span class="adm-label">Стоит, мин</span><input v-model.number="cfg.elite_duration_minutes" class="adm-input" type="number" min="1" /></label>
            <label class="adm-field"><span class="adm-label">Слотов на сторону</span><input v-model.number="cfg.elite_slots" class="adm-input" type="number" min="1" max="54" /></label>
            <label v-for="(w, i) in cfg.elite_weights" :key="'e' + i" class="adm-field"><span class="adm-label">Шанс {{ RARITY[i + 1] }}, %</span><input v-model.number="cfg.elite_weights[i]" class="adm-input" type="number" min="0" step="0.5" /></label>
          </div>
        </section>

        <section class="adm-card adm-card--pad">
          <p class="adm-label">Цены и бюджет</p>
          <div class="tr-fields">
            <label class="adm-field"><span class="adm-label">Скупает по: ценность ×</span><input v-model.number="cfg.buy_price_mult" class="adm-input" type="number" min="0.01" step="0.05" /></label>
            <label class="adm-field"><span class="adm-label">Продаёт по: ценность ×</span><input v-model.number="cfg.sell_price_mult" class="adm-input" type="number" min="0.01" step="0.05" /></label>
            <label class="adm-field"><span class="adm-label">Бюджет выплат за визит</span><input v-model.number="cfg.payout_budget" class="adm-input" type="number" min="0" /></label>
            <label class="adm-field"><span class="adm-label">Бюджет в выходные ×</span><input v-model.number="cfg.weekend_budget_mult" class="adm-input" type="number" min="1" step="0.1" /></label>
            <label class="adm-field"><span class="adm-label">Бюджет элитного ×</span><input v-model.number="cfg.elite_budget_mult" class="adm-input" type="number" min="1" step="0.1" /></label>
          </div>
          <p class="adm-sub">Если выпавшие лоты скупки дороже бюджета, их количество уменьшается. Так визит не может выдать игрокам больше денег, чем бюджет.</p>
        </section>

        <section class="adm-card adm-card--pad">
          <p class="adm-label">Открытие стадий</p>
          <div class="tr-fields">
            <label class="adm-field"><span class="adm-label">Мид-гейм: средний уровень BP</span><input v-model.number="cfg.mid_avg_bp_level" class="adm-input" type="number" min="0" /></label>
            <label class="adm-field"><span class="adm-label">Эндгейм: средний уровень BP</span><input v-model.number="cfg.end_avg_bp_level" class="adm-input" type="number" min="0" /></label>
            <label class="adm-field"><span class="adm-label">Активные — заходили за, дней</span><input v-model.number="cfg.active_days" class="adm-input" type="number" min="1" /></label>
            <label class="adm-field"><span class="adm-label">Минимум активных игроков</span><input v-model.number="cfg.min_active_players" class="adm-input" type="number" min="1" /></label>
          </div>
          <label class="adm-check"><input v-model="phaseForm.mid_unlocked" type="checkbox" /> Мид-гейм открыт</label>
          <label class="adm-check"><input v-model="phaseForm.end_unlocked" type="checkbox" /> Эндгейм открыт</label>
          <p class="adm-sub">Стадия открывается сама при достижении порога и больше не закрывается. Здесь можно открыть или закрыть её вручную, например после вайпа.</p>
        </section>
      </fieldset>
      <div v-if="canManage" class="tr-save">
        <button class="adm-btn adm-btn--acc" :disabled="savingCfg" @click="saveSettings">{{ savingCfg ? 'Сохранение…' : 'Сохранить настройки' }}</button>
      </div>
    </template>

    <!-- catalog item modal -->
    <div v-if="modal" class="adm-modal-backdrop" @click.self="modal = false">
      <div class="adm-modal" style="width:min(620px,94vw)">
        <h2 class="adm-title">{{ form.id ? 'Изменить предмет' : 'Новый предмет' }}</h2>
        <div class="tr-sel">
          <ItemIcon v-if="form.item_key" :itemKey="form.item_key" :size="40" />
          <div><div>{{ form.display_name || 'Предмет не выбран' }}</div><div class="adm-mono tr-id">{{ form.item_key || '—' }}</div></div>
          <button v-if="!form.id" class="adm-btn adm-btn--ghost adm-btn--sm" style="margin-left:auto" @click="pickerOpen = !pickerOpen">{{ pickerOpen ? 'Скрыть' : 'Выбрать предмет' }}</button>
        </div>
        <div v-if="pickerOpen" class="tr-picker">
          <input v-model="pickerQ" class="adm-input" placeholder="Поиск: алмаз, steel, …" />
          <div class="tr-picker__grid">
            <button v-for="it in pickerResults" :key="it.id" class="tr-pick" :class="{ sel: form.item_key === it.id }" :title="it.id" @click="pickItem(it)">
              <ItemIcon :itemKey="it.id" :size="24" /><span>{{ it.name }}</span>
            </button>
          </div>
        </div>
        <div class="tr-fields">
          <label class="adm-field" style="grid-column:1/-1"><span class="adm-label">Название</span><input v-model="form.display_name" class="adm-input" /></label>
          <label class="adm-field"><span class="adm-label">Редкость</span><select v-model.number="form.rarity" class="adm-select"><option v-for="r in [1, 2, 3]" :key="r" :value="r">{{ RARITY[r] }}</option></select></label>
          <label class="adm-field"><span class="adm-label">Стадия</span><select v-model="form.phase" class="adm-select"><option v-for="(l, k) in PHASE" :key="k" :value="k">{{ l }}</option></select></label>
          <label class="adm-field"><span class="adm-label">Ценность за штуку</span><input v-model.number="form.unit_value" class="adm-input" type="number" min="0.01" step="0.01" /></label>
          <label class="adm-field"><span class="adm-label">Кол-во от (пусто — по редкости)</span><input v-model.number="form.qty_min" class="adm-input" type="number" min="1" /></label>
          <label class="adm-field"><span class="adm-label">Кол-во до</span><input v-model.number="form.qty_max" class="adm-input" type="number" min="1" /></label>
        </div>
        <label class="adm-check"><input v-model="form.can_buy" type="checkbox" /> Скупщик может скупать у игроков</label>
        <label class="adm-check"><input v-model="form.can_sell" type="checkbox" /> Скупщик может продавать игрокам (не включайте для предметов, открывающих эпохи)</label>
        <label class="adm-check"><input v-model="form.enabled" type="checkbox" /> Участвует в бросках</label>
        <label class="adm-field"><span class="adm-label">Заметка</span><input v-model="form.note" class="adm-input" /></label>
        <div class="adm-head-actions" style="margin-top:14px">
          <button class="adm-btn adm-btn--ghost" @click="modal = false">Отмена</button>
          <button class="adm-btn adm-btn--acc" @click="saveItem">Сохранить</button>
        </div>
      </div>
    </div>

    <!-- visit detail modal -->
    <div v-if="visitDetail" class="adm-modal-backdrop" @click.self="visitDetail = null">
      <div class="adm-modal" style="width:min(760px,94vw)">
        <h2 class="adm-title">{{ KIND[visitDetail.kind] }} скупщик · {{ dt(visitDetail.starts_at) }}</h2>
        <p class="adm-sub">Выплачено {{ money(visitDetail.paid_out) }} из {{ money(visitDetail.payout_budget) }} · получено {{ money(visitDetail.earned) }}</p>
        <div class="adm-table-wrap" style="max-height:60vh;overflow:auto">
          <table class="adm-table">
            <thead><tr><th></th><th>Предмет</th><th>Сторона</th><th>Редкость</th><th class="ar">Цена</th><th class="ar">Разобрали</th></tr></thead>
            <tbody>
              <tr v-for="s in visitDetail.stock" :key="s.id">
                <td><ItemIcon :itemKey="s.item_key" :size="22" /></td>
                <td>{{ s.display_name }}</td>
                <td>{{ s.side === 'buy' ? 'скупает' : 'продаёт' }}</td>
                <td class="tr-stars" :class="'r' + s.rarity">{{ RARITY[s.rarity] }}</td>
                <td class="ar adm-num">{{ money(s.unit_price) }}</td>
                <td class="ar adm-num">{{ s.qty_total - s.qty_left }} / {{ s.qty_total }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="adm-head-actions" style="margin-top:12px"><button class="adm-btn adm-btn--ghost" @click="visitDetail = null">Закрыть</button></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tr-alert { margin: 12px 0; padding: 10px 14px; border-radius: 10px; border: 1px solid rgba(251, 191, 36, 0.35); background: rgba(251, 191, 36, 0.08); color: #fcd34d; font-size: 0.88rem; }
.tr-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; margin-top: 14px; }
.tr-big { margin: 6px 0 4px; font-size: 1.15rem; font-weight: 800; }
.tr-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
.tr-mini { width: 100%; margin: 8px 0; border-collapse: collapse; font-size: 0.86rem; }
.tr-mini th, .tr-mini td { padding: 4px 6px; text-align: right; }
.tr-mini td:first-child, .tr-mini th:first-child { text-align: left; }
.tr-mini td.zero { opacity: 0.4; }
.tr-preview { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 14px; }
.tr-pgrid { display: grid; grid-template-columns: repeat(9, minmax(0, 1fr)); gap: 4px; margin-top: 6px; }
.tr-pslot { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 4px 2px; border-radius: 6px; font-size: 0.66rem; border: 1px solid rgba(148, 163, 184, 0.25); }
.tr-pslot.r2 { border-color: rgba(96, 165, 250, 0.55); }
.tr-pslot.r3 { border-color: rgba(251, 191, 36, 0.7); box-shadow: 0 0 10px -4px rgba(251, 191, 36, 0.7); }
.tr-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 14px 0 10px; }
.tr-bulk { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-bottom: 10px; padding: 8px 10px; border-radius: 10px; background: rgba(139, 92, 246, 0.08); font-size: 0.86rem; }
.tr-id { font-size: 0.72rem; opacity: 0.6; }
.tr-off { opacity: 0.55; }
.tr-stars { white-space: nowrap; }
.tr-stars.r2 { color: #60a5fa; }
.tr-stars.r3 { color: #fbbf24; }
.tr-item { display: inline-flex; align-items: center; gap: 6px; }
.tr-set { display: grid; gap: 14px; margin: 14px 0 0; padding: 0; border: 0; }
.tr-fields { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 10px; margin: 10px 0; }
.tr-pair { display: flex; gap: 6px; }
.tr-save { position: sticky; bottom: 0; display: flex; justify-content: flex-end; padding: 12px 0; }
.tr-sel { display: flex; align-items: center; gap: 12px; margin: 12px 0; }
.tr-picker { margin-bottom: 12px; }
.tr-picker__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 4px; max-height: 240px; overflow: auto; margin-top: 8px; }
.tr-pick { display: flex; align-items: center; gap: 6px; padding: 5px 6px; border-radius: 8px; border: 1px solid transparent; background: rgba(255, 255, 255, 0.03); color: inherit; font: inherit; font-size: 0.78rem; text-align: left; cursor: pointer; }
.tr-pick.sel, .tr-pick:hover { border-color: rgba(139, 92, 246, 0.5); }
.tr-pick span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
