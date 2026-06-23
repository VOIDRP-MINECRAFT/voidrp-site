export const siteConfig = {
  siteUrl: 'https://void-rp.ru',
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'https://api.void-rp.ru/api/v1',
  serverName: 'VoidRP',
  serverIp: 'void-rp.ru',
  serverVersion: '1.21.1',
  launcherPortableUrl:
    import.meta.env.VITE_LAUNCHER_PORTABLE_URL ||
    'https://void-rp.ru/launcher/self-update/VoidRpLauncher.exe',
  bluemapUrl: 'https://void-rp.ru/map',
  discordUrl: 'https://discord.gg/j2Dvxm8E',
  telegramUrl: 'https://t.me/voidRPminecraft',
  monitoringChartUrl: 'https://minecraftrating.ru/server_chart/396033/',
  hero: {
    badge: 'VoidRP • официальный сайт и лаунчер',
    title: 'Заходи в VoidRP',
    description:
      'Создай аккаунт, подтверди почту, скачай официальный лаунчер и заходи в игру без лишних шагов.',
  },
  features: [
    {
      title: 'Один вход',
      description:
        'Сайт, кабинет, профиль и лаунчер работают через один аккаунт.',
      icon: '🔐',
    },
    {
      title: 'Быстрый старт',
      description:
        'Регистрация, письмо и запуск собраны в короткую понятную цепочку.',
      icon: '🚀',
    },
    {
      title: 'Живой профиль',
      description:
        'Можно настроить аватар, баннер, фон и описание без лишней возни.',
      icon: '🧩',
    },
    {
      title: 'Всё рядом',
      description:
        'Карта, государства, рейтинг, Discord и полезные ссылки в одном месте.',
      icon: '🗺️',
    },
  ],
}
