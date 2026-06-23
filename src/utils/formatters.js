export function formatNumber(value) {
  const numeric = Number(value ?? 0)
  if (!Number.isFinite(numeric)) return '0'
  return new Intl.NumberFormat('ru-RU').format(numeric)
}

export function formatCompactHoursFromMinutes(minutes) {
  const totalMinutes = Number(minutes ?? 0)
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) {
    return '0 ч'
  }

  const hours = Math.floor(totalMinutes / 60)
  return `${formatNumber(hours)} ч`
}

export function formatRoleLabel(role) {
  switch (String(role || '').toLowerCase()) {
    case 'leader':
      return 'Лидер'
    case 'officer':
      return 'Офицер'
    case 'member':
      return 'Участник'
    default:
      return '—'
  }
}

export function formatRecruitmentLabel(value) {
  switch (String(value || '').toLowerCase()) {
    case 'open':
      return 'Свободное вступление'
    case 'request':
      return 'По заявке'
    case 'invite_only':
      return 'Только по приглашению'
    default:
      return '—'
  }
}
