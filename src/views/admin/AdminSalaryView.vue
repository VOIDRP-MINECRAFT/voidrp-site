<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { authState, hasPermission } from '../../stores/authStore'
import { activeServer } from '../../stores/serverStore'
import { toastError, toastSuccess } from '../../services/toast'
import { salaryOverview, salarySaveSettings } from '../../services/salaryAdminApi'
import AdminSaveBar from '../../components/admin/AdminSaveBar.vue'
import { useUnsavedGuard } from '../../composables/useUnsavedGuard'

const token = () => authState.accessToken
const canManage = computed(() => hasPermission('salary.manage'))
const serverName = computed(() => activeServer.value?.name || 'сервер')

const data = ref(null)
const loading = ref(true)
const form = ref({ enabled: false, amount: 50, every_minutes: 30, daily_cap: 300, afk_minutes: 5 })
const saved = ref({ ...form.value })
const saving = ref(false)
const dirty = computed(() => JSON.stringify(normalized(form.value)) !== JSON.stringify(normalized(saved.value)))

const money = (v) => Number(v || 0).toLocaleString('ru-RU', { maximumFractionDigits: 2 })
const time = (v) => new Date(v).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const weekday = (d) => new Date(d + 'T12:00:00').toLocaleDateString('ru-RU', { weekday: 'short', day: '2-digit' })

function normalized(f) {
  return {
    enabled: !!f.enabled, amount: Number(f.amount), every_minutes: Number(f.every_minutes),
    daily_cap: Number(f.daily_cap), afk_minutes: Number(f.afk_minutes),
  }
}

// What a player earns in an hour and how long it takes to reach the cap — the two
// numbers a change here is really about.
const perHour = computed(() => {
  const f = normalized(form.value)
  return f.every_minutes > 0 ? (f.amount * 60) / f.every_minutes : 0
})
const hoursToCap = computed(() => (perHour.value > 0 ? normalized(form.value).daily_cap / perHour.value : 0))
const fmtHours = (h) => {
  if (!h) return '—'
  const whole = Math.floor(h)
  const min = Math.round((h - whole) * 60)
  return whole ? `${whole} ч${min ? ` ${min} мин` : ''}` : `${min} мин`
}

// The last seven days, with the empty ones in, for a strip of bars.
const week = computed(() => {
  const byDay = Object.fromEntries((data.value?.week || []).map(d => [d.day, d]))
  const end = data.value?.today?.day ? new Date(data.value.today.day + 'T12:00:00') : new Date()
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(end.getTime() - i * 86400000).toISOString().slice(0, 10)
    days.push(byDay[d] || { day: d, total: 0, players: 0 })
  }
  const max = Math.max(1, ...days.map(d => d.total))
  return days.map(d => ({ ...d, pct: Math.round((d.total / max) * 100) }))
})

let timer = null
async function load() {
  try {
    data.value = await salaryOverview(token())
    if (!dirty.value) {
      saved.value = { ...data.value.settings }
      form.value = { ...data.value.settings }
    }
  } catch (e) {
    toastError(e.message || 'Не удалось загрузить зарплату')
  } finally {
    loading.value = false
  }
}
onMounted(() => {
  load()
  timer = setInterval(() => { if (!document.hidden) load() }, 60000)
})
onUnmounted(() => clearInterval(timer))

useUnsavedGuard(() => dirty.value)
function reset() { form.value = { ...saved.value } }

async function save() {
  saving.value = true
  try {
    const res = await salarySaveSettings(token(), normalized(form.value))
    saved.value = { ...res.settings }
    form.value = { ...res.settings }
    data.value.settings_updated_by = res.settings_updated_by
    toastSuccess('Сохранено — сервер подхватит в течение минуты')
  } catch (e) {
    toastError(e.message || 'Не удалось сохранить')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="adm-page">
    <div class="adm-head">
      <div>
        <h1 class="adm-title">Зарплата за игру</h1>
        <p class="adm-sub">Сервер «{{ serverName }}» · деньги за активную игру, с дневным лимитом</p>
      </div>
    </div>

    <div v-if="loading" class="adm-skel" style="height: 260px" />

    <template v-else-if="data">
      <div class="sl-grid">
        <div class="adm-card adm-card--pad sl-settings">
          <div class="sl-card-title">Настройки</div>
          <label class="sl-toggle">
            <input v-model="form.enabled" type="checkbox" :disabled="!canManage" />
            <span>Платить игрокам за игру</span>
          </label>
          <div class="sl-fields">
            <label class="sl-field">
              <span>Сумма</span>
              <input v-model.number="form.amount" type="number" min="1" step="1" class="adm-input" :disabled="!canManage" />
            </label>
            <label class="sl-field">
              <span>за каждые (мин)</span>
              <input v-model.number="form.every_minutes" type="number" min="5" max="240" class="adm-input" :disabled="!canManage" />
            </label>
            <label class="sl-field">
              <span>Лимит в день</span>
              <input v-model.number="form.daily_cap" type="number" min="1" step="10" class="adm-input" :disabled="!canManage" />
            </label>
            <label class="sl-field">
              <span>АФК после (мин)</span>
              <input v-model.number="form.afk_minutes" type="number" min="1" max="60" class="adm-input" :disabled="!canManage" />
            </label>
          </div>
          <div class="sl-calc">
            <span><b>{{ money(perHour) }}</b> в час активной игры</span>
            <span>лимит набирается за <b>{{ fmtHours(hoursToCap) }}</b></span>
          </div>
          <p class="sl-hint">
            Считаются только минуты, когда игрок что-то делает: вертит камеру, ломает и ставит блоки,
            дерётся, пишет в чат. Если за «АФК после» минут он ничего не сделал, минуты не идут —
            АФК-бассейн не помогает. Лимит обнуляется в полночь по Москве.
          </p>
          <div v-if="canManage" class="sl-row">
            
            <span v-if="data.settings_updated_by" class="sl-meta">изменил {{ data.settings_updated_by }}</span>
          </div>
        </div>

        <div class="adm-card adm-card--pad sl-today">
          <div class="sl-card-title">Сегодня</div>
          <div class="sl-big">{{ money(data.today.total) }}</div>
          <div class="sl-meta">выплачено {{ data.today.players }} игрокам · {{ data.today.payouts }} выплат</div>
          <div class="sl-week" role="img" :aria-label="'Выплаты за 7 дней'">
            <div v-for="d in week" :key="d.day" class="sl-week__col" :title="`${d.day}: ${money(d.total)} · игроков ${d.players}`">
              <div class="sl-week__bar"><div class="sl-week__fill" :style="{ height: d.pct + '%' }" /></div>
              <div class="sl-week__lbl">{{ weekday(d.day) }}</div>
            </div>
          </div>
          <div v-if="data.top_today.length" class="sl-top">
            <div v-for="t in data.top_today" :key="t.player" class="sl-top__row">
              <span>{{ t.player }}</span>
              <span class="sl-meta">{{ t.minutes }} мин</span>
              <b>{{ money(t.total) }}</b>
            </div>
          </div>
          <div v-else class="sl-meta">Сегодня выплат ещё не было.</div>
        </div>
      </div>

      <div class="adm-card sl-recent">
        <div v-if="!data.recent.length" class="adm-empty">
          <div class="adm-empty__title">Выплат пока нет</div>
          <div class="adm-empty__sub">Включите зарплату — первые выплаты придут через «за каждые» минут игры</div>
        </div>
        <div v-else class="adm-table-wrap">
          <div class="adm-table-scroll">
            <table class="adm-table">
              <thead><tr><th>Когда</th><th>Игрок</th><th>Минут</th><th>Сумма</th></tr></thead>
              <tbody>
                <tr v-for="(r, i) in data.recent" :key="i">
                  <td>{{ time(r.at) }}</td>
                  <td>{{ r.player }}</td>
                  <td class="sl-num">{{ r.minutes }}</td>
                  <td class="sl-num">{{ money(r.amount) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </template>
    <AdminSaveBar v-if="canManage" :dirty="dirty" :saving="saving" @save="save" @reset="reset" />
  </div>
</template>

<style scoped>
.sl-grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 1rem; margin-bottom: 1rem; }
@media (max-width: 900px) { .sl-grid { grid-template-columns: 1fr; } }
.sl-settings, .sl-today { display: flex; flex-direction: column; gap: 0.75rem; }
.sl-card-title { font-weight: 800; font-size: 0.95rem; color: var(--adm-text); }
.sl-toggle { display: flex; align-items: center; gap: 0.5rem; font-size: 0.88rem; color: var(--adm-text); cursor: pointer; }
.sl-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr)); gap: 0.6rem; }
.sl-field { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.76rem; color: var(--adm-dim); }
.sl-calc {
  display: flex; flex-wrap: wrap; gap: 0.4rem 1.2rem; font-size: 0.84rem; color: var(--adm-dim);
  padding: 0.6rem 0.8rem; border-radius: var(--adm-r-sm, 10px); background: rgba(var(--adm-acc-rgb), 0.08);
}
.sl-calc b { color: var(--adm-text); font-variant-numeric: tabular-nums; }
.sl-hint { margin: 0; font-size: 0.78rem; color: var(--adm-dim); line-height: 1.5; }
.sl-row { display: flex; align-items: center; gap: 0.8rem; flex-wrap: wrap; }
.sl-meta { font-size: 0.74rem; color: var(--adm-faint); }
.sl-big { font-size: 2rem; font-weight: 900; color: var(--adm-text); font-variant-numeric: tabular-nums; line-height: 1; }
.sl-week { display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.4rem; height: 6.5rem; }
.sl-week__col { display: flex; flex-direction: column; gap: 0.25rem; min-width: 0; }
.sl-week__bar { flex: 1; display: flex; align-items: flex-end; background: rgba(148, 163, 184, 0.06); border-radius: 4px; overflow: hidden; }
.sl-week__fill { width: 100%; background: var(--adm-acc); border-radius: 4px 4px 0 0; min-height: 2px; }
.sl-week__lbl { font-size: 0.66rem; color: var(--adm-faint); text-align: center; white-space: nowrap; }
.sl-top { display: flex; flex-direction: column; gap: 0.3rem; }
.sl-top__row { display: grid; grid-template-columns: 1fr auto auto; gap: 0.8rem; font-size: 0.84rem; color: var(--adm-text); }
.sl-top__row b { font-variant-numeric: tabular-nums; }
.sl-recent { overflow: hidden; }
.sl-num { font-variant-numeric: tabular-nums; }
</style>
