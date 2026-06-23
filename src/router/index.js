import { createRouter, createWebHistory } from 'vue-router'
import { authState, bootstrapAuth, getIsAuthenticated } from '../stores/authStore'
import NProgress from 'nprogress'
import 'nprogress/nprogress.css'

NProgress.configure({ showSpinner: false, speed: 350, minimum: 0.08 })

import HomeView from '../views/HomeView.vue'
import LinksView from '../views/LinksView.vue'
import LoginView from '../views/LoginView.vue'
import RegisterView from '../views/RegisterView.vue'
import ForgotPasswordView from '../views/ForgotPasswordView.vue'
import ResetPasswordView from '../views/ResetPasswordView.vue'
import VerifyEmailView from '../views/VerifyEmailView.vue'
import DownloadLauncherView from '../views/DownloadLauncherView.vue'
import ProfileView from '../views/ProfileView.vue'
import PublicProfileView from '../views/PublicProfileView.vue'
import EditPublicProfileView from '../views/EditPublicProfileView.vue'
import ReferralCenterView from '../views/ReferralCenterView.vue'
import SocialHubView from '../views/SocialHubView.vue'
import NationsListView from '../views/NationsListView.vue'
import NationPublicView from '../views/NationPublicView.vue'
import NationStudioView from '../views/NationStudioView.vue'
import NationRankingsView from '../views/NationRankingsView.vue'
import AlliancesListView from '../views/AlliancesListView.vue'
import AlliancePublicView from '../views/AlliancePublicView.vue'
import AdminLegacyView from '../views/AdminLegacyView.vue'
import AdminMarketView from '../views/AdminMarketView.vue'
import AdminLayout from '../views/admin/AdminLayout.vue'
import AdminDashboardView from '../views/admin/AdminDashboardView.vue'
import AdminPlayersView from '../views/admin/AdminPlayersView.vue'
import AdminMarketPanelView from '../views/admin/AdminMarketPanelView.vue'
import AdminServerView from '../views/admin/AdminServerView.vue'
import AdminNationsView from '../views/admin/AdminNationsView.vue'
import AdminModSuggestionsView from '../views/admin/AdminModSuggestionsView.vue'
import AdminMetrikaView from '../views/admin/AdminMetrikaView.vue'
import AdminBattlePassView from '../views/admin/AdminBattlePassView.vue'
import AdminDonateView from '../views/admin/AdminDonateView.vue'
import AdminAnticheatView from '../views/admin/AdminAnticheatView.vue'
import AdminAnticheatPlayerView from '../views/admin/AdminAnticheatPlayerView.vue'
import AdminLandingView from '../views/admin/AdminLandingView.vue'
import AdminFeedbackView from '../views/admin/AdminFeedbackView.vue'
import AdminCrashReportsView from '../views/admin/AdminCrashReportsView.vue'
import ExpertGuideView from '../views/ExpertGuideView.vue'
import MarketView from '../views/MarketView.vue'
import MarketItemView from '../views/MarketItemView.vue'
import PlayerMarketMyOrdersView from '../views/PlayerMarketMyOrdersView.vue'
import PrivacyPolicyView from '../views/PrivacyPolicyView.vue'
import OfferAgreementView from '../views/OfferAgreementView.vue'
import LeaderboardView from '../views/LeaderboardView.vue'
import PlayersTopView from '../views/PlayersTopView.vue'
import RecipesView from '../views/RecipesView.vue'
import ShopView from '../views/ShopView.vue'
import BattlePassView from '../views/BattlePassView.vue'
import GameUiMarketView from '../views/GameUiMarketView.vue'
import GameUiMenuView from '../views/GameUiMenuView.vue'

const routes = [
  { path: '/', name: 'home', component: HomeView, meta: { title: 'Главная' } },
  { path: '/shop', name: 'shop', component: ShopView, meta: { title: 'Магазин', requiresAuth: true } },
  { path: '/guide', name: 'expert-guide', component: ExpertGuideView, meta: { title: 'Гайд сборки' } },
  { path: '/recipes', name: 'recipes', component: RecipesView, meta: { title: 'Крафты сборки' } },
  { path: '/game-ui/menu', name: 'game-ui-menu', component: GameUiMenuView, meta: { title: 'Меню', hidePublicShell: true } },
  { path: '/game-ui/market', name: 'game-ui-market', component: GameUiMarketView, meta: { title: 'Рынок игроков', hidePublicShell: true } },
  { path: '/market', name: 'market', component: MarketView, meta: { title: 'Рынок игроков' } },
  { path: '/market/me/orders', name: 'market-my-orders', component: PlayerMarketMyOrdersView, meta: { title: 'Мои ордера', requiresAuth: true } },
  { path: '/market/:material', name: 'market-item', component: MarketItemView, meta: { title: 'Товар' } },
  { path: '/links', name: 'links', component: LinksView, meta: { title: 'Ссылки' } },
  { path: '/privacy', name: 'privacy-policy', component: PrivacyPolicyView, meta: { title: 'Политика конфиденциальности' } },
  { path: '/offer', name: 'offer-agreement', component: OfferAgreementView, meta: { title: 'Договор оферты' } },
  { path: '/login', name: 'login', component: LoginView, meta: { title: 'Вход', guestOnly: true } },
  { path: '/register', name: 'register', component: RegisterView, meta: { title: 'Регистрация', guestOnly: true } },
  { path: '/forgot-password', name: 'forgot-password', component: ForgotPasswordView, meta: { title: 'Восстановление пароля', guestOnly: true } },
  { path: '/reset-password', name: 'reset-password', component: ResetPasswordView, meta: { title: 'Смена пароля', guestOnly: true } },
  { path: '/verify-email', name: 'verify-email', component: VerifyEmailView, meta: { title: 'Подтверждение почты' } },
  { path: '/download-launcher', name: 'download-launcher', component: DownloadLauncherView, meta: { title: 'Скачать лаунчер' } },
  { path: '/profile', name: 'profile', component: ProfileView, meta: { title: 'Профиль', requiresAuth: true } },
  { path: '/profile/public', name: 'edit-public-profile', component: EditPublicProfileView, meta: { title: 'Публичный профиль', requiresAuth: true } },
  { path: '/profile/referrals', name: 'referrals', component: ReferralCenterView, meta: { title: 'Реферальный центр', requiresAuth: true } },
  { path: '/profile/social', name: 'social', component: SocialHubView, meta: { title: 'Социальный центр', requiresAuth: true } },
  { path: '/u/:slug', name: 'public-profile', component: PublicProfileView, meta: { title: 'Профиль игрока' } },
  { path: '/nations', name: 'nations', component: NationsListView, meta: { title: 'Государства' } },
  { path: '/nation/:slug', name: 'nation-public', component: NationPublicView, meta: { title: 'Государство' } },
  { path: '/nation/studio', name: 'nation-studio', component: NationStudioView, meta: { title: 'Студия государства', requiresAuth: true } },
  { path: '/nations/rankings', name: 'nation-rankings', component: NationRankingsView, meta: { title: 'Рейтинг государств' } },
  { path: '/alliances', name: 'alliances', component: AlliancesListView, meta: { title: 'Альянсы' } },
  { path: '/alliances/:slug', name: 'alliance-public', component: AlliancePublicView, meta: { title: 'Альянс' } },
  { path: '/leaderboard', name: 'leaderboard', component: LeaderboardView, meta: { title: 'Рейтинг прогрессии' } },
  { path: '/players/top', name: 'players-top', component: PlayersTopView, meta: { title: 'Топ игроков' } },
  { path: '/battlepass', name: 'battlepass', component: BattlePassView, meta: { title: 'Боевой пропуск' } },
  { path: '/internal-admin', name: 'admin-legacy', component: AdminLegacyView, meta: { title: 'Legacy Admin', hidePublicShell: true } },
  { path: '/internal-admin/market', name: 'admin-market', component: AdminMarketView, meta: { title: 'Market Admin', hidePublicShell: true } },
  {
    path: '/admin',
    component: AdminLayout,
    meta: { requiresAuth: true, requiresAdmin: true, hidePublicShell: true },
    children: [
      { path: '', name: 'admin-dashboard', component: AdminDashboardView, meta: { title: 'Панель управления', requiresAuth: true, requiresAdmin: true, hidePublicShell: true } },
      { path: 'players', name: 'admin-players', component: AdminPlayersView, meta: { title: 'Игроки', requiresAuth: true, requiresAdmin: true, hidePublicShell: true } },
      { path: 'market', name: 'admin-market-panel', component: AdminMarketPanelView, meta: { title: 'Рынок', requiresAuth: true, requiresAdmin: true, hidePublicShell: true } },
      { path: 'server', name: 'admin-server', component: AdminServerView, meta: { title: 'Статус сервера', requiresAuth: true, requiresAdmin: true, hidePublicShell: true } },
      { path: 'nations', name: 'admin-nations', component: AdminNationsView, meta: { title: 'Государства', requiresAuth: true, requiresAdmin: true, hidePublicShell: true } },
      { path: 'mod-suggestions', name: 'admin-mod-suggestions', component: AdminModSuggestionsView, meta: { title: 'Предложения модов', requiresAuth: true, requiresAdmin: true, hidePublicShell: true } },
      { path: 'metrika', name: 'admin-metrika', component: AdminMetrikaView, meta: { title: 'Метрика', requiresAuth: true, requiresAdmin: true, hidePublicShell: true } },
      { path: 'battlepass', name: 'admin-battlepass', component: AdminBattlePassView, meta: { title: 'Battle Pass', requiresAuth: true, requiresAdmin: true, hidePublicShell: true } },
      { path: 'donate', name: 'admin-donate', component: AdminDonateView, meta: { title: 'Донаты', requiresAuth: true, requiresAdmin: true, hidePublicShell: true } },
      { path: 'anticheat', name: 'admin-anticheat', component: AdminAnticheatView, meta: { title: 'Античит', requiresAuth: true, requiresAdmin: true, hidePublicShell: true } },
      { path: 'anticheat/:uuid', name: 'admin-anticheat-player', component: AdminAnticheatPlayerView, meta: { title: 'Игрок — Античит', requiresAuth: true, requiresAdmin: true, hidePublicShell: true } },
      { path: 'landing', name: 'admin-landing', component: AdminLandingView, meta: { title: 'Главная страница', requiresAuth: true, requiresAdmin: true, hidePublicShell: true } },
      { path: 'feedback', name: 'admin-feedback', component: AdminFeedbackView, meta: { title: 'Обращения', requiresAuth: true, requiresAdmin: true, hidePublicShell: true } },
      { path: 'launcher-crashes', name: 'admin-launcher-crashes', component: AdminCrashReportsView, meta: { title: 'Краши лаунчера', requiresAuth: true, requiresAdmin: true, hidePublicShell: true } },
    ],
  },
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
  if (to.meta?.requiresAdmin && !authState.user?.is_admin) {
    NProgress.done()
    return { path: '/' }
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

export default router
