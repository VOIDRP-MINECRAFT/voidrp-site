// Мок-превью админки: vite dev на 5176, /api/v1 перехватывается фикстурами.
// Прод-API не трогается вообще (прокси отсутствует).
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

const SITE_ROOT = '.'

const user = {
  id: 'u-1', site_login: 'mironoouv', email: 'admin@void-rp.ru',
  is_admin: true, email_verified: true, created_at: '2026-01-15T10:00:00Z',
}
const playerAccount = { minecraft_nickname: 'Mironoouv', minecraft_uuid: '11111111-2222-3333-4444-555555555555' }

const servers = [
  {
    id: 's-1', slug: 'voidrp', name: 'VoidRP · Основной', description: 'Главный RP-мир', sort_order: 0,
    host: 'void-rp.ru', port: 25565, mc_version: '1.21.1', loader: 'neoforge', java_version: 21,
    manifest_url: null, pack_version: '1.0.0', min_launcher_version: '0.1.0',
    max_players: 100, whitelist_mode: 'public', maintenance: false, map_url: null,
    accent_color: '#7c3aed', features: {}, is_default: true,
    status: { online: true, players_online: 23, players_max: 100, version: '1.21.1' },
  },
  {
    id: 's-2', slug: 'abyss', name: 'Abyss · Хардкор', description: 'Хардкорный мир', sort_order: 1,
    host: 'abyss.void-rp.ru', port: 25566, mc_version: '1.21.1', loader: 'neoforge', java_version: 21,
    manifest_url: null, pack_version: '1.0.0', min_launcher_version: '0.1.0',
    max_players: 50, whitelist_mode: 'whitelist', maintenance: false, map_url: null,
    accent_color: '#0ea5e9', features: { alliances: false }, is_default: false,
    status: { online: false, players_online: 0, players_max: 50, version: null },
  },
]

const regTrend = Array.from({ length: 14 }, (_, i) => ({ date: `2026-06-${(i + 20)}`, count: 3 + Math.round(8 * Math.abs(Math.sin(i))) }))

const recentUsers = Array.from({ length: 8 }, (_, i) => ({
  id: `ru-${i}`, site_login: ['steve_x', 'alexcraft', 'nether_king', 'wither42', 'enderlord', 'creeper_aw', 'diamond_miner', 'redstone_pro'][i],
  minecraft_nickname: ['SteveX', 'AlexCraft', 'NetherKing', 'Wither42', 'EnderLord', 'CreeperAw', 'DiamondMiner', 'RedstonePro'][i],
  email: `player${i}@mail.ru`, email_verified: i % 3 !== 0,
  created_at: new Date(Date.now() - i * 7200_000).toISOString(),
}))

const fixtures = {
  'POST /api/v1/auth/refresh': { access_token: 'mock-access', refresh_token: 'mock-refresh', user, player_account: playerAccount, security: { active_refresh_sessions: 2 } },
  'GET /api/v1/servers': servers,
  'GET /api/v1/admin/dashboard/stats': {
    users: { total: 1842, active: 1710, new_last_7d: 46, new_last_30d: 213, verified: 1544, reg_trend: regTrend },
    players: { total: 1512 },
    nations: { total: 14 },
    alliances: { total: 4 },
    battlepass: { active_premium: 87, progress_count: 640 },
    market: { enabled_items: 312 },
    mod_suggestions: { total: 58 },
  },
  'GET /api/v1/admin/dashboard/server-status': {
    online: true, players_online: 23, players_max: 100, version: 'Mohist 1.21.1', latency_ms: 4,
    players_sample: [{ id: 1, name: 'SteveX' }, { id: 2, name: 'AlexCraft' }, { id: 3, name: 'NetherKing' }, { id: 4, name: 'EnderLord' }, { id: 5, name: 'Wither42' }, { id: 6, name: 'CreeperAw' }],
  },
  'GET /api/v1/admin/dashboard/recent-users': { users: recentUsers },
  'GET /api/v1/admin/dashboard/metrika': { visits: 12840, users: 7211, pageviews: 40233, bounce_rate: 21.4 },
}

function mockPlugin() {
  return {
    name: 'admin-preview-mocks',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url.startsWith('/api/v1')) return next()
        const path = req.url.split('?')[0]
        const key = `${req.method} ${path}`
        let body = fixtures[key]
        if (body === undefined) {
          // generic fallback: пустые структуры, чтобы страницы отрисовали empty-стейты
          if (path.includes('/players') && req.method === 'GET') body = { players: [], items: [], total: 0 }
          else if (req.method === 'GET') body = Array.isArray(body) ? [] : {}
          else body = {}
        }
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(body))
      })
    },
  }
}

export default defineConfig({
  
  plugins: [vue(), tailwindcss(), mockPlugin()],
  server: { host: '127.0.0.1', port: 5176, strictPort: true },
})
