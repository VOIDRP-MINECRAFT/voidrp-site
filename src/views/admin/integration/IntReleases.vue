<script setup>
// «Релизы» (админы платформы): сборки наших плагинов с GitHub — рекомендовать, пометить важным,
// отозвать, забрать с GitHub сейчас.
import { onMounted, ref } from 'vue'
import { toastError, toastSuccess } from '../../../services/toast'
import { listReleases, patchRelease, saveSupportPolicy, syncReleases } from '../../../services/integrationApi'
import { confirmDialog } from '../../../composables/useConfirm'
import { copyText, fmtDate } from './util'

const emit = defineEmits(['reload'])
const rel = ref(null)
const busy = ref('')

async function load() {
  try { rel.value = await listReleases() } catch (e) { toastError(e?.message || 'Не удалось загрузить релизы') }
}
async function change(plugin, r, patch, ask) {
  if (ask && !(await confirmDialog(ask))) return
  busy.value = r.id
  try {
    await patchRelease(r.id, patch)
    await load()
    emit('reload')
  } catch (e) { toastError(e?.message || 'Не удалось изменить релиз') } finally { busy.value = '' }
}
const yankAsk = (plugin, r) => ({
  title: 'Отозвать сборку',
  message: `${plugin.name} ${r.version} пропадёт у всех серверов: её не предложат, не скачают автообновлением и не объявят. Вернуть можно здесь же.`,
  confirmLabel: 'Отозвать', danger: true,
})
async function syncNow() {
  busy.value = 'sync'
  try {
    const res = await syncReleases()
    toastSuccess(res.added?.length ? `Новые сборки: ${res.added.map((a) => `${a.plugin} ${a.version}`).join(', ')}` : 'Новых релизов на GitHub нет')
    await load()
    emit('reload')
  } catch (e) { toastError(e?.message || 'GitHub не ответил') } finally { busy.value = '' }
}
// Минимальная поддерживаемая версия: ниже неё серверу говорят «обязательно обновите».
const minDraft = ref({})
function minOf(p) { return minDraft.value[p.key] ?? { min: p.min_supported || '', note: p.support_note || '' } }
function setMin(p, field, value) { minDraft.value = { ...minDraft.value, [p.key]: { ...minOf(p), [field]: value } } }
async function saveMin(p) {
  const d = minOf(p)
  busy.value = `min:${p.key}`
  try {
    const res = await saveSupportPolicy(p.key, { min_version: d.min || null, note: d.note || null })
    toastSuccess(res.min_version ? `Минимальная версия ${p.name}: ${res.min_version}${res.notified ? ` — сообщили серверам: ${res.notified}` : ''}` : 'Минимальная версия снята')
    const copy = { ...minDraft.value }; delete copy[p.key]; minDraft.value = copy
    await load()
    emit('reload')
  } catch (e) { toastError(e?.message || 'Не удалось сохранить') } finally { busy.value = '' }
}
const cmd = 'scripts/release_plugin.sh <папка репозитория> -m "что изменилось"'
onMounted(load)
</script>

<template>
  <div class="rl">
    <section class="adm-card rl-how">
      <div class="adm-card__head">
        <div class="adm-card__title">Как выпустить сборку</div>
        <button class="adm-btn adm-btn--sm" :disabled="busy === 'sync'" @click="syncNow">{{ busy === 'sync' ? 'Проверяю…' : 'Проверить GitHub сейчас' }}</button>
      </div>
      <div class="rl-pad">
        <div class="rl-cmd"><code>{{ cmd }}</code><button class="adm-btn adm-btn--sm" @click="copyText(cmd)">Копировать</button></div>
        <p class="rl-muted">Скрипт ставит тег с версией из сборки, ждёт CI (он публикует GitHub Release с этим текстом) и сразу забирает сборку сюда. <code>--important</code> — важное обновление, <code>--no-sync</code> — несколько плагинов придут серверам одним сообщением. Дефис в версии (1.5.0-beta.1) — бета. Без скрипта cron забирает релизы раз в 10 минут.</p>
      </div>
    </section>

    <div v-if="!rel" class="adm-card adm-card--pad"><div class="adm-skel" style="height: 180px" /></div>
    <template v-else>
    <section v-for="p in rel.plugins" :key="p.key" class="adm-card rl-plugin">
      <div class="adm-card__head">
        <div class="adm-card__title">{{ p.name }}</div>
        <a v-if="p.repo_url" class="rl-gh" :href="p.repo_url" target="_blank" rel="noopener">{{ p.repo }}</a>
      </div>
      <div class="rl-min">
        <span class="rl-min__label">Минимальная версия</span>
        <input class="adm-input rl-min__ver" :value="minOf(p).min" placeholder="не задана" @input="setMin(p, 'min', $event.target.value)" />
        <input class="adm-input rl-min__note" :value="minOf(p).note" placeholder="Почему (увидят владельцы серверов)" @input="setMin(p, 'note', $event.target.value)" />
        <button class="adm-btn adm-btn--sm" :disabled="busy === `min:${p.key}`" @click="saveMin(p)">Сохранить</button>
      </div>
      <div v-if="!p.releases.length" class="rl-pad rl-muted">Сборок пока нет.</div>
      <div v-else class="rl-rows">
        <div v-for="r in p.releases" :key="r.id" class="rl-row" :class="{ 'rl-row--yanked': r.yanked }">
          <div class="rl-row__main">
            <b class="rl-ver">{{ r.version }}</b>
            <span v-if="r.recommended" class="adm-badge adm-badge--ok">рекомендуем</span>
            <span v-if="r.channel === 'beta'" class="adm-badge adm-badge--warn">бета</span>
            <span v-if="r.important" class="adm-badge adm-badge--err">важное</span>
            <span v-if="r.yanked" class="adm-badge">отозвана</span>
            <span class="rl-muted">MC {{ r.mc_label || r.mc_versions.join(', ') }} · {{ r.platforms.join(', ') }} · {{ fmtDate(r.published_at) }} · {{ r.source === 'github' ? 'GitHub' : 'вручную' }}</span>
          </div>
          <div class="rl-acts">
            <button v-if="!r.recommended && !r.yanked" class="adm-btn adm-btn--sm" :disabled="busy === r.id" @click="change(p, r, { recommended: true })">Рекомендовать</button>
            <button class="adm-btn adm-btn--sm" :disabled="busy === r.id" @click="change(p, r, { important: !r.important })">{{ r.important ? 'Не важное' : 'Важное' }}</button>
            <button v-if="!r.yanked" class="adm-btn adm-btn--sm adm-btn--danger" :disabled="busy === r.id" @click="change(p, r, { yanked: true }, yankAsk(p, r))">Отозвать</button>
            <button v-else class="adm-btn adm-btn--sm" :disabled="busy === r.id" @click="change(p, r, { yanked: false })">Вернуть</button>
          </div>
        </div>
      </div>
    </section>
    </template>
  </div>
</template>

<style scoped>
.rl { display: flex; flex-direction: column; gap: 1rem; }
.rl-pad { padding: 0 1rem 1rem; display: flex; flex-direction: column; gap: 0.55rem; }
.rl-muted { color: var(--adm-dim); font-size: 0.8rem; line-height: 1.45; margin: 0; }
.rl code { font-family: var(--adm-mono); font-size: 0.8em; }
.rl-cmd { display: flex; gap: 0.5rem; align-items: center; }
.rl-cmd code { flex: 1; min-width: 0; overflow-x: auto; white-space: nowrap; padding: 0.5rem 0.65rem; border-radius: var(--adm-r-sm); background: var(--adm-card-2); border: 1px solid var(--adm-line); color: var(--adm-text); }
.rl-gh { font-size: 0.8rem; color: var(--adm-acc-text); text-decoration: none; }
.rl-min { display: flex; flex-wrap: wrap; gap: 0.45rem; align-items: center; padding: 0 1rem 0.6rem; }
.rl-min__label { font-size: 0.8rem; color: var(--adm-dim); }
.rl-min__ver { width: 8rem; }
.rl-min__note { flex: 1; min-width: 12rem; }
.rl-rows { padding: 0 1rem 0.6rem; }
.rl-row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; padding: 0.5rem 0; border-top: 1px solid var(--adm-line); }
.rl-row--yanked { opacity: 0.55; }
.rl-row__main { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; flex: 1; min-width: 0; font-size: 0.84rem; color: var(--adm-text); }
.rl-ver { font-family: var(--adm-mono); }
.rl-acts { display: flex; gap: 0.35rem; flex-wrap: wrap; }
</style>
