<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({ codes: { type: Array, required: true } })
const emit = defineEmits(['done'])
const { t } = useI18n()
const copied = ref(false)

async function copyAll() {
  try { await navigator.clipboard.writeText(props.codes.join('\n')); copied.value = true; setTimeout(() => (copied.value = false), 1500) } catch { /* ignore */ }
}
function download() {
  const text = `VoidRP — запасные коды 2FA / backup codes\n${new Date().toLocaleString()}\n\n${props.codes.join('\n')}\n`
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'voidrp-backup-codes.txt'
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="bc">
    <b class="bc__title">{{ t('security.mfa.backupTitle') }}</b>
    <p class="bc__hint">{{ t('security.mfa.backupHint') }}</p>
    <ol class="bc__grid">
      <li v-for="c in codes" :key="c"><code>{{ c }}</code></li>
    </ol>
    <div class="bc__actions">
      <button type="button" class="bc__btn bc__btn--ghost" @click="copyAll">{{ copied ? t('security.mfa.copied') : t('security.mfa.copy') }}</button>
      <button type="button" class="bc__btn bc__btn--ghost" @click="download">{{ t('security.mfa.backupDownload') }}</button>
      <button type="button" class="bc__btn" @click="emit('done')">{{ t('security.mfa.backupDone') }}</button>
    </div>
  </div>
</template>

<style scoped>
.bc { display: flex; flex-direction: column; gap: 0.6rem; }
.bc__title { font-size: 0.95rem; color: #e8ecf4; }
.bc__hint { margin: 0; font-size: 0.78rem; color: #7d879c; line-height: 1.45; }
.bc__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr)); gap: 0.35rem; margin: 0; padding: 0.7rem; list-style: none; border-radius: 10px; background: rgba(0, 0, 0, 0.3); border: 1px dashed rgba(148, 163, 184, 0.25); counter-reset: bc; }
.bc__grid li { counter-increment: bc; display: flex; gap: 0.4rem; align-items: baseline; }
.bc__grid li::before { content: counter(bc) '.'; font-size: 0.66rem; color: #55617a; width: 1.1rem; text-align: right; }
.bc__grid code { font-family: ui-monospace, 'JetBrains Mono', Menlo, monospace; font-size: 0.9rem; letter-spacing: 0.05em; color: #e8ecf4; }
.bc__actions { display: flex; gap: 0.45rem; flex-wrap: wrap; }
.bc__btn { padding: 0.55rem 0.95rem; border-radius: 9px; border: none; background: var(--adm-acc, #7c3aed); color: #fff; font-weight: 700; cursor: pointer; }
.bc__btn--ghost { background: transparent; color: #cbd2e0; border: 1px solid rgba(148, 163, 184, 0.25); }
</style>
