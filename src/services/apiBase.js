import { toastError } from './toast'

const DEFAULT_REMOTE_API_BASE_URL = 'https://api.void-rp.ru/api/v1'

let unauthorizedHandler = null

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = typeof handler === 'function' ? handler : null
}

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/$/, '')
}

function resolveApiBaseUrl() {
  const envBaseUrl = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL)
  if (envBaseUrl) {
    return envBaseUrl
  }

  if (import.meta.env.DEV) {
    return '/api/v1'
  }

  return DEFAULT_REMOTE_API_BASE_URL
}

const API_BASE_URL = resolveApiBaseUrl()

const FIELD_LABELS = {
  site_login: 'логин',
  minecraft_nickname: 'игровой ник',
  email: 'почта',
  password: 'пароль',
  password_repeat: 'повтор пароля',
  login: 'логин или почта',
  device_name: 'устройство',
  token: 'токен',
  refresh_token: 'сессионный ключ',
  new_password: 'новый пароль',
  new_password_repeat: 'повтор нового пароля',
  referral_code: 'код приглашения',
  slug: 'адрес страницы',
  title: 'название',
  tag: 'тег',
  short_description: 'краткое описание',
  description: 'описание',
  display_name: 'отображаемое имя',
  bio: 'описание',
  status_text: 'статус',
  theme_mode: 'тема',
  accent_color: 'цвет',
  recruitment_policy: 'тип вступления',
  is_public: 'публичная страница',
  allow_followers_list_public: 'видимость подписчиков',
  allow_friends_list_public: 'видимость друзей',
  allow_profile_comments: 'комментарии профиля',
  alliance_slug: 'альянс',
  alliance_type: 'тип альянса',
  proposal_type: 'тип предложения',
  payload_json: 'дополнительные параметры',
  policy_flags_json: 'дополнительные настройки',
  transfer_fee_percent: 'комиссия перевода',
  allow_internal_transfers: 'внутренние переводы',
  allow_joint_defense: 'совместная защита',
  allow_trade_bonus: 'торговый бонус',
  allow_pvp_protection: 'защита PvP',
  from_nation_slug: 'государство-отправитель',
  to_nation_slug: 'государство-получатель',
  amount: 'сумма',
  comment: 'комментарий',
  role: 'роль',
  target_user_id: 'участник',
  vote: 'голос',
}

function humanizeFieldName(name) {
  const key = String(name || '').trim()
  if (!key) return 'поле'
  return FIELD_LABELS[key] || key.replaceAll('_', ' ')
}

function buildUrl(path) {
  const normalizedPath = String(path || '')
  return `${API_BASE_URL}${normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`}`
}

async function readResponseBody(response) {
  const contentType = response.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    try {
      return await response.json()
    } catch {
      return null
    }
  }

  try {
    const text = await response.text()
    return text || null
  } catch {
    return null
  }
}

function buildRequestOptions(options = {}) {
  const headers = { ...(options.headers || {}) }
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData

  if (!isFormData && options.body != null) {
    const hasContentType = Object.keys(headers).some((key) => key.toLowerCase() === 'content-type')
    if (!hasContentType) {
      headers['Content-Type'] = 'application/json'
    }
  }

  return {
    ...options,
    headers,
  }
}

function formatValidationErrorItem(item) {
  if (!item || typeof item !== 'object') {
    return null
  }

  const loc = Array.isArray(item.loc) ? item.loc : []
  const field = [...loc].reverse().find((entry) => typeof entry === 'string' && !['body', 'query', 'path', 'header'].includes(entry))
  const label = humanizeFieldName(field)
  const msg = String(item.msg || '').trim()

  if (!msg) {
    return `Проверь поле «${label}».`
  }

  const lowered = msg.toLowerCase()
  const ctx = item.ctx || {}

  if (lowered === 'field required') {
    return `Заполни поле «${label}».`
  }

  if (lowered.includes('should have at least')) {
    const minimum = ctx.min_length ?? ctx.ge
    return minimum != null
      ? `Поле «${label}» должно содержать минимум ${minimum} символов.`
      : `Поле «${label}» заполнено слишком коротко.`
  }

  if (lowered.includes('should have at most')) {
    const maximum = ctx.max_length ?? ctx.le
    return maximum != null
      ? `Поле «${label}» должно содержать не больше ${maximum} символов.`
      : `Поле «${label}» заполнено слишком длинно.`
  }

  if (lowered.includes('valid email address')) {
    return 'Укажи корректную почту.'
  }

  if (lowered.includes('input should be greater than') || lowered.includes('greater than 0')) {
    return `Поле «${label}» должно быть больше нуля.`
  }

  if (lowered.includes('greater than or equal to')) {
    const minimum = ctx.ge
    return minimum != null
      ? `Поле «${label}» должно быть не меньше ${minimum}.`
      : `Поле «${label}» заполнено слишком маленьким значением.`
  }

  if (lowered.includes('less than or equal to')) {
    const maximum = ctx.le
    return maximum != null
      ? `Поле «${label}» должно быть не больше ${maximum}.`
      : `Поле «${label}» заполнено слишком большим значением.`
  }

  if (lowered.includes('input should be a valid string')) {
    return `Поле «${label}» заполнено некорректно.`
  }

  return `Проверь поле «${label}»: ${msg}`
}

function formatValidationErrors(errors) {
  if (!Array.isArray(errors) || errors.length === 0) {
    return ''
  }

  const messages = []
  for (const item of errors) {
    const text = formatValidationErrorItem(item)
    if (text && !messages.includes(text)) {
      messages.push(text)
    }
  }

  if (messages.length === 0) {
    return ''
  }

  if (messages.length === 1) {
    return messages[0]
  }

  const preview = messages.slice(0, 3).join('; ')
  return messages.length > 3 ? `${preview}. Ещё ошибок: ${messages.length - 3}.` : preview
}

function extractMessage(body) {
  if (typeof body === 'string' && body.trim()) {
    return body.trim()
  }

  if (body && typeof body === 'object') {
    if (typeof body.detail === 'string' && body.detail.trim()) {
      return body.detail.trim()
    }

    const validationMessage = formatValidationErrors(body.errors || body.detail)
    if (validationMessage) {
      return validationMessage
    }

    if (typeof body.message === 'string' && body.message.trim()) {
      return body.message.trim()
    }
  }

  return ''
}

function isAuthRoute(path) {
  const normalized = String(path || '')
  return normalized.startsWith('/auth/login')
    || normalized.startsWith('/auth/register')
    || normalized.startsWith('/auth/refresh')
    || normalized.startsWith('/auth/logout')
}

function looksLikeExpiredSession(message, response) {
  const lowered = String(message || '').toLowerCase()
  return response.status === 401 && (
    lowered.includes('access token')
    || lowered.includes('invalid token')
    || lowered.includes('expired token')
    || lowered.includes('invalid or expired')
    || lowered.includes('сессия')
    || lowered.includes('нужна авторизация')
    || lowered.includes('user is not available')
  )
}

function buildErrorMessage(response, body) {
  const extracted = extractMessage(body)
  if (extracted) {
    if (looksLikeExpiredSession(extracted, response)) {
      return 'Сессия истекла. Войди снова.'
    }
    return extracted
  }

  if (response.status === 400) {
    return 'Запрос заполнен некорректно. Проверь данные и попробуй снова.'
  }

  if (response.status === 401) {
    return 'Сессия истекла. Войди снова.'
  }

  if (response.status === 403) {
    return 'У тебя нет прав для этого действия.'
  }

  if (response.status === 404) {
    return 'Нужный раздел или объект не найден.'
  }

  if (response.status === 409) {
    return 'Такое действие сейчас выполнить нельзя из-за конфликта данных.'
  }

  if (response.status === 422) {
    return 'Проверь заполненные поля и попробуй снова.'
  }

  if (response.status >= 500) {
    return 'На сервере произошла ошибка. Попробуй ещё раз чуть позже.'
  }

  return `Ошибка ${response.status}`
}

export async function apiRequest(path, options = {}) {
  let response

  try {
    response = await fetch(buildUrl(path), buildRequestOptions(options))
  } catch {
    const error = new Error('Не удалось связаться с сервером. Проверь подключение и попробуй снова.')
    if (options.toast !== false) {
      toastError(error.message, 'Ошибка сети')
    }
    throw error
  }

  const body = response.status === 204 ? null : await readResponseBody(response)

  if (!response.ok) {
    if (
      response.status === 401
      && !options._retried
      && !isAuthRoute(path)
      && options.handleAuth !== false
      && unauthorizedHandler
    ) {
      try {
        const handled = await unauthorizedHandler({ path, response, body, options })
        if (handled === true || handled?.retry === true) {
          return await apiRequest(path, { ...options, _retried: true })
        }
      } catch {
        // continue to normal error below
      }
    }

    const error = new Error(buildErrorMessage(response, body))
    error.status = response.status
    error.body = body
    if (options.toast !== false) {
      toastError(error.message)
    }
    throw error
  }

  return body
}

export function buildAuthHeaders(token, extraHeaders = {}) {
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extraHeaders,
  }
}

export { API_BASE_URL }
