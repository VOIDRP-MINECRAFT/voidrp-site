const ENCHANT_NAMES = {
  AQUA_AFFINITY: 'Водное родство',
  BINDING_CURSE: 'Проклятие несъёмности',
  BLAST_PROTECTION: 'Защита от взрывов',
  CHANNELING: 'Переключение',
  DEPTH_STRIDER: 'Морской странник',
  EFFICIENCY: 'Эффективность',
  FEATHER_FALLING: 'Невесомость',
  FIRE_ASPECT: 'Огненный аспект',
  FIRE_PROTECTION: 'Огненная защита',
  FLAME: 'Пламя',
  FORTUNE: 'Удача',
  FROST_WALKER: 'Морозная поступь',
  IMPALING: 'Пронзание',
  INFINITY: 'Бесконечность',
  KNOCKBACK: 'Отбрасывание',
  LOOTING: 'Добыча',
  LOYALTY: 'Верность',
  LUCK_OF_THE_SEA: 'Морская удача',
  LURE: 'Приманка',
  MENDING: 'Починка',
  MULTISHOT: 'Многостволка',
  PIERCING: 'Прокалывание',
  POWER: 'Мощь',
  PROJECTILE_PROTECTION: 'Защита от снарядов',
  PROTECTION: 'Защита',
  PUNCH: 'Отдача',
  QUICK_CHARGE: 'Быстрая зарядка',
  RESPIRATION: 'Дыхание',
  RIPTIDE: 'Подводный рывок',
  SHARPNESS: 'Острота',
  SILK_TOUCH: 'Шёлковое касание',
  SMITE: 'Кара',
  SOUL_SPEED: 'Скорость душ',
  SWEEPING_EDGE: 'Секущий удар',
  SWIFT_SNEAK: 'Быстрое подкрадывание',
  THORNS: 'Шипы',
  UNBREAKING: 'Прочность',
  VANISHING_CURSE: 'Проклятие исчезновения',
  WIND_BURST: 'Порыв ветра',
  DENSITY: 'Плотность',
  BANE_OF_ARTHROPODS: 'Гибель членистоногих',
}

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']

const POTION_EFFECT_NAMES = {
  HEALING: 'Мгновенного здоровья',
  FIRE_RESISTANCE: 'Стойкости к огню',
  NIGHT_VISION: 'Ночного зрения',
  STRENGTH: 'Силы',
  SWIFTNESS: 'Скорости',
  WATER_BREATHING: 'Водного дыхания',
  REGENERATION: 'Регенерации',
  STRONG_HEALING: 'Мгновенного здоровья II',
  STRONG_SWIFTNESS: 'Скорости II',
  STRONG_STRENGTH: 'Силы II',
  LONG_FIRE_RESISTANCE: 'Стойкости к огню (долгое)',
  LONG_NIGHT_VISION: 'Ночного зрения (долгое)',
  LONG_STRENGTH: 'Силы (долгое)',
  LONG_SWIFTNESS: 'Скорости (долгое)',
  LONG_WATER_BREATHING: 'Водного дыхания (долгое)',
  LONG_REGENERATION: 'Регенерации (долгое)',
  INVISIBILITY: 'Невидимости',
  LONG_INVISIBILITY: 'Невидимости (долгое)',
  LEAPING: 'Прыгучести',
  LONG_LEAPING: 'Прыгучести (долгое)',
  STRONG_LEAPING: 'Прыгучести II',
  SLOW_FALLING: 'Медленного падения',
  LONG_SLOW_FALLING: 'Медленного падения (долгое)',
  TURTLE_MASTER: 'Панциря черепахи',
  LONG_TURTLE_MASTER: 'Панциря черепахи (долгое)',
  STRONG_TURTLE_MASTER: 'Панциря черепахи II',
  INFESTED: 'Заражения',
}

function _resolveSpecial(key) {
  const parts = key.split(':')
  if (parts.length < 2) return null
  const base = parts[0]
  const sub = parts.slice(1).join(':')

  if (base === 'ENCHANTED_BOOK') {
    const enchParts = sub.split(':')
    const enchKey = enchParts[0]
    const level = parseInt(enchParts[1]) || 0
    const enchName = ENCHANT_NAMES[enchKey]
    if (!enchName) return null
    const levelStr = level > 1 && level < ROMAN.length ? ' ' + ROMAN[level] : ''
    return `Книга зачарований: ${enchName}${levelStr}`
  }

  if (base === 'POTION') {
    const effectName = POTION_EFFECT_NAMES[sub]
    if (effectName) return `Зелье ${effectName.charAt(0).toLowerCase() + effectName.slice(1)}`
    return null
  }

  if (base === 'SPLASH_POTION') {
    const effectName = POTION_EFFECT_NAMES[sub]
    if (effectName) return `Зелье-плеск ${effectName.charAt(0).toLowerCase() + effectName.slice(1)}`
    return null
  }

  if (base === 'LINGERING_POTION') {
    const effectName = POTION_EFFECT_NAMES[sub]
    if (effectName) return `Зелье-туча ${effectName.charAt(0).toLowerCase() + effectName.slice(1)}`
    return null
  }

  if (base === 'TIPPED_ARROW') {
    const effectName = POTION_EFFECT_NAMES[sub]
    if (effectName) return `Стрела ${effectName.charAt(0).toLowerCase() + effectName.slice(1)}`
    return null
  }

  if (base === 'MINECRAFT' && sub.startsWith('OMINOUS_BOTTLE_')) {
    const level = parseInt(sub.replace('OMINOUS_BOTTLE_', ''))
    const roman = ['', 'I', 'II', 'III', 'IV', 'V'][level] || level
    if (roman) return `Зловещая бутылка ${roman}`
    return null
  }

  return null
}

const NAMES = {
  // Уголь и топливо
  COAL: 'Уголь',
  CHARCOAL: 'Древесный уголь',
  COAL_ORE: 'Угольная руда',
  DEEPSLATE_COAL_ORE: 'Глубинная угольная руда',
  COAL_BLOCK: 'Угольный блок',

  // Железо
  IRON_INGOT: 'Железный слиток',
  RAW_IRON: 'Необработанное железо',
  IRON_ORE: 'Железная руда',
  DEEPSLATE_IRON_ORE: 'Глубинная железная руда',
  IRON_BLOCK: 'Железный блок',
  IRON_NUGGET: 'Железный самородок',

  // Золото
  GOLD_INGOT: 'Золотой слиток',
  RAW_GOLD: 'Необработанное золото',
  GOLD_ORE: 'Золотая руда',
  DEEPSLATE_GOLD_ORE: 'Глубинная золотая руда',
  NETHER_GOLD_ORE: 'Золотая руда незера',
  GOLD_BLOCK: 'Золотой блок',
  GOLD_NUGGET: 'Золотой самородок',

  // Алмаз
  DIAMOND: 'Алмаз',
  DIAMOND_ORE: 'Алмазная руда',
  DEEPSLATE_DIAMOND_ORE: 'Глубинная алмазная руда',
  DIAMOND_BLOCK: 'Алмазный блок',

  // Изумруд
  EMERALD: 'Изумруд',
  EMERALD_ORE: 'Изумрудная руда',
  DEEPSLATE_EMERALD_ORE: 'Глубинная изумрудная руда',
  EMERALD_BLOCK: 'Изумрудный блок',

  // Лазурит
  LAPIS_LAZULI: 'Лазурит',
  LAPIS_ORE: 'Руда лазурита',
  DEEPSLATE_LAPIS_ORE: 'Глубинная руда лазурита',
  LAPIS_BLOCK: 'Блок лазурита',

  // Красный камень
  REDSTONE: 'Красный камень',
  REDSTONE_ORE: 'Руда красного камня',
  DEEPSLATE_REDSTONE_ORE: 'Глубинная руда красного камня',
  REDSTONE_BLOCK: 'Блок красного камня',

  // Медь
  COPPER_INGOT: 'Медный слиток',
  RAW_COPPER: 'Необработанная медь',
  COPPER_ORE: 'Медная руда',
  DEEPSLATE_COPPER_ORE: 'Глубинная медная руда',
  COPPER_BLOCK: 'Медный блок',

  // Незерит
  NETHERITE_INGOT: 'Слиток незерита',
  NETHERITE_SCRAP: 'Незеритовый лом',
  NETHERITE_BLOCK: 'Блок незерита',

  // Кварц
  QUARTZ: 'Кварц незера',
  NETHER_QUARTZ_ORE: 'Кварцевая руда незера',
  QUARTZ_BLOCK: 'Блок кварца',

  // Аметист
  AMETHYST_SHARD: 'Осколок аметиста',
  AMETHYST_BLOCK: 'Блок аметиста',

  // Древесина (брёвна)
  OAK_LOG: 'Дубовое бревно',
  BIRCH_LOG: 'Берёзовое бревно',
  SPRUCE_LOG: 'Еловое бревно',
  JUNGLE_LOG: 'Бревно джунглей',
  ACACIA_LOG: 'Акациевое бревно',
  DARK_OAK_LOG: 'Бревно тёмного дуба',
  MANGROVE_LOG: 'Мангровое бревно',
  CHERRY_LOG: 'Вишнёвое бревно',
  CRIMSON_STEM: 'Ствол багрянца',
  WARPED_STEM: 'Искажённый ствол',

  // Доски
  OAK_PLANKS: 'Дубовые доски',
  BIRCH_PLANKS: 'Берёзовые доски',
  SPRUCE_PLANKS: 'Еловые доски',
  JUNGLE_PLANKS: 'Доски джунглей',
  ACACIA_PLANKS: 'Акациевые доски',
  DARK_OAK_PLANKS: 'Доски тёмного дуба',
  MANGROVE_PLANKS: 'Мангровые доски',
  CHERRY_PLANKS: 'Вишнёвые доски',
  CRIMSON_PLANKS: 'Багряные доски',
  WARPED_PLANKS: 'Искажённые доски',

  STICK: 'Палка',

  // Камень и земля
  COBBLESTONE: 'Булыжник',
  STONE: 'Камень',
  GRANITE: 'Гранит',
  DIORITE: 'Диорит',
  ANDESITE: 'Андезит',
  DIRT: 'Земля',
  COARSE_DIRT: 'Грубая земля',
  GRASS_BLOCK: 'Блок травы',
  PODZOL: 'Подзол',
  MYCELIUM: 'Мицелий',
  SAND: 'Песок',
  RED_SAND: 'Красный песок',
  GRAVEL: 'Гравий',
  CLAY: 'Блок глины',
  CLAY_BALL: 'Глина',

  // Стекло
  GLASS: 'Стекло',
  GLASS_PANE: 'Стеклянная панель',
  TINTED_GLASS: 'Тонированное стекло',

  // Кирпичи
  BRICK: 'Кирпич',
  BRICKS: 'Кирпичи',
  NETHER_BRICK: 'Незерный кирпич',
  NETHER_BRICKS: 'Незерные кирпичи',

  // Незер/Эндер
  NETHERRACK: 'Незерак',
  SOUL_SAND: 'Душевой песок',
  SOUL_SOIL: 'Душевая земля',
  GLOWSTONE: 'Светокамень',
  GLOWSTONE_DUST: 'Порошок светокамня',
  MAGMA_BLOCK: 'Магматический блок',
  MAGMA_CREAM: 'Огненный крем',
  BLACKSTONE: 'Чёрный камень',
  BASALT: 'Базальт',
  NETHER_WART: 'Незерная бородавка',
  NETHER_WART_BLOCK: 'Блок незерной бородавки',
  BLAZE_ROD: 'Стержень призрака',
  BLAZE_POWDER: 'Порошок призрака',
  GHAST_TEAR: 'Слеза гаста',
  WITHER_SKELETON_SKULL: 'Череп иссушителя-скелета',
  END_STONE: 'Камень края',
  PURPUR_BLOCK: 'Пурпурный блок',
  OBSIDIAN: 'Обсидиан',
  CRYING_OBSIDIAN: 'Плачущий обсидиан',
  ENDER_PEARL: 'Эндер-жемчуг',
  EYE_OF_ENDER: 'Глаз Эндера',
  SHULKER_SHELL: 'Панцирь шалкера',
  CHORUS_FRUIT: 'Плод хора',
  POPPED_CHORUS_FRUIT: 'Жареный плод хора',
  DRAGON_BREATH: 'Дыхание дракона',
  ELYTRA: 'Элитры',

  // Снег и лёд
  SNOWBALL: 'Снежок',
  SNOW_BLOCK: 'Блок снега',
  ICE: 'Лёд',
  PACKED_ICE: 'Плотный лёд',
  BLUE_ICE: 'Синий лёд',

  // Вода/море
  PRISMARINE_CRYSTALS: 'Призмариновые кристаллы',
  PRISMARINE_SHARD: 'Осколок призмарина',
  NAUTILUS_SHELL: 'Раковина наутилуса',
  HEART_OF_THE_SEA: 'Сердце моря',
  INK_SAC: 'Чернильный мешочек',
  GLOW_INK_SAC: 'Светящийся чернильный мешочек',
  KELP: 'Морские водоросли',
  SEA_PICKLE: 'Морской огурец',
  LILY_PAD: 'Кувшинка',
  SPONGE: 'Губка',
  WET_SPONGE: 'Мокрая губка',
  COD: 'Сырая треска',
  COOKED_COD: 'Жареная треска',
  SALMON: 'Сырой лосось',
  COOKED_SALMON: 'Жареный лосось',
  PUFFERFISH: 'Рыба-шар',
  TROPICAL_FISH: 'Тропическая рыба',

  // Еда
  WHEAT: 'Пшеница',
  WHEAT_SEEDS: 'Семена пшеницы',
  BREAD: 'Хлеб',
  APPLE: 'Яблоко',
  GOLDEN_APPLE: 'Золотое яблоко',
  ENCHANTED_GOLDEN_APPLE: 'Зачарованное золотое яблоко',
  CARROT: 'Морковь',
  GOLDEN_CARROT: 'Золотая морковь',
  POTATO: 'Картофель',
  BAKED_POTATO: 'Печёный картофель',
  POISONOUS_POTATO: 'Ядовитый картофель',
  BEETROOT: 'Свёкла',
  BEETROOT_SEEDS: 'Семена свёклы',
  PUMPKIN: 'Тыква',
  PUMPKIN_SEEDS: 'Семена тыквы',
  MELON: 'Арбуз',
  MELON_SLICE: 'Кусок арбуза',
  MELON_SEEDS: 'Семена арбуза',
  SUGAR_CANE: 'Сахарный тростник',
  SUGAR: 'Сахар',
  COOKIE: 'Печенье',
  CAKE: 'Торт',
  PUMPKIN_PIE: 'Тыквенный пирог',
  MUSHROOM_STEW: 'Грибной суп',
  RABBIT_STEW: 'Кроличье рагу',
  BEETROOT_SOUP: 'Свекольный суп',
  SWEET_BERRIES: 'Сладкие ягоды',
  GLOW_BERRIES: 'Светящиеся ягоды',
  BROWN_MUSHROOM: 'Коричневый гриб',
  RED_MUSHROOM: 'Красный гриб',
  BEEF: 'Сырая говядина',
  COOKED_BEEF: 'Жареная говядина',
  PORKCHOP: 'Сырая свинина',
  COOKED_PORKCHOP: 'Жареная свинина',
  CHICKEN: 'Сырая курица',
  COOKED_CHICKEN: 'Жареная курица',
  MUTTON: 'Сырая баранина',
  COOKED_MUTTON: 'Жареная баранина',
  RABBIT: 'Сырой кролик',
  COOKED_RABBIT: 'Жареный кролик',
  RABBIT_FOOT: 'Заячья лапка',
  RABBIT_HIDE: 'Заячья шкурка',
  ROTTEN_FLESH: 'Гнилая плоть',

  // Материалы с мобов
  STRING: 'Нитка',
  FEATHER: 'Перо',
  LEATHER: 'Кожа',
  BONE: 'Кость',
  BONE_MEAL: 'Костная мука',
  SPIDER_EYE: 'Паучий глаз',
  FERMENTED_SPIDER_EYE: 'Сброженный паучий глаз',
  GUNPOWDER: 'Порох',
  SLIMEBALL: 'Слизь',
  PHANTOM_MEMBRANE: 'Мембрана фантома',
  TURTLE_SCUTE: 'Черепашья чешуйка',
  TOTEM_OF_UNDYING: 'Тотем бессмертия',

  // Шерсть
  WHITE_WOOL: 'Белая шерсть',
  ORANGE_WOOL: 'Оранжевая шерсть',
  MAGENTA_WOOL: 'Пурпурная шерсть',
  LIGHT_BLUE_WOOL: 'Голубая шерсть',
  YELLOW_WOOL: 'Жёлтая шерсть',
  LIME_WOOL: 'Лаймовая шерсть',
  PINK_WOOL: 'Розовая шерсть',
  GRAY_WOOL: 'Серая шерсть',
  LIGHT_GRAY_WOOL: 'Светло-серая шерсть',
  CYAN_WOOL: 'Бирюзовая шерсть',
  PURPLE_WOOL: 'Фиолетовая шерсть',
  BLUE_WOOL: 'Синяя шерсть',
  BROWN_WOOL: 'Коричневая шерсть',
  GREEN_WOOL: 'Зелёная шерсть',
  RED_WOOL: 'Красная шерсть',
  BLACK_WOOL: 'Чёрная шерсть',

  // Красители
  WHITE_DYE: 'Белый краситель',
  ORANGE_DYE: 'Оранжевый краситель',
  MAGENTA_DYE: 'Пурпурный краситель',
  LIGHT_BLUE_DYE: 'Голубой краситель',
  YELLOW_DYE: 'Жёлтый краситель',
  LIME_DYE: 'Лаймовый краситель',
  PINK_DYE: 'Розовый краситель',
  GRAY_DYE: 'Серый краситель',
  LIGHT_GRAY_DYE: 'Светло-серый краситель',
  CYAN_DYE: 'Бирюзовый краситель',
  PURPLE_DYE: 'Фиолетовый краситель',
  BLUE_DYE: 'Синий краситель',
  BROWN_DYE: 'Коричневый краситель',
  GREEN_DYE: 'Зелёный краситель',
  RED_DYE: 'Красный краситель',
  BLACK_DYE: 'Чёрный краситель',
  COCOA_BEANS: 'Зёрна какао',
  CACTUS: 'Кактус',
  VINE: 'Лоза',
  BAMBOO: 'Бамбук',

  // Зелья / книги
  GLASS_BOTTLE: 'Стеклянная бутылка',
  EXPERIENCE_BOTTLE: 'Бутылочка опыта',
  ENCHANTED_BOOK: 'Зачарованная книга',
  BOOK: 'Книга',
  PAPER: 'Бумага',
  WRITABLE_BOOK: 'Книга и перо',

  // Инструменты
  FLINT: 'Кремень',
  FLINT_AND_STEEL: 'Огниво',
  FISHING_ROD: 'Удочка',
  COMPASS: 'Компас',
  CLOCK: 'Часы',
  BUCKET: 'Ведро',
  WATER_BUCKET: 'Ведро воды',
  LAVA_BUCKET: 'Ведро лавы',
  SHEARS: 'Ножницы',
  IRON_PICKAXE: 'Железная кирка',
  DIAMOND_PICKAXE: 'Алмазная кирка',
  NETHERITE_PICKAXE: 'Незеритовая кирка',
  IRON_AXE: 'Железный топор',
  DIAMOND_AXE: 'Алмазный топор',
  IRON_SHOVEL: 'Железная лопата',
  IRON_HOE: 'Железная мотыга',

  // Оружие
  IRON_SWORD: 'Железный меч',
  DIAMOND_SWORD: 'Алмазный меч',
  NETHERITE_SWORD: 'Незеритовый меч',
  BOW: 'Лук',
  ARROW: 'Стрела',
  SPECTRAL_ARROW: 'Призрачная стрела',
  TIPPED_ARROW: 'Стрела с эффектом',
  CROSSBOW: 'Арбалет',
  TRIDENT: 'Трезубец',
  SHIELD: 'Щит',

  // Бронь
  LEATHER_HELMET: 'Кожаный шлем',
  LEATHER_CHESTPLATE: 'Кожаный нагрудник',
  LEATHER_LEGGINGS: 'Кожаные поножи',
  LEATHER_BOOTS: 'Кожаные ботинки',
  IRON_HELMET: 'Железный шлем',
  IRON_CHESTPLATE: 'Железный нагрудник',
  IRON_LEGGINGS: 'Железные поножи',
  IRON_BOOTS: 'Железные ботинки',
  DIAMOND_HELMET: 'Алмазный шлем',
  DIAMOND_CHESTPLATE: 'Алмазный нагрудник',
  DIAMOND_LEGGINGS: 'Алмазные поножи',
  DIAMOND_BOOTS: 'Алмазные ботинки',
  NETHERITE_HELMET: 'Незеритовый шлем',
  NETHERITE_CHESTPLATE: 'Незеритовый нагрудник',
  NETHERITE_LEGGINGS: 'Незеритовые поножи',
  NETHERITE_BOOTS: 'Незеритовые ботинки',
  TURTLE_HELMET: 'Черепаший шлем',

  // Блоки / декор
  TORCH: 'Факел',
  LANTERN: 'Фонарь',
  SOUL_LANTERN: 'Душевой фонарь',
  CAMPFIRE: 'Костёр',
  SOUL_CAMPFIRE: 'Душевой костёр',
  CHEST: 'Сундук',
  ENDER_CHEST: 'Эндер-сундук',
  SHULKER_BOX: 'Шалкерный ящик',
  TNT: 'ТНТ',
  IRON_BARS: 'Железные прутья',
  CHAIN: 'Цепь',
  LEAD: 'Поводок',
  SADDLE: 'Седло',
  NAMETAG: 'Бирка с именем',
  NAME_TAG: 'Бирка с именем',
  HONEYCOMB: 'Соты',
  HONEY_BOTTLE: 'Бутылка мёда',
  HONEY_BLOCK: 'Блок мёда',
  HONEYCOMB_BLOCK: 'Блок сот',
  FIREWORK_ROCKET: 'Фейерверк',
  DIAMOND_HORSE_ARMOR: 'Алмазная броня для лошади',

  // ── Моды ────────────────────────────────────────────────────────────────────

  // Aether
  AETHER_GOLDEN_GUMMY_SWET: 'Золотая жевательная конфета',
  AETHER_IRON_BUBBLE: 'Железный пузырь',
  AETHER_VAMPIRE_BLADE: 'Клинок вампира',

  // Compat: Delightful
  COMPATDELIGHT_WARDEN_MEAT: 'Мясо Хранителя',

  // Deeper & Darker
  DEEPERDARKER_WARDEN_CARAPACE: 'Панцирь Хранителя',

  // DMR (Dragon Mounts: Remastered)
  DMR_DRAGON_ARMOR: 'Броня дракона',
  DMR_DRAGON_EGG: 'Яйцо дракона',

  // Draconic Evolution
  DRACONICEVOLUTION_MOB_SOUL: 'Душа моба',

  // Eternal Nether
  ETERNALNETHER_WITHERED_BONE: 'Иссохшая кость',

  // Ice and Fire
  ICEANDFIRE_DRAGONSCALES_BLUE: 'Синяя чешуя дракона',
  ICEANDFIRE_DRAGONSCALES_SAPPHIRE: 'Сапфировая чешуя дракона',
  ICEANDFIRE_DRAGONSCALES_RED: 'Красная чешуя дракона',
  ICEANDFIRE_DRAGONSCALES_GREEN: 'Зелёная чешуя дракона',
  ICEANDFIRE_DRAGONSCALES_BLACK: 'Чёрная чешуя дракона',
  ICEANDFIRE_DRAGONSCALES_WHITE: 'Белая чешуя дракона',
  ICEANDFIRE_DRAGONBONE: 'Кость дракона',
  ICEANDFIRE_DRAGONSTEEL_INGOT: 'Слиток драконьей стали',
  ICEANDFIRE_FIRE_DRAGON_BLOOD: 'Кровь огненного дракона',
  ICEANDFIRE_ICE_DRAGON_BLOOD: 'Кровь ледяного дракона',

  // Samurai Dynasty
  SAMURAI_DYNASTY_SPIRIT_UPGRADE_SMITHING_TEMPLATE: 'Шаблон духовного улучшения',

  // Sophisticated Backpacks
  SOPHISTICATEDBACKPACKS_BACKPACK: 'Рюкзак',
  SOPHISTICATEDBACKPACKS_COPPER_BACKPACK: 'Медный рюкзак',
  SOPHISTICATEDBACKPACKS_IRON_BACKPACK: 'Железный рюкзак',
  SOPHISTICATEDBACKPACKS_GOLD_BACKPACK: 'Золотой рюкзак',
  SOPHISTICATEDBACKPACKS_DIAMOND_BACKPACK: 'Алмазный рюкзак',
  SOPHISTICATEDBACKPACKS_NETHERITE_BACKPACK: 'Незеритовый рюкзак',
  SOPHISTICATEDBACKPACKS_JUKEBOX_UPGRADE: 'Улучшение «Проигрыватель» для рюкзака',
  SOPHISTICATEDBACKPACKS_BATTERY_UPGRADE: 'Батарейное улучшение для рюкзака',
  SOPHISTICATEDBACKPACKS_FEEDING_UPGRADE: 'Кормящее улучшение для рюкзака',
  SOPHISTICATEDBACKPACKS_FILTERING_UPGRADE: 'Фильтрующее улучшение для рюкзака',
  SOPHISTICATEDBACKPACKS_MAGNET_UPGRADE: 'Магнитное улучшение для рюкзака',
  SOPHISTICATEDBACKPACKS_STACK_UPGRADE: 'Стекирующее улучшение для рюкзака',
  SOPHISTICATEDBACKPACKS_VOID_UPGRADE: 'Пустотное улучшение для рюкзака',

  // Twilight Forest
  TWILIGHTFOREST_STEELEAF_SHOVEL: 'Лопата из стального листа',
  TWILIGHTFOREST_STEELEAF_PICKAXE: 'Кирка из стального листа',
  TWILIGHTFOREST_STEELEAF_AXE: 'Топор из стального листа',
  TWILIGHTFOREST_STEELEAF_SWORD: 'Меч из стального листа',
  TWILIGHTFOREST_KNIGHTMETAL_INGOT: 'Слиток рыцарского металла',
  TWILIGHTFOREST_FIERY_INGOT: 'Огненный слиток',
  TWILIGHTFOREST_NAGA_SCALE: 'Чешуя наги',

  // Слизь (альтернативный ID)
  SLIME_BALL: 'Слизь',

  // Незер
  ANCIENT_DEBRIS: 'Древние обломки',
  NETHER_STAR: 'Звезда незера',
  NETHERITE_UPGRADE_SMITHING_TEMPLATE: 'Шаблон незеритового улучшения',

  // Блоки и строительство
  COBBLED_DEEPSLATE: 'Булыжная глубинная сланцевая порода',
  COBBLESTONE_STAIRS: 'Булыжниковые ступени',
  STONE_BRICKS: 'Каменные кирпичи',
  STONE_SLAB: 'Каменная плита',
  BRICK_STAIRS: 'Кирпичные ступени',
  POLISHED_ANDESITE: 'Полированный андезит',
  POLISHED_ANDESITE_STAIRS: 'Ступени из полированного андезита',
  POLISHED_BLACKSTONE: 'Полированный чёрный камень',
  SANDSTONE: 'Песчаник',
  CALCITE: 'Кальцит',
  TUFF: 'Туф',
  MOSS_BLOCK: 'Мшистый блок',
  HAY_BLOCK: 'Стог сена',
  SCAFFOLDING: 'Строительные леса',
  END_STONE_BRICKS: 'Кирпичи из камня края',
  COBWEB: 'Паутина',

  // Призмарин
  PRISMARINE: 'Призмарин',
  PRISMARINE_BRICKS: 'Кирпичи призмарина',
  PRISMARINE_BRICK_STAIRS: 'Ступени из кирпичей призмарина',
  PRISMARINE_STAIRS: 'Ступени призмарина',
  DARK_PRISMARINE: 'Тёмный призмарин',
  DARK_PRISMARINE_SLAB: 'Плита тёмного призмарина',
  DARK_PRISMARINE_STAIRS: 'Ступени тёмного призмарина',
  SEA_LANTERN: 'Морской фонарь',

  // Механизмы и редстоун
  PISTON: 'Поршень',
  STICKY_PISTON: 'Липкий поршень',
  OBSERVER: 'Наблюдатель',
  HOPPER: 'Воронка',
  COMPARATOR: 'Компаратор',
  REPEATER: 'Повторитель',
  REDSTONE_LAMP: 'Лампа из красного камня',
  REDSTONE_TORCH: 'Факел из красного камня',
  TRIPWIRE_HOOK: 'Крюк растяжки',
  TARGET: 'Мишень',

  // Крафтинговые блоки
  ANVIL: 'Наковальня',
  BLAST_FURNACE: 'Доменная печь',
  BREWING_STAND: 'Стойка для зелий',
  GRINDSTONE: 'Точильный камень',
  LOOM: 'Ткацкий станок',
  SMITHING_TABLE: 'Кузнечный стол',
  LECTERN: 'Кафедра',
  BARREL: 'Бочка',
  BOOKSHELF: 'Книжная полка',
  FLOWER_POT: 'Цветочный горшок',

  // Маяк
  BEACON: 'Маяк',
  BELL: 'Колокол',

  // Сажанцы и листья
  OAK_SAPLING: 'Дубовый саженец',
  OAK_LEAVES: 'Дубовые листья',
  SPRUCE_SAPLING: 'Еловый саженец',
  CHERRY_SAPLING: 'Вишнёвый саженец',
  SPRUCE_SIGN: 'Табличка из ели',

  // Бамбук
  BAMBOO_BLOCK: 'Бамбуковый блок',
  BAMBOO_PLANKS: 'Бамбуковые доски',

  // Инструменты / разное
  SPYGLASS: 'Подзорная труба',
  ENDER_EYE: 'Глаз Эндера',
  WIND_CHARGE: 'Заряд ветра',
  BREEZE_ROD: 'Стержень ветра',
  EGG: 'Яйцо',

  // Вёдра
  AXOLOTL_BUCKET: 'Ведро с аксолотлем',
  TROPICAL_FISH_BUCKET: 'Ведро с тропической рыбой',

  // Визг (Sculk)
  SCULK: 'Визг',
  SCULK_CATALYST: 'Катализатор визга',
  SCULK_SENSOR: 'Датчик визга',
  SCULK_SHRIEKER: 'Завывалка',
  CALIBRATED_SCULK_SENSOR: 'Калиброванный датчик визга',

  // Зелья
  POTION: 'Зелье',
  SPLASH_POTION: 'Зелье-плеск',
  LINGERING_POTION: 'Зелье-туча',
  OMINOUS_BOTTLE: 'Зловещая бутылка',

  // Яйца
  SNIFFER_EGG: 'Яйцо снифера',

  // Медь
  WAXED_CUT_COPPER: 'Вощёная обрезная медь',
  WAXED_OXIDIZED_CUT_COPPER: 'Вощёная окисленная обрезная медь',
  WAXED_OXIDIZED_CUT_COPPER_SLAB: 'Плита из вощёной окисленной обрезной меди',
  WAXED_WEATHERED_CUT_COPPER: 'Вощёная состарившаяся обрезная медь',
  WAXED_WEATHERED_CUT_COPPER_SLAB: 'Плита из вощёной состарившейся обрезной меди',
  WAXED_WEATHERED_CUT_COPPER_STAIRS: 'Ступени из вощёной состарившейся обрезной меди',

  // Музыкальные диски
  MUSIC_DISC_11: 'Музыкальный диск «11»',
  MUSIC_DISC_13: 'Музыкальный диск «13»',
  MUSIC_DISC_BLOCKS: 'Музыкальный диск «Blocks»',
  MUSIC_DISC_CAT: 'Музыкальный диск «Cat»',
  MUSIC_DISC_CHIRP: 'Музыкальный диск «Chirp»',
  MUSIC_DISC_CREATOR: 'Музыкальный диск «Creator»',
  MUSIC_DISC_CREATOR_MUSIC_BOX: 'Музыкальный диск «Creator (Music Box)»',
  MUSIC_DISC_FAR: 'Музыкальный диск «Far»',
  MUSIC_DISC_MALL: 'Музыкальный диск «Mall»',
  MUSIC_DISC_MELLOHI: 'Музыкальный диск «Mellohi»',
  MUSIC_DISC_OTHERSIDE: 'Музыкальный диск «Otherside»',
  MUSIC_DISC_PIGSTEP: 'Музыкальный диск «Pigstep»',
  MUSIC_DISC_PRECIPICE: 'Музыкальный диск «Precipice»',
  MUSIC_DISC_RELIC: 'Музыкальный диск «Relic»',
  MUSIC_DISC_STAL: 'Музыкальный диск «Stal»',
  MUSIC_DISC_STRAD: 'Музыкальный диск «Strad»',
  MUSIC_DISC_WAIT: 'Музыкальный диск «Wait»',
  MUSIC_DISC_WARD: 'Музыкальный диск «Ward»',

  // Искажённое (Warped)
  WARPED_FUNGUS: 'Искажённый гриб',

  // Паттерны для знамён
  FLOW_BANNER_PATTERN: 'Узор для знамени «Поток»',
  GUSTER_BANNER_PATTERN: 'Узор для знамени «Буря»',

  // Черепки
  GUSTER_POTTERY_SHERD: 'Черепок «Буря»',

  // Шаблоны для кузнечного стола (armor trims)
  COAST_ARMOR_TRIM_SMITHING_TEMPLATE: 'Шаблон «Побережье»',
  DUNE_ARMOR_TRIM_SMITHING_TEMPLATE: 'Шаблон «Дюна»',
  EYE_ARMOR_TRIM_SMITHING_TEMPLATE: 'Шаблон «Глаз»',
  FLOW_ARMOR_TRIM_SMITHING_TEMPLATE: 'Шаблон «Поток»',
  HOST_ARMOR_TRIM_SMITHING_TEMPLATE: 'Шаблон «Хозяин»',
  RAISER_ARMOR_TRIM_SMITHING_TEMPLATE: 'Шаблон «Подъём»',
  RIB_ARMOR_TRIM_SMITHING_TEMPLATE: 'Шаблон «Ребро»',
  SENTRY_ARMOR_TRIM_SMITHING_TEMPLATE: 'Шаблон «Страж»',
  SHAPER_ARMOR_TRIM_SMITHING_TEMPLATE: 'Шаблон «Ваятель»',
  SILENCE_ARMOR_TRIM_SMITHING_TEMPLATE: 'Шаблон «Тишина»',
  SNOUT_ARMOR_TRIM_SMITHING_TEMPLATE: 'Шаблон «Рыло»',
  SPIRE_ARMOR_TRIM_SMITHING_TEMPLATE: 'Шаблон «Шпиль»',
  TIDE_ARMOR_TRIM_SMITHING_TEMPLATE: 'Шаблон «Прилив»',
  VEX_ARMOR_TRIM_SMITHING_TEMPLATE: 'Шаблон «Вэкс»',
  WARD_ARMOR_TRIM_SMITHING_TEMPLATE: 'Шаблон «Защита»',
  WAYFINDER_ARMOR_TRIM_SMITHING_TEMPLATE: 'Шаблон «Первопроходец»',
  WILD_ARMOR_TRIM_SMITHING_TEMPLATE: 'Шаблон «Дикий»',
  BOLT_ARMOR_TRIM_SMITHING_TEMPLATE: 'Шаблон «Молния»',
  NETHERITE_UPGRADE_SMITHING_TEMPLATE: 'Шаблон незеритового улучшения',

  // Прочие ванильные
  ANCIENT_DEBRIS: 'Древние обломки',
  CLAY: 'Глина',
  END_ROD: 'Жезл Края',
  GLOWSTONE_DUST: 'Светокаменная пыль',
  GOLDEN_CARROT: 'Золотая морковь',
  MAGMA_BLOCK: 'Блок магмы',
  WHITE_CONCRETE: 'Белый бетон',
  SKULL_BANNER_PATTERN: 'Узор для знамени «Череп»',

  // Предметы и блоки без перевода (добавлено)
  BLACKSTONE_SLAB: 'Плита из чёрного камня',
  BRUSH: 'Кисть',
  CHORUS_FLOWER: 'Цветок хора',
  COD_BUCKET: 'Ведро с треской',
  COMPOSTER: 'Компостер',
  CRAFTER: 'Крафтер',
  DARK_OAK_WOOD: 'Брус тёмного дуба',
  DEEPSLATE: 'Сланец',
  DISPENSER: 'Раздатчик',
  GLOW_LICHEN: 'Светящийся лишайник',
  GOAT_HORN: 'Рог козла',
  JUKEBOX: 'Музыкальный ящик',
  LEVER: 'Рычаг',
  MANGROVE_STAIRS: 'Ступени из мангрового дерева',
  MAP: 'Карта',
  NOTE_BLOCK: 'Нотный блок',
  PEARLESCENT_FROGLIGHT: 'Жемчужный лягушачий фонарь',
  POLISHED_BLACKSTONE_STAIRS: 'Ступени из полированного чёрного камня',
  POLISHED_DIORITE_STAIRS: 'Ступени из полированного диорита',
  QUARTZ_BRICKS: 'Кварцевые кирпичи',
  QUARTZ_SLAB: 'Кварцевая плита',
  QUARTZ_STAIRS: 'Кварцевые ступени',
  RED_NETHER_BRICKS: 'Красный адский кирпич',
  ROOTED_DIRT: 'Дерновая земля',
  SALMON_BUCKET: 'Ведро с лососем',
  SANDSTONE_SLAB: 'Плита из песчаника',
  SANDSTONE_STAIRS: 'Ступени из песчаника',
  SHROOMLIGHT: 'Светогриб',
  SLIME_BLOCK: 'Блок слизи',
  SMOKER: 'Коптильня',
  SMOOTH_SANDSTONE: 'Гладкий песчаник',
  SNOW: 'Снег',
  STONE_BRICK_STAIRS: 'Ступени из каменных кирпичей',
  STONE_BUTTON: 'Каменная кнопка',
  STONECUTTER: 'Камнерез',
}

export function getMaterialName(material) {
  if (!material) return 'Предмет'
  const key = String(material).toUpperCase().trim()
  return NAMES[key] || _resolveSpecial(key) || _fallback(key)
}

export function getRussianMaterialName(material) {
  if (!material) return null
  const key = String(material).toUpperCase().trim()
  return NAMES[key] || _resolveSpecial(key) || null
}

function _fallback(key) {
  return key
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b[а-яa-z]/g, (c) => c.toUpperCase())
}
