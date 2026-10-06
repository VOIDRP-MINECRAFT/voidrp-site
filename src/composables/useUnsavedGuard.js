// Не дать потерять правки: вопрос при уходе со страницы внутри админки и при закрытии вкладки.
import { onBeforeUnmount, onMounted } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { confirmDialog } from './useConfirm'

export function confirmDiscard() {
  return confirmDialog({
    title: 'Несохранённые изменения',
    message: 'Изменения не сохранены. Уйти без сохранения?',
    confirmLabel: 'Уйти без сохранения',
    danger: true,
  })
}

/** isDirty: () => boolean */
export function useUnsavedGuard(isDirty) {
  const onUnload = (e) => { if (isDirty()) { e.preventDefault(); e.returnValue = '' } }
  onMounted(() => window.addEventListener('beforeunload', onUnload))
  onBeforeUnmount(() => window.removeEventListener('beforeunload', onUnload))
  onBeforeRouteLeave(async () => (isDirty() ? (await confirmDiscard()) || false : true))
}
