// Общая модель формы сервера: пустой сервер, разбивка полей по вкладкам, сборка запроса.

// Поля про машину и платформу: правит только тот, у кого «Серверы» на всю платформу
// (бэкенд проверяет то же самое).
export const PLATFORM_FIELDS = ['is_default', 'is_external', 'server_core', 'systemd_unit', 'data_dir', 'log_path',
  'rcon_host', 'rcon_port', 'rcon_password', 'pack_root', 'manifest_build_script']

export const BLANK = {
  slug: '', name: '', description: '', icon_url: '', banner_url: '',
  sort_order: 0, is_visible: true, is_default: false, staff_only: false, is_external: false, server_core: '', ticket_hostname: false,
  host: '', port: 25565, mc_version: '1.21.1', loader: 'neoforge',
  java_version: 21, neoforge_version: '',
  pack_root: '', pack_base_url: '', manifest_url: '',
  runtime_seed_url: '', runtime_manifest_url: '', manifest_build_script: '',
  pack_version: '1.0.0', min_launcher_version: '0.1.0',
  status_host: '', status_port: null, max_players: 100,
  whitelist_mode: 'public', maintenance: false,
  map_url: '',
  accent_color: '',
  easydonate_server_id: null,
  // Write-only: typed in to set or replace; empty = leave as it is.
  easydonate_shop_key: '',
  easydonate_shop_key_clear: false,
  news_channels: { update: { telegram: [], discord: [] }, media: { telegram: [], discord: [] } },
  systemd_unit: '', data_dir: '', log_path: '',
  rcon_host: '', rcon_port: null, rcon_password: '',
  features: { nations: true, economy: true, shop: true, alliances: true, battlepass: true, quests: true, leaderboards: true, upgrader: true, trader: true, salary: false, mods: true, progression: true, map: true, news: true, item_bans: false },
}

export const FEATURE_GROUPS = [
  {
    title: 'Игра',
    items: [
      ['nations', 'Государства', 'Создание государств, казна, исследования'],
      ['alliances', 'Альянсы', 'Союзы государств и голосования'],
      ['battlepass', 'Battle Pass', 'Сезонный пропуск с наградами'],
      ['quests', 'Квесты', 'Ежедневные задания'],
      ['progression', 'Прогрессия эпох', 'Этапы сборки и путеводитель'],
      ['leaderboards', 'Топ игроков', 'Рейтинги на сайте и в лаунчере'],
    ],
  },
  {
    title: 'Экономика',
    items: [
      ['economy', 'Экономика и рынок', 'Цены, рынок предметов'],
      ['shop', 'Магазин', 'Донат-привилегии'],
      ['upgrader', 'Апгрейдер', 'Колесо Void Coins'],
      ['trader', 'Скупщик', 'Визиты скупщика на спавне'],
      ['salary', 'Зарплата за игру', 'Только с плагином VoidRP Origins'],
    ],
  },
  {
    title: 'Контент и сервис',
    items: [
      ['mods', 'Моды', 'Список модов сборки лаунчера'],
      ['map', 'Карта', 'Вкладка с веб-картой'],
      ['news', 'Новости', 'Лента новостей сервера'],
      ['item_bans', 'Бан предметов', 'Нужен VoidRpGameSync 1.5.0+ или VoidRpPerms 0.5+'],
    ],
  },
]

// Какие поля на какой вкладке — для точек «есть изменения» на вкладках.
export const TAB_FIELDS = {
  general: ['name', 'slug', 'description', 'sort_order', 'is_visible', 'staff_only', 'is_default', 'whitelist_mode', 'max_players', 'maintenance'],
  look: ['icon_url', 'banner_url', 'accent_color'],
  connection: ['host', 'port', 'mc_version', 'loader', 'java_version', 'neoforge_version', 'server_core', 'is_external', 'ticket_hostname', 'status_host', 'status_port'],
  pack: ['pack_version', 'min_launcher_version', 'pack_base_url', 'manifest_url', 'runtime_seed_url', 'runtime_manifest_url', 'pack_root', 'manifest_build_script'],
  features: ['features', 'map_url'],
  channels: ['news_channels', 'easydonate_server_id', 'easydonate_shop_key', 'easydonate_shop_key_clear'],
  machine: ['systemd_unit', 'data_dir', 'log_path', 'rcon_host', 'rcon_port', 'rcon_password'],
}

export const ACCENTS = ['#7c3aed', '#3b82f6', '#06b6d4', '#22c55e', '#f59e0b', '#f97316', '#ef4444', '#ec4899']

export const CORE_LABELS = { paper: 'Paper', folia: 'Folia', neoforge: 'NeoForge', hybrid: 'Гибрид (Youer, Mohist)' }

// Deep copy that also works on Vue reactive proxies (structuredClone throws on them).
export const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)))

function ensureCat(nc, cat) {
  const c = nc[cat] || {}
  if (!Array.isArray(c.telegram)) c.telegram = []
  if (!Array.isArray(c.discord)) c.discord = []
  nc[cat] = c
  return c
}

/** Строка сервера из API → значения формы (все ключи на месте). */
export function toForm(server) {
  const blank = clone(BLANK)
  const f = { ...blank, ...(server ? clone(server) : {}) }
  for (const k of Object.keys(blank)) if (f[k] === null && typeof blank[k] === 'string') f[k] = ''
  f.easydonate_shop_key = ''
  f.easydonate_shop_key_clear = false
  f.features = { ...blank.features, ...(server?.features || {}) }
  f.news_channels = { ...blank.news_channels, ...(server?.news_channels || {}) }
  ensureCat(f.news_channels, 'update')
  ensureCat(f.news_channels, 'media')
  return f
}

/** Значения формы → тело запроса (пустые строки → null, пустые строки каналов убраны). */
export function buildPayload(form) {
  const p = { ...form }
  for (const k of ['description', 'icon_url', 'banner_url', 'neoforge_version',
    'pack_root', 'pack_base_url', 'manifest_url', 'runtime_seed_url', 'runtime_manifest_url',
    'manifest_build_script', 'status_host', 'map_url', 'accent_color',
    'systemd_unit', 'data_dir', 'log_path', 'rcon_host', 'rcon_password', 'server_core']) {
    if (p[k] === '') p[k] = null
  }
  for (const k of ['status_port', 'rcon_port', 'easydonate_server_id']) {
    if (p[k] === '' || p[k] === undefined || Number.isNaN(p[k])) p[k] = null
  }
  // The shop key is never read back: send it only when typed in, or '' to clear it.
  if (p.easydonate_shop_key_clear) p.easydonate_shop_key = ''
  else if (!p.easydonate_shop_key) delete p.easydonate_shop_key
  delete p.easydonate_shop_key_clear
  delete p.easydonate_shop_key_set
  const nc = {}
  for (const cat of ['update', 'media']) {
    const c = (p.news_channels && p.news_channels[cat]) || {}
    nc[cat] = {
      telegram: (c.telegram || [])
        .filter((t) => t && String(t.chat_id || '').trim() !== '')
        .map((t) => ({ chat_id: String(t.chat_id).trim(), thread_id: (t.thread_id === '' || t.thread_id == null || Number.isNaN(t.thread_id)) ? null : Number(t.thread_id) })),
      discord: (c.discord || []).map((w) => String(w || '').trim()).filter((w) => w !== ''),
    }
  }
  p.news_channels = nc
  return p
}

/** Поля, которые отличаются у двух снимков формы. */
export function changedKeys(a, b) {
  const pa = buildPayload(a)
  const pb = buildPayload(b)
  const keys = new Set([...Object.keys(BLANK), ...Object.keys(pa), ...Object.keys(pb)])
  const out = []
  for (const k of keys) {
    if (k === 'easydonate_shop_key_clear') continue
    if (JSON.stringify(pa[k] ?? null) !== JSON.stringify(pb[k] ?? null)) out.push(k)
  }
  if (a.easydonate_shop_key_clear !== b.easydonate_shop_key_clear) out.push('easydonate_shop_key_clear')
  return out
}

export function visibilityOf(s) {
  if (!s.is_visible) return 'hidden'
  return s.staff_only ? 'staff' : 'all'
}

export function visibilityPatch(mode) {
  return { hidden: { is_visible: false }, staff: { is_visible: true, staff_only: true }, all: { is_visible: true, staff_only: false } }[mode]
}

export const VISIBILITY = [
  ['all', 'Всем', 'Сервер в каталоге сайта и лаунчера'],
  ['staff', 'Админам', 'Видят только админы и модераторы с правом «Скрытые серверы»'],
  ['hidden', 'Скрыт', 'Не виден никому, даже админам'],
]

export function address(s) {
  if (!s.host) return ''
  return Number(s.port || 25565) === 25565 ? s.host : `${s.host}:${s.port}`
}
