import { reactive } from 'vue'

const DEFAULT_DURATION = 4200
const DEFAULT_ERROR_DURATION = 6200

export const toastState = reactive({
  items: [],
})

function createId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function normalizeText(value) {
  return String(value || '').trim()
}

function hasSameToast(title, message, type) {
  return toastState.items.some(
    (item) => item.type === type && item.title === title && item.message === message,
  )
}

export function removeToast(id) {
  const index = toastState.items.findIndex((item) => item.id === id)
  if (index >= 0) {
    toastState.items.splice(index, 1)
  }
}

export function clearToasts() {
  toastState.items.splice(0, toastState.items.length)
}

export function pushToast({
  type = 'info',
  title = '',
  message = '',
  duration = DEFAULT_DURATION,
} = {}) {
  const safeTitle = normalizeText(title)
  const safeMessage = normalizeText(message)

  if (!safeMessage) {
    return null
  }

  if (hasSameToast(safeTitle, safeMessage, type)) {
    return null
  }

  const id = createId()
  const toast = { id, type, title: safeTitle, message: safeMessage }
  toastState.items.push(toast)

  if (duration > 0) {
    window.setTimeout(() => {
      removeToast(id)
    }, duration)
  }

  return id
}

export function toastSuccess(message, title = 'Готово') {
  return pushToast({ type: 'success', title, message, duration: DEFAULT_DURATION })
}

export function toastError(message, title = 'Не удалось выполнить действие') {
  return pushToast({ type: 'error', title, message, duration: DEFAULT_ERROR_DURATION })
}

export function toastInfo(message, title = 'Подсказка') {
  return pushToast({ type: 'info', title, message, duration: DEFAULT_DURATION })
}
