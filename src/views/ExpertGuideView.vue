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
  { label: 'Сборка', title: 'FTB Evolution + 100 модов', text: 'Пак давно перерос базовую сборку: 566 модов, несколько параллельных технологических и магических веток. Единственного «правильного» пути нет — есть общая линия и ответвления.', icon: '🧬' },
  { label: 'Навыки', title: 'Прокачка персонажа', text: 'Система навыков Puffish: Магия, Ближний и Дальний бой, Атлетика, Добыча и Защита. Вкладывай очки и открывай пассивки под свой стиль.', icon: '⭐' },
  { label: 'Вершина', title: 'Квант и сингулярность', text: 'Топ снаряжения — Квантовая броня Modern Industrialization, затем MekaSuit и Броня Хаоса. Финал прогрессии — Абсолютная сингулярность и Воплощённое трансцендентство.', icon: '🏆' },
]

// Ветки прогрессии. Ключи совпадают с epochs.list в config.yml плагина GameSync
// и с PROGRESSION_TIERS на бэкенде — гайд, чат-объявления и рейтинг показывают
// одно и то же. Меняешь эпоху — меняй во всех трёх местах.
const branches = [
  { id: 'all',         label: 'Все',           icon: '🗺️' },
  { id: 'main',        label: 'Общая линия',   icon: '⚙️' },
  { id: 'tech',        label: 'Технологии',    icon: '🏭' },
  { id: 'magic',       label: 'Магия',         icon: '✨' },
  { id: 'exploration', label: 'Исследование',  icon: '🗡️' },
]

const activeBranch = ref('all')

const stages = [
  {
    id: 'survival', number: '01', branch: 'main', epochKey: null,
    title: 'Базовое выживание',
    tags: ['Farmer\'s Delight', 'рюкзаки', 'телепорты', 'True Darkness'],
    goal: 'Пережить первые ночи, обустроить базу и заклеймить территорию. В паке стоит Hardcore True Darkness — без источника света вне базы делать нечего.',
    gate: null,
    unlocks: [
      'Рюкзаки Sophisticated Backpacks с апгрейдами',
      'Телепорты: Simple Teleporters и Tempad, команды FTB Essentials',
      'Готовка Farmer\'s Delight — сытная еда и бафы',
    ],
    checks: [
      'Есть безопасная база и стабильный свет',
      'Заклеймлена территория через FTB Chunks',
      'Налажена еда: ферма или кухня Farmer\'s Delight',
    ],
  },
  {
    id: 'mechanisms', number: '02', branch: 'main', epochKey: 'mechanisms_age',
    title: 'Эпоха механизмов',
    tags: ['Create', 'кинетика', 'автоматизация'],
    goal: 'Собрать первые кинетические линии Create: вращение, пресс, миксер, дробильные колёса. Это самостоятельная ветка автоматизации, а не «подготовка» к другим модам.',
    gate: { id: 'create:precision_mechanism', name: 'Механизм точности' },
    unlocks: [
      'Андезитовый сплав, валы, шестерни, ремни',
      'Механический пресс, миксер, установщик',
      'Механизм точности — ключ к продвинутым машинам Create',
    ],
    checks: [
      'Есть стабильный источник вращения',
      'Работает линия с прессом и миксером',
      'Скрафчен Механизм точности',
    ],
  },
  {
    id: 'steel', number: '03', branch: 'main', epochKey: 'steel_age',
    title: 'Эпоха стали',
    tags: ['Immersive Engineering', 'сталь', 'коксовая печь'],
    goal: 'Поставить коксовую и доменную печь Immersive Engineering. Сталь нужна почти всем машинам среднего уровня — но это не единственный её источник в паке.',
    gate: { id: 'immersiveengineering:ingot_steel', name: 'Стальной слиток' },
    unlocks: [
      'Коксовая печь: кокс и креозот',
      'Доменная печь: сталь потоком',
      'Металлический пресс, провода и первая электрика IE',
    ],
    checks: [
      'Работает коксовая печь',
      'Доменная печь выдаёт сталь стабильно',
      'Есть запас стали под машины',
    ],
  },
  {
    id: 'energy', number: '04', branch: 'main', epochKey: 'energy_age',
    title: 'Эпоха энергии',
    tags: ['Mekanism', 'энергия', 'умножение руды'],
    goal: 'Запустить энергосеть и переработку руды. У Mekanism своя сталь через Металлургический инфузер, так что ветку можно начинать независимо от Immersive Engineering.',
    gate: { id: 'mekanism:steel_casing', name: 'Стальной корпус' },
    unlocks: [
      'Умножение руды до 5× по цепочке машин',
      'Энергокубы и передача энергии',
      'Стальной корпус — основа всех машин Mekanism',
    ],
    checks: [
      'Есть рабочая энергосеть',
      'Запущено умножение руды хотя бы 3×',
      'Скрафчен Стальной корпус',
    ],
  },
  {
    id: 'automation', number: '05', branch: 'main', epochKey: 'automation_age',
    title: 'Эпоха автоматизации',
    tags: ['AE2', 'Refined Storage', 'автокрафт'],
    goal: 'Перейти от сундуков к цифровому хранилищу с автокрафтом. В паке есть и AE2, и Refined Storage 2 — бери что ближе, эпоха засчитывается по контроллеру AE2.',
    gate: { id: 'ae2:controller', name: 'МЭ контроллер' },
    unlocks: [
      'ME-сеть: диски, терминалы, автокрафт по запросу',
      'Процессоры и молекулярный сборщик',
      'MEGA Cells и Advanced AE для расширения',
    ],
    checks: [
      'Собрана ME-сеть с контроллером',
      'Работает автокрафт хотя бы одного рецепта',
      'Хранилище переехало с сундуков на диски',
    ],
  },
  {
    id: 'industry', number: '06', branch: 'main', epochKey: 'industry_age',
    title: 'Индустриальная эпоха',
    tags: ['Modern Industrialization', 'Oritech', 'EnderIO'],
    goal: 'Выйти на тяжёлую промышленность: многоблочные заводы Modern Industrialization, продвинутые корпуса машин, химия и переработка нефти.',
    gate: { id: 'modern_industrialization:advanced_machine_hull', name: 'Усовершенствованный корпус механизма' },
    unlocks: [
      'Мультиблоки MI: электродоменная печь, дистилляция',
      'Продвинутые корпуса и материалы высоких уровней',
      'Ветки Oritech и EnderIO как альтернативные пути',
    ],
    checks: [
      'Построен хотя бы один мультиблок MI',
      'Налажена переработка нефти или химия',
      'Скрафчен усовершенствованный корпус механизма',
    ],
  },
  {
    id: 'quantum', number: '07', branch: 'main', epochKey: 'quantum_age',
    title: 'Квантовая эпоха',
    tags: ['MI Quantum', 'броня', 'вершина снаряжения'],
    goal: 'Собрать Квантовую броню Modern Industrialization — лучшая броня пака: каждая деталь снижает шанс получить любой урон на 25%.',
    gate: { id: 'modern_industrialization:quantum_chestplate', name: 'Квантовый нагрудник' },
    unlocks: [
      'Квантовая броня MI — топ защиты в паке',
      'Квантовые нано- и ньяно-комплекты Extended Industrialization',
      'MekaSuit и Броня Хаоса как альтернативы того же уровня',
    ],
    checks: [
      'Автоматизированы квантовые компоненты',
      'Собран Квантовый нагрудник',
      'Комплект брони закрыт целиком',
    ],
  },
  {
    id: 'singularity', number: '08', branch: 'main', epochKey: 'singularity_age',
    title: 'Эпоха сингулярности',
    tags: ['FTB Evolution', 'пирамида', 'сингулярности'],
    goal: 'Пирамида Эволюции: Эволюционная материя, первородная эссенция, элементальный арканит и сборка Абсолютной сингулярности.',
    gate: { id: 'ftbevolution:ultimate_singularity', name: 'Абсолютная сингулярность' },
    unlocks: [
      'Эволюционная материя и цепочка пирамиды',
      'Элементальный арканит и растворённый потенциал',
      'Абсолютная сингулярность',
    ],
    checks: [
      'Скрафчена Эволюционная материя',
      'Автоматизирована компрессия ресурсов',
      'Собрана Абсолютная сингулярность',
    ],
  },
  {
    id: 'transcendence', number: '09', branch: 'main', epochKey: 'transcendence',
    title: 'Трансцендентство',
    tags: ['FTB Evolution', 'апекс', 'финал'],
    goal: 'Воплощённое трансцендентство — финальная точка прогрессии сборки.',
    gate: { id: 'ftbevolution:realized_transcendence', name: 'Воплощённое трансцендентство' },
    unlocks: [
      'Эволюционный арканум',
      'Воплощённое трансцендентство',
      'Полностью закрытая линия прогрессии',
    ],
    checks: [
      'Собран Эволюционный арканум',
      'Получено Воплощённое трансцендентство',
      'Вершина прогрессии достигнута',
    ],
  },
  {
    id: 'magic-path', number: 'M1', branch: 'magic', epochKey: 'magic_path',
    title: 'Путь магии',
    tags: ['Ars Nouveau', 'мана', 'заклинания'],
    goal: 'Ars Nouveau: своя мана, конструктор заклинаний, фамильяры и автоматизация чарами. Полностью независимая ветка — техпрогресс для неё не нужен.',
    gate: { id: 'ars_nouveau:enchanting_apparatus', name: 'Чародейский Аппарат' },
    unlocks: [
      'Чародейский аппарат и крафт глифов',
      'Собственные заклинания из глифов',
      'Старбанклы и магическая автоматизация',
    ],
    checks: [
      'Построен Чародейский аппарат',
      'Собрано первое рабочее заклинание',
      'Налажен источник маны',
    ],
  },
  {
    id: 'arcane-path', number: 'M2', branch: 'magic', epochKey: 'arcane_path',
    title: 'Тайные искусства',
    tags: ['Forbidden Arcanus', 'Malum', 'Occultism'],
    goal: 'Тёмная сторона магии: ритуалы Forbidden Arcanus, духи Malum, призыв демонов Occultism и заклинания Iron\'s Spellbooks.',
    gate: { id: 'forbidden_arcanus:clibano_core', name: 'Ядро Клибано' },
    unlocks: [
      'Клибано и ритуалы Forbidden Arcanus',
      'Алтарь духов Malum и спиритизм',
      'Ритуалы призыва Occultism',
    ],
    checks: [
      'Собрано Ядро Клибано',
      'Проведён первый ритуал',
      'Открыта работа с духами или демонами',
    ],
  },
  {
    id: 'hunter-path', number: 'E1', branch: 'exploration', epochKey: 'hunter_path',
    title: 'Путь охотника',
    tags: ['Cataclysm', 'боссы', 'снаряжение'],
    goal: 'Боссы L_Ender\'s Cataclysm: Игнис, Левиафан, Сцилла, Харбингер. Дают собственное мощное снаряжение — это самостоятельная ветка, а не ступень к Draconic.',
    gate: { id: 'cataclysm:ignitium_ingot', name: 'Игнитовый слиток' },
    unlocks: [
      'Игнитовая броня и оружие боссов',
      'Уникальные артефакты подземелий',
      'Осколки пустоты и редкие материалы',
    ],
    checks: [
      'Побеждён хотя бы один босс Cataclysm',
      'Получен Игнитовый слиток',
      'Собран комплект боссового снаряжения',
    ],
  },
  {
    id: 'starlight-path', number: 'E2', branch: 'exploration', epochKey: 'starlight_path',
    title: 'Вечный Звездосвет',
    tags: ['Eternal Starlight', 'измерение', 'боссы'],
    goal: 'Измерение Eternal Starlight: собственные биомы, боссы и линейка материалов — эфиросцент, глубинное серебро, нереалий, големосталь.',
    gate: { id: 'eternal_starlight:starcore', name: 'Звёздное ядро' },
    unlocks: [
      'Доступ в измерение Вечного Звездосвета',
      'Эфиросцентное снаряжение и кристальное оружие',
      'Редкие сплавы: нереалий, големосталь, термальный истокамень',
    ],
    checks: [
      'Открыт портал в Eternal Starlight',
      'Побеждён босс измерения',
      'Получено Звёздное ядро',
    ],
  },
  {
    id: 'draconic-path', number: 'T1', branch: 'tech', epochKey: 'draconic_path',
    title: 'Дракониевая энергетика',
    tags: ['Draconic Evolution', 'энергия', 'крафт слияния'],
    goal: 'Draconic Evolution: дракониум, гигантское хранение энергии, реактор и крафт слияния. Никаких драконов тут нет — только Страж Хаоса. Мощная ветка, но НЕ финал: Броня Хаоса стоит ниже Квантовой брони MI.',
    gate: { id: 'draconicevolution:chaotic_core', name: 'Ядро Хаоса' },
    unlocks: [
      'Дракониевые ядра и крафт слияния',
      'Реактор и огромное хранение энергии',
      'Комплект Хаоса — топ-3 броня пака (после Квантовой и MekaSuit)',
    ],
    checks: [
      'Собран крафт слияния (fusion crafting)',
      'Запущено дракониевое хранилище энергии',
      'Получено Ядро Хаоса',
    ],
  },
]

// Иконки лежат как public/item-icons/<modid>/<item_id>.png, оба сегмента в
// нижнем регистре (та же схема, что у ItemSlot на рынке). Часть предметов —
// KubeJS-контент без текстуры в паке, поэтому битую картинку просто прячем.
function iconUrl(itemId) {
  if (!itemId || !itemId.includes(':')) return null
  const [mod, item] = itemId.split(':')
  return `/item-icons/${mod.toLowerCase()}/${item.toLowerCase()}.png`
}

function onIconError(event) {
  event.target.style.display = 'none'
}

// Оглавление всей страницы. Держим списком, а не сканированием DOM: разделы
// статичные, а так их порядок виден в одном месте и не разъезжается с версткой.
// ── «Восхождение»: повествовательная шкала прогрессии ────────────────────
// Пак буквально начинается в Hardcore True Darkness и заканчивается тем, что
// игрок сам становится источником света. Этот блок — единственное «громкое»
// место страницы: яркость и цвет колонки идут снизу вверх по материалам эпох,
// а заполнение нити берётся из настоящего чеклиста игрока, а не декоративное.
const ascentChapters = [
  { stage: 'survival',      era: 'Тьма',            line: 'Ночь здесь абсолютная. Видно ровно настолько, насколько светишь сам.' },
  { stage: 'mechanisms',    era: 'Механизмы',       line: 'Первая шестерня цепляет вторую — мир начинает работать без тебя.' },
  { stage: 'steel',         era: 'Сталь',           line: 'Печь гудит всю ночь. Появляется материал, который держит нагрузку.' },
  { stage: 'energy',        era: 'Энергия',         line: 'Провод под напряжением. Руда перестаёт быть редкой.' },
  { stage: 'automation',    era: 'Автоматизация',   line: 'Сундуки исчезают: всё нажитое помещается в один терминал.' },
  { stage: 'industry',      era: 'Индустрия',       line: 'Завод занимает чанк целиком и работает, пока ты спишь.' },
  { stage: 'quantum',       era: 'Квант',           line: 'Урон становится вероятностью, а не событием.' },
  { stage: 'singularity',   era: 'Сингулярность',   line: 'Ресурсы сжимаются в точку.' },
  { stage: 'transcendence', era: 'Трансцендентство', line: 'Свет теперь исходит от тебя.' },
]

/** Доля выполненных пунктов чеклиста по главам восхождения. */
const ascentProgress = computed(() => {
  const mainStages = stages.filter((st) => ascentChapters.some((c) => c.stage === st.id))
  const total = mainStages.reduce((n, st) => n + st.checks.length, 0)
  if (!total) return 0
  const done = mainStages.reduce(
    (n, st) => n + st.checks.filter((_, i) => checked.value[checkKey(st, i)]).length, 0)
  return done / total
})

/** Глава считается пройденной, когда закрыт весь её чеклист. */
function chapterDone(stageId) {
  const st = stages.find((x) => x.id === stageId)
  if (!st) return false
  return st.checks.every((_, i) => checked.value[checkKey(st, i)])
}

const pageSections = [
  { id: 'sec-progression', label: 'Прогрессия',    icon: '🗺️' },
  { id: 'sec-crosslinks',  label: 'Связи модов',   icon: '🔗' },
  { id: 'sec-tips',        label: 'Советы',        icon: '💡' },
  { id: 'sec-skills',      label: 'Навыки',        icon: '⭐' },
  { id: 'sec-farms',       label: 'Фермы мобов',   icon: '🐄' },
  { id: 'sec-commands',    label: 'Команды',       icon: '⌨️' },
  { id: 'sec-mods-key',    label: 'Ключевые моды', icon: '🧩' },
  { id: 'sec-economy',     label: 'Экономика',     icon: '💰' },
  { id: 'sec-market',      label: 'Рынок',         icon: '🏪' },
  { id: 'sec-quests',      label: 'Квесты',        icon: '📜' },
  { id: 'sec-bp',          label: 'Battle Pass',   icon: '🎫' },
  { id: 'sec-modsell',     label: 'ModSell',       icon: '🏷️' },
  { id: 'sec-allmods',     label: 'Состав сборки', icon: '📦' },
]

function scrollToSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// Сворачивание крупных справочных блоков — страница длинная, а читают её
// обычно ради одного раздела.
const collapsed = ref({})
function toggleSection(id) {
  collapsed.value[id] = !collapsed.value[id]
}

const visibleStages = computed(() =>
  activeBranch.value === 'all' ? stages : stages.filter((s) => s.branch === activeBranch.value),
)

const routeSteps = stages.filter((s) => s.branch === 'main').map((s) => s.title)

const crossLinks = [
  ['Farmer\'s Delight', 'еда, готовка и комфортный старт', 'выживание, ни к чему больше не обязывает'],
  ['Create', 'кинетическая автоматизация', 'самодостаточную линию машин и логистики'],
  ['Immersive Engineering', 'сталь, провода, тяжёлая промышленность', 'машины среднего уровня — но Mekanism варит свою сталь сам'],
  ['Mekanism', 'энергия, умножение руды, MekaSuit', 'энергосеть и переработку для любой ветки'],
  ['Applied Energistics 2', 'хранение, процессоры, автокрафт', 'массовую автоматизацию всего остального'],
  ['Modern Industrialization', 'мультиблоки, химия, Квантовая броня', 'вершину технологической линии'],
  ['Industrial Foregoing', 'фермы растений и мобов, пластик', 'поток ресурсов — снаряжения тут нет'],
  ['L_Ender\'s Cataclysm', 'боссы и их снаряжение', 'самостоятельную боевую ветку'],
  ['Draconic Evolution', 'сверхэнергия, ядра, Броня Хаоса', 'мощную ветку энергетики, но не финал'],
  ['FTB Evolution', 'пирамида, сингулярности, трансцендентство', 'финал прогрессии'],
]

const tips = [
  { title: 'Одного пути нет', text: 'В паке несколько независимых веток. Общая линия — ориентир, а не обязательный порядок: магию и боссов можно качать параллельно.' },
  { title: 'Свет — первый приоритет', text: 'Hardcore True Darkness делает ночь и пещеры по-настоящему чёрными. Факелы и фонари бери с собой всегда, на первый вход выдаётся стартовый набор.' },
  { title: 'Сталь берётся не только у IE', text: 'Immersive Engineering удобен для потока стали, но Mekanism делает свою через Металлургический инфузер, а MI — в электродоменной печи.' },
  { title: 'Автоматизируй рано', text: 'Первые линии Create строй сразу, а к AE2 переходи, как только появятся процессоры — дальше всё упирается в логистику.' },
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

// ── Живой каталог модов ──────────────────────────────────────────────────
// Раздел ниже (modCategories) — редакторские подборки ключевых модов. А этот
// блок грузит /mods/voidrp.json — тот самый файл, который генерится из
// джарников пака (scripts/generate_mods_list.py). Благодаря этому список
// НЕ протухает: добавили или убрали мод — перегенерировали файл, и гайд
// сразу знает актуальный состав. Раньше здесь был захардкоженный текст, и в
// нём месяцами жили Waystones, которых в паке давно нет.
const allMods = ref([])
const modsLoading = ref(true)
const modSearch = ref('')
const activeModCat = ref('all')

// Явные соответствия важнее эвристики: id мода не всегда говорит о его роли.
const MOD_CATEGORY_BY_ID = {
  create: 'tech', immersiveengineering: 'tech', mekanism: 'tech', ae2: 'tech',
  modern_industrialization: 'tech', extended_industrialization: 'tech',
  oritech: 'tech', enderio: 'tech', powah: 'tech', refinedstorage: 'tech',
  industrialforegoing: 'tech', draconicevolution: 'tech', bigreactors: 'tech',
  advanced_ae: 'tech', megacells: 'tech', nautec: 'tech', actuallyadditions: 'tech',
  pneumaticcraft: 'tech', pncr: 'tech', xnet: 'tech', laserio: 'tech',
  ars_nouveau: 'magic', forbidden_arcanus: 'magic', malum: 'magic',
  occultism: 'magic', irons_spellbooks: 'magic', hexerei: 'magic',
  neovitae: 'magic', theurgy: 'magic', paganbless: 'magic', rootsclassic: 'magic',
  mahoutsukai: 'magic', not_enough_glyphs: 'magic', ars_elemental: 'magic',
  cataclysm: 'adventure', eternal_starlight: 'adventure', the_bumblezone: 'adventure',
  alexsmobs: 'adventure', epicfight: 'adventure', simplyswords: 'adventure',
  tacz: 'adventure', minecolonies: 'adventure', ferocious_creature: 'adventure',
  relics: 'adventure', reliquary: 'adventure', gateways: 'adventure',
  farmersdelight: 'comfort', sophisticatedbackpacks: 'comfort',
  sophisticatedstorage: 'comfort', supplementaries: 'comfort', jade: 'comfort',
  jei: 'comfort', emi: 'comfort', simpleteleporters: 'comfort', tempad: 'comfort',
  ftbchunks: 'comfort', ftbessentials: 'comfort', journeymap: 'comfort',
  handcrafted: 'building', chipped: 'building', rechiseled: 'building',
  framedblocks: 'building', mcwfurnitures: 'building', mcwlights: 'building',
  littletiles: 'building', buildinggadgets2: 'building', another_furniture: 'building',
  biomeswevegone: 'world', terralith: 'world', tectonic: 'world', midgard: 'world',
  ctov: 'world', dungeoncrawl: 'world', yungsapi: 'world', nullscape: 'world',
  hardcore_true_darkness: 'world', tfc: 'world',
}

// Слова в id, по которым мод относится к категории, если нет явного правила.
const MOD_CATEGORY_HINTS = [
  ['tech', ['create_', 'createa', 'ae2', 'mekanism', 'industrial', 'energ', 'rftools', 'storage', 'pipe', 'cable', 'machine', 'reactor', 'quarry', 'logistic']],
  ['magic', ['ars_', 'magic', 'spell', 'arcan', 'occult', 'ritual', 'mystical', 'sorcer']],
  ['adventure', ['mob', 'boss', 'dungeon', 'combat', 'weapon', 'sword', 'gun', 'creature', 'monster', 'raid']],
  ['building', ['chisel', 'furnitur', 'decor', 'block', 'build', 'paint', 'lamp', 'light']],
  ['world', ['biome', 'terrain', 'world', 'structure', 'cave', 'dimension', 'nether', 'end_']],
  ['comfort', ['inventory', 'tooltip', 'sort', 'search', 'zoom', 'menu', 'hud', 'map', 'backpack', 'tab']],
]

const MOD_CATEGORIES = [
  { id: 'all',       label: 'Все моды',    icon: '📦' },
  { id: 'tech',      label: 'Технологии',  icon: '🏭' },
  { id: 'magic',     label: 'Магия',       icon: '✨' },
  { id: 'adventure', label: 'Приключения', icon: '🗡️' },
  { id: 'world',     label: 'Мир',         icon: '🌍' },
  { id: 'building',  label: 'Стройка',     icon: '🧱' },
  { id: 'comfort',   label: 'Удобства',    icon: '🧰' },
  { id: 'lib',       label: 'Библиотеки',  icon: '⚙️' },
]

function categorizeMod(mod) {
  const id = (mod.id || '').toLowerCase()
  if (MOD_CATEGORY_BY_ID[id]) return MOD_CATEGORY_BY_ID[id]
  const text = `${id} ${(mod.name || '').toLowerCase()} ${(mod.description || '').toLowerCase()}`
  if (/\b(lib|api|core|util)\b/.test(text) || /(lib|api)$/.test(id)) return 'lib'
  for (const [cat, words] of MOD_CATEGORY_HINTS) {
    if (words.some((w) => id.includes(w))) return cat
  }
  return 'comfort'
}

const categorizedMods = computed(() =>
  allMods.value.map((m) => ({ ...m, cat: categorizeMod(m) })),
)

const modCounts = computed(() => {
  const counts = { all: categorizedMods.value.length }
  for (const m of categorizedMods.value) counts[m.cat] = (counts[m.cat] || 0) + 1
  return counts
})

const filteredMods = computed(() => {
  const q = modSearch.value.trim().toLowerCase()
  return categorizedMods.value
    .filter((m) => activeModCat.value === 'all' || m.cat === activeModCat.value)
    .filter((m) => !q
      || (m.name || '').toLowerCase().includes(q)
      || (m.id || '').toLowerCase().includes(q)
      || (m.description_ru || '').toLowerCase().includes(q))
    .sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id, 'ru'))
})

onMounted(async () => {
  try {
    const res = await fetch('/mods/voidrp.json', { cache: 'no-cache' })
    allMods.value = await res.json()
  } catch {
    allMods.value = []
  } finally {
    modsLoading.value = false
  }
})

const modCategories = [
  {
    name: 'Технологии',
    color: 'blue',
    mods: [
      { name: 'Create', key: 'Шестерни, пресс, миксер, deployer, конвейер, каретки', note: 'Самодостаточная кинетическая ветка' },
      { name: 'Immersive Engineering', key: 'Коксовая печь, доменная печь, сталь, металлический пресс', note: 'Удобный поток стали' },
      { name: 'Mekanism', key: '2–5× обогащение руды, цифровой шахтёр, телепортер, MekaSuit', note: 'Энергосеть и своя сталь' },
      { name: 'Applied Energistics 2', key: 'ME-сеть, ячейки хранения, процессоры, молекулярный сборщик', note: 'Автокрафт и хранение' },
      { name: 'Modern Industrialization', key: 'Мультиблоки, химия, нефть, Квантовая броня', note: 'Вершина технологий пака' },
      { name: 'Extended Industrialization', key: 'Нано- и ньяно-квантовые комплекты поверх MI', note: 'Надстройка над MI' },
      { name: 'Oritech / EnderIO / Powah', key: 'Альтернативные машины, проводники и генерация энергии', note: 'Параллельные тех-ветки' },
      { name: 'Refined Storage 2', key: 'Цифровое хранилище и автокрафт — альтернатива AE2', note: 'На выбор с AE2' },
      { name: 'Industrial Foregoing', key: 'Фермы растений и мобов, лазерный бур, пластик, жидкостные машины', note: 'Поток ресурсов, снаряжения нет' },
    ],
  },
  {
    name: 'Магия',
    color: 'purple',
    mods: [
      { name: 'Ars Nouveau', key: 'Конструктор заклинаний из глифов, мана, фамильяры', note: 'Полностью независимая ветка' },
      { name: 'Forbidden Arcanus', key: 'Клибано, ритуалы, тёмные артефакты', note: 'Тайные искусства' },
      { name: 'Malum', key: 'Духи, алтарь, спиритизм', note: 'Работа с душами' },
      { name: 'Occultism', key: 'Призыв демонов, ритуалы, измерение хранилища', note: 'Демонология' },
      { name: "Iron's Spellbooks", key: 'Школы заклинаний, посохи, книги заклинаний', note: 'Боевая магия' },
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
      { name: "L_Ender's Cataclysm", key: 'Игнис, Левиафан, Сцилла, Харбингер — боссы со своим снаряжением', note: 'Самостоятельная боевая ветка' },
      { name: 'Eternal Starlight', key: 'Своё измерение, боссы, эфиросцент и редкие сплавы', note: 'Ветка исследования' },
      { name: 'Draconic Evolution', key: 'Дракониевые ядра, крафт слияния, реактор, Броня Хаоса', note: 'Мощная энергетика, но не финал' },
      { name: 'Эволюция (FTB Evolution)', key: 'Пирамида: материя, арканум, Воплощённое трансцендентство', note: 'Финал прогрессии' },
    ],
  },
  {
    name: 'Комфорт и хранение',
    color: 'green',
    mods: [
      { name: 'Sophisticated Backpacks', key: 'Рюкзаки с апгрейдами: авто-подбор, сортировка, компактное хранение', note: 'Нужен с первых минут' },
      { name: 'Farmer\'s Delight', key: 'Готовка, блюда, урожай и комфортная еда на старте', note: 'Стабильная еда' },
      { name: 'Supplementaries', key: 'Верёвки, флаги, фонари, доски объявлений, декор', note: 'Декор и утилити' },
      { name: 'Simple Teleporters', key: 'Крафтящийся блок-телепортер для быстрых перемещений', note: 'Основной транспорт' },
      { name: 'Tempad', key: 'Портал в любую сохранённую точку прямо из руки', note: 'Личные порталы' },
      { name: 'FTB Essentials', key: 'Служебные команды: дом, варпы, back', note: 'Команды перемещения' },
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
            Полное прохождение сборки для Minecraft {{ siteConfig.serverVersion }}: от первой ночи
            в кромешной тьме до Квантовой брони и Воплощённого трансцендентства.
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

      <!-- ─── ASCENT: narrative spine ─── -->
      <div class="surface-card gp-card asc">
        <h2 class="gp-section-title">Путь сборки за девять глав</h2>
        <p class="gp-tier-hint">
          Сборка начинается с того, что ты ничего не видишь, и заканчивается тем, что светишь сам.
          Линия слева заполняется по мере того, как ты отмечаешь пункты в чеклистах ниже.
        </p>

        <ol class="asc__list" :style="{ '--asc-progress': ascentProgress }">
          <li
            v-for="(ch, i) in ascentChapters"
            :key="ch.stage"
            class="asc__chapter"
            :class="{ 'is-done': chapterDone(ch.stage) }"
          >
            <button type="button" class="asc__hit" @click="scrollToSection('sec-progression')">
              <span class="asc__node" aria-hidden="true"></span>
              <span class="asc__num">{{ String(i + 1).padStart(2, '0') }}</span>
              <span class="asc__body">
                <span class="asc__era">{{ ch.era }}</span>
                <span class="asc__line">{{ ch.line }}</span>
              </span>
            </button>
          </li>
        </ol>
      </div>

      <!-- ─── MAIN: sidebar + stages ─── -->
      <div id="sec-progression"></div>
      <div class="gp-layout">

        <!-- sticky nav -->
        <aside class="gp-nav surface-card">
          <p class="gp-nav__label">Разделы гайда</p>
          <div class="gp-toc">
            <button
              v-for="sec in pageSections"
              :key="sec.id"
              type="button"
              class="gp-toc__item"
              @click="scrollToSection(sec.id)"
            >
              <span aria-hidden="true">{{ sec.icon }}</span>{{ sec.label }}
            </button>
          </div>

          <p class="gp-nav__label" style="margin-top:.75rem">Маршрут</p>
          <nav class="gp-nav__list">
            <a v-for="stage in visibleStages" :key="stage.id" :href="`#${stage.id}`" class="gp-nav-link">
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
          <div class="gp-branchbar">
            <button
              v-for="b in branches"
              :key="b.id"
              type="button"
              class="gp-branch"
              :class="{ active: activeBranch === b.id }"
              @click="activeBranch = b.id"
            >
              <span aria-hidden="true">{{ b.icon }}</span>{{ b.label }}
              <em>{{ b.id === 'all' ? stages.length : stages.filter((s) => s.branch === b.id).length }}</em>
            </button>
          </div>

          <article v-for="stage in visibleStages" :id="stage.id" :key="stage.id" class="surface-card gp-stage">
            <div class="gp-stage__header">
              <div>
                <div class="gp-stage__num">
                  Этап {{ stage.number }}
                  <span v-if="stage.branch !== 'main'" class="gp-branch-chip">ветка</span>
                </div>
                <h2 class="gp-stage__title">{{ stage.title }}</h2>
                <p class="gp-stage__goal">{{ stage.goal }}</p>
              </div>
              <div class="gp-tags">
                <span v-for="tag in stage.tags" :key="tag" class="gp-tag">{{ tag }}</span>
              </div>
            </div>

            <div v-if="stage.gate" class="gp-gate">
              <img
                v-if="iconUrl(stage.gate.id)"
                :src="iconUrl(stage.gate.id)"
                :alt="stage.gate.name"
                class="gp-gate__icon"
                loading="lazy"
                @error="onIconError"
              />
              <div class="gp-gate__text">
                <span class="gp-gate__label">Эпоха засчитывается за</span>
                <strong>{{ stage.gate.name }}</strong>
                <code>{{ stage.gate.id }}</code>
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
      <div :id="'sec-crosslinks'" class="surface-card gp-card">
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
      <div :id="'sec-tips'" class="surface-card gp-card">
        <h2 class="gp-section-title">Как проходить без лишней боли</h2>
        <div class="gp-tips-grid">
          <div v-for="tip in tips" :key="tip.title" class="gp-tip">
            <strong>{{ tip.title }}</strong>
            <small>{{ tip.text }}</small>
          </div>
        </div>
      </div>

      <!-- ─── TIER GATES ─── -->
      <div :id="'sec-skills'" class="surface-card gp-card">
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
      <div :id="'sec-farms'" class="surface-card gp-card">
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
      <div :id="'sec-commands'" class="surface-card gp-card">
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
      <div :id="'sec-mods-key'" class="surface-card gp-card">
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
      <div :id="'sec-economy'" class="surface-card gp-card">
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
      <div :id="'sec-market'" class="surface-card gp-card">
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
      <div :id="'sec-quests'" class="surface-card gp-card">
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
      <div :id="'sec-bp'" class="surface-card gp-card">
        <h2 class="gp-section-title">Battle Pass (/bp)</h2>
        <p class="gp-tier-hint"><strong>500 уровней</strong>, по <strong>2 500 XP</strong> на уровень — шаг подобран так, чтобы упорный игрок закрывал пасс к концу сезона. Каждый уровень даёт награду на обеих дорожках: предмет, монеты, Void Coin или опыт. XP за мобов, сделки и достижения ограничен <strong>8 000 в день</strong>, а XP за квесты этот лимит НЕ расходует.</p>

        <div class="gp-limits-row" style="margin-bottom:.85rem">
          <div class="gp-limit-chip">
            <span class="gp-limit-label">Уровни</span>
            <span class="gp-limit-value">1 – 500</span>
            <span class="gp-limit-hint">2 500 XP на уровень</span>
          </div>
          <div class="gp-limit-chip">
            <span class="gp-limit-label">Выходные</span>
            <span class="gp-limit-value">×2 XP</span>
            <span class="gp-limit-hint">суббота и воскресенье</span>
          </div>
          <div class="gp-limit-chip">
            <span class="gp-limit-label">Финал сезона</span>
            <span class="gp-limit-value">×2 XP</span>
            <span class="gp-limit-hint">последняя неделя, множители складываются</span>
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
      <div :id="'sec-modsell'" class="surface-card gp-card">
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

      <!-- ─── LIVE MOD CATALOGUE ─── -->
      <div :id="'sec-allmods'" class="surface-card gp-card">
        <h2 class="gp-section-title">
          Весь состав сборки
          <span v-if="!modsLoading" class="gp-mods-total">{{ modCounts.all }} модов</span>
        </h2>
        <p class="gp-tier-hint">
          Список читается прямо из состава пака, поэтому не устаревает: добавили или
          убрали мод — здесь сразу актуально. Ищи по названию, id или описанию.
        </p>

        <div class="gp-branchbar">
          <button
            v-for="c in MOD_CATEGORIES"
            :key="c.id"
            type="button"
            class="gp-branch"
            :class="{ active: activeModCat === c.id }"
            @click="activeModCat = c.id"
          >
            <span aria-hidden="true">{{ c.icon }}</span>{{ c.label }}
            <em>{{ modCounts[c.id] || 0 }}</em>
          </button>
        </div>

        <input
          v-model="modSearch"
          type="search"
          class="gp-mod-search"
          placeholder="Поиск по модам — например «create», «магия», «хранение»"
        />

        <p v-if="modsLoading" class="gp-tier-hint">Загружаем состав сборки…</p>
        <p v-else-if="!filteredMods.length" class="gp-tier-hint">Ничего не нашлось.</p>

        <div v-else class="gp-mod-list">
          <div v-for="mod in filteredMods" :key="mod.id" class="gp-mod-row">
            <div class="gp-mod-row__left">
              <strong class="gp-mod-name">{{ mod.name || mod.id }}</strong>
              <span class="gp-mod-key">{{ mod.description_ru || mod.description || '—' }}</span>
            </div>
            <span class="gp-mod-note">{{ mod.id }}</span>
          </div>
        </div>
      </div>

    </div>
  </section>
</template>

<style scoped>
/* Пиксельный шрифт — родной язык темы. Применяется ТОЛЬКО к дисплейным
   элементам (заголовки разделов, номера, крупные значения); всё читаемое
   остаётся на Inter. @import обязан быть первым, иначе Vite его выбрасывает. */
@import url('https://fonts.googleapis.com/css2?family=Silkscreen:wght@400;700&display=swap');


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

/* ── Фильтр веток прогрессии ── */
.gp-branchbar {
  display: flex;
  flex-wrap: wrap;
  gap: .5rem;
  margin-bottom: 1rem;
}

.gp-branch {
  display: inline-flex;
  align-items: center;
  gap: .4rem;
  padding: .45rem .85rem;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(255,255,255,.04);
  color: rgba(255,255,255,.7);
  font-size: .8rem;
  font-weight: 600;
  cursor: pointer;
  transition: background .15s, border-color .15s, color .15s;
}

.gp-branch:hover { background: rgba(255,255,255,.08); color: rgba(255,255,255,.9); }

.gp-branch.active {
  background: rgba(56,189,248,.16);
  border-color: rgba(56,189,248,.45);
  color: #e0f2fe;
}

.gp-branch em {
  font-style: normal;
  font-size: .7rem;
  opacity: .65;
}

.gp-branch-chip {
  margin-left: .45rem;
  padding: .05rem .4rem;
  border-radius: 999px;
  background: rgba(168,85,247,.18);
  border: 1px solid rgba(168,85,247,.35);
  color: #e9d5ff;
  font-size: .62rem;
  letter-spacing: .04em;
  text-transform: uppercase;
}

/* ── Предмет-гейт эпохи ── */
.gp-gate {
  display: flex;
  align-items: center;
  gap: .75rem;
  margin: 0 0 .9rem;
  padding: .6rem .8rem;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.1);
  background: rgba(255,255,255,.035);
}

.gp-gate__icon {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  image-rendering: pixelated;
}

.gp-gate__text {
  display: flex;
  flex-direction: column;
  gap: .1rem;
  min-width: 0;
}

.gp-gate__label {
  font-size: .68rem;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: rgba(255,255,255,.45);
}

.gp-gate__text strong {
  font-size: .9rem;
  color: rgba(255,255,255,.92);
}

.gp-gate__text code {
  font-size: .7rem;
  color: rgba(56,189,248,.75);
  word-break: break-all;
}

.gp-mods-total {
  margin-left: .6rem;
  font-size: .75rem;
  font-weight: 600;
  color: rgba(255,255,255,.45);
}

.gp-mod-search {
  width: 100%;
  margin: 0 0 .9rem;
  padding: .55rem .8rem;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(255,255,255,.04);
  color: rgba(255,255,255,.9);
  font-size: .85rem;
}

.gp-mod-search:focus {
  outline: none;
  border-color: rgba(56,189,248,.5);
  background: rgba(255,255,255,.06);
}

/* ── Оглавление страницы ── */
.gp-toc {
  display: flex;
  flex-direction: column;
  gap: .15rem;
  margin-bottom: .35rem;
}

.gp-toc__item {
  display: flex;
  align-items: center;
  gap: .45rem;
  padding: .32rem .5rem;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: rgba(255,255,255,.6);
  font-size: .78rem;
  text-align: left;
  cursor: pointer;
  transition: background .15s, color .15s;
}

.gp-toc__item:hover {
  background: rgba(255,255,255,.06);
  color: rgba(255,255,255,.92);
}

/* ══ Пиксельная дисплейная типографика ═══════════════════════════════════
   Одна гарнитура на все акцентные цифры и заголовки страницы — так шрифт
   читается как система, а не как случайная вставка в одном блоке. */
.gp-h1,
.gp-section-title,
.gp-stage__num,
.gp-progress__num,
.gp-limit-value,
.asc__num {
  font-family: 'Silkscreen', 'JetBrains Mono', ui-monospace, monospace;
  letter-spacing: .02em;
}

.gp-h1 { font-size: clamp(1.5rem, 4vw, 2.1rem); }
.gp-section-title { font-size: clamp(.98rem, 2.4vw, 1.15rem); letter-spacing: .03em; }
.gp-progress__num { font-variant-numeric: tabular-nums; }
.gp-limit-value { font-variant-numeric: tabular-nums; }

/* ══ Путь сборки ══════════════════════════════════════════════════════════
   Единственный акцент страницы. Палитра — та же фиолетово-голубая, что у
   всего сайта (--site-accent → sky), карточка обычная surface-card, так что
   блок не выпадает из вёрстки. Длина яркой части линии = реальному прогрессу
   игрока по чеклистам, поэтому это данные, а не украшение. */
.asc__list {
  position: relative;
  margin: .25rem 0 0;
  padding: 0 0 0 1.65rem;
  list-style: none;
}

.asc__list::before,
.asc__list::after {
  content: '';
  position: absolute;
  left: .3rem;
  top: .7rem;
  width: 2px;
  border-radius: 2px;
}

.asc__list::before {
  bottom: .7rem;
  background: rgba(148, 163, 184, .16);
}

.asc__list::after {
  height: calc((100% - 1.4rem) * clamp(0.015, var(--asc-progress, 0), 1));
  background: linear-gradient(180deg, #8b5cf6 0%, #a78bfa 45%, #7dd3fc 100%);
  box-shadow: 0 0 14px rgba(139, 92, 246, .45);
  transition: height .8s cubic-bezier(.2,.7,.2,1);
}

.asc__chapter { position: relative; }

.asc__hit {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: baseline;
  gap: 0 .85rem;
  width: 100%;
  padding: .42rem 0;
  border: 0;
  background: none;
  text-align: left;
  cursor: pointer;
  border-radius: 10px;
  transition: background .15s;
}

.asc__hit:hover { background: rgba(255,255,255,.035); }

.asc__node {
  position: absolute;
  left: -1.65rem;
  top: .95rem;
  width: 7px;
  height: 7px;
  transform: translateX(-2.5px);
  border-radius: 50%;
  background: #131b2e;
  border: 2px solid rgba(148, 163, 184, .3);
}

.is-done .asc__node {
  background: #7dd3fc;
  border-color: #7dd3fc;
  box-shadow: 0 0 10px rgba(125, 211, 252, .75);
}

.asc__num {
  font-size: .9rem;
  font-variant-numeric: tabular-nums;
  color: rgba(167, 139, 250, .85);
}

.is-done .asc__num { color: #7dd3fc; }

.asc__body { display: block; min-width: 0; }

.asc__era {
  display: block;
  font-size: .95rem;
  font-weight: 700;
  color: rgba(255,255,255,.92);
}

.asc__line {
  display: block;
  margin-top: .1rem;
  max-width: 66ch;
  font-size: .84rem;
  line-height: 1.6;
  color: rgba(255,255,255,.55);
}

@media (prefers-reduced-motion: reduce) {
  .asc__list::after { transition: none; }
}

/* ══ Доводка страницы ═════════════════════════════════════════════════════
   Акцент на странице один — линия пути выше. Здесь только дисциплина:
   воздух, единый маркер разделов и слот предмета в родной для темы форме. */

/* Разделы читаются как главы: тонкая фиолетовая засечка вместо капслока. */
.gp-card { padding: clamp(1rem, 2.5vw, 1.5rem); }

.gp-section-title {
  display: flex;
  align-items: center;
  gap: .6rem;
  color: rgba(226, 232, 240, .95);
  margin: 0 0 1rem;
}

.gp-section-title::before {
  content: '';
  flex: none;
  width: 3px;
  height: 1.05em;
  border-radius: 2px;
  background: linear-gradient(180deg, #8b5cf6, #7dd3fc);
}

/* Номер этапа — пиксельная цифра, а не разрядка капслоком. */
.gp-stage__num {
  display: flex;
  align-items: center;
  gap: .5rem;
  font-size: .82rem;
  font-weight: 700;
  letter-spacing: .04em;
  text-transform: none;
  color: rgba(167, 139, 250, .8);
  margin-bottom: .3rem;
}

.gp-stage { padding: clamp(1rem, 2.5vw, 1.35rem); }
.gp-stage__title { letter-spacing: -.01em; }

/* Предмет-гейт: квадратный слот — форма, родная для инвентаря игры. */
.gp-gate {
  align-items: center;
  gap: .85rem;
  padding: .7rem .85rem;
  border-radius: 16px;
  border-color: rgba(139, 92, 246, .2);
  background:
    linear-gradient(180deg, rgba(139, 92, 246, .07), rgba(139, 92, 246, .02));
}

.gp-gate__icon {
  width: 44px;
  height: 44px;
  padding: 5px;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, .18);
  background: rgba(8, 12, 22, .75);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.05);
}

.gp-gate__text code {
  align-self: flex-start;
  padding: .06rem .34rem;
  border-radius: 5px;
  background: rgba(125, 211, 252, .09);
}

/* Чипы веток и оглавление — чуть плотнее и с фокусом для клавиатуры. */
.gp-branch:focus-visible,
.gp-toc__item:focus-visible,
.asc__hit:focus-visible,
.gp-mod-search:focus-visible {
  outline: 2px solid rgba(139, 92, 246, .65);
  outline-offset: 2px;
}

/* Строки каталога модов: спокойная зебра вместо рамок у каждой. */
.gp-mod-row {
  border-radius: 10px;
  padding-inline: .55rem;
}

.gp-mod-row:nth-child(odd) { background: rgba(255,255,255,.022); }
.gp-mod-row:hover { background: rgba(139, 92, 246, .07); }
</style>
