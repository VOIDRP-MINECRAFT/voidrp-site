import { reactive } from 'vue'

// Module-level state for a single shared confirm dialog. `<ConfirmDialog>` is
// mounted once (in AdminLayout) and any admin view can await confirmDialog(...)
// instead of the native, off-brand window.confirm().
export const confirmState = reactive({
  open: false,
  title: 'Подтверждение',
  message: '',
  confirmLabel: 'Подтвердить',
  cancelLabel: 'Отмена',
  danger: false,
  _resolve: null,
})

/**
 * Show a styled confirm dialog. Resolves to true (confirmed) or false.
 * @param {{title?:string, message?:string, confirmLabel?:string, cancelLabel?:string, danger?:boolean}} opts
 * @returns {Promise<boolean>}
 */
export function confirmDialog(opts = {}) {
  confirmState.title = opts.title || 'Подтверждение'
  confirmState.message = opts.message || ''
  confirmState.confirmLabel = opts.confirmLabel || 'Подтвердить'
  confirmState.cancelLabel = opts.cancelLabel || 'Отмена'
  confirmState.danger = !!opts.danger
  confirmState.open = true
  return new Promise((resolve) => {
    confirmState._resolve = resolve
  })
}

export function resolveConfirm(result) {
  confirmState.open = false
  const r = confirmState._resolve
  confirmState._resolve = null
  if (r) r(result)
}
