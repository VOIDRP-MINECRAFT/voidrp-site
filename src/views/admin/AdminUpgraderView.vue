<script setup>
import { ref, computed, onMounted } from 'vue'
import { authState, hasPermission } from '../../stores/authStore'
import { confirmDialog } from '../../composables/useConfirm'
import { toastSuccess, toastError } from '../../services/toast'
import {
  adminGetUpgraderConfig, adminUpdateUpgraderConfig, adminListUpgraderRewards,
  adminCreateUpgraderReward, adminUpdateUpgraderReward, adminDeleteUpgraderReward,
  adminImportUpgraderMarket,
} from '../../services/upgraderAdminApi'
import ItemIcon from '../../components/ItemIcon.vue'

const token = () => authState.accessToken
const canManage = computed(() => hasPermission('upgrader.manage'))

const loading = ref(true)
const rewards = ref([])
const config = ref({ rtp: 0.9, coins_per_vc: 1000, min_stake: 1, max_multiplier: 100, max_chance: 0.9 })

// settings editor
const cfgModal = ref(false)
const cfgForm = ref({})
const cfgSaving = ref(false)
function openConfig() { cfgForm.value = { ...config.value, rtp_pct: Math.round(config.value.rtp * 100), max_chance_pct: Math.round(config.value.max_chance * 100) }; cfgModal.value = true }
async function saveConfig() {
  cfgSaving.value = true
  try {
    const upd = await adminUpdateUpgraderConfig(token(), {
      rtp: Math.min(1, Math.max(0.5, (cfgForm.value.rtp_pct || 90) / 100)),
      coins_per_vc: Math.max(1, Math.round(cfgForm.value.coins_per_vc)),
      min_stake: Math.max(1, Math.round(cfgForm.value.min_stake)),
      max_multiplier: Math.max(1.5, Number(cfgForm.value.max_multiplier)),
      max_chance: Math.min(0.99, Math.max(0.05, (cfgForm.value.max_chance_pct || 90) / 100)),
    })
    config.value = upd
    cfgModal.value = false
    toastSuccess('Настройки сохранены')
  } catch (e) { toastError(e.message || 'Ошибка') } finally { cfgSaving.value = false }
}

const TIERS = ['common', 'rare', 'epic', 'legendary']
const tierLabel = { common: 'Обычный', rare: 'Редкий', epic: 'Эпический', legendary: 'Легендарный' }
const tierColor = { common: '#94a3b8', rare: '#38bdf8', epic: '#a78bfa', legendary: '#fbbf24' }

function money(v) { return Number(v || 0).toLocaleString('ru-RU') }

async function load() {
  loading.value = true
  try {
    const [cfg, rw] = await Promise.all([adminGetUpgraderConfig(token()), adminListUpgraderRewards(token())])
    config.value = cfg
    rewards.value = rw
  } catch (e) { toastError(e.message || 'Ошибка загрузки') } finally { loading.value = false }
}

// ── item catalog (client-side search) ─────────────────────────────────────
const catalog = ref([])
const catalogReady = ref(false)
async function loadCatalog() {
  try {
    const r = await fetch('/item_catalog.json', { cache: 'force-cache' })
    catalog.value = await r.json()
  } catch { catalog.value = [] } finally { catalogReady.value = true }
}
const pickerQ = ref('')
const pickerResults = computed(() => {
  const q = pickerQ.value.trim().toLowerCase()
  if (!q) return catalog.value.slice(0, 60)
  const out = []
  for (const it of catalog.value) {
    if (it.id.includes(q) || it.name.toLowerCase().includes(q)) { out.push(it); if (out.length >= 60) break }
  }
  return out
})

// ── create / edit modal ───────────────────────────────────────────────────
const blank = () => ({ id: null, item_key: '', display_name: '', vc_value: 50, amount: 1, tier: 'rare', enabled: true, give_command: '' })
const form = ref(blank())
const modalOpen = ref(false)
const pickerOpen = ref(false)

function openCreate() { form.value = blank(); pickerQ.value = ''; pickerOpen.value = true; modalOpen.value = true }
function openEdit(r) { form.value = { ...r, give_command: r.give_command || '' }; pickerOpen.value = false; modalOpen.value = true }
function pickItem(it) {
  form.value.item_key = it.id
  if (!form.value.display_name || !form.value.id) form.value.display_name = it.name
  pickerOpen.value = false
}
function closeModal() { modalOpen.value = false }

async function save() {
  const f = form.value
  if (!f.item_key) { toastError('Выберите предмет'); return }
  if (!f.display_name.trim()) { toastError('Укажите название'); return }
  if (!(f.vc_value >= 1)) { toastError('Цена в Void Coin должна быть ≥ 1'); return }
  try {
    if (f.id) {
      const upd = await adminUpdateUpgraderReward(token(), f.id, {
        display_name: f.display_name.trim(), vc_value: f.vc_value, amount: f.amount, tier: f.tier,
        enabled: f.enabled, give_command: f.give_command.trim() || null,
      })
      const i = rewards.value.findIndex((x) => x.id === f.id)
      if (i >= 0) rewards.value[i] = upd
      toastSuccess('Награда обновлена')
    } else {
      const created = await adminCreateUpgraderReward(token(), {
        item_key: f.item_key, display_name: f.display_name.trim(), vc_value: f.vc_value,
        amount: f.amount, tier: f.tier, enabled: f.enabled, give_command: f.give_command.trim() || null,
      })
      rewards.value.push(created)
      rewards.value.sort((a, b) => a.vc_value - b.vc_value)
      toastSuccess('Награда добавлена')
    }
    modalOpen.value = false
  } catch (e) { toastError(e.message || 'Не удалось сохранить') }
}

async function toggleEnabled(r) {
  try {
    const upd = await adminUpdateUpgraderReward(token(), r.id, { enabled: !r.enabled })
    const i = rewards.value.findIndex((x) => x.id === r.id)
    if (i >= 0) rewards.value[i] = upd
  } catch (e) { toastError(e.message || 'Ошибка') }
}

const importing = ref(false)
async function importMarket() {
  if (!(await confirmDialog({ title: 'Импорт с рынка', message: 'Добавить текущие рыночные предметы в пул как выключенные черновики? Затем включите нужные вручную.', confirmLabel: 'Импортировать' }))) return
  importing.value = true
  try {
    const res = await adminImportUpgraderMarket(token())
    if (res.added > 0) { await load(); toastSuccess(`Добавлено черновиков: ${res.added}`) }
    else toastSuccess('Новых предметов на рынке нет')
  } catch (e) { toastError(e.message || 'Ошибка импорта') } finally { importing.value = false }
}

async function remove(r) {
  if (!(await confirmDialog({ title: 'Удалить награду', message: `Убрать «${r.display_name}» из пула апгрейдера?`, confirmLabel: 'Удалить', danger: true }))) return
  try {
    await adminDeleteUpgraderReward(token(), r.id)
    rewards.value = rewards.value.filter((x) => x.id !== r.id)
    toastSuccess('Удалено')
  } catch (e) { toastError(e.message || 'Ошибка') }
}

onMounted(() => { load(); loadCatalog() })
</script>

<template>
  <div class="adm-page">
    <div class="adm-head-actions">
      <div>
        <h1 class="adm-title">Апгрейдер — награды</h1>
        <p class="adm-sub">Пул предметов, на которые игроки апают Void Coin. Настраивается для активного сервера.</p>
      </div>
      <div v-if="canManage" class="adm-head-actions" style="gap:8px">
        <button class="adm-btn adm-btn--ghost" :disabled="importing" @click="importMarket">{{ importing ? 'Импорт…' : 'Импорт с рынка' }}</button>
        <button class="adm-btn adm-btn--acc" @click="openCreate">+ Добавить предмет</button>
      </div>
    </div>

    <div class="up-cfg">
      <span class="adm-badge adm-badge--info">RTP {{ (config.rtp * 100).toFixed(0) }}%</span>
      <span class="adm-badge">1 VC = {{ money(config.coins_per_vc) }} монет</span>
      <span class="adm-badge">макс ×{{ config.max_multiplier }}</span>
      <span class="adm-badge">макс шанс {{ (config.max_chance * 100).toFixed(0) }}%</span>
      <span class="adm-badge adm-badge--ok">{{ rewards.filter((r) => r.enabled).length }} активно</span>
      <span class="adm-badge">{{ rewards.length }} всего</span>
      <button v-if="canManage" class="adm-btn adm-btn--ghost adm-btn--sm" @click="openConfig">⚙ Настройки</button>
    </div>

    <div v-if="loading" class="adm-empty">Загрузка…</div>
    <div v-else-if="!rewards.length" class="adm-empty">Пул пуст. Добавьте предметы или запустите seed-скрипт.</div>

    <div v-else class="adm-table-wrap">
      <table class="adm-table">
        <thead><tr><th></th><th>Предмет</th><th>ID</th><th class="ar">Цена (VC)</th><th class="ar">Кол-во</th><th>Тир</th><th>Статус</th><th></th></tr></thead>
        <tbody>
          <tr v-for="r in rewards" :key="r.id">
            <td><div class="up-ic"><ItemIcon :itemKey="r.item_key" :size="28" /></div></td>
            <td>{{ r.display_name }}</td>
            <td class="adm-mono up-id">{{ r.item_key }}</td>
            <td class="ar adm-num">{{ money(r.vc_value) }}</td>
            <td class="ar adm-num">{{ r.amount }}</td>
            <td><span class="up-tier" :style="{ color: tierColor[r.tier], borderColor: tierColor[r.tier] }">{{ tierLabel[r.tier] || r.tier }}</span></td>
            <td>
              <button class="up-toggle" :class="{ on: r.enabled }" :disabled="!canManage" @click="toggleEnabled(r)">
                {{ r.enabled ? 'вкл' : 'выкл' }}
              </button>
            </td>
            <td class="ar">
              <template v-if="canManage">
                <button class="adm-btn adm-btn--ghost adm-btn--sm" @click="openEdit(r)">✎</button>
                <button class="adm-btn adm-btn--danger adm-btn--sm" @click="remove(r)">✕</button>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- settings modal -->
    <div v-if="cfgModal" class="adm-modal-backdrop" @click.self="cfgModal = false">
      <div class="adm-modal" style="width:min(480px,94vw)">
        <h2 class="adm-title">Настройки апгрейдера</h2>
        <p class="adm-sub">Действуют для активного сервера. Влияют на новые спины сразу.</p>
        <div class="up-fields" style="margin-top:12px">
          <label class="adm-field"><span class="adm-label">RTP (возврат игроку), %</span><input class="adm-input" type="number" min="50" max="100" v-model.number="cfgForm.rtp_pct" /></label>
          <label class="adm-field"><span class="adm-label">Макс. шанс, %</span><input class="adm-input" type="number" min="5" max="99" v-model.number="cfgForm.max_chance_pct" /></label>
          <label class="adm-field"><span class="adm-label">Курс: 1 VC = N монет</span><input class="adm-input" type="number" min="1" v-model.number="cfgForm.coins_per_vc" /></label>
          <label class="adm-field"><span class="adm-label">Мин. ставка (VC)</span><input class="adm-input" type="number" min="1" v-model.number="cfgForm.min_stake" /></label>
          <label class="adm-field up-wide"><span class="adm-label">Макс. множитель (×)</span><input class="adm-input" type="number" min="1.5" step="0.5" v-model.number="cfgForm.max_multiplier" /></label>
        </div>
        <p class="adm-sub" style="margin-top:10px">Дом забирает {{ (100 - (cfgForm.rtp_pct || 90)).toFixed(0) }}%. Курс влияет только на импорт с рынка и seed, не на уже добавленные награды.</p>
        <div class="adm-head-actions" style="margin-top:14px">
          <button class="adm-btn adm-btn--ghost" @click="cfgModal = false">Отмена</button>
          <button class="adm-btn adm-btn--acc" :disabled="cfgSaving" @click="saveConfig">{{ cfgSaving ? 'Сохранение…' : 'Сохранить' }}</button>
        </div>
      </div>
    </div>

    <!-- modal -->
    <div v-if="modalOpen" class="adm-modal-backdrop" @click.self="closeModal">
      <div class="adm-modal up-modal">
        <h2 class="adm-title">{{ form.id ? 'Изменить награду' : 'Новая награда' }}</h2>

        <!-- selected item + picker toggle -->
        <div class="up-sel">
          <div class="up-ic up-ic--lg"><ItemIcon v-if="form.item_key" :itemKey="form.item_key" :size="40" /></div>
          <div class="up-sel-info">
            <div class="up-sel-name">{{ form.display_name || 'Предмет не выбран' }}</div>
            <div class="adm-mono up-id">{{ form.item_key || '—' }}</div>
          </div>
          <button v-if="!form.id" class="adm-btn adm-btn--ghost adm-btn--sm" @click="pickerOpen = !pickerOpen">{{ pickerOpen ? 'Скрыть' : 'Выбрать предмет' }}</button>
        </div>

        <!-- item picker -->
        <div v-if="pickerOpen" class="up-picker">
          <input class="adm-input" v-model="pickerQ" :placeholder="catalogReady ? 'Поиск: алмаз, netherite, ...' : 'Загрузка каталога…'" />
          <div class="up-picker-grid">
            <button v-for="it in pickerResults" :key="it.id" class="up-pick" :class="{ sel: form.item_key === it.id }" @click="pickItem(it)" :title="it.id">
              <ItemIcon :itemKey="it.id" :size="26" />
              <span class="up-pick-name">{{ it.name }}</span>
            </button>
          </div>
          <div class="up-pick-hint">{{ catalog.length ? `${catalog.length} предметов в каталоге` : '' }}</div>
        </div>

        <!-- fields -->
        <div class="up-fields">
          <label class="adm-field"><span class="adm-label">Название</span><input class="adm-input" v-model="form.display_name" /></label>
          <label class="adm-field"><span class="adm-label">Цена в Void Coin</span><input class="adm-input" type="number" min="1" v-model.number="form.vc_value" /></label>
          <label class="adm-field"><span class="adm-label">Количество</span><input class="adm-input" type="number" min="1" v-model.number="form.amount" /></label>
          <label class="adm-field"><span class="adm-label">Тир</span>
            <select class="adm-select" v-model="form.tier"><option v-for="tk in TIERS" :key="tk" :value="tk">{{ tierLabel[tk] }}</option></select>
          </label>
          <label class="adm-field up-wide"><span class="adm-label">Своя give-команда (необязательно, {player})</span><input class="adm-input adm-mono" v-model="form.give_command" placeholder="minecraft:give {player} minecraft:diamond 8" /></label>
          <label class="adm-check up-wide"><input type="checkbox" v-model="form.enabled" /> Активна (участвует в апгрейдере)</label>
        </div>

        <div class="adm-head-actions" style="margin-top:14px">
          <button class="adm-btn adm-btn--ghost" @click="closeModal">Отмена</button>
          <button class="adm-btn adm-btn--acc" @click="save">{{ form.id ? 'Сохранить' : 'Добавить' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.up-cfg { display: flex; flex-wrap: wrap; gap: 8px; margin: 4px 0 16px; }
.ar { text-align: right; }
.up-ic { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 8px; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.08); }
.up-ic--lg { width: 52px; height: 52px; }
.up-id { font-size: 0.72rem; color: #8a90a8; }
.up-tier { font-size: 0.68rem; font-weight: 800; text-transform: uppercase; padding: 1px 7px; border-radius: 6px; border: 1px solid; }
.up-toggle { padding: 3px 11px; border-radius: 7px; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.04); color: #8a90a8; font-weight: 700; font-size: 0.72rem; cursor: pointer; }
.up-toggle.on { color: #34d399; border-color: rgba(52,211,153,0.4); background: rgba(52,211,153,0.1); }
.up-toggle:disabled { cursor: default; opacity: 0.6; }

.up-modal { width: min(640px, 94vw); max-height: 90vh; overflow-y: auto; }
.up-sel { display: flex; align-items: center; gap: 12px; padding: 10px; border-radius: 10px; background: rgba(139,123,255,0.06); border: 1px solid rgba(139,123,255,0.2); margin: 10px 0; }
.up-sel-info { flex: 1; min-width: 0; }
.up-sel-name { font-weight: 800; color: #eef2ff; }
.up-picker { margin-bottom: 12px; }
.up-picker-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 6px; max-height: 260px; overflow-y: auto; margin-top: 8px; padding: 4px; border-radius: 10px; background: rgba(0,0,0,0.18); }
.up-pick { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 4px; border-radius: 9px; border: 1px solid transparent; background: rgba(255,255,255,0.02); cursor: pointer; }
.up-pick:hover { background: rgba(139,123,255,0.12); }
.up-pick.sel { border-color: #8b7bff; background: rgba(139,123,255,0.16); }
.up-pick-name { font-size: 0.6rem; color: #c9d2ee; text-align: center; line-height: 1.15; max-height: 2.3em; overflow: hidden; }
.up-pick-hint { font-size: 0.68rem; color: #8a90a8; margin-top: 6px; }
.up-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.up-wide { grid-column: 1 / -1; }
</style>
