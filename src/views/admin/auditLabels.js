// Журнал действий человеческим языком: категории, коды действий и записи вида
// «PATCH /api/v1/admin/servers/{server_id}», которые пишет общий перехватчик запросов.

export const CATEGORIES = {
  monitoring: ['Мониторинг', 'adm-badge--info'],
  punishment: ['Наказания', 'adm-badge--err'],
  punishments: ['Наказания', 'adm-badge--err'],
  anticheat: ['Античит', 'adm-badge--warn'],
  security: ['Безопасность', 'adm-badge--warn'],
  news: ['Новости', ''],
  market: ['Рынок', ''],
  moderators: ['Сотрудники', ''],
  roles: ['Роли', ''],
  servers: ['Серверы', 'adm-badge--acc'],
  server_ops: ['Сервер', 'adm-badge--info'],
  files: ['Файлы', ''],
  mods: ['Моды', ''],
  plugins: ['Плагины', ''],
  game_perms: ['Права в игре', ''],
  backups: ['Бэкапы', ''],
  integration: ['Интеграция', 'adm-badge--acc'],
  trader: ['Скупщик', ''],
  cosmetics: ['Косметика', ''],
  launcher: ['Лаунчер', ''],
  launcher_crashes: ['Краши', ''],
  launcher_crash_rules: ['Правила крашей', ''],
  item_bans: ['Бан предметов', ''],
  player_feedback: ['Обращения', ''],
}
export const categoryLabel = (c) => (CATEGORIES[c] || [c, ''])[0]
export const categoryClass = (c) => (CATEGORIES[c] || [c, ''])[1]

const ACTIONS = {
  rcon: 'команда в консоль', rcon_denied: 'команда отклонена', power_restart: 'перезапуск сервера', power_start: 'запуск сервера',
  power_stop: 'остановка сервера', moderate_kick: 'кик игрока', moderate_op: 'выдал оператора', 'watchdog.toggle': 'сторож зависаний',
  mfa_passed: 'вход с 2FA', reauth: 'подтвердил пароль', mfa_enable: 'включил 2FA', mfa_backup_codes: 'новые коды восстановления 2FA',
  update: 'изменил', create: 'создал', delete: 'удалил', meta: 'оформление группы', role_add: 'выдал роль', role_remove: 'снял роль',
  assign: 'назначил сотрудником', revoke: 'снял с должности', appoint_admin: 'назначил админом', admin_servers: 'админство серверов',
  migrate_personal: 'перенёс личные права в роль', to_badge: 'сделал значком', audit_account: 'проверил аккаунт', delete_test_account: 'удалил тестовый аккаунт',
  download: 'скачал файл', edit: 'изменил файл', delete_dir: 'удалил папку', config_download: 'скачал конфиг с секретом',
  install_token: 'ссылка установки', settings: 'изменил настройки', release_update: 'изменил релиз', member_add: 'добавил в группу',
  member_remove: 'убрал из группы', node_add: 'добавил право', node_remove: 'убрал право', group_create: 'создал группу', group_delete: 'удалил группу',
  force_visit: 'вызвал скупщика', end_visit: 'закончил визит', upload: 'загрузил', apply_plugman: 'перезагрузил плагин', restart_apply: 'применил при перезапуске',
  grant: 'выдал', issue_warn: 'выдал предупреждение', revoke_warn: 'снял предупреждение', issue_mute: 'выдал мут', revoke_mute: 'снял мут',
  issue_ban: 'выдал бан', revoke_ban: 'снял бан', clear_violations: 'очистил нарушения',
}

const RESOURCES = [
  [/\/servers\/\{[^}]+\}\/auth-settings/, 'таймауты входа'], [/\/servers/, 'сервер'], [/\/roles\/\{[^}]+\}\/members/, 'участника роли'],
  [/\/roles\/order/, 'порядок ролей'], [/\/roles/, 'роль'], [/\/news\/upload-image/, 'картинку новости'], [/\/news/, 'новость'],
  [/\/mods\/regenerate/, 'манифест сборки'], [/\/mods\/apply/, 'изменения модов'], [/\/mods\/upload/, 'мод'], [/\/mods/, 'мод'],
  [/\/plugins\/upload/, 'плагин'], [/\/plugins/, 'плагин'], [/\/files\/write/, 'файл'], [/\/files/, 'файл'],
  [/\/game-perms\/groups\/\{[^}]+\}\/members/, 'участника группы прав'], [/\/game-perms\/groups\/\{[^}]+\}\/meta/, 'оформление группы прав'], [/\/game-perms/, 'группу прав'],
  [/\/launcher\/deploy/, 'деплой лаунчера'], [/\/launcher\/version/, 'версию лаунчера'], [/\/launcher\/notes/, 'заметки к релизу'],
  [/\/launcher-crashes/, 'краш лаунчера'], [/\/launcher-crash-rules/, 'правило крашей'], [/\/item-bans/, 'бан предмета'],
  [/\/backups/, 'бэкап'], [/\/punishments/, 'наказание'], [/\/player-feedback/, 'обращение'], [/\/anticheat/, 'данные античита'],
  [/\/trader\/preview/, 'пробный визит скупщика'], [/\/server-ops\/power/, 'питание сервера'], [/\/server-ops\/rcon/, 'команду в консоль'],
  [/\/integration\/install-token/, 'ссылку установки'], [/\/integration\/selftest/, 'проверку связи'], [/\/integration\/releases\/sync/, 'синхронизацию релизов'],
  [/\/moderators\/admins/, 'админа'], [/\/moderators/, 'сотрудника'],
]
const VERBS = { POST: 'создал', PUT: 'изменил', PATCH: 'изменил', DELETE: 'удалил' }
const VERB_OVERRIDES = [[/\/revoke$/, 'снял'], [/\/(remove|delete)$/, 'убрал'], [/\/(sync|selftest|deploy|regenerate|apply|power|rcon|preview)$/, 'выполнил'], [/\/upload/, 'загрузил']]

/** «изменил сервер», «команда в консоль»… — и исходный код для подсказки. */
export function actionLabel(action) {
  if (!action) return '—'
  if (ACTIONS[action]) return ACTIONS[action]
  const m = /^(GET|POST|PUT|PATCH|DELETE)\s+(\S+)/.exec(action)
  if (!m) return action.replace(/_/g, ' ')
  const path = m[2]
  const res = RESOURCES.find(([re]) => re.test(path))
  const verb = (VERB_OVERRIDES.find(([re]) => re.test(path)) || [null, VERBS[m[1]] || ''])[1]
  return res ? `${verb} ${res[1]}` : `${verb} (${path.replace('/api/v1/admin/', '')})`
}
