// Per-server mechanics guides. Keyed by server slug, then locale.
// A guide is a list of sections; each section has blocks rendered by
// ServerGuideView. Block types: p (paragraph), h (subheading), ul / ol (lists),
// note (callout), cmd (command row {text, desc}).

// ─── VoidRP: Origins ────────────────────────────────────────────────────────
// Kept in step with the in-game guide (voidrp_origins, lang/*.yml): the same
// steps, commands and rules, so the site and the /menu screen never disagree.

const originsRu = {
  title: 'Гайд по VoidRP: Origins',
  subtitle: 'Чистое выживание без модов — заходи с любого клиента, лаунчер не нужен',
  sections: [
    {
      id: 'about',
      icon: '🌱',
      title: 'Что такое Origins',
      blocks: [
        { t: 'p', text: 'Origins — ванильное выживание на плагинах. Без модов и без модпака: мир, ресурсы и соседи — как в оригинальной игре. Сюда можно зайти обычным клиентом Minecraft.' },
        { t: 'h', text: 'Как устроен мир' },
        { t: 'ul', items: [
          'Приватов нет — территорию никто не защищает. Гриф и воровство при этом запрещены правилами, за них банят.',
          'PvP включено везде, кроме спавна.',
          'Вещи при смерти выпадают — keepInventory выключен.',
          'Спавн — безопасная зона: там нельзя строить и драться.',
          'Аккаунт общий со всем VoidRP: тот же логин и пароль, что на сайте и в лаунчере.',
        ] },
        { t: 'note', text: 'Ценное храни надёжно: приватов нет, и сундук посреди поля — лёгкая добыча.' },
      ],
    },
    {
      id: 'join',
      icon: '🔑',
      title: 'Как зайти',
      blocks: [
        { t: 'ol', items: [
          'Зарегистрируйся на сайте void-rp.ru — это твой аккаунт для всех серверов.',
          'Запусти Minecraft любой версии от 1.21.1 до 26.x — с любого лаунчера.',
          'Добавь сервер с адресом origins.void-rp.ru:25567 и зайди.',
          'Перед входом в мир появится окно входа — введи пароль от аккаунта VoidRP.',
        ] },
        { t: 'note', text: 'С лаунчером VoidRP ещё проще: выбери сервер «VoidRP: Origins» и нажми «Играть» — вход подтвердится сам.' },
        { t: 'note', text: 'Меню сервера (/меню) рисуется на клиенте 1.21.6 и новее. На более старых версиях играть можно, а подсказки придут в чат.' },
      ],
    },
    {
      id: 'start',
      icon: '🏠',
      title: 'С чего начать',
      blocks: [
        { t: 'ol', items: [
          'Уйди со спавна подальше — свободной земли хватит всем.',
          'Запомни дом: /sethome — сохранить место, /home — вернуться. Домов можно три, у каждого своё имя.',
          'Играй с друзьями: /tpa <ник> — попроситься к игроку, /tpahere <ник> — позвать к себе.',
          'Береги своё: приватов нет, поэтому базу лучше прятать и не оставлять ценное на виду.',
        ] },
      ],
    },
    {
      id: 'commands',
      icon: '⌨️',
      title: 'Команды',
      blocks: [
        { t: 'p', text: 'Всё, что доступно игроку. Аргументы в <> обязательны, в [] — нет.' },
        { t: 'cmd', text: '/spawn', desc: 'вернуться на спавн' },
        { t: 'cmd', text: '/sethome [имя]', desc: 'запомнить место как дом' },
        { t: 'cmd', text: '/home [имя]', desc: 'телепорт домой' },
        { t: 'cmd', text: '/delhome <имя>', desc: 'удалить дом' },
        { t: 'cmd', text: '/tpa <ник>', desc: 'попросить телепорт к игроку' },
        { t: 'cmd', text: '/tpahere <ник>', desc: 'позвать игрока к себе' },
        { t: 'cmd', text: '/tpaccept, /tpdeny', desc: 'принять или отклонить запрос' },
        { t: 'cmd', text: '/msg <ник> <текст>', desc: 'личное сообщение, /r — ответить' },
        { t: 'cmd', text: '/rules', desc: 'правила в чате' },
        { t: 'cmd', text: '/shop, /рынок', desc: 'рынок игроков' },
        { t: 'cmd', text: '/меню, /гайд, /настройки', desc: 'меню сервера, гайд и настройки' },
      ],
    },
    {
      id: 'menu',
      icon: '📱',
      title: 'Меню в игре',
      blocks: [
        { t: 'p', text: 'На Origins есть своё меню прямо в игре — без модов, на обычном клиенте. Оно открывается само при первом входе, а потом по команде /меню.' },
        { t: 'ul', items: [
          'Курсор двигается поворотом головы, клик — левая кнопка мыши.',
          'Разделы: главная, гайд, новости, топ игроков, рынок, ссылки и настройки. Переключаются кликом, колёсиком или цифрами 1–7.',
          'Рынок игроков — тот же, что на сайте: выставляй предметы из инвентаря, покупай у других, заявки и отмена — там же. Открыть сразу: /shop.',
          'В настройках можно сменить язык меню на английский — выбор запоминается.',
          'Если меню обрезано по краям или сдвинуто, настрой форму экрана: кнопка в настройках или /vui screen.',
        ] },
      ],
    },
    {
      id: 'rules',
      icon: '📜',
      title: 'Правила',
      blocks: [
        { t: 'ol', items: [
          'Читы, читерские клиенты и макросы запрещены.',
          'Баги и дюпы не используем — нашёл, сообщи админам.',
          'Гриф и воровство у других игроков запрещены.',
          'На спавне нельзя строить и драться.',
          'Оскорбления, спам и реклама в чате запрещены.',
          'Один игрок — один аккаунт. Паролем не делимся.',
        ] },
        { t: 'note', text: 'За нарушения — мут или бан.' },
      ],
    },
  ],
}

const originsEn = {
  title: 'VoidRP: Origins Guide',
  subtitle: 'Pure survival, no mods — join from any client, no launcher needed',
  sections: [
    {
      id: 'about',
      icon: '🌱',
      title: 'What Origins is',
      blocks: [
        { t: 'p', text: 'Origins is vanilla survival on plugins. No mods and no modpack: the world, the resources and your neighbours, as the game made them. You can join with an ordinary Minecraft client.' },
        { t: 'h', text: 'How the world works' },
        { t: 'ul', items: [
          'There are no land claims — nobody protects territory. Griefing and theft are still against the rules and get you banned.',
          'PvP is on everywhere except spawn.',
          'You drop your items when you die — keepInventory is off.',
          'Spawn is a safe zone: no building and no fighting there.',
          'Your account is shared with all of VoidRP: the same login and password as on the website and in the launcher.',
        ] },
        { t: 'note', text: 'Keep valuables somewhere safe: without claims, a chest in the open is easy pickings.' },
      ],
    },
    {
      id: 'join',
      icon: '🔑',
      title: 'How to join',
      blocks: [
        { t: 'ol', items: [
          'Register on void-rp.ru — that is your account for every server.',
          'Start Minecraft, any version from 1.21.1 to 26.x, from any launcher.',
          'Add a server with the address origins.void-rp.ru:25567 and join.',
          'A login window appears before the world — enter your VoidRP account password.',
        ] },
        { t: 'note', text: 'With the VoidRP launcher it is simpler still: pick “VoidRP: Origins” and press Play — your login is confirmed automatically.' },
        { t: 'note', text: 'The server menu (/menu) is drawn on clients 1.21.6 and newer. Older versions can play, and get the hints in chat.' },
      ],
    },
    {
      id: 'start',
      icon: '🏠',
      title: 'Where to start',
      blocks: [
        { t: 'ol', items: [
          'Walk away from spawn — there is free land for everyone.',
          'Set a home: /sethome remembers a place, /home takes you back. Up to three, each with its own name.',
          'Play with friends: /tpa <name> asks to join a player, /tpahere <name> invites them to you.',
          'Look after your things: there are no claims, so hide your base and keep valuables out of sight.',
        ] },
      ],
    },
    {
      id: 'commands',
      icon: '⌨️',
      title: 'Commands',
      blocks: [
        { t: 'p', text: 'Everything a player can use. Arguments in <> are required, in [] optional.' },
        { t: 'cmd', text: '/spawn', desc: 'back to spawn' },
        { t: 'cmd', text: '/sethome [name]', desc: 'remember this place as a home' },
        { t: 'cmd', text: '/home [name]', desc: 'teleport home' },
        { t: 'cmd', text: '/delhome <name>', desc: 'delete a home' },
        { t: 'cmd', text: '/tpa <name>', desc: 'ask to teleport to a player' },
        { t: 'cmd', text: '/tpahere <name>', desc: 'invite a player to you' },
        { t: 'cmd', text: '/tpaccept, /tpdeny', desc: 'accept or refuse a request' },
        { t: 'cmd', text: '/msg <name> <text>', desc: 'private message, /r to reply' },
        { t: 'cmd', text: '/rules', desc: 'the rules in chat' },
        { t: 'cmd', text: '/shop, /market', desc: 'the player market' },
        { t: 'cmd', text: '/menu, /guide, /settings', desc: 'the server menu, the guide and settings' },
      ],
    },
    {
      id: 'menu',
      icon: '📱',
      title: 'The in-game menu',
      blocks: [
        { t: 'p', text: 'Origins has its own menu right in the game — no mods, on an ordinary client. It opens by itself on your first join, and afterwards with /menu.' },
        { t: 'ul', items: [
          'You move the cursor by turning your head and click with the left mouse button.',
          'Sections: home, guide, news, top players, market, links and settings. Switch with a click, the wheel or the keys 1–7.',
          'The player market is the same one as on the website: put items up from your inventory, buy from others, place and cancel orders. Straight to it: /shop.',
          'Settings switch the menu to Russian or English — your choice is kept.',
          'If the menu is cut off at the edges or shifted, set up the screen shape: the button in settings, or /vui screen.',
        ] },
      ],
    },
    {
      id: 'rules',
      icon: '📜',
      title: 'Rules',
      blocks: [
        { t: 'ol', items: [
          'Cheats, cheat clients and macros are banned.',
          'Do not use bugs or duplication — report them to the admins.',
          'Griefing and stealing from other players are banned.',
          'No building and no fighting at spawn.',
          'No insults, spam or advertising in chat.',
          'One player, one account. Never share your password.',
        ] },
        { t: 'note', text: 'Breaking the rules means a mute or a ban.' },
      ],
    },
  ],
}

export const serverGuides = {
  origins: { ru: originsRu, en: originsEn },
}

export function hasServerGuide(slug) {
  return !!(slug && serverGuides[slug])
}

export function getServerGuide(slug, locale) {
  const entry = slug && serverGuides[slug]
  if (!entry) return null
  return entry[locale] || entry.ru || entry.en || null
}
