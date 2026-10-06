<script setup>
// Новый сервер за три шага: имя → что за сервер → адрес. Остальное — уже в настройках.
import { computed, reactive, ref, watch } from 'vue'
import { authState } from '../../../stores/authStore'
import { toastError, toastSuccess } from '../../../services/toast'
import { createServer, suggestServerPaths } from '../../../services/adminServersApi'
import SrvSeg from './SrvSeg.vue'
import { CORE_LABELS, buildPayload, toForm } from './shared'

const props = defineProps({ servers: { type: Array, default: () => [] } })
const emit = defineEmits(['close', 'created'])
const token = () => authState.accessToken

const step = ref(1)
const form = reactive(toForm(null))
form.is_visible = true
form.staff_only = true // a new server starts hidden from players until it is ready
form.maintenance = false
const kind = ref('ours')
const slugTouched = ref(false)

const TR = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ы: 'y', э: 'e', ю: 'yu', я: 'ya' }
function slugify(name) {
  return name.toLowerCase().replace(/^voidrp[:\s-]*/, '').split('').map((c) => TR[c] ?? c).join('')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32)
}
watch(() => form.name, (n) => { if (!slugTouched.value) form.slug = slugify(n) })
const slugError = computed(() => {
  if (!form.slug) return 'Нужен slug'
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(form.slug)) return 'Только латиница, цифры, «-» и «_»'
  if (props.servers.some((s) => s.slug === form.slug)) return 'Такой slug уже занят'
  return ''
})
const canNext = computed(() => {
  if (step.value === 1) return form.name.trim() && !slugError.value
  if (step.value === 2) return !!form.mc_version
  return !!form.host
})

watch(kind, (k) => {
  form.is_external = k === 'external'
  if (k === 'external' && !form.server_core) form.server_core = 'paper'
})
watch(() => form.server_core, (c) => {
  // A partner on a plugin core usually plays with a vanilla client; client mods are a choice.
  if ((c === 'paper' || c === 'folia') && kind.value === 'external' && form.loader === 'neoforge') form.loader = 'vanilla'
})

const saving = ref(false)
const autofill = ref(null)
async function next() {
  if (!canNext.value) return
  if (step.value < 3) { step.value++; return }
  saving.value = true
  try {
    if (!form.is_external) {
      try {
        const s = await suggestServerPaths(token(), { slug: form.slug, neoforge_version: form.neoforge_version, mc_version: form.mc_version, loader: form.loader, java_version: form.java_version })
        const { runtime_source, runtime_needs_build, ...fields } = s
        for (const [k, v] of Object.entries(fields)) if (v !== '' && v != null && (form[k] === '' || form[k] == null)) form[k] = v
        autofill.value = { runtime_source, runtime_needs_build }
      } catch { /* paths stay empty — they can be set in «Сборка» later */ }
    }
    const created = await createServer(token(), buildPayload(form))
    toastSuccess(`«${created.name}» создан — он пока виден только админам`)
    emit('created', created)
  } catch (e) {
    toastError(e?.message || 'Не удалось создать сервер')
  } finally {
    saving.value = false
  }
}
const STEPS = ['Название', 'Что за сервер', 'Адрес']
</script>

<template>
  <div class="wz">
    <div class="wz-head">
      <button type="button" class="adm-btn adm-btn--sm adm-btn--ghost" @click="emit('close')">← Все серверы</button>
      <h1 class="adm-title">Новый сервер</h1>
    </div>

    <ol class="wz-steps">
      <li v-for="(t, i) in STEPS" :key="t" :class="{ 'wz-steps__on': step === i + 1, 'wz-steps__done': step > i + 1 }">
        <span class="wz-steps__n">{{ step > i + 1 ? '✓' : i + 1 }}</span>{{ t }}
      </li>
    </ol>

    <section class="wz-card">
      <template v-if="step === 1">
        <h2>Как назовём?</h2>
        <label class="adm-field"><span>Название</span><input v-model="form.name" class="adm-input" placeholder="VoidRP: Origins" autofocus /></label>
        <label class="adm-field"><span>Slug — короткое имя для ссылок</span>
          <input v-model.trim="form.slug" class="adm-input wz-mono" placeholder="origins" @input="slugTouched = true" />
          <small :class="slugError ? 'wz-err' : 'wz-note'">{{ slugError || `Ссылки: void-rp.ru/status/${form.slug}. Потом не меняется.` }}</small>
        </label>
        <label class="adm-field"><span>Описание (можно позже)</span><textarea v-model="form.description" class="adm-textarea" rows="2" placeholder="Выживание с магией и техникой" /></label>
      </template>

      <template v-else-if="step === 2">
        <h2>Что за сервер?</h2>
        <div class="wz-kinds">
          <button type="button" class="wz-kind" :class="{ 'wz-kind--on': kind === 'ours' }" @click="kind = 'ours'">
            <b>Наш</b><span>Крутится на этой машине: папки, служба и сборка создадутся сами</span>
          </button>
          <button type="button" class="wz-kind" :class="{ 'wz-kind--on': kind === 'external' }" @click="kind = 'external'">
            <b>Сервер партнёра</b><span>На чужой машине: подключается плагинами VoidRP, откроется «Интеграция»</span>
          </button>
        </div>
        <div class="wz-grid">
          <label class="adm-field"><span>Ядро сервера</span>
            <select v-model="form.server_core" class="adm-select">
              <option value="">не указано</option>
              <option v-for="(l, k) in CORE_LABELS" :key="k" :value="k">{{ l }}</option>
            </select>
          </label>
          <label class="adm-field"><span>Версия Minecraft</span><input v-model.trim="form.mc_version" class="adm-input" placeholder="1.21.1" /></label>
          <div class="adm-field wz-wide"><span>Клиент в лаунчере</span><SrvSeg v-model="form.loader" :options="[['neoforge', 'NeoForge'], ['fabric', 'Fabric'], ['vanilla', 'Ванилла']]" label="Клиент в лаунчере" /></div>
          <label v-if="form.loader === 'neoforge'" class="adm-field"><span>Версия NeoForge</span><input v-model.trim="form.neoforge_version" class="adm-input" placeholder="21.1.172" /></label>
          <label class="adm-field"><span>Java</span><input v-model.number="form.java_version" type="number" class="adm-input" /></label>
        </div>
      </template>

      <template v-else>
        <h2>Куда подключаться игрокам?</h2>
        <div class="wz-grid">
          <label class="adm-field wz-wide"><span>Хост</span><input v-model.trim="form.host" class="adm-input" placeholder="play.example.ru" /></label>
          <label class="adm-field"><span>Порт</span><input v-model.number="form.port" type="number" class="adm-input" /></label>
          <label class="adm-field"><span>Макс. игроков</span><input v-model.number="form.max_players" type="number" class="adm-input" /></label>
        </div>
        <ul class="wz-after">
          <li>Сервер появится <b>только для админов</b> — откроете игрокам, когда будет готов.</li>
          <li v-if="!form.is_external">Пути сборки, папки и RCON заполню по slug, папки создадутся на диске.</li>
          <li v-else>Дальше — вкладка «Интеграция»: одна команда ставит плагины на сервер партнёра.</li>
        </ul>
      </template>

      <div class="wz-foot">
        <button v-if="step > 1" type="button" class="adm-btn" :disabled="saving" @click="step--">Назад</button>
        <span v-else />
        <button type="button" class="adm-btn adm-btn--acc" :disabled="!canNext || saving" @click="next">
          {{ step < 3 ? 'Дальше' : saving ? 'Создаю…' : 'Создать сервер' }}
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.wz { display: flex; flex-direction: column; gap: 1rem; max-width: 640px; }
.wz-head { display: flex; flex-direction: column; align-items: flex-start; gap: 0.4rem; }
.wz-steps { list-style: none; margin: 0; padding: 0; display: flex; gap: 0.4rem; flex-wrap: wrap; }
.wz-steps li { display: flex; align-items: center; gap: 0.45rem; font-size: 0.82rem; font-weight: 600; color: var(--adm-dim); padding: 0.35rem 0.7rem 0.35rem 0.35rem; border-radius: 999px; border: 1px solid var(--adm-line); }
.wz-steps__n { width: 1.4rem; height: 1.4rem; border-radius: 50%; display: grid; place-items: center; font-size: 0.72rem; font-weight: 800; background: var(--adm-card-2); }
.wz-steps .wz-steps__on { color: var(--adm-text); border-color: var(--adm-acc-line); background: var(--adm-acc-soft); }
.wz-steps__on .wz-steps__n { background: var(--adm-acc); color: #fff; }
.wz-steps__done { color: var(--adm-mut); }
.wz-steps__done .wz-steps__n { background: color-mix(in srgb, var(--adm-ok) 25%, transparent); color: var(--adm-ok); }
.wz-card { padding: 1.2rem; border-radius: var(--adm-r); background: var(--adm-card); border: 1px solid var(--adm-line); display: flex; flex-direction: column; gap: 1rem; }
.wz-card h2 { margin: 0; font-size: 1.05rem; font-weight: 800; color: var(--adm-text); }
.wz-mono { font-family: var(--adm-mono); }
.wz-note { font-size: 0.75rem; color: var(--adm-dim); }
.wz-err { font-size: 0.75rem; color: var(--adm-err); }
.wz-kinds { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 0.6rem; }
.wz-kind { text-align: left; display: flex; flex-direction: column; gap: 0.25rem; padding: 0.8rem 0.9rem; border-radius: var(--adm-r-sm); border: 1px solid var(--adm-line-strong); background: var(--adm-card-2); color: var(--adm-text); font: inherit; cursor: pointer; }
.wz-kind span { font-size: 0.76rem; color: var(--adm-dim); line-height: 1.4; }
.wz-kind--on { border-color: var(--adm-acc); background: var(--adm-acc-soft); box-shadow: inset 0 0 0 1px var(--adm-acc-line); }
.wz-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 180px), 1fr)); gap: 0.85rem; }
.wz-wide { grid-column: 1 / -1; }
.wz-after { margin: 0; padding-left: 1.1rem; color: var(--adm-mut); font-size: 0.82rem; display: flex; flex-direction: column; gap: 0.3rem; }
.wz-after b { color: var(--adm-text); }
.wz-foot { display: flex; justify-content: space-between; gap: 0.5rem; padding-top: 0.4rem; border-top: 1px solid var(--adm-line); }
</style>
