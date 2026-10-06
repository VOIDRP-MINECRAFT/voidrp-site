<script setup>
// «Возврат игроков»: чтобы новичок вернулся на следующий день. Приветствие с целью на первый
// день, награда за второй день и напоминание в Telegram — для выбранного сервера. Работает
// одинаково на наших серверах (через RCON) и у партнёров (через VoidRpPerms).
import { computed, onMounted, ref } from 'vue'
import { authState, hasPermission } from '../../stores/authStore'
import { activeServer } from '../../stores/serverStore'
import { getRetention, saveRetention, testRetention } from '../../services/adminApi'
import { toastError, toastSuccess } from '../../services/toast'
import AdminSaveBar from '../../components/admin/AdminSaveBar.vue'
import { useUnsavedGuard } from '../../composables/useUnsavedGuard'
import SrvToggle from './servers/SrvToggle.vue'

const data = ref(null)
const form = ref(null)
const base = ref('')
const saving = ref(false)
const canManage = computed(() => hasPermission('retention.manage'))
const dirty = computed(() => !!form.value && JSON.stringify(form.value) !== base.value)
useUnsavedGuard(() => dirty.value)

async function load() {
  try {
    data.value = await getRetention(authState.accessToken)
    form.value = JSON.parse(JSON.stringify(data.value.settings))
    base.value = JSON.stringify(form.value)
  } catch (e) { toastError(e?.message || 'Не удалось загрузить') }
}
onMounted(load)

async function save() {
  saving.value = true
  try {
    const res = await saveRetention(authState.accessToken, form.value)
    form.value = JSON.parse(JSON.stringify(res.settings))
    base.value = JSON.stringify(form.value)
    toastSuccess(form.value.enabled ? 'Сохранено — работает со следующего входа игроков' : 'Сохранено')
  } catch (e) { toastError(e?.message || 'Не удалось сохранить') } finally { saving.value = false }
}
function reset() { form.value = JSON.parse(base.value) }

const ALLOWED = ['give', 'eco', 'money', 'tellraw', 'title', 'effect', 'xp']
function cmdError(c) {
  const t = (c || '').trim().replace(/^\//, '')
  if (!t) return ''
  if (!t.includes('{player}')) return 'нет {player}'
  const first = t.split(/\s+/)[0].toLowerCase().replace(/^minecraft:/, '')
  return ALLOWED.includes(first) || first === 'experience' ? '' : `«${first}» нельзя`
}
const blocked = computed(() => {
  if (!form.value) return ''
  const bad = form.value.commands.map(cmdError).find(Boolean)
  if (bad) return `в команде награды ${bad}`
  const tgBad = (form.value.tg_bonus_commands || []).map(cmdError).find(Boolean)
  if (tgBad) return `в бонусе за Telegram ${tgBad}`
  for (const st of form.value.streak || []) {
    const e = (st.commands || []).map(cmdError).find(Boolean)
    if (e) return `в серии (${st.day}-й день) ${e}`
  }
  const days = (form.value.streak || []).map((x) => x.day)
  if (new Set(days).size !== days.length) return "в серии дни повторяются"
  if (form.value.enabled && !form.value.commands.some((c) => c.trim())) return 'нужна хотя бы одна команда награды'
  return ''
})

function addStreak() {
  const last = Math.max(1, ...(form.value.streak || []).map((x) => x.day || 0))
  form.value.streak.push({ day: last + 2, message: 'Ещё один день подряд, {player}!', commands: ['minecraft:give {player} minecraft:diamond 1'] })
}
const testNick = ref('')
const testing = ref(false)
async function runTest() {
  if (!/^[A-Za-z0-9_]{1,16}$/.test(testNick.value)) { toastError('Ник латиницей, до 16 символов'); return }
  testing.value = true
  try { const r = await testRetention(authState.accessToken, testNick.value); toastSuccess(r.detail); setTimeout(load, 70000) }
  catch (e) { toastError(e?.message || 'Не удалось') } finally { testing.value = false }
}

const st = computed(() => data.value?.stats || {})
const d = (k) => st.value.deliveries?.[k] || 0
const KIND = { welcome: 'Приветствие', day2: 'Награда 2-го дня', test: 'Проверка', tg_link: 'Бонус за Telegram' }
const kindLabel = (k) => KIND[k] || (k.startsWith('streak') ? `Серия: ${k.slice(6)}-й день` : k)
const STATUS = { pending: ['ждёт игрока', ''], delivered: ['выдано', 'adm-badge--ok'], failed: ['не вышло', 'adm-badge--err'] }
const fmt = (iso) => (iso ? new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—')
const preview = (t) => (t || '').replaceAll('{player}', 'Steve').replaceAll('{server}', activeServer.value?.name || 'сервер').replaceAll('{reward}', form.value?.reward_label || 'награда')
</script>

<template>
  <div class="adm-page adm-page--read">
    <div class="adm-page__head">
      <div>
        <h1 class="adm-title">Возврат игроков</h1>
        <p class="adm-sub">Чтобы новичок вернулся на следующий день: цель на первый день, награда за второй и напоминание в Telegram. Для «{{ activeServer?.name || 'сервер' }}».</p>
      </div>
      <RouterLink to="/admin/funnel" class="adm-btn adm-btn--ghost">Воронка новичка →</RouterLink>
    </div>

    <div v-if="!form" class="adm-loading">Загружаю настройки…</div>
    <template v-else>
      <!-- Цифры -->
      <div class="rt-stats">
        <div class="rt-stat"><b>{{ st.newcomers ?? '—' }}</b><span>новичков за {{ st.days }} дн</span></div>
        <div class="rt-stat"><b>{{ st.returned_pct != null ? `${st.returned_pct}%` : '—' }}</b><span>вернулись на другой день ({{ st.returned ?? 0 }})</span></div>
        <div class="rt-stat"><b>{{ d('day2_delivered') }}</b><span>наград выдано<template v-if="d('day2_pending')"> · ждут {{ d('day2_pending') }}</template></span></div>
        <div class="rt-stat"><b>{{ st.tg_pct != null ? `${st.tg_pct}%` : '—' }}</b><span>новичков с Telegram ({{ st.tg_linked ?? 0 }}) · напоминаний {{ st.reminders_sent ?? 0 }}</span></div>
      </div>

      <section class="adm-card rt-sec">
        <div class="rt-head">
          <SrvToggle v-model="form.enabled" :disabled="!canManage" label="Включено на этом сервере" :hint="form.enabled ? `Работает: приветствие, награда и напоминание — по настройкам ниже` : `Пока выключено, ничего не выдаётся и не отправляется`" />
        </div>
      </section>

      <!-- Награда -->
      <section class="adm-card rt-sec">
        <h2>Награда за второй день</h2>
        <p class="rt-note">Выдаётся при входе в другой календарный день (по Москве) в течение {{ form.window_days }} {{ form.window_days === 1 ? 'дня' : 'дней' }} после первого — один раз на игрока. Если игрок ещё грузится, сервер попробует снова каждые 2 минуты.</p>
        <div class="rt-grid">
          <label class="adm-field"><span>Как называется в сообщениях</span><input v-model="form.reward_label" class="adm-input" maxlength="80" :disabled="!canManage" /></label>
          <label class="adm-field"><span>Окно, дней после первого входа</span><input v-model.number="form.window_days" type="number" min="1" max="7" class="adm-input" :disabled="!canManage" /></label>
          <label class="adm-field rt-wide"><span>Сообщение в чат при выдаче</span><input v-model="form.reward_message" class="adm-input" maxlength="240" :disabled="!canManage" /><small class="rt-prev">{{ preview(form.reward_message) }}</small></label>
        </div>
        <div class="adm-field">
          <span>Команды награды — выполняются от консоли, {player} — ник</span>
          <div v-for="(c, i) in form.commands" :key="i" class="rt-cmd">
            <input v-model="form.commands[i]" class="adm-input rt-mono" :class="{ 'rt-bad': cmdError(c) }" :disabled="!canManage" placeholder="minecraft:give {player} minecraft:diamond 2" />
            <button v-if="canManage" type="button" class="adm-btn adm-btn--sm adm-btn--danger" aria-label="Убрать" @click="form.commands.splice(i, 1)">✕</button>
            <small v-if="cmdError(c)" class="rt-err">{{ cmdError(c) }}</small>
          </div>
          <button v-if="canManage && form.commands.length < 10" type="button" class="rt-add" @click="form.commands.push('')">+ команда</button>
          <small class="rt-note">Разрешены give, eco/money, tellraw, title, effect, xp — только для этого игрока. На серверах с модами предметы пишите с пространством имён: <code>minecraft:diamond</code>, <code>mekanism:ingot_osmium</code>.</small>
        </div>
        <div v-if="canManage" class="rt-test">
          <input v-model.trim="testNick" class="adm-input rt-mono" placeholder="ваш ник в игре" maxlength="16" aria-label="Ник для проверки" />
          <button type="button" class="adm-btn adm-btn--sm" :disabled="testing || dirty" :title="dirty ? 'Сначала сохраните изменения' : ''" @click="runTest">Выдать себе для проверки</button>
          <span class="rt-note">Зайдите на сервер — награда придёт в течение минуты. Не считается наградой игрока.</span>
        </div>
      </section>

      <!-- Приветствие -->
      <section class="adm-card rt-sec">
        <h2>Цель на первый день</h2>
        <SrvToggle v-model="form.welcome_enabled" :disabled="!canManage" label="Писать новичку при первом входе" hint="Несколько строк в чат: что сделать сегодня и что завтра ждёт награда" />
        <div v-if="form.welcome_enabled" class="adm-field">
          <span>Строки ({server}, {player}, {reward})</span>
          <div v-for="(l, i) in form.welcome_lines" :key="i" class="rt-cmd">
            <input v-model="form.welcome_lines[i]" class="adm-input" maxlength="240" :disabled="!canManage" />
            <button v-if="canManage" type="button" class="adm-btn adm-btn--sm adm-btn--danger" aria-label="Убрать" @click="form.welcome_lines.splice(i, 1)">✕</button>
          </div>
          <button v-if="canManage && form.welcome_lines.length < 6" type="button" class="rt-add" @click="form.welcome_lines.push('')">+ строка</button>
          <div class="rt-chat" aria-label="Как это увидит игрок">
            <div v-for="(l, i) in form.welcome_lines.filter((x) => x.trim())" :key="i" :class="i ? 'rt-chat__y' : 'rt-chat__g'">{{ preview(l) }}</div>
          </div>
        </div>
      </section>

      <!-- Напоминание -->
      <section class="adm-card rt-sec">
        <h2>Напоминание в Telegram</h2>
        <SrvToggle v-model="form.reminder_enabled" :disabled="!canManage" label="Напомнить, если не вернулся" hint="Через сутки после первого входа, один раз, только тем, кто привязал Telegram. В сообщении есть кнопка «Не напоминать». Письмом не шлём: согласия на рекламные письма нет." />
        <label v-if="form.reminder_enabled" class="adm-field"><span>Текст ({server}, {player}, {reward})</span><textarea v-model="form.reminder_text" class="adm-textarea" rows="2" maxlength="400" :disabled="!canManage" /><small class="rt-prev">{{ preview(form.reminder_text) }}</small></label>
      </section>

      <!-- Бонус за Telegram -->
      <section class="adm-card rt-sec">
        <h2>Бонус за привязку Telegram</h2>
        <SrvToggle v-model="form.tg_bonus_enabled" :disabled="!canManage" label="Давать бонус тем, кто привязал Telegram"
                   hint="Один раз на аккаунт, при ближайшем входе на этот сервер. Получат и те, кто привязал раньше. Без привязки напоминания до игрока не дойдут." />
        <template v-if="form.tg_bonus_enabled">
          <label class="adm-field"><span>Сообщение в чат</span><input v-model="form.tg_bonus_message" class="adm-input" maxlength="240" :disabled="!canManage" /><small class="rt-prev">{{ preview(form.tg_bonus_message) }}</small></label>
          <div class="adm-field">
            <span>Команды бонуса</span>
            <div v-for="(c, i) in form.tg_bonus_commands" :key="i" class="rt-cmd">
              <input v-model="form.tg_bonus_commands[i]" class="adm-input rt-mono" :class="{ 'rt-bad': cmdError(c) }" :disabled="!canManage" />
              <button v-if="canManage" type="button" class="adm-btn adm-btn--sm adm-btn--danger" aria-label="Убрать" @click="form.tg_bonus_commands.splice(i, 1)">✕</button>
              <small v-if="cmdError(c)" class="rt-err">{{ cmdError(c) }}</small>
            </div>
            <button v-if="canManage && form.tg_bonus_commands.length < 10" type="button" class="rt-add" @click="form.tg_bonus_commands.push('')">+ команда</button>
          </div>
          <p class="rt-note">Кнопка «Привязать» есть в профиле на сайте и в лаунчере; ссылка: <code>t.me/voidrp_bot?start=link</code>.</p>
        </template>
      </section>

      <!-- Серия входов -->
      <section class="adm-card rt-sec">
        <h2>Серия входов</h2>
        <SrvToggle v-model="form.streak_enabled" :disabled="!canManage" label="Награды за дни подряд"
                   hint="Считаются дни (по Москве), когда игрок заходил на этот сервер, без пропусков. Каждая награда — один раз на игрока." />
        <div v-if="form.streak_enabled" class="rt-streak">
          <div v-for="(st, i) in form.streak" :key="i" class="rt-step">
            <div class="rt-step__head">
              <label class="adm-field rt-day"><span>День подряд</span><input v-model.number="st.day" type="number" min="2" max="60" class="adm-input" :disabled="!canManage" /></label>
              <label class="adm-field rt-grow"><span>Сообщение</span><input v-model="st.message" class="adm-input" maxlength="240" :disabled="!canManage" /></label>
              <button v-if="canManage" type="button" class="adm-btn adm-btn--sm adm-btn--danger rt-del" aria-label="Убрать день" @click="form.streak.splice(i, 1)">✕</button>
            </div>
            <div v-for="(c, j) in st.commands" :key="j" class="rt-cmd">
              <input v-model="st.commands[j]" class="adm-input rt-mono" :class="{ 'rt-bad': cmdError(c) }" :disabled="!canManage" />
              <button v-if="canManage" type="button" class="adm-btn adm-btn--sm adm-btn--danger" aria-label="Убрать" @click="st.commands.splice(j, 1)">✕</button>
              <small v-if="cmdError(c)" class="rt-err">{{ cmdError(c) }}</small>
            </div>
            <button v-if="canManage && st.commands.length < 10" type="button" class="rt-add" @click="st.commands.push('')">+ команда</button>
          </div>
          <button v-if="canManage && form.streak.length < 10" type="button" class="rt-add" @click="addStreak">+ день серии</button>
        </div>
      </section>

      <!-- Последние -->
      <section class="adm-card rt-sec">
        <h2>Последние выдачи</h2>
        <div v-if="!st.recent?.length" class="rt-note">Пока ничего — появится после первых входов новичков.</div>
        <div v-else class="adm-table-scroll">
          <table class="adm-table">
            <thead><tr><th>Игрок</th><th>Что</th><th>Состояние</th><th>Когда</th><th>Заметка</th></tr></thead>
            <tbody>
              <tr v-for="r in st.recent" :key="r.id">
                <td class="rt-mono">{{ r.nickname }}</td>
                <td>{{ kindLabel(r.kind) }}<span v-if="r.created_by" class="rt-note"> · {{ r.created_by }}</span></td>
                <td><span class="adm-badge" :class="STATUS[r.status]?.[1]">{{ STATUS[r.status]?.[0] || r.status }}</span><span v-if="r.attempts > 1" class="rt-note"> · попыток {{ r.attempts }}</span></td>
                <td class="adm-num rt-note">{{ fmt(r.delivered_at || r.created_at) }}</td>
                <td class="rt-note">{{ r.last_error || '' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <AdminSaveBar v-if="canManage" :dirty="dirty" :saving="saving" :blocked="blocked" text="настройки возврата игроков" @save="save" @reset="reset" />
    </template>
  </div>
</template>

<style scoped>
.rt-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 0.6rem; }
.rt-stat { padding: 0.8rem 0.95rem; border-radius: var(--adm-r); background: var(--adm-card); border: 1px solid var(--adm-line); display: flex; flex-direction: column; gap: 0.1rem; }
.rt-stat b { font-size: 1.45rem; color: var(--adm-text); font-variant-numeric: tabular-nums; }
.rt-stat span { font-size: 0.76rem; color: var(--adm-dim); }
.rt-sec { padding: 1rem 1.1rem 1.1rem; display: flex; flex-direction: column; gap: 0.85rem; }
.rt-sec h2 { margin: 0; font-size: 0.95rem; font-weight: 800; color: var(--adm-text); }
.rt-head { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.rt-note { margin: 0; font-size: 0.76rem; color: var(--adm-dim); line-height: 1.45; }
.rt-note code { font-family: var(--adm-mono); font-size: 0.72rem; }
.rt-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr)); gap: 0.8rem; }
.rt-wide { grid-column: 1 / -1; }
.rt-prev { font-size: 0.74rem; color: var(--adm-acc-text); }
.rt-cmd { display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap; }
.rt-cmd .adm-input { flex: 1; min-width: 12rem; }
.rt-mono { font-family: var(--adm-mono); font-size: 0.8rem; }
.rt-bad { border-color: rgba(248, 113, 113, 0.6) !important; }
.rt-err { width: 100%; font-size: 0.72rem; color: var(--adm-err); }
.rt-add { align-self: flex-start; border: 1px dashed var(--adm-acc-line); background: transparent; color: var(--adm-acc-text); border-radius: var(--adm-r-sm); padding: 0.3rem 0.65rem; font: inherit; font-size: 0.76rem; font-weight: 700; cursor: pointer; }
.rt-test { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; padding-top: 0.6rem; border-top: 1px solid var(--adm-line); }
.rt-test .adm-input { width: 12rem; }
.rt-chat { margin-top: 0.3rem; padding: 0.6rem 0.75rem; border-radius: 8px; background: rgba(0, 0, 0, 0.45); font-family: var(--adm-mono); font-size: 0.78rem; display: flex; flex-direction: column; gap: 0.15rem; }
.rt-chat__g { color: #fbbf24; }
.rt-chat__y { color: #fde68a; }
.rt-streak { display: flex; flex-direction: column; gap: 0.7rem; }
.rt-step { padding: 0.75rem; border-radius: var(--adm-r-sm); background: var(--adm-card-2); border: 1px solid var(--adm-line); display: flex; flex-direction: column; gap: 0.45rem; }
.rt-step__head { display: flex; gap: 0.6rem; align-items: flex-end; flex-wrap: wrap; }
.rt-day { width: 7rem; }
.rt-grow { flex: 1; min-width: 12rem; }
.rt-del { margin-bottom: 0.15rem; }
</style>
