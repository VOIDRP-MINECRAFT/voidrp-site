<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import {
  adminCrashRuleCoverage,
  adminCreateCrashRule,
  adminDeleteCrashRule,
  adminListBuiltinCrashRules,
  adminListCrashRules,
  adminSetLauncherRam,
  adminTestCrashRule,
  adminUpdateCrashRule,
} from '../../services/adminCrashRulesApi'
import { authState, hasPermission } from '../../stores/authStore'
import { confirmDialog } from '../../composables/useConfirm'
import { toastError, toastSuccess } from '../../services/toast'

const token = () => authState.accessToken
const route = useRoute()
const canManage = hasPermission('crashes.rules.manage')

const loading = ref(true)
const rules = ref([])
const builtin = ref([])
const servers = ref([])
const actionTypes = ref({})
const defaultRamMb = ref(6144)
const coverage = ref(null)
const coverageDays = ref(14)
const showBuiltin = ref(false)

async function load() {
  loading.value = true
  try {
    const [list, bi] = await Promise.all([adminListCrashRules(token()), adminListBuiltinCrashRules(token())])
    rules.value = list?.items || []
    servers.value = list?.servers || []
    actionTypes.value = list?.action_types || {}
    defaultRamMb.value = list?.default_recommended_ram_mb || 6144
    builtin.value = bi?.items || []
    ramDraft.value = Object.fromEntries(servers.value.map((s) => [s.slug, s.launcher_recommended_ram_mb ? s.launcher_recommended_ram_mb / 1024 : '']))
  } catch (e) {
    toastError(e.message || 'Не удалось загрузить правила')
  } finally {
    loading.value = false
  }
  loadCoverage()
}

async function loadCoverage() {
  try {
    coverage.value = await adminCrashRuleCoverage(token(), coverageDays.value)
  } catch {
    coverage.value = null
  }
}

const coveragePct = computed(() => {
  const c = coverage.value
  return c && c.total ? Math.round((c.recognized / c.total) * 100) : 0
})

const dbKeys = computed(() => new Set(rules.value.map((r) => r.key)))
const ruleTitleByKey = computed(() => {
  const map = {}
  for (const r of builtin.value) map[r.key] = r.title
  for (const r of rules.value) map[r.key] = r.title
  return map
})

// ── Recommended memory per server ─────────────────────────────────────────
const ramDraft = ref({})
const ramSaving = ref('')

async function saveRam(slug) {
  const raw = ramDraft.value[slug]
  const gb = raw === '' || raw == null ? null : Number(raw)
  if (gb != null && (!Number.isFinite(gb) || gb < 1 || gb > 64)) {
    toastError('Укажите от 1 до 64 ГБ или оставьте пустым')
    return
  }
  ramSaving.value = slug
  try {
    await adminSetLauncherRam(token(), slug, gb == null ? null : Math.round(gb * 1024))
    toastSuccess('Сохранено — лаунчеры подхватят при следующем запуске')
  } catch (e) {
    toastError(e.message || 'Не удалось сохранить')
  } finally {
    ramSaving.value = ''
  }
}

// ── Editor ────────────────────────────────────────────────────────────────
const editorOpen = ref(false)
const saving = ref(false)
const form = reactive(emptyForm())
const testResult = ref(null)
const testing = ref(false)

function emptyForm() {
  return {
    id: null, key: '', server_slug: '', priority: 50, enabled: true,
    title: '', cause: '', solution: '',
    patterns_all: '', patterns_any: '', exit_codes: '',
    actions: [{ type: 'relaunch', label: 'Запустить снова', paths: '' }],
  }
}

function fillForm(rule, { asNew = false } = {}) {
  Object.assign(form, emptyForm(), {
    id: asNew ? null : rule.id ?? null,
    key: rule.key || '',
    server_slug: rule.server_slug || '',
    priority: rule.priority ?? 50,
    enabled: rule.enabled ?? true,
    title: rule.title || '',
    cause: rule.cause || '',
    solution: rule.solution || '',
    patterns_all: (rule.patterns_all || []).join('\n'),
    patterns_any: (rule.patterns_any || []).join('\n'),
    exit_codes: (rule.exit_codes || []).join(', '),
    actions: (rule.actions || []).map((a) => ({ type: a.type, label: a.label || '', paths: (a.paths || []).join('\n') })),
  })
  testResult.value = null
  editorOpen.value = true
}

function openNew(prefill = {}) {
  Object.assign(form, emptyForm(), prefill)
  testResult.value = null
  editorOpen.value = true
}

function overrideBuiltin(rule) {
  fillForm(rule, { asNew: true })
}

async function disableBuiltin(rule) {
  if (!(await confirmDialog({
    title: 'Отключить встроенное правило',
    message: `Лаунчер перестанет показывать «${rule.title}». Правило можно вернуть, удалив запись-отключение.`,
    confirmLabel: 'Отключить',
    danger: true,
  }))) return
  try {
    await adminCreateCrashRule(token(), { ...rule, enabled: false, server_slug: null })
    toastSuccess('Встроенное правило отключено')
    load()
  } catch (e) {
    toastError(e.message || 'Не удалось отключить')
  }
}

function lines(text) {
  return String(text || '').split('\n').map((s) => s.trim()).filter(Boolean)
}

function payload() {
  return {
    key: form.key.trim(),
    server_slug: form.server_slug || null,
    priority: Number(form.priority) || 0,
    enabled: !!form.enabled,
    title: form.title.trim(),
    cause: form.cause,
    solution: form.solution,
    patterns_all: lines(form.patterns_all),
    patterns_any: lines(form.patterns_any),
    exit_codes: String(form.exit_codes || '').split(/[\s,;]+/).filter(Boolean).map(Number).filter(Number.isInteger),
    actions: form.actions
      .filter((a) => a.type)
      .map((a) => ({ type: a.type, label: a.label.trim(), paths: a.type === 'fix_files' ? lines(a.paths) : [] })),
  }
}

function addAction() {
  if (form.actions.length < 4) form.actions.push({ type: 'repair', label: 'Починить клиент', paths: '' })
}

async function runTest() {
  const p = payload()
  testing.value = true
  try {
    testResult.value = await adminTestCrashRule(token(), {
      patterns_all: p.patterns_all,
      patterns_any: p.patterns_any,
      exit_codes: p.exit_codes,
      server_slug: p.server_slug,
      limit: 500,
    })
  } catch (e) {
    toastError(e.message || 'Проверка не удалась')
  } finally {
    testing.value = false
  }
}

async function save() {
  saving.value = true
  try {
    const body = payload()
    if (form.id) await adminUpdateCrashRule(token(), form.id, body)
    else await adminCreateCrashRule(token(), body)
    toastSuccess('Правило сохранено — лаунчеры подхватят при следующем запуске')
    editorOpen.value = false
    load()
  } catch (e) {
    toastError(e.message || 'Не удалось сохранить')
  } finally {
    saving.value = false
  }
}

async function remove(rule) {
  const message = rule.overrides_builtin
    ? `Запись «${rule.key}» переопределяет встроенное правило — после удаления лаунчер вернётся к встроенному варианту.`
    : `Удалить правило «${rule.title}»?`
  if (!(await confirmDialog({ title: 'Удалить правило', message, confirmLabel: 'Удалить', danger: true }))) return
  try {
    await adminDeleteCrashRule(token(), rule.id)
    rules.value = rules.value.filter((r) => r.id !== rule.id)
    loadCoverage()
  } catch (e) {
    toastError(e.message || 'Не удалось удалить')
  }
}

// Preview with placeholders filled from the first matching crash (like the launcher does).
const previewCaptures = computed(() => testResult.value?.samples?.[0]?.captures || {})
function renderText(text) {
  return String(text || '').replace(/\{(\w+)(?:\|([^}]*))?\}/g, (_, name, fallback) => previewCaptures.value[name] ?? fallback ?? '')
}

onMounted(() => {
  load()
  // «Создать правило» from a crash card: ?pattern=<escaped line>
  if (route.query.pattern && canManage) {
    openNew({ patterns_all: String(route.query.pattern), key: '', title: '' })
  }
})
</script>

<template>
  <div class="adm-page" style="max-width: 1040px">
    <div class="adm-page__head">
      <div>
        <h1 class="adm-title">Правила крашей</h1>
        <p class="adm-sub">Что лаунчер объясняет игроку после краша и какую кнопку исправления предлагает</p>
      </div>
      <div class="adm-head-actions">
        <button class="adm-btn" :disabled="loading" @click="load">Обновить</button>
        <button v-if="canManage" class="adm-btn adm-btn--acc" @click="openNew()">Новое правило</button>
      </div>
    </div>

    <div v-if="loading" class="adm-skel" style="height: 320px" />

    <template v-else>
      <!-- Coverage -->
      <div class="adm-card adm-card--pad">
        <div class="cov-head">
          <div>
            <div class="adm-card__title">Покрытие правилами</div>
            <p v-if="coverage" class="adm-sub">
              Распознано <b>{{ coverage.recognized }}</b> из <b>{{ coverage.total }}</b> крашей за {{ coverage.days }} дн. ({{ coveragePct }}%)
            </p>
          </div>
          <select v-model.number="coverageDays" class="adm-select" style="width: auto" @change="loadCoverage">
            <option :value="3">3 дня</option>
            <option :value="7">7 дней</option>
            <option :value="14">14 дней</option>
            <option :value="30">30 дней</option>
          </select>
        </div>
        <div v-if="coverage && coverage.total" class="cov-bar"><span :style="{ width: coveragePct + '%' }" /></div>
        <div v-if="coverage" class="cov-list">
          <span v-for="row in coverage.by_rule" :key="row.key" class="chip" :class="{ 'chip--warn': row.key === '<unrecognized>' }">
            {{ row.key === '<unrecognized>' ? 'не распознано' : (ruleTitleByKey[row.key] || row.key) }} · {{ row.count }}
          </span>
        </div>
        <p v-if="coverage?.unrecognized_samples?.length" class="adm-sub" style="margin-top: 0.6rem">
          Нераспознанные — открой лог в «Краши лаунчера» и нажми «Создать правило»:
          <router-link
            v-for="s in coverage.unrecognized_samples.slice(0, 8)"
            :key="s.id"
            class="adm-mono unrec"
            :to="{ path: '/admin/launcher-crashes', query: { player: s.player_nickname } }"
          >{{ s.player_nickname }}</router-link>
        </p>
      </div>

      <!-- Memory threshold -->
      <div class="adm-card adm-card--pad" style="margin-top: 0.8rem">
        <div class="adm-card__title">Рекомендуемая память</div>
        <p class="adm-sub">Перед запуском лаунчер предупредит, если игроку выделено меньше. Пусто — {{ defaultRamMb / 1024 }} ГБ по умолчанию.</p>
        <div class="ram-grid">
          <label v-for="s in servers" :key="s.slug" class="adm-field">
            <span>{{ s.name }} <span class="adm-mono">({{ s.slug }})</span></span>
            <div class="ram-row">
              <input v-model="ramDraft[s.slug]" class="adm-input" type="number" min="1" max="64" step="0.5" :disabled="!canManage" :placeholder="String(defaultRamMb / 1024)" />
              <span class="adm-sub">ГБ</span>
              <button v-if="canManage" class="adm-btn adm-btn--sm" :disabled="ramSaving === s.slug" @click="saveRam(s.slug)">Сохранить</button>
            </div>
          </label>
        </div>
      </div>

      <!-- DB rules -->
      <h2 class="section-title">Свои правила</h2>
      <div v-if="rules.length" class="cards">
        <div v-for="rule in rules" :key="rule.id" class="adm-card adm-card--hover" style="padding: 0.85rem 1.1rem">
          <div class="card__top">
            <div class="card__meta">
              <span class="adm-badge" :class="rule.enabled ? 'adm-badge--ok' : 'adm-badge--err'">{{ rule.enabled ? 'вкл' : 'выкл' }}</span>
              <b>{{ rule.title }}</b>
              <span class="adm-mono key">{{ rule.key }}</span>
              <span v-if="rule.overrides_builtin" class="adm-badge adm-badge--info">{{ rule.enabled ? 'переопределяет встроенное' : 'отключает встроенное' }}</span>
              <span class="chip">🖥 {{ rule.server_slug || 'все серверы' }}</span>
              <span class="chip">приоритет {{ rule.priority }}</span>
            </div>
            <div v-if="canManage" class="card__actions">
              <button class="adm-btn adm-btn--sm" @click="fillForm(rule)">Изменить</button>
              <button class="adm-btn adm-btn--danger adm-btn--sm" @click="remove(rule)">Удалить</button>
            </div>
          </div>
          <div class="patterns adm-mono">
            <div v-for="p in rule.patterns_all" :key="'a' + p">все: {{ p }}</div>
            <div v-for="p in rule.patterns_any" :key="'y' + p">любой: {{ p }}</div>
            <div v-if="rule.exit_codes.length">коды: {{ rule.exit_codes.join(', ') }}</div>
          </div>
          <div class="env-chips">
            <span v-for="a in rule.actions" :key="a.type + a.label" class="chip">🔘 {{ a.label || actionTypes[a.type] || a.type }}</span>
          </div>
        </div>
      </div>
      <div v-else class="adm-empty">
        <div class="adm-empty__title">Своих правил пока нет</div>
        <div class="adm-empty__sub">Работают только встроенные правила лаунчера (ниже)</div>
      </div>

      <!-- Built-in rules -->
      <h2 class="section-title">
        Встроенные в лаунчер
        <button class="adm-btn adm-btn--ghost adm-btn--sm" @click="showBuiltin = !showBuiltin">{{ showBuiltin ? 'Скрыть' : `Показать (${builtin.length})` }}</button>
      </h2>
      <div v-if="showBuiltin" class="cards">
        <div v-for="rule in builtin" :key="rule.key" class="adm-card" style="padding: 0.75rem 1.1rem">
          <div class="card__top">
            <div class="card__meta">
              <b>{{ rule.title }}</b>
              <span class="adm-mono key">{{ rule.key }}</span>
              <span class="chip">приоритет {{ rule.priority }}</span>
              <span v-if="dbKeys.has(rule.key)" class="adm-badge adm-badge--info">есть своя запись</span>
            </div>
            <div v-if="canManage && !dbKeys.has(rule.key)" class="card__actions">
              <button class="adm-btn adm-btn--sm" @click="overrideBuiltin(rule)">Переопределить</button>
              <button class="adm-btn adm-btn--danger adm-btn--sm" @click="disableBuiltin(rule)">Отключить</button>
            </div>
          </div>
          <p class="adm-sub" style="margin-top: 0.35rem">{{ rule.cause }}</p>
        </div>
      </div>
    </template>

    <!-- Editor -->
    <div v-if="editorOpen" class="adm-modal-backdrop" @click.self="editorOpen = false">
      <div class="adm-modal rule-modal">
        <h2 class="adm-title">{{ form.id ? 'Изменить правило' : 'Новое правило' }}</h2>
        <p class="adm-sub">Шаблоны — регулярные выражения по логу игры (без учёта регистра). Именованная группа <span class="adm-mono">(?&lt;file&gt;...)</span> подставляется в тексты как <span class="adm-mono">{file}</span> или <span class="adm-mono">{file|если не найдено}</span>.</p>

        <div class="grid2">
          <label class="adm-field"><span>Ключ (латиница, a-z0-9_)</span><input v-model="form.key" class="adm-input adm-mono" placeholder="my_mod_crash" /></label>
          <label class="adm-field"><span>Сервер</span>
            <select v-model="form.server_slug" class="adm-select">
              <option value="">Все серверы</option>
              <option v-for="s in servers" :key="s.slug" :value="s.slug">{{ s.name }}</option>
            </select>
          </label>
          <label class="adm-field"><span>Приоритет (выше — проверяется раньше)</span><input v-model.number="form.priority" class="adm-input" type="number" min="-1000" max="1000" /></label>
          <label class="adm-check" style="align-self: end"><input v-model="form.enabled" type="checkbox" /> Включено</label>
        </div>

        <label class="adm-field"><span>Все эти шаблоны должны найтись (по одному в строке)</span><textarea v-model="form.patterns_all" class="adm-textarea adm-mono" rows="3" /></label>
        <label class="adm-field"><span>Хотя бы один из этих (по одному в строке)</span><textarea v-model="form.patterns_any" class="adm-textarea adm-mono" rows="2" /></label>
        <label class="adm-field"><span>Коды завершения (через запятую, необязательно)</span><input v-model="form.exit_codes" class="adm-input adm-mono" placeholder="-1, 1" /></label>

        <div class="test-row">
          <button class="adm-btn" :disabled="testing" @click="runTest">{{ testing ? 'Проверяем…' : 'Проверить на последних крашах' }}</button>
          <span v-if="testResult && !testResult.errors.length" class="adm-sub">
            Совпало <b>{{ testResult.matched }}</b> из {{ testResult.tested }}
          </span>
        </div>
        <div v-if="testResult?.errors?.length" class="exit-hint">{{ testResult.errors.join(' ') }}</div>
        <div v-if="testResult?.samples?.length" class="samples">
          <div v-for="s in testResult.samples.slice(0, 6)" :key="s.id" class="sample">
            <div class="sample__head">
              <span class="adm-mono">{{ s.player_nickname }}</span>
              <span class="adm-sub">{{ new Date(s.created_at).toLocaleString('ru-RU') }}</span>
              <span v-if="s.advice_rule_key" class="chip">сейчас: {{ s.advice_rule_key }}</span>
              <span v-for="(v, k) in s.captures" :key="k" class="chip">{{ k }} = {{ v }}</span>
            </div>
            <pre class="adm-mono">{{ s.snippet }}</pre>
          </div>
        </div>

        <label class="adm-field"><span>Заголовок</span><input v-model="form.title" class="adm-input" maxlength="160" /></label>
        <label class="adm-field"><span>Что произошло</span><textarea v-model="form.cause" class="adm-textarea" rows="3" /></label>
        <label class="adm-field"><span>Как исправить</span><textarea v-model="form.solution" class="adm-textarea" rows="3" /></label>

        <div class="adm-field">
          <span>Кнопки (до 4)</span>
          <div v-for="(a, i) in form.actions" :key="i" class="action-row">
            <select v-model="a.type" class="adm-select">
              <option v-for="(label, type) in actionTypes" :key="type" :value="type">{{ label }}</option>
            </select>
            <input v-model="a.label" class="adm-input" placeholder="Подпись на кнопке" maxlength="60" />
            <button class="adm-btn adm-btn--danger adm-btn--sm" @click="form.actions.splice(i, 1)">✕</button>
            <textarea
              v-if="a.type === 'fix_files'"
              v-model="a.paths"
              class="adm-textarea adm-mono action-paths"
              rows="2"
              placeholder="config/…/файл — по одному в строке, только внутри config/"
            />
          </div>
          <button v-if="form.actions.length < 4" class="adm-btn adm-btn--ghost adm-btn--sm" style="align-self: flex-start" @click="addAction">+ Кнопка</button>
        </div>

        <!-- Preview -->
        <div class="preview">
          <div class="adm-label">Так увидит игрок</div>
          <b>{{ renderText(form.title) || 'Заголовок' }}</b>
          <p><span class="adm-sub">Что произошло:</span> {{ renderText(form.cause) }}</p>
          <p><span class="adm-sub">Как исправить:</span> {{ renderText(form.solution) }}</p>
          <div class="env-chips">
            <span v-for="(a, i) in form.actions" :key="i" class="chip">{{ renderText(a.label) || actionTypes[a.type] }}</span>
          </div>
        </div>

        <div class="adm-head-actions" style="margin-top: 14px">
          <button class="adm-btn adm-btn--ghost" @click="editorOpen = false">Отмена</button>
          <button class="adm-btn adm-btn--acc" :disabled="saving" @click="save">{{ saving ? 'Сохранение…' : 'Сохранить' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cards { display: flex; flex-direction: column; gap: 0.65rem; }
.section-title { display: flex; align-items: center; gap: 0.6rem; margin: 1.4rem 0 0.6rem; font-size: 0.95rem; font-weight: 800; }
.card__top { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap; }
.card__meta { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.card__actions { display: flex; gap: 0.4rem; }
.key { font-size: 0.72rem; color: var(--adm-faint); }
.patterns { margin-top: 0.5rem; font-size: 0.7rem; color: var(--adm-mut); display: flex; flex-direction: column; gap: 0.15rem; word-break: break-all; }
.env-chips { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.5rem; }
.chip {
  display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.15rem 0.5rem;
  background: var(--adm-line-soft, rgba(148, 163, 184, 0.08)); border: 1px solid var(--adm-line);
  border-radius: 999px; font-size: 0.7rem; color: var(--adm-mut); font-weight: 600;
  max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.chip--warn { color: var(--adm-warn); border-color: var(--adm-warn); }
.cov-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem; flex-wrap: wrap; }
.cov-bar { height: 8px; border-radius: 999px; background: var(--adm-line); overflow: hidden; margin: 0.7rem 0; }
.cov-bar span { display: block; height: 100%; background: var(--adm-acc); }
.cov-list { display: flex; flex-wrap: wrap; gap: 0.35rem; }
.unrec { margin-left: 0.4rem; color: var(--adm-acc-text); }
.ram-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 0.7rem; margin-top: 0.6rem; }
.ram-row { display: flex; align-items: center; gap: 0.4rem; }
.ram-row .adm-input { max-width: 90px; }

.rule-modal { width: min(820px, 96vw); max-height: 92vh; overflow-y: auto; display: flex; flex-direction: column; gap: 0.7rem; }
.grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.7rem; }
.test-row { display: flex; align-items: center; gap: 0.7rem; flex-wrap: wrap; }
.exit-hint { font-size: 0.76rem; color: var(--adm-warn); }
.samples { display: flex; flex-direction: column; gap: 0.45rem; max-height: 260px; overflow-y: auto; }
.sample { border: 1px solid var(--adm-line); border-radius: 8px; padding: 0.45rem 0.6rem; }
.sample__head { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; }
.sample pre { margin: 0.35rem 0 0; font-size: 0.68rem; color: var(--adm-mut); white-space: pre-wrap; word-break: break-all; }
.action-row { display: grid; grid-template-columns: 220px 1fr auto; gap: 0.4rem; align-items: center; }
.action-paths { grid-column: 1 / -1; }
.preview { border: 1px dashed var(--adm-line); border-radius: 10px; padding: 0.7rem 0.9rem; display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.82rem; }
.preview p { margin: 0; white-space: pre-line; }
@media (max-width: 640px) {
  .action-row { grid-template-columns: 1fr auto; }
  .action-row .adm-input { grid-column: 1 / -1; }
}
</style>
