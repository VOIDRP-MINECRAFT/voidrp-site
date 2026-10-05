<script setup>
// «Почему?» и «Починить»: причины по порядку важности, шаги, и где можно — кнопка, которую
// VoidRpPerms 0.7+ выполняет на сервере (дописать настройки в конфиги, проверить обновления,
// перечитать VoidRpAuth) или повторная проверка снаружи.
import { ref } from 'vue'
import { toastError, toastSuccess } from '../../../services/toast'
import { runFix } from '../../../services/integrationApi'

const props = defineProps({
  diagnosis: { type: Object, required: true },
  canConfig: { type: Boolean, default: false },
  external: { type: Boolean, default: false },
})
const emit = defineEmits(['reload'])
const busy = ref('')
const output = ref('')

function fixesFor(f) {
  const t = `${f.title} ${f.cause}`
  const out = []
  if (/нет настроек из новой версии|конфиг/i.test(t)) out.push({ action: 'config', label: 'Починить конфиги' })
  if (/обновлени|устарел|не поддерживается/i.test(t)) out.push({ action: 'updates', label: 'Проверить обновления' })
  if (/секрет|перечитать/i.test(t)) out.push({ action: 'reload', label: 'Перечитать конфиги' })
  if (/снаружи|недоступен|игроки не могут/i.test(t) && props.external) out.push({ action: 'reach', label: 'Проверить снаружи снова' })
  return out
}
async function fix(action) {
  busy.value = action
  output.value = ''
  try {
    const res = await runFix(action)
    output.value = res.output || (res.reach ? (res.reach.ok ? `Снаружи доступен: ${res.reach.address}, ${res.reach.latency_ms} мс, ${res.reach.version}` : `Снаружи недоступен: ${res.reach.error}`) : 'Готово')
    toastSuccess('Сделано')
    emit('reload')
  } catch (e) { toastError(e?.message || 'Не получилось') } finally { busy.value = '' }
}
</script>

<template>
  <div class="dg">
    <div class="dg-head">{{ diagnosis.headline }}</div>
    <div v-for="(f, i) in diagnosis.findings" :key="i" class="dg-item" :class="`dg-item--${f.severity}`">
      <div class="dg-title">{{ f.title }}</div>
      <div class="dg-cause">{{ f.cause }}</div>
      <ol v-if="f.steps?.length" class="dg-steps"><li v-for="(s, j) in f.steps" :key="j">{{ s }}</li></ol>
      <div v-if="canConfig && fixesFor(f).length" class="dg-fixes">
        <button v-for="x in fixesFor(f)" :key="x.action" class="adm-btn adm-btn--sm adm-btn--acc" :disabled="!!busy" @click="fix(x.action)">{{ busy === x.action ? 'Выполняю…' : x.label }}</button>
      </div>
    </div>
    <pre v-if="output" class="dg-out">{{ output }}</pre>
  </div>
</template>

<style scoped>
.dg { display: flex; flex-direction: column; gap: 0.55rem; }
.dg-head { font-weight: 700; color: var(--adm-text); font-size: 0.92rem; }
.dg-item { padding: 0.65rem 0.8rem; border-radius: var(--adm-r-sm); background: var(--adm-card-2); border: 1px solid var(--adm-line); border-left-width: 3px; }
.dg-item--err { border-left-color: var(--adm-err); }
.dg-item--warn { border-left-color: var(--adm-warn); }
.dg-item--info { border-left-color: var(--adm-info); }
.dg-title { font-weight: 700; font-size: 0.86rem; color: var(--adm-text); }
.dg-cause { font-size: 0.82rem; color: var(--adm-dim); margin-top: 0.15rem; line-height: 1.45; }
.dg-steps { margin: 0.4rem 0 0; padding-left: 1.2rem; font-size: 0.82rem; color: var(--adm-text); line-height: 1.5; }
.dg-fixes { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-top: 0.5rem; }
.dg-out { margin: 0; padding: 0.6rem; font-family: var(--adm-mono); font-size: 0.74rem; background: var(--adm-card-2); border: 1px solid var(--adm-line); border-radius: var(--adm-r-sm); color: var(--adm-text); white-space: pre-wrap; }
</style>
