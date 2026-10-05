// Общее для вкладок «Интеграции»: форматирование, модули сервера, копирование.
import { toastError, toastSuccess } from '../../../services/toast'

export function ago(iso, now = Date.now()) {
  if (!iso) return ''
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  if (s < 60) return `${s} с назад`
  if (s < 3600) return `${Math.floor(s / 60)} мин назад`
  if (s < 86400) return `${Math.floor(s / 3600)} ч назад`
  return `${Math.floor(s / 86400)} дн назад`
}
export const fmtSize = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} МБ` : `${Math.max(1, Math.round(b / 1024))} КБ`)
export const fmtDate = (v) => (v ? new Date(v).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '')
export const fmtDateTime = (v) => (v ? new Date(v).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '')

export const MODULE_NAMES = {
  auth: 'вход', monitoring: 'мониторинг', perms: 'права', chat: 'чат', anticheat: 'античит', grim: 'GrimAC',
  console: 'консоль', log: 'лог и чат', item_bans: 'бан предметов', punishments: 'наказания', updates: 'автообновление',
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toastSuccess('Скопировано') } catch { toastError('Не удалось скопировать — выделите и скопируйте вручную') }
}

/** Модуль, который работает по свежему отчёту, и модуль, который плагин прислал выключенным. */
function moduleOn(data, key) {
  for (const r of data?.reports || []) if (r.fresh && r.modules?.[key]?.ok) return r
  return null
}
function moduleOff(data, key) {
  for (const r of data?.reports || []) {
    const m = r.modules?.[key]
    if (r.fresh && m && !m.ok) return { plugin: r.plugin, detail: m.detail }
  }
  return null
}

/** Плитки модулей: что работает на сервере и почему не работает остальное. */
export function moduleTiles(data) {
  if (!data) return []
  const server = data.server || {}
  const req = Object.fromEntries((data.required || []).map((r) => [r.key, r]))
  const by = (r) => (r ? `${r.plugin} ${r.version || ''}`.trim() : '')
  const tile = (key, title, opts) => ({ key, title, ...opts })
  const on = (k) => moduleOn(data, k)
  const off = (k) => moduleOff(data, k)
  const authHint = server.auth_method === 'mod'
    ? 'Нужен мод voidrp-auth-bridge на сервере (его же получат игроки в паке).'
    : 'Нужен VoidRpAuth — без него на сервере в offline-mode можно зайти под чужим ником.'
  return [
    tile('auth', 'Вход через аккаунт VoidRP', { required: true, state: req.auth?.ok ? 'ok' : 'err',
      text: req.auth?.ok ? `Работает · ${req.auth.plugin} ${req.auth.version || ''}` : authHint }),
    tile('monitoring', 'Мониторинг', { required: true, state: req.monitoring?.ok ? 'ok' : 'err',
      text: req.monitoring?.ok ? `Работает · ${req.monitoring.plugin} ${req.monitoring.version || ''}` : 'Нужен VoidRpPerms 0.4.0+ — он присылает TPS, игроков и память.' }),
    tile('perms', 'Права в игре', { state: on('perms') ? 'ok' : 'idle',
      text: on('perms') ? `Работает · ${by(on('perms'))}. Группы — в «Права в игре».` : 'VoidRpPerms и LuckPerms: права настраиваются в админке.' }),
    tile('chat', 'Чат с префиксами', { state: on('chat') ? 'ok' : off('chat') ? 'warn' : 'idle',
      text: on('chat') ? `Работает · ${by(on('chat'))}` : off('chat') ? `Выключен: ${off('chat').detail || 'без пояснения'}` : 'VoidRpPerms, если нет другого чат-плагина.' }),
    tile('console', 'Консоль, лог и чат без RCON', { state: on('console') && on('log') ? 'ok' : off('console') || off('log') ? 'warn' : 'idle',
      text: on('console') && on('log') ? `Работает · ${by(on('console'))}. RCON можно выключить.` : (off('console') || off('log')) ? `Выключено: ${(off('console') || off('log')).detail || 'без пояснения'}` : 'VoidRpPerms 0.5.0+: команды, лог и чат сервера в «Мониторинге».' }),
    tile('punishments', 'Баны и муты', { state: on('punishments') ? 'ok' : off('punishments') ? 'warn' : 'idle',
      text: on('punishments') ? `Работает · ${by(on('punishments'))}. EssentialsX не нужен.` : off('punishments') ? `Выключено: ${off('punishments').detail || 'без пояснения'}` : 'VoidRpPerms 0.5.0+ держит наказания из админки сам.' }),
    tile('item_bans', 'Бан предметов', { state: on('item_bans') ? 'ok' : off('item_bans') ? 'warn' : 'idle',
      text: on('item_bans') ? `Работает · ${by(on('item_bans'))}${server.item_bans_enabled ? '' : '. Раздел включает владелец в «Серверах».'}` : off('item_bans') ? `Выключено: ${off('item_bans').detail || 'без пояснения'}` : 'VoidRpPerms 0.5.0+ убирает у игроков запрещённые предметы.' }),
    tile('anticheat', 'Античит', { state: on('anticheat') ? (on('grim') ? 'ok' : 'warn') : 'idle',
      text: on('anticheat') ? `Работает · ${by(on('anticheat'))}${on('grim') ? ' · GrimAC подключён' : ` · GrimAC: ${off('grim')?.detail || 'не подключён'}`}` : 'По желанию: VoidRpGuard с GrimAC и CoreProtect.' }),
  ]
}
