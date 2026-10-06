<script setup>
// «Воронка новичка»: от регистрации до игры через неделю — где теряем людей, как меняется
// по неделям, и кто застрял (чтобы написать им или позвать бонусом).
import { computed, onMounted, ref, watch } from 'vue'
import { authState } from '../../stores/authStore'
import { serverState, fetchServers } from '../../stores/serverStore'
import { getFunnel } from '../../services/adminApi'
import { toastError, toastSuccess } from '../../services/toast'
import SrvSeg from './servers/SrvSeg.vue'

const data = ref(null)
const loading = ref(true)
const server = ref('')
const source = ref('')
const weeks = ref(12)
const stuckTab = ref('one_day')

async function load() {
  loading.value = true
  try { data.value = await getFunnel(authState.accessToken, { server: server.value, source: source.value, weeks: weeks.value }) }
  catch (e) { toastError(e?.message || 'Не удалось посчитать воронку') }
  finally { loading.value = false }
}
onMounted(() => { fetchServers(); load() })
watch([server, source, weeks], load)

const steps = computed(() => data.value?.steps || [])
const first = computed(() => steps.value[0]?.count || 0)
// Самая большая потеря между соседними шагами — её и стоит чинить первой.
const worst = computed(() => {
  let best = null
  for (const s of steps.value.slice(1)) if (s.lost > 0 && (!best || s.lost > best.lost)) best = s
  return best
})
const ADVICE = {
  opened: 'Регистрируются, но не открывают лаунчер: проверьте, видна ли кнопка скачивания сразу после регистрации и не пугает ли установка.',
  launched: 'Открыли лаунчер, но не нажали «Играть»: долгая загрузка сборки, нехватка памяти или ошибки — смотрите «Краши лаунчера».',
  joined: 'Запускают лаунчер, но не доходят до сервера: смотрите «Краши лаунчера» и долгую загрузку сборки.',
  returned: 'Заходят один раз и не возвращаются — главная потеря. Помогают первые 15 минут: стартовый набор, понятная цель, гайд новичка, ежедневная награда.',
  week: 'Возвращаются, но не задерживаются на неделю: нужны цели на неделю — квесты, Battle Pass, государства.',
}
const pct = (n, of) => (of ? Math.round((n * 100) / of) : 0)
const fmtWeek = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : '—')
const cohortKeys = computed(() => steps.value.slice(1).map((s) => [s.key, s.label]))
// Ячейка когорты: доля от зарегистрировавшихся в ту неделю, оттенок — одна шкала цвета.
const cellStyle = (n, of) => ({ background: `rgba(var(--adm-acc-rgb), ${(0.06 + (pct(n, of) / 100) * 0.5).toFixed(2)})` })

const STUCK = [
  ['one_day', 'Зашли один раз', 'Были на сервере в один день и больше трёх дней не появлялись'],
  ['no_join', 'Не дошли до сервера', 'Нажимали «Играть», но ни разу не зашли на сервер'],
  ['no_launch', 'Открыли лаунчер, не играли', 'Вошли в лаунчер, но ни разу не нажали «Играть»'],
  ['no_open', 'Не открыли лаунчер', 'Зарегистрировались, но в лаунчер так и не вошли'],
]
const stuckList = computed(() => data.value?.stuck?.[stuckTab.value] || [])
async function copyEmails() {
  const emails = stuckList.value.map((p) => p.email).filter(Boolean).join(', ')
  try { await navigator.clipboard.writeText(emails); toastSuccess(`Скопировано адресов: ${stuckList.value.length}`) } catch { toastError('Не удалось скопировать') }
}
const SOURCE = { site: 'сайт', game: 'в игре', referral: 'по приглашению' }
</script>

<template>
  <div class="adm-page">
    <div class="adm-page__head">
      <div>
        <h1 class="adm-title">Воронка новичка</h1>
        <p class="adm-sub">Путь игрока от регистрации до игры через неделю: где теряем людей и кого позвать обратно. Сотрудники не считаются.</p>
      </div>
    </div>

    <div class="fn-filters">
      <select v-model="server" class="adm-select fn-sel" aria-label="Сервер">
        <option value="">Все серверы</option>
        <option v-for="s in serverState.list" :key="s.slug" :value="s.slug">{{ s.name }}</option>
      </select>
      <SrvSeg v-model="source" :options="[['', 'Все'], ['site', 'С сайта'], ['game', 'В игре'], ['referral', 'По приглашению']]" label="Откуда пришли" />
      <SrvSeg v-model="weeks" :options="[[4, '4 нед'], [12, '12 нед'], [26, 'полгода'], [52, 'год']]" label="Период" />
    </div>

    <div v-if="loading && !data" class="adm-loading">Считаю путь игроков…</div>
    <template v-else-if="data">
      <div v-if="!data.total" class="adm-empty"><div class="adm-empty__title">За этот период регистраций нет</div><div class="adm-empty__sub">Попробуйте период побольше или другой фильтр.</div></div>
      <template v-else>
        <!-- Шаги -->
        <section class="adm-card fn-card">
          <div class="adm-card__head"><div class="adm-card__title">Шаги</div><span class="fn-muted">{{ data.total }} новичков за {{ data.weeks }} нед</span></div>
          <ol class="fn-steps">
            <li v-for="(s, i) in steps" :key="s.key" class="fn-step" :class="{ 'fn-step--worst': worst && worst.key === s.key }">
              <div class="fn-step__label">
                <span class="fn-step__n">{{ i + 1 }}</span>
                <span>{{ s.label }}</span>
              </div>
              <div class="fn-step__bar" :title="`${s.count} из ${first}`">
                <span :style="{ width: `${Math.max(2, pct(s.count, first))}%` }" />
              </div>
              <div class="fn-step__num"><b>{{ s.count }}</b><span>{{ pct(s.count, first) }}%</span></div>
              <div class="fn-step__drop">
                <template v-if="s.lost != null">
                  <span v-if="s.lost > 0" class="fn-lost">−{{ s.lost }}</span>
                  <span class="fn-muted">{{ s.of_prev }}% от прошлого шага</span>
                </template>
              </div>
            </li>
          </ol>
          <div v-if="worst" class="fn-advice">
            <b>Больше всего теряем на шаге «{{ worst.label }}»: {{ worst.lost }} чел.</b>
            <span>{{ ADVICE[worst.key] }}</span>
          </div>
          <p class="fn-side">
            Telegram привязали <b>{{ data.telegram?.linked ?? 0 }} из {{ data.telegram?.total ?? 0 }}</b> новичков — только им дойдёт напоминание о награде.
            <template v-if="data.downloads?.total"> Скачиваний лаунчера с сайта за период: <b>{{ data.downloads.total }}</b> (из них вошли в аккаунт {{ data.downloads.signed_in }}).</template>
            <template v-else> Скачивания лаунчера с сайта считаются с 6 октября.</template>
          </p>
          <p v-if="server && !data.playtime_since" class="fn-side">
            Время в игре на этом сервере ещё не собиралось — оно приходит от VoidRpPerms 0.7.1+ (или VoidRpGameSync). Как только игроки поиграют, здесь появится доля тех, кто наиграл 15+ минут.
          </p>
          <p v-else-if="data.played15?.joined" class="fn-side">
            Из зашедших на сервер (время в игре собирается с {{ fmtDate(data.playtime_since) }}) <b>{{ pct(data.played15.played15, data.played15.joined) }}%</b> наиграли больше 15 минут — {{ data.played15.played15 }} из {{ data.played15.joined }}.
          </p>
        </section>

        <!-- Когорты -->
        <section class="adm-card fn-card">
          <div class="adm-card__head"><div class="adm-card__title">По неделям регистрации</div><span class="fn-muted">доля от зарегистрировавшихся в ту неделю</span></div>
          <div class="adm-table-scroll">
            <table class="adm-table fn-coh">
              <thead><tr><th>Неделя</th><th>Регистраций</th><th v-for="k in cohortKeys" :key="k[0]">{{ k[1] }}</th></tr></thead>
              <tbody>
                <tr v-for="c in data.cohorts" :key="c.start">
                  <td class="fn-week">с {{ fmtWeek(c.start) }}<span v-if="!c.mature" class="fn-young" title="Неделе меньше двух недель — шаг «через неделю» ещё не мог случиться">идёт</span><span v-if="data.marks?.[c.start]" class="fn-mark" :title="data.marks[c.start]">★ {{ data.marks[c.start] }}</span></td>
                  <td class="adm-num">{{ c.registered }}</td>
                  <td v-for="k in cohortKeys" :key="k[0]" class="fn-cell adm-num" :style="cellStyle(c[k[0]], c.registered)" :title="`${c[k[0]]} из ${c.registered}`">{{ pct(c[k[0]], c.registered) }}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- Застрявшие -->
        <section class="adm-card fn-card">
          <div class="adm-card__head">
            <div class="adm-card__title">Кого позвать обратно</div>
            <button v-if="stuckList.length" type="button" class="adm-btn adm-btn--sm" @click="copyEmails">Скопировать почты ({{ stuckList.length }})</button>
          </div>
          <div class="fn-pad">
            <div class="adm-tabs">
              <button v-for="t in STUCK" :key="t[0]" type="button" class="adm-tab" :class="{ 'adm-tab--active': stuckTab === t[0] }" @click="stuckTab = t[0]">
                {{ t[1] }} <span class="fn-n">{{ data.stuck[t[0]]?.length || 0 }}</span>
              </button>
            </div>
            <p class="fn-muted">{{ STUCK.find((t) => t[0] === stuckTab)[2] }}.</p>
          </div>
          <div v-if="!stuckList.length" class="fn-pad fn-calm">Таких нет — отлично.</div>
          <div v-else class="adm-table-scroll">
            <table class="adm-table">
              <thead><tr><th>Игрок</th><th>Почта</th><th>Telegram</th><th>Откуда</th><th>Регистрация</th><th>Был последний раз</th><th>В игре</th></tr></thead>
              <tbody>
                <tr v-for="p in stuckList" :key="p.login">
                  <td><RouterLink v-if="p.nickname" :to="`/admin/players/${p.nickname}`" class="fn-nick">{{ p.nickname }}</RouterLink><span v-else>{{ p.login }}</span></td>
                  <td class="fn-dim">{{ p.email }}</td>
                  <td><span class="adm-badge" :class="p.telegram ? 'adm-badge--ok' : ''">{{ p.telegram ? 'привязан' : 'нет' }}</span></td>
                  <td class="fn-dim">{{ SOURCE[p.source] || p.source }}</td>
                  <td class="adm-num fn-dim">{{ fmtDate(p.registered_at) }}</td>
                  <td class="adm-num fn-dim">{{ fmtDate(p.last_seen_at) }}</td>
                  <td class="adm-num fn-dim">{{ p.playtime_min ? `${p.playtime_min} мин` : '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>
    </template>
  </div>
</template>

<style scoped>
.fn-filters { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; }
.fn-sel { width: auto; min-width: 12rem; }
.fn-card { display: flex; flex-direction: column; }
.fn-muted { color: var(--adm-dim); font-size: 0.78rem; }
.fn-pad { padding: 0 1rem 0.8rem; display: flex; flex-direction: column; gap: 0.5rem; }
.fn-steps { list-style: none; margin: 0; padding: 0 1rem 1rem; display: flex; flex-direction: column; gap: 0.55rem; }
.fn-step { display: grid; grid-template-columns: minmax(11rem, 14rem) minmax(0, 1fr) 6.5rem minmax(9rem, 13rem); gap: 0.8rem; align-items: center; }
@media (max-width: 760px) { .fn-step { grid-template-columns: 1fr auto; } .fn-step__bar { grid-column: 1 / -1; order: 3; } .fn-step__drop { grid-column: 1 / -1; order: 4; } }
.fn-step__label { display: flex; align-items: center; gap: 0.55rem; font-size: 0.86rem; font-weight: 600; color: var(--adm-text); }
.fn-step__n { width: 1.4rem; height: 1.4rem; border-radius: 50%; display: grid; place-items: center; font-size: 0.7rem; font-weight: 800; background: var(--adm-card-2); color: var(--adm-mut); flex: none; }
.fn-step__bar { height: 1.6rem; border-radius: 6px; background: var(--adm-card-2); overflow: hidden; }
.fn-step__bar span { display: block; height: 100%; border-radius: 6px; background: var(--adm-acc); transition: width 0.3s; }
.fn-step--worst .fn-step__bar span { background: linear-gradient(90deg, var(--adm-acc), var(--adm-warn)); }
.fn-step__num { display: flex; align-items: baseline; gap: 0.4rem; font-variant-numeric: tabular-nums; }
.fn-step__num b { font-size: 1.05rem; color: var(--adm-text); }
.fn-step__num span { font-size: 0.78rem; color: var(--adm-dim); }
.fn-step__drop { display: flex; gap: 0.5rem; align-items: baseline; font-size: 0.78rem; }
.fn-lost { color: var(--adm-err); font-weight: 800; font-variant-numeric: tabular-nums; }
.fn-step--worst .fn-step__label { color: var(--adm-warn); }
.fn-advice { margin: 0 1rem 1rem; padding: 0.75rem 0.9rem; border-radius: var(--adm-r-sm); border: 1px solid rgba(251, 191, 36, 0.3); background: rgba(251, 191, 36, 0.06); display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.82rem; color: var(--adm-mut); line-height: 1.45; }
.fn-advice b { color: var(--adm-text); }
.fn-side { margin: 0 1rem 1rem; font-size: 0.8rem; color: var(--adm-dim); }
.fn-side b { color: var(--adm-text); }
.fn-coh td, .fn-coh th { text-align: center; }
.fn-coh td:first-child, .fn-coh th:first-child { text-align: left; }
.fn-week { white-space: nowrap; }
.fn-young { margin-left: 0.4rem; font-size: 0.66rem; font-weight: 700; padding: 0.05rem 0.35rem; border-radius: 5px; background: var(--adm-card-2); color: var(--adm-dim); }
.fn-mark { display: block; margin-top: 0.15rem; font-size: 0.66rem; font-weight: 700; color: var(--adm-warn); }
.fn-cell { color: var(--adm-text); font-weight: 700; }
.fn-n { opacity: 0.6; font-size: 0.75em; margin-left: 0.15rem; }
.fn-nick { font-weight: 700; color: var(--adm-text); text-decoration: none; font-family: var(--adm-mono); }
.fn-nick:hover { color: var(--adm-acc-text); }
.fn-dim { color: var(--adm-dim); }
.fn-calm { color: var(--adm-ok); font-size: 0.84rem; }
</style>
