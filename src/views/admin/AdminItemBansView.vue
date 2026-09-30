<script setup>
// «Бан предметов» выбранного сервера. Список живёт в бэкенде; плагин сервера (VoidRpGameSync)
// забирает его раз в 30 с и удаляет эти предметы у игроков: при входе, подборе, клике в
// инвентаре и проверкой раз в N секунд. Поиск идёт по предметам, которые сервер сам прислал.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { authState, hasPermission } from '../../stores/authStore'
import { confirmDialog } from '../../composables/useConfirm'
import { toastError, toastSuccess } from '../../services/toast'
import ItemIcon from '../../components/ItemIcon.vue'
import {
  addItemBans, deleteItemBan, getItemBans, saveItemBanSettings, searchBanItems, updateItemBan,
} from '../../services/itemBansApi'

const token = () => authState.accessToken
const canManage = computed(() => hasPermission('items.bans.manage'))

const data = ref(null)
const loading = ref(true)
async function load(silent = false) {
  if (!silent) loading.value = !data.value
  try {
    data.value = await getItemBans(token())
    if (!settingsDirty.value) resetSettings()
  } catch (e) {
    if (!silent) toastError(e?.message || 'Не удалось загрузить список')
  } finally {
    loading.value = false
  }
}

// ── Список ──
const listQ = ref('')
const bans = computed(() => data.value?.items || [])
const shownBans = computed(() => {
  const q = listQ.value.trim().toLowerCase()
  if (!q) return bans.value
  return bans.value.filter((b) => b.item_id.includes(q) || b.name.toLowerCase().includes(q) || (b.reason || '').toLowerCase().includes(q))
})
const activeCount = computed(() => bans.value.filter((b) => b.enabled).length)
const bannedIds = computed(() => new Set(bans.value.map((b) => b.item_id)))

const busy = ref(new Set())
function setBusy(id, on) {
  const next = new Set(busy.value)
  on ? next.add(id) : next.delete(id)
  busy.value = next
}
async function toggle(b) {
  setBusy(b.id, true)
  try {
    const updated = await updateItemBan(token(), b.id, { enabled: !b.enabled })
    Object.assign(b, updated)
    toastSuccess(updated.enabled ? `«${b.name}» снова запрещён` : `«${b.name}» временно разрешён`)
  } catch (e) { toastError(e?.message || 'Не удалось изменить') } finally { setBusy(b.id, false) }
}
async function remove(b) {
  const ok = await confirmDialog({
    title: 'Разрешить предмет?',
    message: `«${b.name}» (${b.item_id}) уберётся из списка, и сервер перестанет его удалять примерно через 30 секунд.`,
    confirmLabel: 'Разрешить', danger: true,
  })
  if (!ok) return
  setBusy(b.id, true)
  try {
    await deleteItemBan(token(), b.id)
    data.value.items = data.value.items.filter((x) => x.id !== b.id)
    toastSuccess(`«${b.name}» убран из списка`)
  } catch (e) { toastError(e?.message || 'Не удалось убрать') } finally { setBusy(b.id, false) }
}

// Причина — правится прямо в строке
const editingReason = ref(null) // { id, text }
function startReason(b) { if (canManage.value) editingReason.value = { id: b.id, text: b.reason || '' } }
async function saveReason(b) {
  const text = editingReason.value?.text ?? ''
  editingReason.value = null
  if ((b.reason || '') === text.trim()) return
  try {
    Object.assign(b, await updateItemBan(token(), b.id, { reason: text.trim() || null }))
  } catch (e) { toastError(e?.message || 'Не удалось сохранить причину') }
}

// ── Поиск и добавление ──
const q = ref('')
const results = ref([])
const verified = ref(false)
const searching = ref(false)
const picked = ref([]) // [{ id, name, icon }]
const reason = ref('')
const adding = ref(false)
let searchTimer = null
let searchSeq = 0

async function runSearch() {
  const seq = ++searchSeq
  searching.value = true
  try {
    const res = await searchBanItems(token(), q.value.trim(), 60)
    if (seq !== searchSeq) return
    results.value = res.items || []
    verified.value = !!res.verified
  } catch (e) {
    if (seq === searchSeq) toastError(e?.message || 'Поиск не удался')
  } finally {
    if (seq === searchSeq) searching.value = false
  }
}
watch(q, () => { clearTimeout(searchTimer); searchTimer = setTimeout(runSearch, 250) })

const pickedIds = computed(() => new Set(picked.value.map((p) => p.id)))
function togglePick(it) {
  if (bannedIds.value.has(it.id)) return
  picked.value = pickedIds.value.has(it.id) ? picked.value.filter((p) => p.id !== it.id) : [...picked.value, it]
}
// Предмет, которого нет в поиске, можно добавить по точному id («мод:предмет»).
const ID_RE = /^[a-z0-9_.-]+:[a-z0-9_./-]+$/
const typedId = computed(() => {
  const v = q.value.trim().toLowerCase()
  return ID_RE.test(v) && !results.value.some((r) => r.id === v) && !bannedIds.value.has(v) ? v : null
})
function pickTyped() {
  if (typedId.value && !pickedIds.value.has(typedId.value)) {
    picked.value = [...picked.value, { id: typedId.value, name: typedId.value, icon: false }]
  }
}
async function addPicked() {
  if (!picked.value.length) return
  adding.value = true
  try {
    const res = await addItemBans(token(), picked.value.map((p) => p.id), reason.value.trim())
    const n = res.added?.length || 0
    toastSuccess(n ? `Запрещено предметов: ${n}. Сервер применит примерно через 30 секунд` : 'Эти предметы уже были в списке')
    picked.value = []
    reason.value = ''
    await load(true)
    results.value = results.value.map((r) => ({ ...r, banned: bannedIds.value.has(r.id) }))
  } catch (e) { toastError(e?.message || 'Не удалось запретить') } finally { adding.value = false }
}

// ── Настройки ──
const settings = ref({ message: '', seconds: 5 })
const settingsDirty = ref(false)
const savingSettings = ref(false)
function resetSettings() {
  const s = data.value?.settings
  if (!s) return
  settings.value = { message: s.message, seconds: Math.round(s.scan_period_ticks / 20) }
  settingsDirty.value = false
}
watch(settings, () => {
  const s = data.value?.settings
  settingsDirty.value = !!s && (settings.value.message !== s.message || settings.value.seconds * 20 !== s.scan_period_ticks)
}, { deep: true })
async function saveSettings() {
  savingSettings.value = true
  try {
    const saved = await saveItemBanSettings(token(), {
      message: settings.value.message.trim(),
      scan_period_ticks: Math.round(Number(settings.value.seconds) * 20),
    })
    data.value.settings = saved
    resetSettings()
    toastSuccess('Настройки сохранены')
  } catch (e) { toastError(e?.message || 'Не удалось сохранить') } finally { savingSettings.value = false }
}

// Цветовые коды Minecraft (§a, &c…) → разметка для предпросмотра сообщения.
const MC = { 0: '#000', 1: '#00a', 2: '#0a0', 3: '#0aa', 4: '#a00', 5: '#a0a', 6: '#fa0', 7: '#aaa', 8: '#555', 9: '#55f', a: '#5f5', b: '#5ff', c: '#f55', d: '#f5f', e: '#ff5', f: '#fff' }
const preview = computed(() => {
  const out = []
  let color = '#fff'
  let bold = false
  const parts = (settings.value.message || '').split(/[§&]([0-9a-fk-or])/i)
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 1) {
      const c = parts[i].toLowerCase()
      if (MC[c]) {
        color = MC[c]
        bold = false
      } else if (c === 'l') {
        bold = true
      } else if (c === 'r') {
        color = '#fff'
        bold = false
      }
    } else if (parts[i]) out.push({ text: parts[i], color, bold })
  }
  return out
})

// ── Состояние синхронизации ──
const now = ref(Date.now())
function ago(iso) {
  if (!iso) return null
  const s = Math.max(0, Math.round((now.value - new Date(iso).getTime()) / 1000))
  if (s < 60) return `${s} с назад`
  if (s < 3600) return `${Math.floor(s / 60)} мин назад`
  if (s < 86400) return `${Math.floor(s / 3600)} ч назад`
  return `${Math.floor(s / 86400)} дн назад`
}
const sync = computed(() => {
  const st = data.value?.sync || {}
  const at = st.bans_fetched_at ? new Date(st.bans_fetched_at).getTime() : null
  if (!at) return { tone: 'err', text: 'Сервер ещё ни разу не забирал список, поэтому бан на нём не работает. Нужен плагин VoidRpGameSync 1.5.0 или новее.' }
  const age = (now.value - at) / 1000
  if (age > 180) return { tone: 'warn', text: `Сервер последний раз забирал список ${ago(st.bans_fetched_at)}. Похоже, он выключен или нет связи с админкой.` }
  return { tone: 'ok', text: `Сервер забирает список: ${ago(st.bans_fetched_at)}${st.plugin_version ? ` · плагин ${st.plugin_version}` : ''}` }
})
const fmtDate = (v) => (v ? new Date(v).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '')
const fmtNum = (n) => Number(n || 0).toLocaleString('ru-RU')

let tick = null
function onVisibility() { if (!document.hidden) { now.value = Date.now(); load(true) } }
onMounted(() => {
  load()
  runSearch()
  tick = setInterval(() => { if (!document.hidden) { now.value = Date.now(); load(true) } }, 30000)
  document.addEventListener('visibilitychange', onVisibility)
})
onBeforeUnmount(() => {
  clearInterval(tick)
  clearTimeout(searchTimer)
  document.removeEventListener('visibilitychange', onVisibility)
})
</script>

<template>
  <div class="adm-page">
    <div class="adm-page__head">
      <div>
        <h1 class="adm-title">Бан предметов</h1>
        <p class="adm-sub">
          Сервер удаляет эти предметы у игроков при входе, подборе, клике в инвентаре и проверкой
          каждые {{ Math.round((data?.settings?.scan_period_ticks || 100) / 20) }} с.
        </p>
      </div>
    </div>

    <div v-if="loading" class="adm-card adm-card--pad"><div class="adm-skel" style="height: 220px" /></div>

    <template v-else-if="data">
      <div class="ib-sync" :class="`ib-sync--${sync.tone}`">
        <span class="adm-dot" :class="`adm-dot--${sync.tone}`" />
        <span>{{ sync.text }}</span>
        <span v-if="data.sync.items_reported_at" class="ib-sync__meta">
          Предметов на сервере: {{ fmtNum(data.sync.registry_size) }}
        </span>
        <span v-else class="ib-sync__meta">Сервер ещё не прислал свои предметы, поэтому поиск идёт по всем известным</span>
      </div>

      <div class="ib-grid" :class="{ 'ib-grid--single': !canManage }">
        <!-- Список запрещённых -->
        <section class="adm-card ib-list">
          <div class="adm-card__head">
            <div class="adm-card__title">Запрещено: {{ activeCount }}<span v-if="activeCount !== bans.length" class="ib-muted"> · выключено {{ bans.length - activeCount }}</span></div>
            <input v-if="bans.length > 6" v-model="listQ" class="adm-input ib-listq" placeholder="Найти в списке" />
          </div>

          <div v-if="!bans.length" class="adm-empty">
            <div class="adm-empty__title">Список пуст</div>
            <div class="adm-empty__sub">На этом сервере можно пользоваться всеми предметами.</div>
          </div>

          <ul v-else class="ib-rows">
            <li v-for="b in shownBans" :key="b.id" class="ib-row" :class="{ 'ib-row--off': !b.enabled }">
              <ItemIcon :itemKey="b.item_id" :size="36" />
              <div class="ib-row__main">
                <div class="ib-row__name">
                  {{ b.name }}
                  <span v-if="!b.enabled" class="adm-badge">выключен</span>
                  <span v-if="b.on_server === false" class="adm-badge adm-badge--warn" title="Сервер не прислал такой предмет в своём списке: возможно, опечатка в id или мод удалён">нет на сервере</span>
                </div>
                <div class="ib-row__id adm-mono">{{ b.item_id }}</div>
                <div v-if="editingReason?.id === b.id" class="ib-reason-edit">
                  <input v-model="editingReason.text" class="adm-input" maxlength="500" placeholder="Почему запрещён"
                         @keydown.enter="saveReason(b)" @keydown.esc="editingReason = null" @blur="saveReason(b)" v-focus />
                </div>
                <button v-else class="ib-reason" :class="{ 'ib-reason--empty': !b.reason }" :disabled="!canManage" @click="startReason(b)">
                  {{ b.reason || (canManage ? 'Добавить причину' : 'Причина не указана') }}
                </button>
                <div class="ib-row__who">{{ b.created_by || '—' }} · {{ fmtDate(b.created_at) }}</div>
              </div>
              <div v-if="canManage" class="ib-row__actions">
                <button class="adm-btn adm-btn--sm" :disabled="busy.has(b.id)" @click="toggle(b)">{{ b.enabled ? 'Выключить' : 'Включить' }}</button>
                <button class="adm-btn adm-btn--sm adm-btn--danger" :disabled="busy.has(b.id)" @click="remove(b)">Разрешить</button>
              </div>
            </li>
            <li v-if="!shownBans.length" class="ib-none">Ничего не нашлось</li>
          </ul>
        </section>

        <!-- Добавление -->
        <section v-if="canManage" class="adm-card ib-add">
          <div class="adm-card__head"><div class="adm-card__title">Запретить предметы</div></div>
          <div class="ib-add__body">
            <input v-model="q" class="adm-input" placeholder="Название или id: удочка, reliquary:rod_of_lyssa" />
            <div class="ib-hint">
              <template v-if="verified">Показываются только предметы, которые есть на этом сервере.</template>
              <template v-else>Сервер не прислал список своих предметов, поэтому показаны все известные.</template>
              Можно выбрать несколько.
            </div>

            <div class="ib-results" :class="{ 'ib-results--busy': searching }">
              <button v-for="it in results" :key="it.id" class="ib-item"
                      :class="{ 'ib-item--picked': pickedIds.has(it.id), 'ib-item--banned': it.banned || bannedIds.has(it.id) }"
                      :disabled="it.banned || bannedIds.has(it.id)" :title="it.id" @click="togglePick(it)">
                <ItemIcon :itemKey="it.id" :size="32" />
                <span class="ib-item__text">
                  <span class="ib-item__name">{{ it.name }}</span>
                  <span class="ib-item__id adm-mono">{{ it.id }}</span>
                </span>
                <span v-if="it.banned || bannedIds.has(it.id)" class="adm-badge adm-badge--err">уже запрещён</span>
                <span v-else-if="pickedIds.has(it.id)" class="ib-check">✓</span>
              </button>
              <button v-if="typedId" class="ib-item ib-item--typed" @click="pickTyped">
                <span class="ib-item__text">
                  <span class="ib-item__name">Добавить по id</span>
                  <span class="ib-item__id adm-mono">{{ typedId }}</span>
                </span>
              </button>
              <div v-if="!results.length && !typedId && !searching" class="ib-none">Ничего не нашлось</div>
            </div>

            <div v-if="picked.length" class="ib-picked">
              <div class="ib-picked__chips">
                <span v-for="p in picked" :key="p.id" class="ib-chip">
                  <ItemIcon :itemKey="p.id" :size="18" />{{ p.name }}
                  <button class="ib-chip__x" :aria-label="`Убрать ${p.name}`" @click="togglePick(p)">×</button>
                </span>
              </div>
              <input v-model="reason" class="adm-input" maxlength="500" placeholder="Причина (видят только сотрудники), например: дюп предметов" />
              <button class="adm-btn adm-btn--danger" :disabled="adding" @click="addPicked">
                {{ adding ? 'Запрещаю…' : `Запретить ${picked.length === 1 ? 'предмет' : `предметы (${picked.length})`}` }}
              </button>
            </div>
          </div>
        </section>
      </div>

      <!-- Настройки -->
      <section class="adm-card ib-settings">
        <div class="adm-card__head"><div class="adm-card__title">Что видит игрок</div></div>
        <div class="ib-settings__body">
          <label class="adm-field ib-settings__msg">
            <span class="adm-label">Сообщение, когда предмет удалён (цвета: §c, §a, &amp;e…)</span>
            <input v-model="settings.message" class="adm-input" maxlength="256" :disabled="!canManage" />
          </label>
          <div class="ib-preview" aria-label="Как это выглядит в чате">
            <span v-for="(p, i) in preview" :key="i" :style="{ color: p.color, fontWeight: p.bold ? 700 : 400 }">{{ p.text }}</span>
          </div>
          <label class="adm-field ib-settings__period">
            <span class="adm-label">Проверка инвентарей, раз в секунд</span>
            <input v-model.number="settings.seconds" type="number" min="2" max="60" class="adm-input" :disabled="!canManage" />
          </label>
          <div v-if="canManage" class="ib-settings__actions">
            <button class="adm-btn adm-btn--acc" :disabled="!settingsDirty || savingSettings || !settings.message.trim() || settings.seconds < 2 || settings.seconds > 60" @click="saveSettings">
              {{ savingSettings ? 'Сохраняю…' : 'Сохранить' }}
            </button>
            <button v-if="settingsDirty" class="adm-btn adm-btn--ghost" @click="resetSettings">Отменить</button>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script>
// Автофокус поля причины при начале правки.
export default { directives: { focus: { mounted: (el) => el.focus() } } }
</script>

<style scoped>
.ib-muted { color: var(--adm-dim); font-weight: 500; }
.ib-sync {
  display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 0.75rem;
  padding: 0.7rem 0.9rem; margin-bottom: 1rem; border-radius: var(--adm-r);
  border: 1px solid var(--adm-line); background: var(--adm-card); font-size: 0.86rem; color: var(--adm-text);
}
.ib-sync--err { border-color: color-mix(in srgb, var(--adm-err) 45%, transparent); }
.ib-sync--warn { border-color: color-mix(in srgb, var(--adm-warn) 45%, transparent); }
.ib-sync__meta { margin-left: auto; color: var(--adm-dim); font-size: 0.8rem; }

.ib-grid { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 1rem; align-items: start; }
.ib-grid--single { grid-template-columns: minmax(0, 1fr); }
@media (max-width: 1100px) { .ib-grid { grid-template-columns: minmax(0, 1fr); } }

.ib-listq { max-width: 220px; }
.ib-rows { list-style: none; margin: 0; padding: 0.25rem 0.5rem 0.5rem; }
.ib-row {
  display: flex; align-items: flex-start; gap: 0.8rem; padding: 0.7rem 0.5rem;
  border-bottom: 1px solid var(--adm-line);
}
.ib-row:last-child { border-bottom: 0; }
.ib-row--off { opacity: 0.55; }
.ib-row__main { flex: 1; min-width: 0; }
.ib-row__name { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; font-weight: 700; color: var(--adm-text); }
.ib-row__id { font-size: 0.74rem; color: var(--adm-dim); margin-top: 0.1rem; word-break: break-all; }
.ib-reason {
  display: block; margin-top: 0.35rem; padding: 0; border: 0; background: none; text-align: left;
  font-size: 0.84rem; color: var(--adm-text); cursor: text;
}
.ib-reason:disabled { cursor: default; }
.ib-reason--empty { color: var(--adm-faint); font-style: italic; }
.ib-reason-edit { margin-top: 0.35rem; }
.ib-row__who { margin-top: 0.3rem; font-size: 0.74rem; color: var(--adm-dim); }
.ib-row__actions { display: flex; flex-direction: column; gap: 0.35rem; flex-shrink: 0; }
@media (max-width: 560px) {
  .ib-row { flex-wrap: wrap; }
  .ib-row__actions { flex-direction: row; width: 100%; padding-left: calc(36px + 0.8rem); }
}
.ib-none { padding: 1rem; text-align: center; color: var(--adm-dim); font-size: 0.85rem; }

.ib-add__body { display: flex; flex-direction: column; gap: 0.6rem; padding: 0 1rem 1rem; }
.ib-hint { font-size: 0.78rem; color: var(--adm-dim); }
.ib-results {
  display: flex; flex-direction: column; gap: 0.25rem; max-height: 420px; overflow-y: auto;
  padding: 0.3rem; border: 1px solid var(--adm-line); border-radius: var(--adm-r-sm); background: var(--adm-bg-soft);
  transition: opacity 0.15s;
}
.ib-results--busy { opacity: 0.6; }
.ib-item {
  display: flex; align-items: center; gap: 0.65rem; width: 100%; padding: 0.4rem 0.5rem;
  border: 1px solid transparent; border-radius: var(--adm-r-sm); background: none; text-align: left;
  color: var(--adm-text); cursor: pointer;
}
.ib-item:hover:not(:disabled) { background: var(--adm-card-2); }
.ib-item:focus-visible { outline: 2px solid var(--adm-acc); outline-offset: 1px; }
.ib-item--picked { border-color: var(--adm-acc-line); background: var(--adm-acc-soft); }
.ib-item--banned { cursor: default; opacity: 0.6; }
.ib-item--typed { border-style: dashed; border-color: var(--adm-line-strong); }
.ib-item__text { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.ib-item__name { font-size: 0.86rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ib-item__id { font-size: 0.72rem; color: var(--adm-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ib-check { color: var(--adm-acc-text); font-weight: 900; }

.ib-picked { display: flex; flex-direction: column; gap: 0.55rem; padding-top: 0.3rem; border-top: 1px solid var(--adm-line); }
.ib-picked__chips { display: flex; flex-wrap: wrap; gap: 0.35rem; }
.ib-chip {
  display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.2rem 0.25rem 0.2rem 0.4rem;
  border-radius: 999px; background: var(--adm-card-2); border: 1px solid var(--adm-line); font-size: 0.8rem; color: var(--adm-text);
}
.ib-chip__x { border: 0; background: none; color: var(--adm-dim); font-size: 1rem; line-height: 1; cursor: pointer; padding: 0 0.2rem; }
.ib-chip__x:hover { color: var(--adm-err); }

.ib-settings { margin-top: 1rem; }
.ib-settings__body { display: grid; grid-template-columns: minmax(0, 1fr) 220px; gap: 0.75rem 1rem; padding: 0 1rem 1rem; align-items: end; }
.ib-settings__msg { grid-column: 1; }
.ib-settings__period { grid-column: 2; grid-row: 1; }
.ib-preview {
  grid-column: 1 / -1; padding: 0.55rem 0.75rem; border-radius: var(--adm-r-sm);
  background: rgba(0, 0, 0, 0.55); font-size: 0.88rem; min-height: 2.2rem;
}
.ib-settings__actions { grid-column: 1 / -1; display: flex; gap: 0.5rem; }
@media (max-width: 640px) {
  .ib-settings__body { grid-template-columns: minmax(0, 1fr); }
  .ib-settings__msg, .ib-settings__period { grid-column: 1; grid-row: auto; }
}
</style>
