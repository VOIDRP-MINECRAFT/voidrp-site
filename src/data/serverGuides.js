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
          '/home и /tpa нет, но телепортироваться можно через Вейстоны (мод Waystones) — см. раздел «Телепортация». В остальном перемещайся ногами, лодкой и порталами.',
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
        { t: 'p', text: 'Первый куб 16×16×16 центрирован на ядре — защита расходится от ядра одинаково во все стороны. Каждое улучшение добавляет ещё один куб к объёму — в ту сторону, куда ты кликнул по ядру.' },
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
        { t: 'h', text: 'Заполнить пробелы' },
        { t: 'p', text: 'Кубы растут только по осям (вверх/вниз/в стороны), но не по диагонали — поэтому в углах остаются пробелы. Команда /claim fill достраивает приват до сплошного прямоугольного объёма: заполняет все пустые ячейки внутри габаритов привата.' },
        { t: 'ul', items: [
          'Встань в свой приват и держи в руке предмет улучшения.',
          'Стоимость — базовая цена за каждую добавленную ячейку; заполнение соблюдает лимит в 31 куб и не залезает на чужие приваты.',
        ] },
        { t: 'h', text: 'Показать сетку привата' },
        { t: 'p', text: 'Кликни правой кнопкой по ядру ПУСТОЙ рукой (владелец, доверенный или админ) — вокруг привата покажется точная сетка из кубов частицами (бело-фиолетовые для лучшей видимости). Повторный клик выключает её.' },
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
      id: 'bounty',
      icon: '☠️',
      title: 'Награды за головы',
      blocks: [
        { t: 'p', text: 'Любого игрока можно объявить в розыск — назначить награду алмазами за его голову. Кто убьёт цель, тот забирает всю накопленную награду.' },
        { t: 'h', text: 'Как назначить' },
        { t: 'ol', items: [
          'Возьми алмазы в инвентарь — награда оплачивается ими сразу при назначении.',
          'Введи /bounty <ник> <алмазов> — указанное число алмазов спишется и повиснет на голове цели.',
          'На весь сервер уйдёт объявление. Награды складываются: несколько игроков могут скинуться на одну голову.',
        ] },
        { t: 'h', text: 'Как получить' },
        { t: 'ul', items: [
          'Убей игрока, на котором висит награда, — все алмазы с его головы выдадутся тебе автоматически.',
          'Награда за собственную голову и самоубийство не выплачиваются.',
        ] },
        { t: 'cmd', text: '/bounty <ник> <алмазов>', desc: 'Назначить награду за голову игрока (спишет алмазы)' },
        { t: 'cmd', text: '/bounty list', desc: 'Показать активные награды' },
        { t: 'note', text: 'Список активных наград виден и на сайте — вкладка «Награды за головы».' },
      ],
    },
    {
      id: 'trophies',
      icon: '📜',
      title: 'Трофеи и лента убийств',
      blocks: [
        { t: 'h', text: 'Головы-трофеи' },
        { t: 'p', text: 'Когда ты убиваешь игрока в PvP, с него выпадает его голова — с его скином. Забирай как трофей, вешай на базе или используй как доказательство килла.' },
        { t: 'h', text: 'Координаты смерти' },
        { t: 'p', text: 'При смерти тебе в чат приходят координаты места гибели — чтобы знать, куда бежать за своими вещами. Помни: инвентарь не сохраняется, поэтому спеши.' },
        { t: 'h', text: 'Лента убийств «Пульс Abyss»' },
        { t: 'p', text: 'Все PvP-убийства попадают в живую ленту на сайте — кто кого убил и чем. Следи за войнами сервера на вкладке «Пульс Abyss». Координаты баз при этом нигде не раскрываются.' },
        { t: 'h', text: 'Статистика и топы' },
        { t: 'p', text: 'Убийства, смерти и наигранное время считаются и уходят в личный профиль и рейтинги на сайте — соревнуйся за место в топе игроков.' },
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
        { t: 'cmd', text: '/claim fill', desc: 'Заполнить пробелы: достроить приват до сплошного объёма (нужен предмет улучшения в руке)' },
        { t: 'cmd', text: '/claim trust <ник>', desc: 'Добавить доверенного' },
        { t: 'cmd', text: '/claim untrust <ник>', desc: 'Убрать доверенного' },
        { t: 'cmd', text: '/claim remove', desc: 'Снять приват, в котором стоишь (только владелец)' },
        { t: 'p', text: 'Снять приват также можно, сломав своё ядро. Правый клик по ядру пустой рукой показывает краткую информацию.' },
      ],
    },
    {
      id: 'travel',
      icon: '🧭',
      title: 'Телепортация (Вейстоны)',
      blocks: [
        { t: 'p', text: 'В сборке есть мод Waystones — «Вейстоны». Это единственная быстрая телепортация на сервере: /home, /tpa и обычных телепортов нет.' },
        { t: 'ol', items: [
          'Скрафти или найди блок «Вейстон» и поставь его.',
          'Активируй его правым кликом — он станет точкой телепортации.',
          'Подойди к любому активированному вейстону и выбери в списке другой, чтобы телепортироваться. Варп-камень (Warp Stone) позволяет телепортироваться к известным вейстонам издалека с перезарядкой.',
        ] },
        { t: 'note', text: 'Это анархия: вейстон, стоящий в открытую, могут найти, использовать и сломать другие игроки. Важные вейстоны ставь внутри привата.' },
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
          'No /home or /tpa, but you can teleport via Waystones (the Waystones mod) — see the “Travel” section. Otherwise travel on foot, by boat or through portals.',
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
        { t: 'p', text: 'The first 16×16×16 cube is centered on the core — protection extends equally in every direction from it. Each upgrade adds one more cube to the volume, in the direction you clicked on the core.' },
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
        { t: 'h', text: 'Fill the gaps' },
        { t: 'p', text: 'Cubes only grow along the axes (up/down/sideways), not diagonally — so corners stay empty. The /claim fill command completes the claim into a solid rectangular volume: it fills every empty cell inside the claim’s bounding box.' },
        { t: 'ul', items: [
          'Stand inside your claim and hold the upgrade item.',
          'Cost is the base price per added cell; the fill respects the 31-cube limit and never overlaps other claims.',
        ] },
        { t: 'h', text: 'Show the claim grid' },
        { t: 'p', text: 'Right-click the core with an EMPTY hand (owner, trusted or admin) to show the exact cube grid around the claim as particles (alternating white/purple for visibility). Click again to turn it off.' },
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
      id: 'bounty',
      icon: '☠️',
      title: 'Bounties',
      blocks: [
        { t: 'p', text: 'Any player can have a price put on their head — a bounty paid in diamonds. Whoever kills the target collects the whole pledged reward.' },
        { t: 'h', text: 'Placing a bounty' },
        { t: 'ol', items: [
          'Have diamonds on you — the reward is paid up front when you place it.',
          'Type /bounty <name> <diamonds> — that many diamonds are taken and pinned to the target’s head.',
          'A server-wide announcement goes out. Bounties stack: several players can chip in on one head.',
        ] },
        { t: 'h', text: 'Collecting' },
        { t: 'ul', items: [
          'Kill a player who has a bounty — all diamonds on their head are given to you automatically.',
          'Bounties on your own head and suicides do not pay out.',
        ] },
        { t: 'cmd', text: '/bounty <name> <diamonds>', desc: 'Put a bounty on a player (spends diamonds)' },
        { t: 'cmd', text: '/bounty list', desc: 'Show active bounties' },
        { t: 'note', text: 'Active bounties are also listed on the site — the "Bounties" tab.' },
      ],
    },
    {
      id: 'trophies',
      icon: '📜',
      title: 'Trophies & kill feed',
      blocks: [
        { t: 'h', text: 'Head trophies' },
        { t: 'p', text: 'When you kill a player in PvP, their head drops — with their skin. Take it as a trophy, mount it on your base, or use it as proof of the kill.' },
        { t: 'h', text: 'Death coordinates' },
        { t: 'p', text: 'On death you get the coordinates of where you died in chat — so you know where to run for your stuff. Remember: inventory is not kept, so hurry.' },
        { t: 'h', text: 'The “Abyss Pulse” kill feed' },
        { t: 'p', text: 'Every PvP kill lands in a live feed on the site — who killed whom and with what. Follow the server’s wars on the “Abyss Pulse” tab. Base coordinates are never revealed.' },
        { t: 'h', text: 'Stats & leaderboards' },
        { t: 'p', text: 'Kills, deaths and playtime are tracked and sent to your profile and the site rankings — compete for a spot in the top players.' },
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
        { t: 'cmd', text: '/claim fill', desc: 'Fill the gaps: complete the claim into a solid volume (upgrade item in hand)' },
        { t: 'cmd', text: '/claim trust <name>', desc: 'Add a trusted player' },
        { t: 'cmd', text: '/claim untrust <name>', desc: 'Remove a trusted player' },
        { t: 'cmd', text: '/claim remove', desc: 'Remove the claim you stand in (owner only)' },
        { t: 'p', text: 'You can also remove a claim by breaking your own core. Right-clicking the core with an empty hand shows a quick summary.' },
      ],
    },
    {
      id: 'travel',
      icon: '🧭',
      title: 'Travel (Waystones)',
      blocks: [
        { t: 'p', text: 'The modpack includes the Waystones mod. Waystones are the only fast travel on the server — there is no /home, /tpa or vanilla teleport.' },
        { t: 'ol', items: [
          'Craft or find a Waystone block and place it.',
          'Right-click to activate it — it becomes a teleport point.',
          'Walk up to any activated waystone and pick another from the list to teleport. A Warp Stone lets you teleport to known waystones from afar on a cooldown.',
        ] },
        { t: 'note', text: 'This is anarchy: a waystone out in the open can be found, used and destroyed by other players. Put important ones inside a claim.' },
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
