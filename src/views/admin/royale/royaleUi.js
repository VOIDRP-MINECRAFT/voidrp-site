// Shared bits of the «Королевская битва» admin tabs: team colours, number formats, event lines.

export const TEAM_COLORS = {
  red: '#f87171', blue: '#60a5fa', green: '#4ade80', yellow: '#facc15',
  orange: '#fb923c', purple: '#a855f7', aqua: '#67e8f9', pink: '#f472b6',
}
export const TEAM_TITLES = {
  red: 'Красные', blue: 'Синие', green: 'Зелёные', yellow: 'Жёлтые',
  orange: 'Оранжевые', purple: 'Фиолетовые', aqua: 'Голубые', pink: 'Розовые',
}
export const TEAM_KEYS = Object.keys(TEAM_COLORS)

export const STATUS = { winner: 'Победитель', eliminated: 'Выбыл', left: 'Вышел', playing: 'В игре' }

export const when = (iso) => (iso
  ? new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' })
  : '—')
export const timeOnly = (iso) => (iso
  ? new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' })
  : '—')
export const clock = (s) => {
  const v = Math.max(0, Math.round(s || 0))
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`
}
/** Damage is kept in half-hearts by the server: shown in hearts. */
export const hearts = (d) => (Math.round(((d || 0) / 2) * 10) / 10).toLocaleString('ru-RU')
/** Seconds → «9 мин» / «1 мин 30 с» / «45 с». */
export function mmss(sec) {
  const s = Math.max(0, Math.round(sec || 0))
  const m = Math.floor(s / 60)
  const r = s % 60
  if (!m) return `${r} с`
  return r ? `${m} мин ${r} с` : `${m} мин`
}

export const moscowDate = (iso) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' })
export const plural = (n, one, few, many) => {
  const a = Math.abs(n) % 100
  const b = a % 10
  if (a > 10 && a < 20) return many
  if (b > 1 && b < 5) return few
  if (b === 1) return one
  return many
}

/** One line of the game's feed: icon, parts (text + team colour) and a note. */
export function feedLine(e, teamTitle = (k) => TEAM_TITLES[k] || k) {
  const c = (k) => TEAM_COLORS[k]
  switch (e.type) {
    case 'kill':
      return e.killer
        ? { icon: '☠', parts: [{ text: e.killer, color: c(e.killer_team) }, { text: ' → ' }, { text: e.victim, color: c(e.victim_team) }], note: e.with }
        : { icon: '☠', parts: [{ text: e.victim, color: c(e.victim_team) }, { text: ' выбыл' }], note: e.with }
    case 'team_out':
      return { icon: '⚑', parts: [{ text: teamTitle(e.team), color: c(e.team) }, { text: ` выбыли · ${e.placement}-е место` }] }
    case 'airdrop':
      return { icon: '📦', parts: [{ text: 'Сброс припасов' }], tone: 'gold' }
    case 'airdrop_open':
      return { icon: '📦', parts: [{ text: 'Припасы открыл ' }, { text: e.player, color: c(e.team) }], tone: 'gold' }
    case 'phase':
      return { icon: '◎', parts: [{ text: `Фаза ${e.phase}: зона сужается` }], tone: 'red' }
    case 'start':
      return { icon: '▶', parts: [{ text: 'Игра началась' }] }
    case 'end':
      return { icon: '★', parts: [{ text: 'Игра окончена' }], tone: 'gold' }
    default:
      return { icon: '·', parts: [{ text: e.type }] }
  }
}
