// Per-server mechanics guides. Keyed by server slug, then locale.
// A guide is a list of sections; each section has blocks rendered by
// ServerGuideView. Block types: p (paragraph), h (subheading), ul / ol (lists),
// note (callout), cmd (command row {text, desc}).

const abyssRu = {
  title: 'Гайд по VoidRP: Abyss',
  subtitle: 'Анархия с приватами через блок — всё, что нужно знать',
  sections: [
    {
      id: 'anarchy',
      icon: '💀',
      title: 'Что такое анархия',
      blocks: [
        { t: 'p', text: 'Abyss — жёсткий анархо-сервер. Правил почти нет: гриф, обман, PvP, ловушки, рейды — всё разрешено. Единственная защита твоих построек — приват через блок-ядро.' },
        { t: 'h', text: 'Ключевые правила мира' },
        { t: 'ul', items: [
          'PvP включён везде, в том числе внутри приватов — приват защищает постройки, а не игрока.',
          'Инвентарь при смерти НЕ сохраняется (keepInventory выключен). Умер — потерял всё, что было при себе.',
          'Вне приватов гриф разрешён: любой может ломать и строить где угодно.',
          'Телепортов, /home и /tpa нет — перемещайся ногами, лодкой, порталами.',
          'Откатов и восстановления вещей нет. Всё, что случилось, — случилось.',
        ] },
        { t: 'note', text: 'Хочешь сохранить базу — поставь ядро привата. Без него любой прохожий может тебя разграбить.' },
      ],
    },
    {
      id: 'claims',
      icon: '🛡️',
      title: 'Приваты через блок',
      blocks: [
        { t: 'p', text: 'Приват создаётся установкой блока «Ядро привата». Вокруг ядра защищается куб 16×16×16 (объём, а не вся высота): чужие не могут ломать, ставить и открывать блоки внутри.' },
        { t: 'h', text: 'Как получить ядро' },
        { t: 'p', text: 'Скрафтить «Ядро привата» на верстаке или получить у администрации командой /claim give (только для операторов).' },
        { t: 'recipe', result: 'voidrp_claims:claim_core', resultName: 'Ядро привата',
          grid: [
            'minecraft:obsidian', 'minecraft:ender_pearl', 'minecraft:obsidian',
            'minecraft:ender_pearl', 'minecraft:netherite_ingot', 'minecraft:ender_pearl',
            'minecraft:obsidian', 'minecraft:ender_pearl', 'minecraft:obsidian',
          ],
          legend: [
            { id: 'minecraft:obsidian', name: 'Обсидиан', count: 4 },
            { id: 'minecraft:ender_pearl', name: 'Эндер-жемчуг', count: 4 },
            { id: 'minecraft:netherite_ingot', name: 'Незеритовый слиток', count: 1 },
          ] },
        { t: 'h', text: 'Как создать приват' },
        { t: 'ol', items: [
          'Поставь ядро в центре будущей базы.',
          'Появится сообщение «Приват создан». Уровень 1 — это один куб 16×16×16 вокруг ядра.',
          'Над ядром поднимаются частицы-маячок, чтобы приват было видно издалека.',
        ] },
        { t: 'h', text: 'Что защищено внутри' },
        { t: 'ul', items: [
          'Ломание и установка блоков не-доверенными — запрещено.',
          'Контейнеры, двери, кнопки, рычаги — только для владельца и доверенных.',
          'Диспенсеры и мобы не могут ставить блоки внутри чужого привата.',
        ] },
        { t: 'note', text: 'PvP внутри привата работает — тебя всё ещё могут убить на своей же базе. Приват спасает постройки и сундуки, но не жизнь.' },
        { t: 'note', text: 'Приват не вечен: его можно взять рейдом — пробить взрывами и выкопать ядро. Подробнее — в разделе «Как захватить чужой приват».' },
      ],
    },
    {
      id: 'levels',
      icon: '⬆️',
      title: 'Расширение привата',
      blocks: [
        { t: 'p', text: 'Приват растёт по кубам 16×16×16. Каждое улучшение добавляет один куб к объёму привата — в ту сторону, куда ты кликнул по ядру.' },
        { t: 'h', text: 'Как расширить' },
        { t: 'ol', items: [
          'Возьми в руку предмет улучшения (по умолчанию — Алмазный блок).',
          'Кликни правой кнопкой по ТОЙ ГРАНИ ядра, в сторону которой хочешь прирастить куб (вверх, вниз, вбок).',
          'Прирастёт ещё один куб 16×16×16 с этой стороны. Кликая разные грани, строишь нужную форму базы.',
        ] },
        { t: 'h', text: 'Лимит и цена' },
        { t: 'ul', items: [
          'Максимум 30 улучшений — 31 куб вместе с ядром.',
          'Чем больше прокачка, тем дороже: цена улучшения растёт по мере роста привата.',
        ] },
        { t: 'note', text: 'Приваты не пересекаются — нельзя прирастить куб на чужой приват.' },
        { t: 'h', text: 'Показать сетку привата' },
        { t: 'p', text: 'Кликни правой кнопкой по ядру ПУСТОЙ рукой (владелец, доверенный или админ) — вокруг привата покажется точная сетка из кубов частицами. Повторный клик выключает её.' },
      ],
    },
    {
      id: 'raid',
      icon: '💥',
      title: 'Как захватить чужой приват',
      blocks: [
        { t: 'p', text: 'Приваты не вечны — на анархии любую базу можно взять. Обычным способом заприваченные блоки не сломать, но есть путь рейда.' },
        { t: 'h', text: 'Шаг 1 — пробей стены взрывами' },
        { t: 'p', text: 'Взрывы (TNT и кристаллы Края) ПРОБИВАЮТ защиту привата — заприваченные блоки от них ломаются. Взрывай стены и прокапывайся к ядру.' },
        { t: 'h', text: 'Шаг 2 — выкопай ядро' },
        { t: 'ul', items: [
          'Само ядро взорвать НЕЛЬЗЯ — оно взрывоустойчивое, как обсидиан.',
          'Ядро нужно ВЫКОПАТЬ киркой. Оно очень прочное — копается очень долго (около 37 секунд алмазной киркой).',
          'Нужна минимум алмазная кирка: камень и железо ядро почти не берут.',
        ] },
        { t: 'note', text: 'Пока копаешь ядро — стоишь на месте и уязвим, тебя могут убить в PvP. Рейди группой: кто-то копает, кто-то прикрывает.' },
        { t: 'p', text: 'Как только ядро сломано — приват падает, и вся база открыта: ломай, грабь, забирай всё.' },
      ],
    },
    {
      id: 'trust',
      icon: '🤝',
      title: 'Доверенные игроки',
      blocks: [
        { t: 'p', text: 'Доверенные могут строить и открывать контейнеры внутри твоего привата наравне с тобой.' },
        { t: 'p', text: 'Встань внутри своего привата и используй команды:' },
        { t: 'cmd', text: '/claim trust <ник>', desc: 'Добавить игрока в доверенные' },
        { t: 'cmd', text: '/claim untrust <ник>', desc: 'Убрать игрока из доверенных' },
      ],
    },
    {
      id: 'commands',
      icon: '⌨️',
      title: 'Команды приватов',
      blocks: [
        { t: 'cmd', text: '/claim info', desc: 'Информация о привате, в котором стоишь (владелец, уровень, размер, доверенные)' },
        { t: 'cmd', text: '/claim trust <ник>', desc: 'Добавить доверенного' },
        { t: 'cmd', text: '/claim untrust <ник>', desc: 'Убрать доверенного' },
        { t: 'cmd', text: '/claim remove', desc: 'Снять приват, в котором стоишь (только владелец)' },
        { t: 'p', text: 'Снять приват также можно, сломав своё ядро. Правый клик по ядру пустой рукой показывает краткую информацию.' },
      ],
    },
    {
      id: 'skins',
      icon: '🎨',
      title: 'Скины',
      blocks: [
        { t: 'p', text: 'На Abyss работает своя система скинов — они не привязаны к Mojang. Загрузи скин в личном кабинете на сайте или в лаунчере, и его увидят все игроки в игре.' },
        { t: 'ul', items: [
          'Поддерживаются форматы 64×64 и классический 64×32.',
          'Доступны обе модели рук — обычная (classic) и тонкая (slim).',
        ] },
      ],
    },
    {
      id: 'voice',
      icon: '🎧',
      title: 'Голосовой чат',
      blocks: [
        { t: 'p', text: 'На сервере установлен Simple Voice Chat — проксимити-голос: слышно тех, кто рядом. Мод входит в сборку, отдельно ставить ничего не нужно.' },
        { t: 'ul', items: [
          'По умолчанию активация по клавише V (настраивается в меню голосового чата).',
          'Группы и рации — через встроенное меню мода.',
        ] },
      ],
    },
    {
      id: 'launcher',
      icon: '🚀',
      title: 'Вход и лаунчер',
      blocks: [
        { t: 'p', text: 'Заходить на Abyss нужно через лаунчер VoidRP — он подтягивает сборку, Java нужной версии и подтверждает твой вход по одноразовому тикету.' },
        { t: 'ul', items: [
          'Скачай лаунчер на сайте и войди в свой аккаунт VoidRP.',
          'Выбери сервер Abyss — лаунчер сам поставит нужную версию и моды.',
          'Нажми «Играть» — вход подтвердится автоматически.',
        ] },
      ],
    },
  ],
}

const abyssEn = {
  title: 'VoidRP: Abyss Guide',
  subtitle: 'Anarchy with block-based claims — everything you need to know',
  sections: [
    {
      id: 'anarchy',
      icon: '💀',
      title: 'What anarchy means here',
      blocks: [
        { t: 'p', text: 'Abyss is a hardcore anarchy server. There are almost no rules: griefing, scamming, PvP, traps and raids are all allowed. The only way to protect your builds is a block-anchored claim.' },
        { t: 'h', text: 'Core world rules' },
        { t: 'ul', items: [
          'PvP is on everywhere, including inside claims — a claim protects builds, not the player.',
          'Inventory is NOT kept on death (keepInventory off). Die and you lose everything you carried.',
          'Outside claims, griefing is allowed: anyone can break and build anywhere.',
          'No teleports, /home or /tpa — travel on foot, by boat or through portals.',
          'No rollbacks or item restoration. What happens, happens.',
        ] },
        { t: 'note', text: 'Want to keep your base? Place a claim core. Without one, any passer-by can loot you.' },
      ],
    },
    {
      id: 'claims',
      icon: '🛡️',
      title: 'Block-based claims',
      blocks: [
        { t: 'p', text: 'A claim is created by placing a Claim Core block. It protects a 16×16×16 cube around the core (a volume, not full height): outsiders cannot break, place or open blocks inside.' },
        { t: 'h', text: 'Getting a core' },
        { t: 'p', text: 'Craft a Claim Core at a crafting table, or get one from staff via /claim give (operators only).' },
        { t: 'recipe', result: 'voidrp_claims:claim_core', resultName: 'Claim Core',
          grid: [
            'minecraft:obsidian', 'minecraft:ender_pearl', 'minecraft:obsidian',
            'minecraft:ender_pearl', 'minecraft:netherite_ingot', 'minecraft:ender_pearl',
            'minecraft:obsidian', 'minecraft:ender_pearl', 'minecraft:obsidian',
          ],
          legend: [
            { id: 'minecraft:obsidian', name: 'Obsidian', count: 4 },
            { id: 'minecraft:ender_pearl', name: 'Ender Pearl', count: 4 },
            { id: 'minecraft:netherite_ingot', name: 'Netherite Ingot', count: 1 },
          ] },
        { t: 'h', text: 'Creating a claim' },
        { t: 'ol', items: [
          'Place the core at the center of your future base.',
          'You will see "Claim created". Level 1 is a single 16×16×16 cube around the core.',
          'A particle plume rises above the core so claims are visible from afar.',
        ] },
        { t: 'h', text: 'What is protected inside' },
        { t: 'ul', items: [
          'Breaking and placing blocks by non-trusted players is blocked.',
          'Containers, doors, buttons, levers — owner and trusted only.',
          'Dispensers and mobs cannot place blocks inside someone else’s claim.',
        ] },
        { t: 'note', text: 'PvP still works inside a claim — you can be killed on your own base. Claims protect builds and chests, not your life.' },
        { t: 'note', text: 'Claims are not forever: they can be raided — breach with explosives and mine out the core. See "Raiding someone’s claim" below.' },
      ],
    },
    {
      id: 'levels',
      icon: '⬆️',
      title: 'Expanding a claim',
      blocks: [
        { t: 'p', text: 'A claim grows in 16×16×16 cubes. Each upgrade adds one cube to the claim volume — in the direction you clicked on the core.' },
        { t: 'h', text: 'How to expand' },
        { t: 'ol', items: [
          'Hold the upgrade item (Block of Diamond by default).',
          'Right-click the FACE of the core pointing the way you want to grow (up, down, sideways).',
          'One more 16×16×16 cube is added on that side. Click different faces to shape your base.',
        ] },
        { t: 'h', text: 'Limit and cost' },
        { t: 'ul', items: [
          'Up to 30 upgrades — 31 cubes including the core.',
          'The more you upgrade, the more expensive it gets: the cost rises as the claim grows.',
        ] },
        { t: 'note', text: 'Claims cannot overlap — you can’t grow a cube onto someone else’s claim.' },
        { t: 'h', text: 'Show the claim grid' },
        { t: 'p', text: 'Right-click the core with an EMPTY hand (owner, trusted or admin) to show the exact cube grid around the claim as particles. Click again to turn it off.' },
      ],
    },
    {
      id: 'raid',
      icon: '💥',
      title: 'Raiding someone’s claim',
      blocks: [
        { t: 'p', text: 'Claims aren’t forever — on anarchy any base can be taken. You can’t hand-break claimed blocks, but there is a raid path.' },
        { t: 'h', text: 'Step 1 — breach the walls with explosives' },
        { t: 'p', text: 'Explosions (TNT and end crystals) BREACH claim protection — claimed blocks are destroyed by them. Blow through the walls and dig toward the core.' },
        { t: 'h', text: 'Step 2 — mine out the core' },
        { t: 'ul', items: [
          'The core itself CANNOT be blown up — it is blast-proof like obsidian.',
          'You must MINE the core with a pickaxe. It is extremely tough — about 37 seconds with a diamond pickaxe.',
          'A diamond pickaxe is the minimum: stone and iron barely scratch it.',
        ] },
        { t: 'note', text: 'While mining the core you stand still and exposed — you can be killed in PvP. Raid in a group: one digs, others cover.' },
        { t: 'p', text: 'Once the core is broken the claim falls and the whole base is open — break it, loot it, take everything.' },
      ],
    },
    {
      id: 'trust',
      icon: '🤝',
      title: 'Trusted players',
      blocks: [
        { t: 'p', text: 'Trusted players can build and open containers inside your claim just like you.' },
        { t: 'p', text: 'Stand inside your claim and use:' },
        { t: 'cmd', text: '/claim trust <name>', desc: 'Add a player to trusted' },
        { t: 'cmd', text: '/claim untrust <name>', desc: 'Remove a player from trusted' },
      ],
    },
    {
      id: 'commands',
      icon: '⌨️',
      title: 'Claim commands',
      blocks: [
        { t: 'cmd', text: '/claim info', desc: 'Info about the claim you stand in (owner, level, size, trusted)' },
        { t: 'cmd', text: '/claim trust <name>', desc: 'Add a trusted player' },
        { t: 'cmd', text: '/claim untrust <name>', desc: 'Remove a trusted player' },
        { t: 'cmd', text: '/claim remove', desc: 'Remove the claim you stand in (owner only)' },
        { t: 'p', text: 'You can also remove a claim by breaking your own core. Right-clicking the core with an empty hand shows a quick summary.' },
      ],
    },
    {
      id: 'skins',
      icon: '🎨',
      title: 'Skins',
      blocks: [
        { t: 'p', text: 'Abyss has its own skin system, not tied to Mojang. Upload a skin in your account on the site or in the launcher, and everyone in-game will see it.' },
        { t: 'ul', items: [
          'Supports 64×64 and legacy 64×32 formats.',
          'Both arm models are available — classic and slim.',
        ] },
      ],
    },
    {
      id: 'voice',
      icon: '🎧',
      title: 'Voice chat',
      blocks: [
        { t: 'p', text: 'The server runs Simple Voice Chat — proximity voice: you hear players near you. It ships with the modpack, nothing extra to install.' },
        { t: 'ul', items: [
          'Push-to-talk on V by default (configurable in the voice chat menu).',
          'Groups and walkie-talkies via the mod’s built-in menu.',
        ] },
      ],
    },
    {
      id: 'launcher',
      icon: '🚀',
      title: 'Joining & the launcher',
      blocks: [
        { t: 'p', text: 'Join Abyss through the VoidRP launcher — it downloads the modpack and the right Java version, and confirms your login with a one-time ticket.' },
        { t: 'ul', items: [
          'Download the launcher on the site and sign in to your VoidRP account.',
          'Pick the Abyss server — the launcher installs the correct version and mods.',
          'Press Play — your login is confirmed automatically.',
        ] },
      ],
    },
  ],
}

export const serverGuides = {
  abyss: { ru: abyssRu, en: abyssEn },
}

export function hasServerGuide(slug) {
  return !!(slug && serverGuides[slug])
}

export function getServerGuide(slug, locale) {
  const entry = slug && serverGuides[slug]
  if (!entry) return null
  return entry[locale] || entry.ru || entry.en || null
}
