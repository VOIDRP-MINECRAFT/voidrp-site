import { createRouter, createWebHistory } from 'vue-router'
import { authState, bootstrapAuth, getIsAuthenticated, hasPermission } from '../stores/authStore'
import NProgress from 'nprogress'
import 'nprogress/nprogress.css'

NProgress.configure({ showSpinner: false, speed: 350, minimum: 0.08 })

// Все вьюхи грузятся лениво (code-splitting): в стартовый бандл попадает только
// оболочка приложения, а страница-роут подтягивается отдельным чанком по мере
// перехода. Это резко уменьшает размер первичной загрузки (админка, рынок, гайд
// и т.д. больше не тянутся при заходе на главную).
const routes = [
  { path: '/', name: 'home', component: () => import('../views/HomeView.vue'), meta: { title: 'Главная' } },
  { path: '/servers', name: 'servers', component: () => import('../views/ServersView.vue'), meta: { title: 'Серверы' } },
  { path: '/shop', name: 'shop', component: () => import('../views/ShopView.vue'), meta: { title: 'Магазин', requiresAuth: true, feature: 'shop' } },
  { path: '/guide', redirect: '/server-guide' },
  { path: '/server-guide', name: 'server-guide', component: () => import('../views/ServerGuideView.vue'), meta: { title: 'Гайд сервера' } },
  { path: '/mods', name: 'mods', component: () => import('../views/ModsView.vue'), meta: { title: 'Моды сборки' } },
  { path: '/game-ui/menu', name: 'game-ui-menu', component: () => import('../views/GameUiMenuView.vue'), meta: { title: 'Меню', hidePublicShell: true } },
  { path: '/game-ui/market', name: 'game-ui-market', component: () => import('../views/GameUiMarketView.vue'), meta: { title: 'Рынок игроков', hidePublicShell: true } },
  { path: '/game-ui/hud', name: 'game-ui-hud', component: () => import('../views/GameUiHudView.vue'), meta: { title: 'HUD', hidePublicShell: true } },
  { path: '/game-ui/nmarket', name: 'game-ui-nmarket', component: () => import('../views/GameUiNationMarketView.vue'), meta: { title: 'Рынок государств', hidePublicShell: true } },
  { path: '/game-ui/treasury', name: 'game-ui-treasury', component: () => import('../views/GameUiTreasuryView.vue'), meta: { title: 'Казна', hidePublicShell: true } },
  { path: '/game-ui/battlepass', name: 'game-ui-battlepass', component: () => import('../views/GameUiBattlePassView.vue'), meta: { title: 'Battle Pass', hidePublicShell: true } },
  { path: '/game-ui/alliance', name: 'game-ui-alliance', component: () => import('../views/GameUiAllianceView.vue'), meta: { title: 'Альянс', hidePublicShell: true } },
  { path: '/game-ui/quests', name: 'game-ui-quests', component: () => import('../views/GameUiQuestsView.vue'), meta: { title: 'Квесты', hidePublicShell: true } },
  { path: '/market', name: 'market', component: () => import('../views/MarketView.vue'), meta: { title: 'Рынок игроков', feature: 'economy' } },
  { path: '/market/me/orders', name: 'market-my-orders', component: () => import('../views/PlayerMarketMyOrdersView.vue'), meta: { title: 'Мои ордера', requiresAuth: true, feature: 'economy' } },
  { path: '/market/:material', name: 'market-item', component: () => import('../views/MarketItemView.vue'), meta: { title: 'Товар', feature: 'economy' } },
  { path: '/news', name: 'news', component: () => import('../views/NewsView.vue'), meta: { title: 'Новости', feature: 'news' } },
  { path: '/news/:slug', name: 'news-item', component: () => import('../views/NewsItemView.vue'), meta: { title: 'Новость', feature: 'news' } },
  { path: '/links', name: 'links', component: () => import('../views/LinksView.vue'), meta: { title: 'Ссылки' } },
  { path: '/privacy', name: 'privacy-policy', component: () => import('../views/PrivacyPolicyView.vue'), meta: { title: 'Политика конфиденциальности' } },
  { path: '/offer', name: 'offer-agreement', component: () => import('../views/OfferAgreementView.vue'), meta: { title: 'Договор оферты' } },
  { path: '/login', name: 'login', component: () => import('../views/LoginView.vue'), meta: { title: 'Вход', guestOnly: true } },
  { path: '/register', name: 'register', component: () => import('../views/RegisterView.vue'), meta: { title: 'Регистрация', guestOnly: true } },
  { path: '/forgot-password', name: 'forgot-password', component: () => import('../views/ForgotPasswordView.vue'), meta: { title: 'Восстановление пароля', guestOnly: true } },
  { path: '/reset-password', name: 'reset-password', component: () => import('../views/ResetPasswordView.vue'), meta: { title: 'Смена пароля', guestOnly: true } },
  { path: '/verify-email', name: 'verify-email', component: () => import('../views/VerifyEmailView.vue'), meta: { title: 'Подтверждение почты' } },
  { path: '/download-launcher', name: 'download-launcher', component: () => import('../views/DownloadLauncherView.vue'), meta: { title: 'Скачать лаунчер' } },
  { path: '/profile', name: 'profile', component: () => import('../views/ProfileView.vue'), meta: { title: 'Профиль', requiresAuth: true } },
  { path: '/profile/public', name: 'edit-public-profile', component: () => import('../views/EditPublicProfileView.vue'), meta: { title: 'Публичный профиль', requiresAuth: true } },
  { path: '/profile/referrals', name: 'referrals', component: () => import('../views/ReferralCenterView.vue'), meta: { title: 'Реферальный центр', requiresAuth: true } },
  { path: '/profile/social', name: 'social', component: () => import('../views/SocialHubView.vue'), meta: { title: 'Социальный центр', requiresAuth: true } },
  { path: '/link-telegram', name: 'link-telegram', component: () => import('../views/LinkTelegramView.vue'), meta: { title: 'Привязка Telegram', requiresAuth: true } },
  { path: '/u/:slug', name: 'public-profile', component: () => import('../views/PublicProfileView.vue'), meta: { title: 'Профиль игрока' } },
  { path: '/nations', name: 'nations', component: () => import('../views/NationsListView.vue'), meta: { title: 'Государства', feature: 'nations' } },
  { path: '/nation/:slug', name: 'nation-public', component: () => import('../views/NationPublicView.vue'), meta: { title: 'Государство', feature: 'nations' } },
  { path: '/nation/studio', name: 'nation-studio', component: () => import('../views/NationStudioView.vue'), meta: { title: 'Студия государства', requiresAuth: true, feature: 'nations' } },
  { path: '/nations/rankings', name: 'nation-rankings', component: () => import('../views/NationRankingsView.vue'), meta: { title: 'Рейтинг государств', feature: 'nations' } },
  { path: '/alliances', name: 'alliances', component: () => import('../views/AlliancesListView.vue'), meta: { title: 'Альянсы', feature: 'alliances' } },
  { path: '/alliances/:slug', name: 'alliance-public', component: () => import('../views/AlliancePublicView.vue'), meta: { title: 'Альянс', feature: 'alliances' } },
  { path: '/leaderboard', name: 'leaderboard', component: () => import('../views/LeaderboardView.vue'), meta: { title: 'Рейтинг прогрессии', feature: 'progression' } },
  { path: '/players/top', name: 'players-top', component: () => import('../views/PlayersTopView.vue'), meta: { title: 'Топ игроков', feature: 'leaderboards' } },
  { path: '/bounties', name: 'bounties', component: () => import('../views/BountyBoardView.vue'), meta: { title: 'Награды за головы', feature: 'bounties' } },
  { path: '/killfeed', name: 'killfeed', component: () => import('../views/KillfeedView.vue'), meta: { title: 'Пульс Abyss', feature: 'killfeed' } },
  { path: '/battlepass', name: 'battlepass', component: () => import('../views/BattlePassView.vue'), meta: { title: 'Боевой пропуск', feature: 'battlepass' } },
  { path: '/internal-admin', name: 'admin-legacy', component: () => import('../views/AdminLegacyView.vue'), meta: { title: 'Legacy Admin', hidePublicShell: true } },
  { path: '/internal-admin/market', name: 'admin-market', component: () => import('../views/AdminMarketView.vue'), meta: { title: 'Market Admin', hidePublicShell: true } },
  {
    path: '/admin',
    component: () => import('../views/admin/AdminLayout.vue'),
    meta: { requiresAuth: true, requiresAdmin: true, hidePublicShell: true },
    children: [
      { path: '', name: 'admin-dashboard', component: () => import('../views/admin/AdminDashboardView.vue'), meta: { title: 'Панель управления', requiresAuth: true, requiresAdmin: true, hidePublicShell: true } },
      { path: 'players', name: 'admin-players', component: () => import('../views/admin/AdminPlayersView.vue'), meta: { title: 'Игроки', requiresAuth: true, requiresAdmin: true, hidePublicShell: true, permission: 'players.view' } },
      { path: 'market', name: 'admin-market-panel', component: () => import('../views/admin/AdminMarketPanelView.vue'), meta: { title: 'Рынок', requiresAuth: true, requiresAdmin: true, hidePublicShell: true, permission: 'market.view', serverScoped: true } },
      { path: 'server', name: 'admin-server', component: () => import('../views/admin/AdminServerView.vue'), meta: { title: 'Серверы', requiresAuth: true, requiresAdmin: true, hidePublicShell: true, permission: 'servers.manage' } },
      { path: 'monitoring', name: 'admin-monitoring', component: () => import('../views/admin/AdminServerOpsView.vue'), meta: { title: 'Мониторинг', requiresAuth: true, requiresAdmin: true, hidePublicShell: true, permission: 'monitoring.view', serverScoped: true } },
      { path: 'mods', name: 'admin-mods', component: () => import('../views/admin/AdminModsView.vue'), meta: { title: 'Моды', requiresAuth: true, requiresAdmin: true, hidePublicShell: true, permission: 'mods.view', serverScoped: true } },
      { path: 'nations', name: 'admin-nations', component: () => import('../views/admin/AdminNationsView.vue'), meta: { title: 'Государства', requiresAuth: true, requiresAdmin: true, hidePublicShell: true, permission: 'nations.view', serverScoped: true } },
      { path: 'mod-suggestions', name: 'admin-mod-suggestions', component: () => import('../views/admin/AdminModSuggestionsView.vue'), meta: { title: 'Предложения модов', requiresAuth: true, requiresAdmin: true, hidePublicShell: true, permission: 'mod_suggestions.view' } },
      { path: 'metrika', name: 'admin-metrika', component: () => import('../views/admin/AdminMetrikaView.vue'), meta: { title: 'Метрика', requiresAuth: true, requiresAdmin: true, hidePublicShell: true, permission: 'metrika.view' } },
      { path: 'battlepass', name: 'admin-battlepass', component: () => import('../views/admin/AdminBattlePassView.vue'), meta: { title: 'Battle Pass', requiresAuth: true, requiresAdmin: true, hidePublicShell: true, permission: 'battlepass.view', serverScoped: true } },
      { path: 'donate', name: 'admin-donate', component: () => import('../views/admin/AdminDonateView.vue'), meta: { title: 'Донаты', requiresAuth: true, requiresAdmin: true, hidePublicShell: true, permission: 'donate.view' } },
      { path: 'anticheat', name: 'admin-anticheat', component: () => import('../views/admin/AdminAnticheatView.vue'), meta: { title: 'Античит', requiresAuth: true, requiresAdmin: true, hidePublicShell: true, permission: 'anticheat.view', serverScoped: true } },
      { path: 'anticheat/:uuid', name: 'admin-anticheat-player', component: () => import('../views/admin/AdminAnticheatPlayerView.vue'), meta: { title: 'Игрок — Античит', requiresAuth: true, requiresAdmin: true, hidePublicShell: true, permission: 'anticheat.view', serverScoped: true } },
      { path: 'landing', name: 'admin-landing', component: () => import('../views/admin/AdminLandingView.vue'), meta: { title: 'Главная страница', requiresAuth: true, requiresAdmin: true, hidePublicShell: true, permission: 'landing.manage' } },
      { path: 'news', name: 'admin-news', component: () => import('../views/admin/AdminNewsView.vue'), meta: { title: 'Новости', requiresAuth: true, requiresAdmin: true, hidePublicShell: true, anyPermission: ['news.updates.view', 'news.media.view'] } },
      { path: 'feedback', name: 'admin-feedback', component: () => import('../views/admin/AdminFeedbackView.vue'), meta: { title: 'Обращения', requiresAuth: true, requiresAdmin: true, hidePublicShell: true, permission: 'feedback.view' } },
      { path: 'launcher-crashes', name: 'admin-launcher-crashes', component: () => import('../views/admin/AdminCrashReportsView.vue'), meta: { title: 'Краши лаунчера', requiresAuth: true, requiresAdmin: true, hidePublicShell: true, permission: 'crashes.view' } },
      { path: 'launcher', name: 'admin-launcher', component: () => import('../views/admin/AdminLauncherView.vue'), meta: { title: 'Лаунчер', requiresAuth: true, requiresAdmin: true, hidePublicShell: true, permission: 'launcher.view' } },
      { path: 'moderators', name: 'admin-moderators', component: () => import('../views/admin/AdminModeratorsView.vue'), meta: { title: 'Модерация', requiresAuth: true, requiresAdmin: true, hidePublicShell: true, adminOnly: true } },
    ],
  },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('../views/NotFoundView.vue'), meta: { title: 'Страница не найдена' } },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  },
})

router.beforeEach(async (to) => {
  NProgress.start()
  await bootstrapAuth()
  const isAuthenticated = getIsAuthenticated()
  if (to.meta?.requiresAuth && !isAuthenticated) {
    NProgress.done()
    return { path: '/login', query: { redirect: to.fullPath } }
  }
  // Admin panel is open to staff (full admin OR moderator); requiresAdmin now
  // means "staff". Per-route meta.permission and meta.adminOnly refine access.
  if (to.meta?.requiresAdmin && !(authState.user?.is_admin || authState.user?.is_moderator)) {
    NProgress.done()
    return { path: '/' }
  }
  if (to.meta?.adminOnly && !authState.user?.is_admin) {
    NProgress.done()
    return { path: '/admin' }
  }
  if (to.meta?.permission && !hasPermission(to.meta.permission)) {
    NProgress.done()
    return { path: '/admin' }
  }
  if (Array.isArray(to.meta?.anyPermission) && !to.meta.anyPermission.some((p) => hasPermission(p))) {
    NProgress.done()
    return { path: '/admin' }
  }
  if (to.meta?.guestOnly && isAuthenticated) {
    NProgress.done()
    return { path: '/profile' }
  }
  document.title = typeof to.meta?.title === 'string' && to.meta.title.length > 0
    ? `${to.meta.title} — VoidRP`
    : 'VoidRP'
  return true
})

router.afterEach(() => {
  NProgress.done()
})

// После деплоя старые чанки удаляются, и у пользователя со старой открытой
// вкладкой ленивый import() падает ("Failed to fetch dynamically imported
// module"). В этом случае делаем разовую жёсткую перезагрузку на нужный путь,
// чтобы подтянуть новый билд.
router.onError((error, to) => {
  const msg = String(error?.message || '')
  const isChunkError =
    /dynamically imported module|Importing a module script failed|Failed to fetch/i.test(msg)
  if (isChunkError && to?.fullPath) {
    const reloadKey = 'voidrp_chunk_reload_at'
    const last = Number(sessionStorage.getItem(reloadKey) || '0')
    // защита от цикла: не чаще одного релоада в 10 секунд
    if (Date.now() - last > 10000) {
      sessionStorage.setItem(reloadKey, String(Date.now()))
      window.location.assign(to.fullPath)
    }
  }
  NProgress.done()
})

export default router
