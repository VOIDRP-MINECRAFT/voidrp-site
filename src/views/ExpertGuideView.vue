<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { siteConfig } from '../config.site'
import { usePageMeta } from '../composables/usePageMeta.js'

usePageMeta({
  title: 'Гайд сборки',
  description: 'Полный гайд по сборке модов VoidRP — как прогрессировать, что крафтить, как работают механики. Всё для новичков и опытных игроков.',
  url: 'https://void-rp.ru/guide',
  breadcrumbs: [
    { name: 'Главная', url: '/' },
    { name: 'Гайд' },
  ],
})

const CHECK_STORAGE_KEY = 'voidrp-expert-progression-guide-v1'

const checked = ref({})

const introCards = [
  { label: 'Сборка', title: 'FTB Evolution', text: 'Технологическая сборка: развивайся от первых механизмов Create через Mekanism и AE2 до энергетики Draconic Evolution и эндгейм-компонентов Эволюции.', icon: '🧬' },
  { label: 'Навыки', title: 'Прокачка персонажа', text: 'Система навыков Puffish: Магия, Ближний и Дальний бой, Атлетика, Добыча и Защита. Вкладывай очки и открывай пассивки под свой стиль.', icon: '⭐' },
  { label: 'Финальная цель', title: 'Достичь вершины', text: 'Абсолютная сингулярность, Эволюционный арканум и Воплощённое трансцендентство — вершина сборки через Create, Mekanism, AE2, IE и Draconic.', icon: '🏆' },
]

const routeSteps = [
  'Выживание + Farmer\'s Delight',
  'Create / первая механика',
  'Immersive Engineering / сталь',
  'Mekanism / энергия',
  'AE2 / хранение и автокрафт',
  'Industrial Foregoing / фермы',
  'Cataclysm / боссы',
  'Draconic Evolution',
  'Эволюция / эндгейм',
]

const stages = [
  {
    id: 'survival',
    number: '01',
    title: 'Базовое выживание',
    tags: ['Farmer\'s Delight', 'рюкзаки', 'Waystones'],
    goal: 'Обустроить базу, наладить еду и хранение, заклеймить территорию через FTB Chunks и подготовить ресурсы под Create.',
    unlocks: [
      'Рюкзаки Sophisticated Backpacks с апгрейдами',
      'Камни Waystones для быстрых перемещений',
      'Железо, медь, цинк и редстоун под первые механизмы',
    ],
    checks: [
      'Есть безопасная база и стабильная еда',
      'Заклеймлена территория через FTB Chunks',
      'Собраны ресурсы под первые механизмы Create',
    ],
  },
  {
    id: 'create',
    number: '02',
    title: 'Create — первая механика',
    tags: ['Create', 'автоматизация', 'механизмы'],
    goal: 'Построить первые кинетические линии: пресс, миксер, деплоер и дробильные колёса.',
    unlocks: [
      'Андезитовый сплав, валы и шестерни',
      'Механический пресс, миксер, установщик',
      'Первые автоматические линии обработки',
    ],
    checks: [
      'Работает линия с механическим прессом',
      'Собраны миксер и установщик',
      'Есть стабильный источник вращения',
    ],
  },
  {
    id: 'steel',
    number: '03',
    title: 'Immersive Engineering — сталь',
    tags: ['Immersive Engineering', 'сталь', 'провода'],
    goal: 'Наладить производство стали — обязательного материала для Mekanism и большинства машин средней игры.',
    unlocks: [
      'Коксовая печь и доменная печь',
      'Сталь, металлический пресс, дробилка',
      'Провода и первая передача энергии',
    ],
    checks: [
      'Работает доменная печь и идёт сталь',
      'Собран металлический пресс',
      'Настроена базовая передача энергии',
    ],
  },
  {
    id: 'mekanism',
    number: '04',
    title: 'Mekanism — энергия и переработка',
    tags: ['Mekanism', 'энергия', '5× руда'],
    goal: 'Запустить энергосеть и умножение руды 3–5×, открыть базовые машины и хранилища энергии.',
    unlocks: [
      'Металлургический инфузер, стальной корпус',
      'Обогащение руды (2×–5×)',
      'Энергетические кубы и генераторы',
    ],
    checks: [
      'Работает умножение руды',
      'Есть стабильный источник энергии',
      'Собран стальной корпус и базовые схемы',
    ],
  },
  {
    id: 'ae2',
    number: '05',
    title: 'AE2 — хранение и автокрафт',
    tags: ['Applied Energistics 2', 'хранение', 'автокрафт'],
    goal: 'Перейти от сундуков к ME-сети с цифровым хранением и автоматическим крафтом по запросу.',
    unlocks: [
      'Процессоры, контроллёр, ячейки хранения',
      'Молекулярный сборщик и поставщики шаблонов',
      'Автокрафт по запросу',
    ],
    checks: [
      'ME-сеть работает стабильно',
      'Настроен автокрафт через сборщики',
      'Основные ресурсы заведены в сеть',
    ],
  },
  {
    id: 'automation',
    number: '06',
    title: 'Industrial Foregoing — фермы',
    tags: ['Industrial Foregoing', 'фермы', 'ресурсы'],
    goal: 'Автоматизировать растения, мобов и добычу ресурсов для позднего потребления.',
    unlocks: [
      'Сеятель и сборщик растений',
      'Дробилка мобов, пластик, жидкостные машины',
      'Лазерный бур и ресурсные линии',
    ],
    checks: [
      'Запущены фермы растений или мобов',
      'Налажено производство пластика',
      'Готова ресурсная база под боссов',
    ],
  },
  {
    id: 'bosses',
    number: '07',
    title: 'Cataclysm — боссы',
    tags: ['L_Ender\'s Cataclysm', 'боссы', 'добыча'],
    goal: 'Победить боссов Cataclysm и собрать уникальную добычу для позднего снаряжения и компонентов Draconic.',
    unlocks: [
      'Игнис, Левиафан, Харбингер и их дроп',
      'Мощное оружие и броня',
      'Компоненты под Draconic Evolution',
    ],
    checks: [
      'Готово снаряжение и расходники под боссов',
      'Побеждён хотя бы один босс Cataclysm',
      'Собрана нужная добыча',
    ],
  },
  {
    id: 'draconic',
    number: '08',
    title: 'Draconic Evolution',
    tags: ['Draconic Evolution', 'энергия', 'ядра'],
    goal: 'Выйти на сверхэнергетику: дракониевые ядра, крафт слияния (fusion) и огромное хранение энергии.',
    unlocks: [
      'Ядро виверны и пробуждённое ядро',
      'Инжекторы слияния и энергоядро',
      'Дракониевые инструменты и броня',
    ],
    checks: [
      'Собрано ядро виверны',
      'Работает крафт слияния (fusion)',
      'Есть большое хранилище энергии',
    ],
  },
  {
    id: 'endgame',
    number: '09',
    title: 'Эволюция — эндгейм',
    tags: ['FTB Evolution', 'эндгейм', 'вершина'],
    goal: 'Собрать эксклюзивные компоненты Эволюции — вершину сборки, доступную в магазине и Battle Pass.',
    unlocks: [
      'Эволюционная материя и первородная эссенция',
      'Абсолютная сингулярность, Эволюционный арканум',
      'Воплощённое трансцендентство — апекс сборки',
    ],
    checks: [
      'Автоматизированы дорогие промежуточные компоненты',
      'Получен первый эндгейм-предмет Эволюции',
      'Достигнута вершина прогрессии',
    ],
  },
]

const crossLinks = [
  ['Farmer\'s Delight', 'еда, комфортный старт, рюкзаки', 'подготовку к Create'],
  ['Create', 'механическая обработка и первые механизмы', 'ресурсы и рамки для IE и Mekanism'],
  ['Immersive Engineering', 'сталь, провода, тяжёлая промышленность', 'Mekanism и машины средней игры'],
  ['Mekanism', 'энергия, умножение руды, схемы', 'AE2, Industrial Foregoing, Draconic'],
  ['Applied Energistics 2', 'хранение, процессоры, автокрафт', 'массовую автоматизацию'],
  ['Industrial Foregoing', 'фермы, пластик, ресурсы', 'снаряжение под боссов'],
  ['L_Ender\'s Cataclysm', 'боссы и уникальная добыча', 'Draconic Evolution'],
  ['Draconic Evolution', 'сверхэнергия и ядра', 'эндгейм Эволюции'],
]

const tips = [
  { title: 'Не уходи в один мод', text: 'Держи несколько целей одновременно: еда, хранение, Create, сталь и энергия.' },
  { title: 'Сталь — ключевой мост', text: 'Immersive Engineering нужен для Mekanism и почти всех машин средней игры — не откладывай доменную печь.' },
  { title: 'Автоматизируй рано', text: 'Первые линии Create строй сразу, а к AE2 переходи, как только появятся процессоры.' },
  { title: 'Качай навыки', text: 'Вкладывай очки Puffish Skills под свой стиль. Ошибся веткой — купи Сигил сброса в магазине или получи в Battle Pass.' },
]

const tierGates = [
  { epoch: 'Магия',        item: 'Заклинания, мана и магический урон',     id: 'skill:magic',     mod: 'Puffish Skills', color: '#a78bfa' },
  { epoch: 'Ближний бой',  item: 'Урон и выживаемость в рукопашной',       id: 'skill:melee',     mod: 'Puffish Skills', color: '#f87171' },
  { epoch: 'Дальний бой',  item: 'Луки, арбалеты и точность',             id: 'skill:ranged',    mod: 'Puffish Skills', color: '#34d399' },
  { epoch: 'Атлетика',     item: 'Скорость, прыжок и выносливость',        id: 'skill:athletics', mod: 'Puffish Skills', color: '#38bdf8' },
  { epoch: 'Добыча',       item: 'Скорость копания и бонусы к руде',       id: 'skill:mining',    mod: 'Puffish Skills', color: '#fbbf24' },
  { epoch: 'Защита',       item: 'Броня, сопротивление и здоровье',        id: 'skill:defense',   mod: 'Puffish Skills', color: '#fb923c' },
]

const farmRules = [
  {
    icon: '🔦',
    color: '#22c55e',
    title: 'Рычаг — обязателен',
    text: 'Каждая ферма мобов должна иметь рычаг (или кнопку) для полного отключения спавна. Уходя от спавнера — выключай ферму.',
    type: 'required',
  },
  {
    icon: '⚔️',
    color: '#f59e0b',
    title: 'Молотилка — обязательна',
    text: 'Механизм убийства мобов должен работать постоянно пока ферма активна. Моб обязан погибнуть — не залежаться живым рядом со спавнером.',
    type: 'required',
  },
  {
    icon: '💀',
    color: '#ef4444',
    title: 'Нарушение = снос спавнера',
    text: 'Если мобы спавнятся неконтролируемо и не умирают — это прямая нагрузка на сервер. Администратор сломает спавнер без предупреждения.',
    type: 'warning',
  },
]

const regionLimits = [
  { label: 'Приватных чанков', value: '100', hint: '1 чанк = 16×16 блоков' },
  { label: 'Force-load чанков', value: '25', hint: 'грузятся даже без игроков' },
  { label: 'Домов (/sethome)', value: '2', hint: 'на аккаунт' },
]

const regionCommands = [
  { cmd: 'Миникарта', desc: 'В углу экрана — карта FTB Chunks с сеткой чанков' },
  { cmd: 'Клавиша карты', desc: 'Открыть большую карту претензий (забинди в «Управление» → FTB Chunks)' },
  { cmd: 'ЛКМ по чанку', desc: 'Заклеймить чанк — приват, защита от чужих' },
  { cmd: 'ПКМ по чанку', desc: 'Снять клейм с чанка' },
  { cmd: 'Shift + ЛКМ', desc: 'Force-load: чанк работает, даже когда тебя нет рядом' },
  { cmd: '/ftbteams party create <имя>', desc: 'Создать команду — общий доступ к приватам' },
  { cmd: '/ftbteams party invite <игрок>', desc: 'Пригласить игрока в свою команду' },
  { cmd: 'Настройки команды', desc: 'В GUI команды — права союзников и PvP в приватах' },
]

const serverCommands = [
  { cmd: '/sethome <название>', desc: 'Поставить точку дома (лимит: 2)' },
  { cmd: '/home <название>', desc: 'Телепортироваться домой' },
  { cmd: '/homes', desc: 'Список всех своих домов' },
  { cmd: '/delhome <название>', desc: 'Удалить точку дома' },
  { cmd: '/spawn', desc: 'Телепортироваться на спавн сервера' },
  { cmd: '/tpa <игрок>', desc: 'Запросить телепортацию к игроку' },
  { cmd: '/tpahere <игрок>', desc: 'Позвать игрока к себе' },
  { cmd: '/tpaccept', desc: 'Принять запрос телепортации' },
  { cmd: '/tpdeny', desc: 'Отклонить запрос телепортации' },
]

const nationMemberCommands = [
  { cmd: '/nationtreasury', desc: 'Баланс казны, территория и престиж государства (алиас: /ntreasury)' },
  { cmd: '/nationtreasuryhistory', desc: 'Последние 5 операций с казной (алиас: /ntreasuryhistory)' },
  { cmd: '/nationdonate <сумма> [комментарий]', desc: 'Задонатить деньги в казну своего государства (алиас: /ndonate)' },
  { cmd: '/marketprice [предмет]', desc: 'Рыночная цена предмета в руке или по названию (алиас: /mprice, /price)' },
  { cmd: '/nmarket', desc: 'Открыть рынок государств в GUI (алиас: /nm, /nationmarket)' },
]

const nationOfficerCommands = [
  { cmd: '/nationwithdraw <сумма> [комментарий]', desc: 'Снять деньги из казны на свой баланс (алиас: /nwithdraw)' },
  { cmd: '/nmarket sell <кол-во|all> <цена>', desc: 'Выставить предмет из руки на рынок своего государства' },
  { cmd: '/nmarket listings', desc: 'Список активных лотов своего государства' },
  { cmd: '/nmarket cancel <id>', desc: 'Снять лот с рынка и вернуть предметы' },
  { cmd: '/nmarket confirm', desc: 'Подтвердить выставление лота с нестандартной ценой' },
  { cmd: '/nsetcapital', desc: 'Установить столицу в текущей позиции — только для главы государства' },
  { cmd: 'Сайт → Студия → Участники', desc: 'Выдать звание (титул) участнику: офицер — рядовым, глава — всем. Отображается в чате.', web: true },
]

const modCategories = [
  {
    name: 'Технологии',
    color: 'blue',
    mods: [
      { name: 'Create', key: 'Шестерни, пресс, миксер, deployer, конвейер, каретки', note: 'Старт техно-прогрессии' },
      { name: 'Immersive Engineering', key: 'Коксовая печь, доменная печь, сталь, металлический пресс', note: 'Единственный источник стали' },
      { name: 'Mekanism', key: '2–5× обогащение руды, цифровой шахтёр, телепортер, генераторы', note: 'Главная энергосеть' },
      { name: 'Applied Energistics 2', key: 'ME-сеть, ячейки хранения, процессоры, молекулярный сборщик', note: 'Автокрафт и хранение' },
      { name: 'Industrial Foregoing', key: 'Фермы растений и мобов, лазерный бур, пластик, жидкостные машины', note: 'Автоматизация ресурсов' },
    ],
  },
  {
    name: 'Навыки и RPG',
    color: 'purple',
    mods: [
      { name: 'Puffish Skills', key: 'Дерево навыков: Магия, Ближний/Дальний бой, Атлетика, Добыча, Защита', note: 'Прокачка персонажа за очки' },
      { name: 'Puffish Attributes', key: 'Расширенные атрибуты под навыки и снаряжение', note: 'Основа RPG-системы' },
      { name: 'Сигилы сброса', key: 'Обнуляют выбранную ветку навыков — продаются в магазине и падают в Battle Pass', note: 'Передумал — сбрось ветку' },
    ],
  },
  {
    name: 'Боссы и эндгейм',
    color: 'red',
    mods: [
      { name: "L_Ender's Cataclysm", key: 'Игнис, Левиафан, Сцилла, Харбингер — боссы с уникальным дропом', note: 'Ключ к позднему снаряжению' },
      { name: 'Draconic Evolution', key: 'Дракониевые ядра, крафт слияния, реактор, огромное хранение энергии', note: 'Сверхэнергетика' },
      { name: 'Эволюция (FTB Evolution)', key: 'Эксклюзивные компоненты: сингулярность, арканум, трансцендентство', note: 'Вершина сборки' },
    ],
  },
  {
    name: 'Комфорт и хранение',
    color: 'green',
    mods: [
      { name: 'Sophisticated Backpacks', key: 'Рюкзаки с апгрейдами: авто-подбор, сортировка, компактное хранение', note: 'Нужен с первых минут' },
      { name: 'Farmer\'s Delight', key: 'Готовка, блюда, урожай и комфортная еда на старте', note: 'Стабильная еда' },
      { name: 'Supplementaries', key: 'Верёвки, флаги, фонари, доски объявлений, декор', note: 'Декор и утилити' },
      { name: 'Waystones', key: 'Камни путешественника — телепортация между точками, бесплатная на спавн', note: 'Основной транспорт' },
    ],
  },
]

// ── Economy & Market ──
const marketStats = [
  { label: 'Комиссия продавца', value: '2%', hint: 'идёт в казну государства' },
  { label: 'Premium BP комиссия', value: '1%', hint: 'нужен Battle Pass Premium' },
  { label: 'Сбор налога', value: 'раз в неделю', hint: 'прогрессивные ставки' },
  { label: 'Налог на казну', value: '5% / неделя', hint: 'для государственных казн' },
]

const marketCommands = [
  { cmd: '/shop', desc: 'Открыть GUI игрового рынка' },
  { cmd: '/pm sell <кол-во|all> <цена>', desc: 'Выставить ордер на продажу (предмет из руки)' },
  { cmd: '/pm buy <item_key> <кол-во> <цена>', desc: 'Выставить ордер на покупку по ключу предмета' },
  { cmd: '/pm orders', desc: 'Открыть GUI своих ордеров' },
  { cmd: '/pm pickup', desc: 'Забрать незабранные предметы и деньги после сделок' },
  { cmd: '/pm cancel sell|buy <id>', desc: 'Отменить ордер и вернуть предметы / деньги' },
  { cmd: '/pm confirm', desc: 'Подтвердить ожидающее действие' },
  { cmd: '/marketprice', desc: 'Цена предмета в руке (алиасы: /mprice, /price)' },
]

const potionKeys = [
  { key: 'potion:night_vision', name: 'Ночное зрение' },
  { key: 'potion:speed', name: 'Скорость' },
  { key: 'potion:strength', name: 'Сила' },
  { key: 'potion:healing', name: 'Мгновенное лечение' },
  { key: 'potion:regeneration', name: 'Регенерация' },
  { key: 'potion:fire_resistance', name: 'Огнестойкость' },
  { key: 'potion:water_breathing', name: 'Дыхание под водой' },
  { key: 'potion:invisibility', name: 'Невидимость' },
  { key: 'potion:leaping', name: 'Прыжок' },
  { key: 'potion:slow_falling', name: 'Медленное падение' },
  { key: 'splash_potion:night_vision', name: 'Бросаемое: ночное зрение' },
  { key: 'splash_potion:healing', name: 'Бросаемое: лечение' },
  { key: 'splash_potion:strength', name: 'Бросаемое: сила' },
  { key: 'lingering_potion:regeneration', name: 'Оседающее: регенерация' },
]

const wealthTaxTiers = [
  { range: '0 – 100 000₽', rate: '0%', color: '#22c55e' },
  { range: '100 000 – 500 000₽', rate: '2%', color: '#f59e0b' },
  { range: '500 000 – 2 000 000₽', rate: '5%', color: '#f97316' },
  { range: '2 000 000₽ и выше', rate: '10%', color: '#ef4444' },
]

// ── Daily Quests ──
const dailyQuestCommands = [
  { cmd: '/dq', desc: 'Открыть 3 ежедневных квеста (обновляются каждый день в полночь)' },
  { cmd: '/bq', desc: 'Испытание Героя — 1 сложный квест на 3 дня, +2000 XP Battle Pass при выполнении' },
  { cmd: '/delivery', desc: 'Задание Торговца Артефактами — принести особые предметы, +3000 XP Battle Pass' },
  { cmd: '/questtrack', desc: 'Закрепить / открепить активный квест в углу экрана' },
]

const dailyQuestTypes = [
  { icon: '⚔️', name: 'Убийство', desc: 'Убить определённых мобов' },
  { icon: '⛏️', name: 'Добыча', desc: 'Добыть нужное количество блоков' },
  { icon: '📦', name: 'Сбор', desc: 'Собрать определённые предметы' },
  { icon: '🎣', name: 'Рыбалка', desc: 'Поймать рыбу удочкой' },
  { icon: '🐄', name: 'Разведение', desc: 'Разводить животных' },
  { icon: '🔨', name: 'Крафт', desc: 'Скрафтить предметы' },
  { icon: '💰', name: 'Продажа рынка', desc: 'Продать предметы через /shop или /pm sell' },
  { icon: '🛒', name: 'Покупка рынка', desc: 'Купить предметы через /shop или /pm buy' },
  { icon: '⭐', name: 'ModSell', desc: 'Продать модовые предметы через /modsell' },
]

// ── Battle Pass ──
const bpXpSources = [
  { source: 'Ванильный босс (Визер, Дракон, Древний страж)', xp: '+500 XP' },
  { source: 'Модовый босс (Cataclysm и др.)', xp: '+150 XP' },
  { source: 'Обычный моб', xp: '+3 XP' },
  { source: 'Рыночная сделка', xp: 'до +150 XP' },
  { source: 'Достижение', xp: '+100 XP' },
  { source: 'Квест Battle Pass выполнен', xp: '+400–1000 XP' },
  { source: 'Ежедневный квест (/dq) выполнен', xp: '+600 XP' },
  { source: 'Испытание Героя (/bq) выполнено', xp: '+2 000 XP' },
  { source: 'Задание Торговца (/delivery) выполнено', xp: '+3 000 XP' },
]

// ── ModSell ──
const modSellCommands = [
  { cmd: '/modsell [кол-во]', desc: 'Продать модовый предмет из руки (алиас: /мпродать)' },
  { cmd: '/msellall', desc: 'Продать все подходящие предметы из инвентаря (алиас: /мпродатьвсё)' },
  { cmd: '/msellinfo', desc: 'Узнать цену предмета в руке (алиас: /мценник)' },
]

const totalChecks = computed(() => stages.reduce((sum, stage) => sum + stage.checks.length, 0))
const completedChecks = computed(() => Object.values(checked.value).filter(Boolean).length)
const completionPercent = computed(() => {
  if (!totalChecks.value) return 0
  return Math.round((completedChecks.value / totalChecks.value) * 100)
})

function checkKey(stage, index) { return `${stage.id}-${index}` }
function resetProgress() { checked.value = {} }

onMounted(() => {
  try {
    const raw = window.localStorage.getItem(CHECK_STORAGE_KEY)
    checked.value = raw ? JSON.parse(raw) || {} : {}
  } catch {
    checked.value = {}
  }
})

watch(checked, (value) => {
  try { window.localStorage.setItem(CHECK_STORAGE_KEY, JSON.stringify(value)) }
  catch { /* private mode — progress won't be saved */ }
}, { deep: true })
</script>

<template>
  <section class="gp py-3 md:py-4">
    <div class="container-shell max-w-[1380px] space-y-3">

      <!-- ─── HEADER ─── -->
      <header class="gp-header">
        <div class="gp-header__left">
          <p class="gp-eyebrow">Гайд · VoidRP Expert</p>
          <h1 class="gp-h1">Progression Rebuild</h1>
          <p class="gp-desc">
            Полное прохождение сборки FTB Evolution для Minecraft {{ siteConfig.serverVersion }}:
            от базового выживания до Draconic Evolution и эндгейм-компонентов Эволюции.
          </p>
          <div class="gp-header__actions">
            <RouterLink to="/download-launcher" class="btn btn-primary btn-sm">Скачать лаунчер</RouterLink>
            <RouterLink to="/links" class="btn btn-outline btn-sm">Ссылки</RouterLink>
            <button type="button" class="btn btn-ghost btn-sm" @click="resetProgress">Сбросить прогресс</button>
          </div>
        </div>

        <div class="gp-progress">
          <div class="gp-progress__top">
            <span class="gp-progress__label">Прогресс гайда</span>
            <span class="gp-progress__fraction">{{ completedChecks }}/{{ totalChecks }}</span>
          </div>
          <div class="gp-progress__num">{{ completionPercent }}%</div>
          <div class="gp-progress__bar-track">
            <div class="gp-progress__bar-fill" :style="{ width: `${completionPercent}%` }"></div>
          </div>
          <p class="gp-progress__hint">Отмечай этапы — прогресс сохраняется в браузере</p>
        </div>
      </header>

      <!-- ─── INTRO CARDS ─── -->
      <div class="gp-intro-grid">
        <div v-for="card in introCards" :key="card.title" class="gp-intro-card">
          <span class="gp-intro-icon">{{ card.icon }}</span>
          <div>
            <p class="gp-intro-label">{{ card.label }}</p>
            <h3 class="gp-intro-title">{{ card.title }}</h3>
            <p class="gp-intro-text">{{ card.text }}</p>
          </div>
        </div>
      </div>

      <!-- ─── MAIN: sidebar + stages ─── -->
      <div class="gp-layout">

        <!-- sticky nav -->
        <aside class="gp-nav surface-card">
          <p class="gp-nav__label">Маршрут</p>
          <nav class="gp-nav__list">
            <a v-for="stage in stages" :key="stage.id" :href="`#${stage.id}`" class="gp-nav-link">
              <span class="gp-nav-link__num">{{ stage.number }}</span>
              <span class="gp-nav-link__title">{{ stage.title }}</span>
            </a>
          </nav>

          <div class="gp-nav__route">
            <p class="gp-nav__label" style="margin-top:.75rem">Прогрессия</p>
            <ol class="gp-route">
              <li v-for="(step, i) in routeSteps" :key="step">
                <span>{{ i + 1 }}</span>{{ step }}
              </li>
            </ol>
          </div>
        </aside>

        <!-- stages -->
        <div class="gp-stages">
          <article v-for="stage in stages" :id="stage.id" :key="stage.id" class="surface-card gp-stage">
            <div class="gp-stage__header">
              <div>
                <div class="gp-stage__num">Этап {{ stage.number }}</div>
                <h2 class="gp-stage__title">{{ stage.title }}</h2>
                <p class="gp-stage__goal">{{ stage.goal }}</p>
              </div>
              <div class="gp-tags">
                <span v-for="tag in stage.tags" :key="tag" class="gp-tag">{{ tag }}</span>
              </div>
            </div>

            <div class="gp-stage__body">
              <div class="gp-list-block">
                <p class="gp-list-label">Что открывает</p>
                <ul class="gp-unlocks">
                  <li v-for="item in stage.unlocks" :key="item">
                    <span class="gp-diamond">◆</span>{{ item }}
                  </li>
                </ul>
              </div>

              <div class="gp-list-block">
                <p class="gp-list-label">Чеклист</p>
                <div class="gp-checklist">
                  <label v-for="(item, index) in stage.checks" :key="item" class="gp-check" :class="{ done: checked[checkKey(stage, index)] }">
                    <input v-model="checked[checkKey(stage, index)]" type="checkbox" />
                    <span>{{ item }}</span>
                  </label>
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>

      <!-- ─── CROSS-LINKS TABLE ─── -->
      <div class="surface-card gp-card">
        <h2 class="gp-section-title">Связи модов — почему нельзя пропускать ветки</h2>
        <div class="gp-table-wrap">
          <table class="gp-table">
            <thead>
              <tr>
                <th>Мод / этап</th>
                <th>Что даёт</th>
                <th>Что открывает</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in crossLinks" :key="row[0]">
                <td><strong>{{ row[0] }}</strong></td>
                <td>{{ row[1] }}</td>
                <td>{{ row[2] }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ─── TIPS ─── -->
      <div class="surface-card gp-card">
        <h2 class="gp-section-title">Как проходить без лишней боли</h2>
        <div class="gp-tips-grid">
          <div v-for="tip in tips" :key="tip.title" class="gp-tip">
            <strong>{{ tip.title }}</strong>
            <small>{{ tip.text }}</small>
          </div>
        </div>
      </div>

      <!-- ─── TIER GATES ─── -->
      <div class="surface-card gp-card">
        <h2 class="gp-section-title">Навыки персонажа (Puffish Skills)</h2>
        <p class="gp-tier-hint">За игру ты получаешь очки навыков и вкладываешь их в 6 веток. Открой дерево навыков клавишей (по умолчанию <code class="gp-cmd" style="display:inline">K</code>). Передумал — купи Сигил сброса ветки в магазине или получи его в Battle Pass.</p>
        <div class="gp-tier-grid">
          <div v-for="gate in tierGates" :key="gate.id" class="gp-tier-card">
            <div class="gp-tier-card__dot" :style="{ background: gate.color }"></div>
            <div class="gp-tier-card__body">
              <p class="gp-tier-epoch" :style="{ color: gate.color }">{{ gate.epoch }}</p>
              <p class="gp-tier-item">{{ gate.item }}</p>
              <span class="gp-tier-mod">{{ gate.mod }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ─── MOB FARM RULES ─── -->
      <div class="surface-card gp-card">
        <h2 class="gp-section-title">Правила для ферм мобов</h2>
        <p class="gp-farm-intro">
          Фермы мобов создают нагрузку на сервер. Несоблюдение правил — причина для административного вмешательства без предупреждения.
        </p>
        <div class="gp-farm-rules">
          <div
            v-for="rule in farmRules"
            :key="rule.title"
            class="gp-farm-rule"
            :class="'gp-farm-rule--' + rule.type"
          >
            <div class="gp-farm-rule__icon">{{ rule.icon }}</div>
            <div class="gp-farm-rule__body">
              <strong class="gp-farm-rule__title" :style="{ color: rule.color }">{{ rule.title }}</strong>
              <p class="gp-farm-rule__text">{{ rule.text }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- ─── SERVER COMMANDS ─── -->
      <div class="surface-card gp-card">
        <h2 class="gp-section-title">Команды сервера</h2>

        <!-- Limits row -->
        <div class="gp-limits-row">
          <div v-for="lim in regionLimits" :key="lim.label" class="gp-limit-chip">
            <span class="gp-limit-label">{{ lim.label }}</span>
            <span class="gp-limit-value">{{ lim.value }}</span>
            <span class="gp-limit-hint">{{ lim.hint }}</span>
          </div>
        </div>

        <div class="gp-cmds-grid">
          <!-- Privat -->
          <div class="gp-cmd-block">
            <p class="gp-cmd-block__title">
              <span class="gp-cmd-block__dot" style="background:#8b5cf6"></span>
              Приваты (FTB Chunks)
            </p>
            <p class="gp-cmd-block__note">Приваты ставятся по карте: открой карту FTB Chunks и кликай по клеткам-чанкам. Союзники добавляются через команду (FTB Teams).</p>
            <div class="gp-cmd-list">
              <div v-for="row in regionCommands" :key="row.cmd" class="gp-cmd-row">
                <code class="gp-cmd">{{ row.cmd }}</code>
                <span class="gp-cmd-desc">{{ row.desc }}</span>
              </div>
            </div>
          </div>

          <!-- Homes & Spawn -->
          <div class="gp-cmd-block">
            <p class="gp-cmd-block__title">
              <span class="gp-cmd-block__dot" style="background:#22c55e"></span>
              Дома и телепортация
            </p>
            <p class="gp-cmd-block__note">Лимит домов — 2. Команда /back на сервере отключена.</p>
            <div class="gp-cmd-list">
              <div v-for="row in serverCommands" :key="row.cmd" class="gp-cmd-row">
                <code class="gp-cmd">{{ row.cmd }}</code>
                <span class="gp-cmd-desc">{{ row.desc }}</span>
              </div>
            </div>
          </div>

          <!-- Nation member commands -->
          <div class="gp-cmd-block">
            <p class="gp-cmd-block__title">
              <span class="gp-cmd-block__dot" style="background:#f59e0b"></span>
              Государство — казна и рынок (все участники)
            </p>
            <p class="gp-cmd-block__note">Доступны всем игрокам, состоящим в государстве.</p>
            <div class="gp-cmd-list">
              <div v-for="row in nationMemberCommands" :key="row.cmd" class="gp-cmd-row">
                <code class="gp-cmd">{{ row.cmd }}</code>
                <span class="gp-cmd-desc">{{ row.desc }}</span>
              </div>
            </div>
          </div>

          <!-- Nation officer/leader commands -->
          <div class="gp-cmd-block">
            <p class="gp-cmd-block__title">
              <span class="gp-cmd-block__dot" style="background:#ef4444"></span>
              Государство — управление (офицеры и глава)
            </p>
            <p class="gp-cmd-block__note">Снятие из казны и управление лотами. /nsetcapital — только для главы.</p>
            <div class="gp-cmd-list">
              <div v-for="row in nationOfficerCommands" :key="row.cmd" class="gp-cmd-row">
                <code class="gp-cmd" :class="row.web ? 'gp-cmd--web' : ''">{{ row.cmd }}</code>
                <span class="gp-cmd-desc">{{ row.desc }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ─── MODS REFERENCE ─── -->
      <div class="surface-card gp-card">
        <h2 class="gp-section-title">Справочник по модам</h2>
        <div class="gp-mods-grid">
          <div v-for="cat in modCategories" :key="cat.name" class="gp-mod-cat">
            <p class="gp-mod-cat__name">{{ cat.name }}</p>
            <div class="gp-mod-list">
              <div v-for="mod in cat.mods" :key="mod.name" class="gp-mod-row">
                <div class="gp-mod-row__left">
                  <strong class="gp-mod-name">{{ mod.name }}</strong>
                  <span class="gp-mod-key">{{ mod.key }}</span>
                </div>
                <span class="gp-mod-note">{{ mod.note }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ─── ECONOMY & TAXES ─── -->
      <div class="surface-card gp-card">
        <h2 class="gp-section-title">Экономика и налоги</h2>
        <p class="gp-tier-hint">Прогрессивный налог на богатство списывается раз в неделю — только с суммы выше порога. Рыночная комиссия 2% с каждой продажи автоматически поступает в казну государства продавца.</p>

        <div class="gp-limits-row" style="margin-bottom:.85rem">
          <div v-for="stat in marketStats" :key="stat.label" class="gp-limit-chip">
            <span class="gp-limit-label">{{ stat.label }}</span>
            <span class="gp-limit-value">{{ stat.value }}</span>
            <span class="gp-limit-hint">{{ stat.hint }}</span>
          </div>
        </div>

        <p class="gp-list-label" style="margin-bottom:.5rem">Ставки налога на богатство (раз в неделю)</p>
        <div class="gp-table-wrap">
          <table class="gp-table">
            <thead>
              <tr><th>Диапазон баланса</th><th>Ставка</th></tr>
            </thead>
            <tbody>
              <tr v-for="tier in wealthTaxTiers" :key="tier.range">
                <td>{{ tier.range }}</td>
                <td><strong :style="{ color: tier.color }">{{ tier.rate }}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ─── PLAYER MARKET ─── -->
      <div class="surface-card gp-card">
        <h2 class="gp-section-title">Игровой рынок (/shop)</h2>
        <p class="gp-tier-hint">Ордерная биржа: игроки выставляют ордера на продажу и покупку — сделки исполняются автоматически при совпадении цен. После исполнения ордера забери товар через <code class="gp-cmd" style="display:inline">/pm pickup</code>.</p>
        <div class="gp-cmds-grid">
          <div class="gp-cmd-block">
            <p class="gp-cmd-block__title">
              <span class="gp-cmd-block__dot" style="background:#34d399"></span>
              Команды рынка
            </p>
            <p class="gp-cmd-block__note">Продажа — возьми предмет в руку и введи <code class="gp-cmd" style="display:inline">/pm sell</code>. Покупка — укажи item_key предмета вручную. Комиссия 2% (1% с Premium BP) списывается с продавца при исполнении ордера и зачисляется в казну его государства.</p>
            <div class="gp-cmd-list">
              <div v-for="row in marketCommands" :key="row.cmd" class="gp-cmd-row">
                <code class="gp-cmd">{{ row.cmd }}</code>
                <span class="gp-cmd-desc">{{ row.desc }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="gp-cmds-grid" style="margin-top:.85rem">
          <div class="gp-cmd-block">
            <p class="gp-cmd-block__title">
              <span class="gp-cmd-block__dot" style="background:#a78bfa"></span>
              Зелья и зачарованные книги — ключи для /pm buy
            </p>
            <p class="gp-cmd-block__note">
              Для зелий используй формат <code class="gp-cmd" style="display:inline">potion:эффект</code>,
              для бросаемых — <code class="gp-cmd" style="display:inline">splash_potion:эффект</code>,
              для оседающих — <code class="gp-cmd" style="display:inline">lingering_potion:эффект</code>.<br>
              Для книг: <code class="gp-cmd" style="display:inline">enchanted_book:зачарование:уровень</code>
              — например <code class="gp-cmd" style="display:inline">enchanted_book:sharpness:5</code>.
            </p>
            <div class="gp-cmd-list">
              <div v-for="row in potionKeys" :key="row.key" class="gp-cmd-row">
                <code class="gp-cmd">{{ row.key }}</code>
                <span class="gp-cmd-desc">{{ row.name }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ─── DAILY QUESTS ─── -->
      <div class="surface-card gp-card">
        <h2 class="gp-section-title">Ежедневные квесты</h2>
        <p class="gp-tier-hint">Три независимые системы квестов с разными сроками и наградами. При получении награды автоматически начисляется XP Battle Pass.</p>

        <div class="gp-cmds-grid" style="margin-bottom:.85rem">
          <div class="gp-cmd-block">
            <p class="gp-cmd-block__title">
              <span class="gp-cmd-block__dot" style="background:#f59e0b"></span>
              Команды квестов
            </p>
            <p class="gp-cmd-block__note">XP Battle Pass начисляется при получении награды, а не при выполнении задания. Используй /questtrack чтобы отслеживать прогресс прямо на экране.</p>
            <div class="gp-cmd-list">
              <div v-for="row in dailyQuestCommands" :key="row.cmd" class="gp-cmd-row">
                <code class="gp-cmd">{{ row.cmd }}</code>
                <span class="gp-cmd-desc">{{ row.desc }}</span>
              </div>
            </div>
          </div>
        </div>

        <p class="gp-list-label" style="margin-bottom:.5rem">Типы квестов</p>
        <div class="gp-tier-grid">
          <div v-for="qt in dailyQuestTypes" :key="qt.name" class="gp-tier-card">
            <div style="font-size:1.1rem;flex-shrink:0;margin-top:.05rem">{{ qt.icon }}</div>
            <div class="gp-tier-card__body">
              <p class="gp-tier-epoch" style="color:rgb(148 163 184)">{{ qt.name }}</p>
              <p style="font-size:.75rem;font-weight:500;color:rgb(100 116 139);margin:0">{{ qt.desc }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- ─── BATTLE PASS ─── -->
      <div class="surface-card gp-card">
        <h2 class="gp-section-title">Battle Pass (/bp)</h2>
        <p class="gp-tier-hint">100 уровней, по 10 000 XP на уровень — прогресс рассчитан на весь сезон. Каждый уровень даёт награду: монеты, предметы или опыт. Доступны бесплатная и Premium дорожки со своими квестами каждый день. XP за мобов, сделки и достижения ограничен <strong>8 000 в день</strong>, поэтому уровни зарабатываются постепенно, а не за один вечер.</p>

        <div class="gp-limits-row" style="margin-bottom:.85rem">
          <div class="gp-limit-chip">
            <span class="gp-limit-label">Уровни</span>
            <span class="gp-limit-value">1 – 100</span>
            <span class="gp-limit-hint">10 000 XP на уровень</span>
          </div>
          <div class="gp-limit-chip">
            <span class="gp-limit-label">Бесплатные квесты</span>
            <span class="gp-limit-value">3 / день</span>
            <span class="gp-limit-hint">обновляются в полночь</span>
          </div>
          <div class="gp-limit-chip">
            <span class="gp-limit-label">Premium квесты</span>
            <span class="gp-limit-value">3 / день</span>
            <span class="gp-limit-hint">нужен Battle Pass Premium</span>
          </div>
          <div class="gp-limit-chip">
            <span class="gp-limit-label">Premium бонус</span>
            <span class="gp-limit-value">1% комиссия</span>
            <span class="gp-limit-hint">вместо 2% на рынке</span>
          </div>
        </div>

        <p class="gp-list-label" style="margin-bottom:.5rem">Источники XP</p>
        <div class="gp-tips-grid">
          <div v-for="src in bpXpSources" :key="src.source" class="gp-tip">
            <strong>{{ src.xp }}</strong>
            <small>{{ src.source }}</small>
          </div>
        </div>
      </div>

      <!-- ─── MODSELL ─── -->
      <div class="surface-card gp-card">
        <h2 class="gp-section-title">ModSell — продажа модовых предметов</h2>
        <p class="gp-tier-hint">Продажа предметов из модов напрямую за монеты сервера. Цены динамические — рассчитываются автоматически по рыночной модели. Продажа через ModSell засчитывается в квесты типа «ModSell» в Daily Quests.</p>
        <div class="gp-cmds-grid">
          <div class="gp-cmd-block">
            <p class="gp-cmd-block__title">
              <span class="gp-cmd-block__dot" style="background:#a78bfa"></span>
              Команды ModSell
            </p>
            <p class="gp-cmd-block__note">Положи предмет в руку и введи команду. Принимаются только предметы из реестра сервера — проверь /msellinfo перед продажей.</p>
            <div class="gp-cmd-list">
              <div v-for="row in modSellCommands" :key="row.cmd" class="gp-cmd-row">
                <code class="gp-cmd">{{ row.cmd }}</code>
                <span class="gp-cmd-desc">{{ row.desc }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  </section>
</template>

<style scoped>
/* ─── Header ─── */
.gp-header {
  display: grid;
  gap: 1rem;
  align-items: start;
}

@media (min-width: 860px) {
  .gp-header { grid-template-columns: 1fr 260px; }
}

.gp-eyebrow {
  font-size: .75rem;
  font-weight: 700;
  letter-spacing: .18em;
  text-transform: uppercase;
  color: rgb(100 116 139);
  margin: 0 0 .3rem;
}

.gp-h1 {
  font-size: 1.5rem;
  font-weight: 900;
  color: #f8fbff;
  margin: 0 0 .4rem;
  letter-spacing: -.03em;
}

.gp-desc {
  font-size: .83rem;
  line-height: 1.6;
  color: rgb(100 116 139);
  margin: 0 0 .75rem;
  max-width: 520px;
}

.gp-header__actions {
  display: flex;
  flex-wrap: wrap;
  gap: .4rem;
}

/* ─── Progress ─── */
.gp-progress {
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(20,26,50,.98), rgba(12,17,32,1));
  padding: 1rem;
}

.gp-progress__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: .3rem;
}

.gp-progress__label {
  font-size: .75rem;
  font-weight: 700;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: rgba(255,255,255,.4);
}

.gp-progress__fraction {
  font-size: .75rem;
  font-weight: 700;
  color: rgba(255,255,255,.4);
}

.gp-progress__num {
  font-size: 2rem;
  font-weight: 900;
  color: #fff;
  letter-spacing: -.04em;
  margin-bottom: .6rem;
}

.gp-progress__bar-track {
  height: 6px;
  border-radius: 999px;
  background: rgba(255,255,255,.1);
  overflow: hidden;
  margin-bottom: .6rem;
}

.gp-progress__bar-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #34d399, #86efac);
  transition: width .4s ease;
}

.gp-progress__hint {
  font-size: .75rem;
  color: rgba(255,255,255,.35);
  margin: 0;
}

/* ─── Intro cards ─── */
.gp-intro-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: .5rem;
}

.gp-intro-card {
  display: flex;
  align-items: flex-start;
  gap: .75rem;
  border: 1px solid rgba(148,163,184,.1);
  border-radius: 16px;
  background: rgba(255,255,255,.025);
  padding: .85rem;
}

.gp-intro-icon {
  font-size: 1.3rem;
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: rgba(139,92,246,.1);
  border: 1px solid rgba(139,92,246,.15);
}

.gp-intro-label {
  font-size: .75rem;
  font-weight: 700;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: rgb(100 116 139);
  margin: 0 0 .15rem;
}

.gp-intro-title {
  font-size: .92rem;
  font-weight: 800;
  color: rgb(226 232 240);
  margin: 0 0 .25rem;
}

.gp-intro-text {
  font-size: .78rem;
  line-height: 1.55;
  color: rgb(100 116 139);
  margin: 0;
}

/* ─── Layout ─── */
.gp-layout {
  display: grid;
  gap: .75rem;
}

@media (min-width: 1024px) {
  .gp-layout { grid-template-columns: 220px minmax(0, 1fr); }
}

/* ─── Sidebar nav ─── */
.gp-nav {
  padding: .85rem;
  position: sticky;
  top: 5rem;
  height: fit-content;
  max-height: calc(100vh - 7rem);
  overflow-y: auto;
}

@media (max-width: 1023px) {
  .gp-nav { position: relative; top: 0; max-height: none; }
}

.gp-nav__label {
  font-size: .75rem;
  font-weight: 700;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: rgb(100 116 139);
  margin: 0 0 .5rem;
}

.gp-nav__list {
  display: flex;
  flex-direction: column;
  gap: .25rem;
}

.gp-nav-link {
  display: flex;
  align-items: center;
  gap: .5rem;
  border-radius: 10px;
  padding: .4rem .5rem;
  transition: background .12s, color .12s;
  color: rgb(148 163 184);
}

.gp-nav-link:hover { background: rgba(255,255,255,.05); color: #fff; }

.gp-nav-link__num {
  font-size: .75rem;
  font-weight: 900;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  border: 1px solid rgba(134,239,172,.2);
  background: rgba(134,239,172,.07);
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgb(134 239 172);
  flex-shrink: 0;
}

.gp-nav-link__title {
  font-size: .75rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* route list */
.gp-route {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: .2rem;
}

.gp-route li {
  display: flex;
  align-items: center;
  gap: .4rem;
  font-size: .75rem;
  color: rgb(100 116 139);
}

.gp-route li span {
  font-size: .75rem;
  font-weight: 800;
  color: rgb(71 85 105);
  width: 16px;
  flex-shrink: 0;
}

/* ─── Stages ─── */
.gp-stages { display: flex; flex-direction: column; gap: .65rem; }

.gp-stage {
  padding: 1rem;
  scroll-margin-top: 5.5rem;
}

.gp-stage__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: .75rem;
  margin-bottom: .75rem;
  flex-wrap: wrap;
}

.gp-stage__num {
  font-size: .75rem;
  font-weight: 700;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: rgb(100 116 139);
  margin-bottom: .2rem;
}

.gp-stage__title {
  font-size: 1rem;
  font-weight: 900;
  color: #f0f4ff;
  margin: 0 0 .3rem;
  letter-spacing: -.02em;
}

.gp-stage__goal {
  font-size: .8rem;
  line-height: 1.55;
  color: rgb(100 116 139);
  margin: 0;
  max-width: 520px;
}

.gp-tags { display: flex; flex-wrap: wrap; gap: .3rem; flex-shrink: 0; }

.gp-tag {
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 999px;
  background: rgba(255,255,255,.04);
  padding: .18rem .55rem;
  font-size: .75rem;
  font-weight: 800;
  letter-spacing: .1em;
  text-transform: uppercase;
  color: rgb(148 163 184);
}

.gp-stage__body {
  display: grid;
  gap: .5rem;
}

@media (min-width: 640px) {
  .gp-stage__body { grid-template-columns: 1fr 1fr; }
}

.gp-list-block {
  border: 1px solid rgba(255,255,255,.06);
  border-radius: 12px;
  background: rgba(255,255,255,.02);
  padding: .75rem;
}

.gp-list-label {
  font-size: .75rem;
  font-weight: 700;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: rgb(100 116 139);
  margin: 0 0 .5rem;
}

.gp-unlocks {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: .35rem;
}

.gp-unlocks li {
  display: flex;
  align-items: flex-start;
  gap: .4rem;
  font-size: .8rem;
  line-height: 1.5;
  color: rgb(203 213 225);
}

.gp-diamond { color: rgb(110 231 183); flex-shrink: 0; font-size: .75rem; margin-top: .15rem; }

.gp-checklist { display: flex; flex-direction: column; gap: .3rem; }

.gp-check {
  display: flex;
  align-items: flex-start;
  gap: .5rem;
  border: 1px solid rgba(255,255,255,.07);
  border-radius: 8px;
  background: rgba(255,255,255,.025);
  padding: .45rem .55rem;
  font-size: .8rem;
  line-height: 1.45;
  color: rgb(203 213 225);
  cursor: pointer;
  transition: border-color .12s, background .12s;
}

.gp-check input { accent-color: #22c55e; margin-top: .08rem; flex-shrink: 0; }
.gp-check.done { border-color: rgba(34,197,94,.2); background: rgba(34,197,94,.04); color: rgb(134 239 172); }

/* ─── Cards ─── */
.gp-card { padding: 1rem; }

.gp-section-title {
  font-size: .92rem;
  font-weight: 800;
  color: rgb(203 213 225);
  margin: 0 0 .85rem;
}

/* ─── Cross-links table ─── */
.gp-table-wrap { overflow-x: auto; border: 1px solid rgba(255,255,255,.07); border-radius: 12px; }

.gp-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 560px;
}

.gp-table th {
  background: rgba(255,255,255,.03);
  border-bottom: 1px solid rgba(255,255,255,.07);
  padding: .42rem .75rem;
  font-size: .75rem;
  font-weight: 800;
  letter-spacing: .16em;
  text-transform: uppercase;
  color: rgb(100 116 139);
  text-align: left;
}

.gp-table td {
  border-bottom: 1px solid rgba(255,255,255,.05);
  padding: .5rem .75rem;
  font-size: .82rem;
  color: rgb(148 163 184);
  vertical-align: top;
}

.gp-table td strong { color: rgb(226 232 240); font-weight: 700; }
.gp-table tr:last-child td { border-bottom: none; }

/* ─── Tips ─── */
.gp-tips-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: .5rem;
}

.gp-tip {
  border: 1px solid rgba(255,255,255,.07);
  border-radius: 12px;
  background: rgba(255,255,255,.025);
  padding: .75rem;
  display: flex;
  flex-direction: column;
  gap: .3rem;
}

.gp-tip strong { font-size: .85rem; font-weight: 800; color: rgb(226 232 240); }
.gp-tip small { font-size: .78rem; line-height: 1.55; color: rgb(100 116 139); }

/* ─── Limits row ─── */
.gp-limits-row {
  display: flex;
  flex-wrap: wrap;
  gap: .5rem;
  margin-bottom: 1rem;
}

.gp-limit-chip {
  display: flex;
  flex-direction: column;
  gap: .1rem;
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 12px;
  background: rgba(255,255,255,.03);
  padding: .55rem .85rem;
  min-width: 140px;
}

.gp-limit-label {
  font-size: .6rem;
  font-weight: 700;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: rgb(100 116 139);
}

.gp-limit-value {
  font-size: 1.05rem;
  font-weight: 900;
  color: #f8fbff;
  letter-spacing: -.02em;
}

.gp-limit-hint {
  font-size: .75rem;
  color: rgb(71 85 105);
}

/* ─── Commands grid ─── */
.gp-cmds-grid {
  display: grid;
  gap: .75rem;
}

@media (min-width: 860px) {
  .gp-cmds-grid { grid-template-columns: 1fr 1fr; }
}

.gp-cmd-block {
  border: 1px solid rgba(255,255,255,.07);
  border-radius: 14px;
  background: rgba(255,255,255,.02);
  padding: .85rem;
}

.gp-cmd-block__title {
  display: flex;
  align-items: center;
  gap: .45rem;
  font-size: .78rem;
  font-weight: 800;
  color: rgb(226 232 240);
  margin: 0 0 .3rem;
}

.gp-cmd-block__dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  flex-shrink: 0;
}

.gp-cmd-block__note {
  font-size: .75rem;
  color: rgb(100 116 139);
  margin: 0 0 .65rem;
  line-height: 1.5;
}

.gp-cmd-list {
  display: flex;
  flex-direction: column;
  gap: .3rem;
}

.gp-cmd-row {
  display: flex;
  align-items: flex-start;
  gap: .5rem;
  padding: .35rem .4rem;
  border-radius: 8px;
  background: rgba(255,255,255,.02);
  flex-wrap: wrap;
}

.gp-cmd {
  font-family: 'Courier New', monospace;
  font-size: .75rem;
  font-weight: 700;
  color: rgb(110 231 183);
  background: rgba(110,231,183,.07);
  border: 1px solid rgba(110,231,183,.12);
  border-radius: 5px;
  padding: .15rem .4rem;
  white-space: nowrap;
  flex-shrink: 0;
}

.gp-cmd-desc {
  font-size: .77rem;
  color: rgb(148 163 184);
  line-height: 1.45;
  padding-top: .1rem;
}

.gp-cmd--web {
  color: rgb(167 139 250);
  background: rgba(139,92,246,.07);
  border-color: rgba(139,92,246,.18);
}

/* ─── Mods reference ─── */
.gp-mods-grid {
  display: grid;
  gap: .75rem;
}

@media (min-width: 860px) {
  .gp-mods-grid { grid-template-columns: 1fr 1fr; }
}

.gp-mod-cat {
  border: 1px solid rgba(255,255,255,.07);
  border-radius: 14px;
  background: rgba(255,255,255,.02);
  padding: .85rem;
}

.gp-mod-cat__name {
  font-size: .75rem;
  font-weight: 800;
  letter-spacing: .16em;
  text-transform: uppercase;
  color: rgb(100 116 139);
  margin: 0 0 .6rem;
}

.gp-mod-list {
  display: flex;
  flex-direction: column;
  gap: .4rem;
}

.gp-mod-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: .5rem;
  padding: .45rem .5rem;
  border-radius: 9px;
  border: 1px solid rgba(255,255,255,.05);
  background: rgba(255,255,255,.025);
  flex-wrap: wrap;
}

.gp-mod-row__left {
  display: flex;
  flex-direction: column;
  gap: .12rem;
  flex: 1;
  min-width: 140px;
}

.gp-mod-name {
  font-size: .82rem;
  font-weight: 800;
  color: rgb(226 232 240);
}

.gp-mod-key {
  font-size: .75rem;
  color: rgb(100 116 139);
  line-height: 1.4;
}

.gp-mod-note {
  font-size: .75rem;
  font-weight: 700;
  color: rgb(71 85 105);
  border: 1px solid rgba(255,255,255,.06);
  border-radius: 6px;
  padding: .15rem .4rem;
  white-space: nowrap;
  align-self: flex-start;
  flex-shrink: 0;
}

/* ─── Tier Gates ─── */
.gp-tier-hint {
  font-size: .78rem;
  color: rgb(100 116 139);
  margin: -.3rem 0 .85rem;
  line-height: 1.55;
}

.gp-tier-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: .4rem;
}

.gp-tier-card {
  display: flex;
  gap: .5rem;
  align-items: flex-start;
  border: 1px solid rgba(255,255,255,.07);
  border-radius: 12px;
  background: rgba(255,255,255,.02);
  padding: .6rem .7rem;
}

.gp-tier-card__dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  flex-shrink: 0;
  margin-top: .3rem;
}

.gp-tier-card__body {
  display: flex;
  flex-direction: column;
  gap: .15rem;
  min-width: 0;
}

.gp-tier-epoch {
  font-size: .75rem;
  font-weight: 800;
  letter-spacing: .1em;
  text-transform: uppercase;
  margin: 0;
}

.gp-tier-item {
  font-size: .82rem;
  font-weight: 700;
  color: rgb(226 232 240);
  margin: 0;
  line-height: 1.3;
}

.gp-tier-mod {
  font-size: .75rem;
  font-weight: 600;
  color: rgb(71 85 105);
}

/* ─── Mob Farm Rules ─── */
.gp-farm-intro {
  font-size: .82rem;
  color: rgba(255,255,255,.45);
  margin: 0 0 1rem;
  line-height: 1.55;
}

.gp-farm-rules {
  display: flex;
  flex-direction: column;
  gap: .6rem;
}

.gp-farm-rule {
  display: flex;
  align-items: flex-start;
  gap: .9rem;
  border-radius: 12px;
  padding: .85rem 1rem;
  border: 1px solid rgba(255,255,255,.07);
  background: rgba(255,255,255,.03);
}

.gp-farm-rule--warning {
  border-color: rgba(239,68,68,.35);
  background: rgba(239,68,68,.07);
}

.gp-farm-rule__icon {
  font-size: 1.35rem;
  line-height: 1;
  flex-shrink: 0;
  margin-top: .1rem;
}

.gp-farm-rule__body { flex: 1; }

.gp-farm-rule__title {
  display: block;
  font-size: .875rem;
  font-weight: 700;
  margin-bottom: .2rem;
}

.gp-farm-rule__text {
  font-size: .8rem;
  color: rgba(255,255,255,.55);
  margin: 0;
  line-height: 1.5;
}
</style>
