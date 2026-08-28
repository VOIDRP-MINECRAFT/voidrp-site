<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { authState, hasPermission } from '../../stores/authStore'
import { activeServer } from '../../stores/serverStore'
import { getPunishments, createPunishment, revokePunishment } from '../../services/adminSecurityApi'
import { toastError, toastSuccess } from '../../services/toast'
import { confirmDialog } from '../../composables/useConfirm'

const token = () => authState.accessToken
const canManage = hasPermission('punishments.manage')

const PAGE_SIZE = 50
const items = ref([])
const total = ref(0)
const loading = ref(false)

const q = ref('')
const typeFilter = ref('')
const statusFilter = ref('active')
const page = ref(1)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))

const TYPE_LABELS = {
  ban: 'Бан', tempban: 'Врем. бан', mute: 'Мут', tempmute: 'Врем. мут', kick: 'Кик', warn: 'Предупр.',
}
const TYPES = Object.keys(TYPE_LABELS)

const form = ref({ player: '', type: 'ban', reason: '', durationValue: 1, durationUnit: 'd', scope: 'server', enforce: true })
const submitting = ref(false)
const needsDuration = computed(() => form.value.type === 'tempban' || form.value.type === 'tempmute')
const UNIT_SECONDS = { m: 60, h: 3600, d: 86400 }

async function submit() {
  if (!form.value.player.trim()) { toastError('Укажите ник игрока'); return }
  submitting.value = true
  try {
    const body = {
      player: form.value.player.trim(),
      type: form.value.type,
      reason: form.value.reason.trim() || null,
      scope: form.value.scope,
      enforce: form.value.enforce,
    }
    if (needsDuration.value) {
      body.duration_seconds = Math.max(1, form.value.durationValue) * UNIT_SECONDS[form.value.durationUnit]
    }
    const res = await createPunishment(token(), body)
    if (res.rcon_error) toastError(`Записано, но в игре не применилось: ${res.rcon_error}`)
    else toastSuccess('Наказание выдано')
    form.value.player = ''
    form.value.reason = ''
    page.value = 1
    load()
  } catch (e) {
    toastError(e?.message || 'Не удалось выдать наказание')
  } finally {
    submitting.value = false
  }
}

async function revoke(p) {
  if (!(await confirmDialog({
    title: 'Снять наказание', message: `Снять ${TYPE_LABELS[p.type]?.toLowerCase()} с игрока ${p.player_name}?`,
    confirmLabel: 'Снять',
  }))) return
  try {
    await revokePunishment(token(), p.id, { lift_in_game: true })
    toastSuccess('Наказание снято')
    load()
  } catch (e) {
    toastError(e?.message || 'Не удалось снять')
  }
}

async function load() {
  loading.value = true
  try {
    const res = await getPunishments(token(), {
      q: q.value.trim(), type: typeFilter.value, status: statusFilter.value,
      limit: PAGE_SIZE, offset: (page.value - 1) * PAGE_SIZE,
    })
    items.value = res.items || []
    total.value = res.total || 0
  } catch (e) {
    toastError('Не удалось загрузить наказания')
  } finally {
    loading.value = false
  }
}

let searchTimer = null
function onSearch() { clearTimeout(searchTimer); searchTimer = setTimeout(() => { page.value = 1; load() }, 350) }
function goToPage(p) { const np = Math.min(Math.max(1, p), totalPages.value); if (np === page.value) return; page.value = np; load() }

function fmtDate(iso) { return iso ? new Date(iso).toLocaleString('ru', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—' }
function expiryText(p) {
  if (p.type === 'kick' || p.type === 'warn') return '—'
  if (!p.expires_at) return 'навсегда'
  return fmtDate(p.expires_at)
}
function typeBadgeClass(t) {
  if (t.includes('ban')) return 'adm-badge--err'
  if (t.includes('mute')) return 'adm-badge--warn'
  return ''
}
function statusBadge(p) {
  if (p.effective) return { label: 'Действует', cls: 'adm-badge--ok' }
  if (!p.active) return { label: 'Снято', cls: '' }
  if (p.expired) return { label: 'Истекло', cls: '' }
  return { label: 'Разово', cls: '' }
}

let poll = null
function onVisibility() {
  if (document.hidden) { clearInterval(poll); poll = null }
  else if (!poll) { load(); poll = setInterval(load, 30000) }
}
onMounted(() => { load(); poll = setInterval(load, 30000); document.addEventListener('visibilitychange', onVisibility) })
onBeforeUnmount(() => { clearInterval(poll); document.removeEventListener('visibilitychange', onVisibility) })
</script>

<template>
  <div class="adm-page">
    <div class="adm-page__head">
      <div>
        <h1 class="adm-title">Наказания</h1>
        <p class="adm-sub">Баны и муты для «{{ activeServer?.name || 'сервера' }}» + глобальные · применяются в игре через RCON</p>
      </div>
      <div class="adm-head-actions">
        <button class="adm-btn" :disabled="loading" @click="load">Обновить</button>
      </div>
    </div>

    <!-- Issue form -->
    <div v-if="canManage" class="adm-card adm-card--pad">
      <div class="adm-label">Выдать наказание</div>
      <div class="pun-form">
        <label class="adm-field pun-f-player"><span>Игрок</span>
          <input v-model="form.player" class="adm-input" placeholder="Ник" /></label>
        <label class="adm-field pun-f-type"><span>Тип</span>
          <select v-model="form.type" class="adm-select">
            <option v-for="t in TYPES" :key="t" :value="t">{{ TYPE_LABELS[t] }}</option>
          </select></label>
        <label v-if="needsDuration" class="adm-field pun-f-dur"><span>Срок</span>
          <input v-model.number="form.durationValue" type="number" min="1" class="adm-input" /></label>
        <label v-if="needsDuration" class="adm-field pun-f-unit"><span>&nbsp;</span>
          <select v-model="form.durationUnit" class="adm-select">
            <option value="m">минут</option><option value="h">часов</option><option value="d">дней</option>
          </select></label>
        <label class="adm-field pun-f-scope"><span>Область</span>
          <select v-model="form.scope" class="adm-select">
            <option value="server">Этот сервер</option><option value="global">Все серверы</option>
          </select></label>
      </div>
      <div class="pun-form2">
        <label class="adm-field pun-f-reason"><span>Причина</span>
          <input v-model="form.reason" class="adm-input" placeholder="Необязательно" /></label>
        <label class="adm-check pun-enforce"><input v-model="form.enforce" type="checkbox" /> применить в игре</label>
        <button class="adm-btn adm-btn--acc" :disabled="submitting" @click="submit">Выдать</button>
      </div>
    </div>

    <!-- Filters -->
    <div class="pun-filters">
      <input v-model="q" class="adm-input" placeholder="Поиск по нику…" @input="onSearch" />
      <select v-model="typeFilter" class="adm-select" @change="page = 1; load()">
        <option value="">Все типы</option>
        <option v-for="t in TYPES" :key="t" :value="t">{{ TYPE_LABELS[t] }}</option>
      </select>
      <select v-model="statusFilter" class="adm-select" @change="page = 1; load()">
        <option value="active">Актуальные</option>
        <option value="all">Все (история)</option>
      </select>
    </div>

    <div v-if="!items.length && !loading" class="adm-empty">
      <div class="adm-empty__title">Наказаний нет</div>
      <div class="adm-empty__sub">{{ statusFilter === 'active' ? 'Сейчас нет действующих банов и мутов.' : 'История пуста.' }}</div>
    </div>

    <div v-else class="adm-table-wrap">
      <div class="adm-table-scroll">
        <table class="adm-table">
          <thead>
            <tr><th>Игрок</th><th>Тип</th><th>Причина</th><th>Кем</th><th>Истекает</th><th>Статус</th><th></th></tr>
          </thead>
          <tbody>
            <tr v-for="p in items" :key="p.id">
              <td class="adm-mono">{{ p.player_name }}</td>
              <td>
                <span class="adm-badge" :class="typeBadgeClass(p.type)">{{ TYPE_LABELS[p.type] }}</span>
                <span v-if="!p.server_id" class="pun-global" title="Действует на всех серверах">🌐</span>
              </td>
              <td class="pun-reason">{{ p.reason || '—' }}</td>
              <td class="pun-dim">{{ p.issued_by_name }}</td>
              <td class="adm-num pun-dim">{{ expiryText(p) }}</td>
              <td><span class="adm-badge" :class="statusBadge(p).cls">{{ statusBadge(p).label }}</span></td>
              <td class="pun-act">
                <button v-if="canManage && p.active" class="adm-btn adm-btn--sm" @click="revoke(p)">Снять</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="totalPages > 1" class="adm-pager">
      <span class="adm-pager__info">Стр. {{ page }} / {{ totalPages }} · всего {{ total }}</span>
      <div class="adm-head-actions">
        <button class="adm-btn adm-btn--sm" :disabled="page <= 1" @click="goToPage(page - 1)">← Назад</button>
        <button class="adm-btn adm-btn--sm" :disabled="page >= totalPages" @click="goToPage(page + 1)">Вперёд →</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pun-form { display: flex; gap: 0.7rem; flex-wrap: wrap; align-items: end; margin-top: 0.2rem; }
.pun-form2 { display: flex; gap: 0.9rem; flex-wrap: wrap; align-items: end; margin-top: 0.7rem; }
.pun-f-player { flex: 0 0 180px; }
.pun-f-type, .pun-f-scope { flex: 0 0 150px; }
.pun-f-dur { flex: 0 0 90px; }
.pun-f-unit { flex: 0 0 120px; }
.pun-f-reason { flex: 1 1 260px; }
.pun-enforce { padding-bottom: 0.55rem; }
.pun-filters { display: flex; gap: 0.6rem; flex-wrap: wrap; }
.pun-filters .adm-input { max-width: 240px; }
.pun-filters .adm-select { max-width: 190px; }
.pun-global { margin-left: 0.35rem; font-size: 0.72rem; }
.pun-reason { color: var(--adm-mut); max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pun-dim { color: var(--adm-dim); font-size: 0.78rem; white-space: nowrap; }
.pun-act { text-align: right; }
</style>
