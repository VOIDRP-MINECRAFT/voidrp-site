<script setup>
import { siteConfig } from '../config.site'

const updatedAt = '21 мая 2026 года'

const operator = {
  name: 'Миронов А.А. (физическое лицо)',
  site: siteConfig.siteUrl,
  email: 'support@void-rp.ru',
  telegram: siteConfig.telegramUrl,
}

const toc = [
  { id: 'general',      label: 'Общие положения' },
  { id: 'data',         label: 'Какие данные обрабатываются' },
  { id: 'goals',        label: 'Цели обработки' },
  { id: 'legal-basis',  label: 'Правовые основания' },
  { id: 'public',       label: 'Публичные данные' },
  { id: 'third',        label: 'Передача третьим лицам' },
  { id: 'security',     label: 'Хранение и защита' },
  { id: 'rights',       label: 'Права пользователя' },
  { id: 'cookies',      label: 'Cookies' },
  { id: 'contact',      label: 'Обращения' },
  { id: 'changes',      label: 'Изменение политики' },
]

const collectedData = [
  'логин аккаунта на сайте',
  'игровой ник Minecraft',
  'адрес электронной почты',
  'пароль в защищённом виде, без хранения открытого пароля',
  'технические данные сессии: токены входа, дата входа, устройство, IP-адрес, user-agent',
  'данные публичного профиля, если пользователь сам их заполняет: отображаемое имя, описание, статус, изображения профиля',
  'данные игрового взаимодействия, связанные с аккаунтом: государство, роль, активность, заявки, публичная статистика',
  'данные системы Battle Pass: уровень, опыт, текущий сезон, статус и срок действия Premium-подписки',
  'данные выполнения квестов: ежедневные квесты, квесты Battle Pass, прогресс и дата последнего выполнения',
  'ссылки и текстовые комментарии к предложениям клиентских модов, если пользователь самостоятельно их отправляет через лаунчер',
]

const goals = [
  'регистрация и вход в аккаунт VoidRP',
  'подтверждение электронной почты и восстановление доступа',
  'работа личного кабинета, публичного профиля и лаунчера',
  'связь аккаунта сайта с игровым аккаунтом Minecraft',
  'обеспечение безопасности, защита от взломов, спама, обхода блокировок и нарушений правил',
  'ведение игровой статистики, рейтингов, государств, альянсов и иных публичных игровых разделов',
  'ведение и отображение прогресса Battle Pass: уровень, сезон, статус Premium — в личном кабинете и публичном профиле',
  'обеспечение работы системы ежедневных квестов и квестов Battle Pass',
  'обработка и учёт покупки Premium Battle Pass: проверка оплаты, активация, хранение срока действия подписки',
  'рассылка технических уведомлений, связанных с аккаунтом и безопасностью',
  'обработка предложений пользователей по добавлению клиентских модов, передаваемых через лаунчер',
]

const rights = [
  'получить сведения об обработке своих персональных данных',
  'попросить уточнить, заблокировать или удалить некорректные данные',
  'отозвать согласие на обработку персональных данных, если дальнейшая обработка не требуется по закону или для исполнения соглашения',
  'обратиться к администрации проекта по вопросам персональных данных',
  'обжаловать действия оператора в уполномоченный орган по защите прав субъектов персональных данных',
]

const securityMeasures = [
  'использование защищённого соединения HTTPS',
  'хранение паролей только в хэшированном виде',
  'ограничение доступа к административным инструментам',
  'использование токенов доступа и refresh-сессий',
  'ведение технических журналов для безопасности и расследования инцидентов',
  'ограничение обработки данных целями, указанными в настоящей политике',
]
</script>

<template>
  <div id="top" class="py-6 md:py-8">
    <div class="container-shell max-w-5xl">

      <!-- Hero -->
      <div class="legal-hero mb-5">
        <div class="legal-hero__badge">Политика конфиденциальности</div>
        <h1 class="legal-hero__title">
          Политика конфиденциальности<br class="hidden sm:block"> и обработки персональных данных
        </h1>
        <p class="legal-hero__desc">
          Настоящая политика описывает, какие данные собирает проект {{ siteConfig.serverName }},
          зачем они используются, как защищаются и как пользователь может обратиться по вопросам обработки данных.
        </p>

        <div class="legal-hero__meta">
          <div class="legal-meta-cell">
            <p class="metric-label">Дата редакции</p>
            <p class="legal-meta-val">{{ updatedAt }}</p>
          </div>
          <div class="legal-meta-cell">
            <p class="metric-label">Сайт</p>
            <p class="legal-meta-val break-all">{{ operator.site }}</p>
          </div>
          <div class="legal-meta-cell">
            <p class="metric-label">Контакт</p>
            <p class="legal-meta-val break-all">{{ operator.email }}</p>
          </div>
        </div>
      </div>

      <!-- Two-column layout -->
      <div class="legal-layout">

        <!-- Sticky TOC sidebar -->
        <aside class="legal-toc">
          <p class="legal-toc__heading">Содержание</p>
          <nav class="legal-toc__nav">
            <a
              v-for="(item, i) in toc"
              :key="item.id"
              :href="`#${item.id}`"
              class="legal-toc__link"
            >
              <span class="legal-toc__num">{{ i + 1 }}</span>
              {{ item.label }}
            </a>
          </nav>
          <div class="legal-toc__footer">
            <a href="#top" class="legal-toc__top">↑ Наверх</a>
            <RouterLink to="/offer" class="legal-toc__doc">Договор оферты →</RouterLink>
          </div>
        </aside>

        <!-- Content -->
        <div class="legal-sections">

          <section id="general" class="surface-card legal-section">
            <h2 class="legal-title"><span class="legal-num">1</span>Общие положения</h2>
            <div class="legal-text">
              <p>
                1.1. Оператором персональных данных является {{ operator.name }}, осуществляющий администрирование сайта,
                игрового сервера, лаунчера и связанных сервисов {{ siteConfig.serverName }}.
              </p>
              <p>
                1.2. Используя сайт, регистрируя аккаунт, входя в личный кабинет, используя лаунчер или играя на сервере,
                пользователь подтверждает, что ознакомился с настоящей политикой.
              </p>
              <p>
                1.3. Политика применяется к сайту {{ siteConfig.siteUrl }}, API, личному кабинету, лаунчеру,
                игровому серверу Minecraft и связанным публичным разделам проекта.
              </p>
              <p>
                1.4. Если пользователь не согласен с условиями политики, он должен прекратить регистрацию,
                использование сайта, лаунчера и игрового сервера.
              </p>
            </div>
          </section>

          <section id="data" class="surface-card legal-section">
            <h2 class="legal-title"><span class="legal-num">2</span>Какие данные могут обрабатываться</h2>
            <p class="legal-muted">
              Проект обрабатывает только те данные, которые нужны для регистрации, безопасности, работы аккаунта,
              игрового сервиса и публичных функций.
            </p>
            <div class="mt-4 grid gap-2">
              <div v-for="item in collectedData" :key="item" class="legal-row">
                <span class="legal-row__bullet">◆</span>
                <p>{{ item }}</p>
              </div>
            </div>
          </section>

          <section id="goals" class="surface-card legal-section">
            <h2 class="legal-title"><span class="legal-num">3</span>Цели обработки данных</h2>
            <div class="mt-4 grid gap-2">
              <div v-for="item in goals" :key="item" class="legal-row">
                <span class="legal-row__bullet">◆</span>
                <p>{{ item }}</p>
              </div>
            </div>
          </section>

          <section id="legal-basis" class="surface-card legal-section">
            <h2 class="legal-title"><span class="legal-num">4</span>Правовые основания обработки</h2>
            <div class="legal-text">
              <p>
                4.1. Обработка персональных данных осуществляется на основании согласия пользователя,
                настоящей политики, договора оферты, пользовательского соглашения проекта и требований законодательства РФ.
              </p>
              <p>
                4.2. Согласие выражается путём регистрации аккаунта, отправки формы, входа в личный кабинет,
                использования лаунчера или продолжения игры на сервере.
              </p>
              <p>
                4.3. Отдельные технические данные могут обрабатываться для защиты сервиса, предотвращения нарушений,
                расследования инцидентов и обеспечения стабильной работы проекта.
              </p>
            </div>
          </section>

          <section id="public" class="surface-card legal-section">
            <h2 class="legal-title"><span class="legal-num">5</span>Публичные данные</h2>
            <div class="legal-text">
              <p>
                5.1. Часть данных может отображаться публично внутри сайта или игры, если это необходимо для работы
                игровых механик: ник, публичный профиль, государство, роль, рейтинг, статистика, заявки, альянсы,
                активность государства, уровень Battle Pass, статус Premium Battle Pass и иные игровые сведения.
              </p>
              <p>
                5.2. Пользователь самостоятельно отвечает за информацию, которую размещает в публичном профиле,
                описаниях, названиях, изображениях и иных открытых разделах.
              </p>
              <p>
                5.3. Администрация вправе скрывать, изменять или удалять публичные материалы, если они нарушают правила
                сервера, законодательство РФ, права третьих лиц или мешают нормальной работе проекта.
              </p>
            </div>
          </section>

          <section id="third" class="surface-card legal-section">
            <h2 class="legal-title"><span class="legal-num">6</span>Передача данных третьим лицам</h2>
            <div class="legal-text">
              <p>
                6.1. Персональные данные не продаются третьим лицам.
              </p>
              <p>
                6.2. Данные могут передаваться техническим поставщикам, если это необходимо для работы сайта,
                хостинга, почтовой отправки, защиты инфраструктуры, аналитики ошибок или платежей, если такие функции подключены.
              </p>
              <p>
                6.3. Данные могут быть предоставлены государственным органам только в случаях и порядке,
                предусмотренных законодательством РФ.
              </p>
            </div>
          </section>

          <section id="security" class="surface-card legal-section">
            <h2 class="legal-title"><span class="legal-num">7</span>Хранение и защита данных</h2>
            <div class="mt-4 grid gap-2">
              <div v-for="item in securityMeasures" :key="item" class="legal-row">
                <span class="legal-row__bullet">◆</span>
                <p>{{ item }}</p>
              </div>
            </div>
            <div class="legal-text mt-4">
              <p>
                7.1. Данные хранятся столько, сколько необходимо для работы аккаунта, исполнения соглашения,
                защиты проекта, выполнения требований закона и разрешения возможных споров.
              </p>
              <p>
                7.2. После удаления аккаунта часть технических записей может временно сохраняться в журналах безопасности,
                резервных копиях или административной истории, если это необходимо для защиты проекта и соблюдения закона.
              </p>
            </div>
          </section>

          <section id="rights" class="surface-card legal-section">
            <h2 class="legal-title"><span class="legal-num">8</span>Права пользователя</h2>
            <div class="mt-4 grid gap-2">
              <div v-for="item in rights" :key="item" class="legal-row">
                <span class="legal-row__bullet">◆</span>
                <p>{{ item }}</p>
              </div>
            </div>
          </section>

          <section id="cookies" class="surface-card legal-section">
            <h2 class="legal-title"><span class="legal-num">9</span>Cookies и технические идентификаторы</h2>
            <div class="legal-text">
              <p>
                9.1. Сайт может использовать cookies, localStorage и аналогичные технологии для сохранения сессии,
                входа в аккаунт, работы интерфейса, защиты от ошибок и улучшения пользовательского опыта.
              </p>
              <p>
                9.2. Пользователь может ограничить использование cookies в настройках браузера, но часть функций сайта
                может работать некорректно.
              </p>
            </div>
          </section>

          <section id="contact" class="surface-card legal-section">
            <h2 class="legal-title"><span class="legal-num">10</span>Обращения по персональным данным</h2>
            <div class="legal-text">
              <p>
                10.1. По вопросам обработки персональных данных пользователь может обратиться к администрации проекта.
              </p>
              <p>
                Email: <a class="legal-link" :href="`mailto:${operator.email}`">{{ operator.email }}</a>
              </p>
              <p>
                Telegram: <a class="legal-link" :href="operator.telegram" target="_blank" rel="noreferrer">{{ operator.telegram }}</a>
              </p>
              <p>
                10.2. В обращении нужно указать аккаунт, email, суть запроса и сведения, позволяющие подтвердить,
                что запрос относится именно к аккаунту заявителя.
              </p>
            </div>
          </section>

          <section id="changes" class="surface-card legal-section">
            <h2 class="legal-title"><span class="legal-num">11</span>Изменение политики</h2>
            <div class="legal-text">
              <p>
                11.1. Администрация может обновлять настоящую политику. Новая редакция вступает в силу с момента
                публикации на сайте, если в тексте не указана иная дата.
              </p>
              <p>
                11.2. Продолжение использования сайта, лаунчера или игрового сервера после публикации новой редакции
                означает согласие пользователя с обновлёнными условиями.
              </p>
            </div>
          </section>

          <!-- Bottom nav -->
          <div class="legal-bottom-nav">
            <RouterLink to="/register" class="btn btn-outline btn-sm">← Регистрация</RouterLink>
            <RouterLink to="/" class="btn btn-ghost btn-sm">На главную</RouterLink>
            <RouterLink to="/offer" class="btn btn-ghost btn-sm ml-auto">Договор оферты →</RouterLink>
          </div>

        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── Hero ─────────────────────────────────────────────── */
.legal-hero {
  border: 1px solid rgba(139, 92, 246, 0.22);
  border-radius: 24px;
  background:
    radial-gradient(ellipse at top left, rgba(139, 92, 246, 0.28) 0%, transparent 48%),
    linear-gradient(135deg, rgba(22, 28, 52, 0.98), rgba(10, 14, 28, 1));
  padding: 1.75rem 1.75rem 1.5rem;
}

.legal-hero__badge {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  border: 1px solid rgba(139, 92, 246, 0.28);
  background: rgba(139, 92, 246, 0.12);
  padding: .32rem .8rem;
  font-size: .75rem;
  font-weight: 800;
  letter-spacing: .18em;
  text-transform: uppercase;
  color: #c4b0ff;
  margin-bottom: .9rem;
}

.legal-hero__title {
  font-size: clamp(1.35rem, 3.5vw, 2rem);
  font-weight: 900;
  letter-spacing: -.035em;
  color: #f8fbff;
  line-height: 1.15;
  margin: 0 0 .75rem;
}

.legal-hero__desc {
  font-size: .9rem;
  line-height: 1.75;
  color: rgba(255, 255, 255, .5);
  margin: 0 0 1.25rem;
  max-width: 64ch;
}

.legal-hero__meta {
  display: grid;
  gap: .75rem;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
}

.legal-meta-cell {
  border: 1px solid rgba(255, 255, 255, .08);
  border-radius: 12px;
  background: rgba(0, 0, 0, .18);
  padding: .75rem .9rem;
}

.legal-meta-val {
  margin-top: .35rem;
  font-size: .85rem;
  font-weight: 700;
  color: rgb(226 232 240);
}

/* ── Layout ───────────────────────────────────────────── */
.legal-layout {
  display: grid;
  gap: 1.25rem;
  align-items: start;
}

@media (min-width: 1024px) {
  .legal-layout {
    grid-template-columns: 200px 1fr;
  }
}

/* ── TOC sidebar ──────────────────────────────────────── */
.legal-toc {
  display: none;
}

@media (min-width: 1024px) {
  .legal-toc {
    display: flex;
    flex-direction: column;
    gap: .2rem;
    position: sticky;
    top: 5rem;
    border: 1px solid rgba(255, 255, 255, .07);
    border-radius: 18px;
    background: rgba(255, 255, 255, .02);
    padding: 1rem;
  }
}

.legal-toc__heading {
  font-size: .75rem;
  font-weight: 800;
  letter-spacing: .18em;
  text-transform: uppercase;
  color: rgb(100 116 139);
  margin: 0 0 .6rem;
  padding: 0 .35rem;
}

.legal-toc__nav {
  display: flex;
  flex-direction: column;
  gap: .1rem;
}

.legal-toc__link {
  display: flex;
  align-items: center;
  gap: .5rem;
  border-radius: 8px;
  padding: .38rem .5rem;
  font-size: .78rem;
  font-weight: 600;
  color: rgb(100 116 139);
  transition: background .15s, color .15s;
  line-height: 1.35;
}

.legal-toc__link:hover {
  background: rgba(139, 92, 246, .1);
  color: #d4c4ff;
}

.legal-toc__num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.3rem;
  height: 1.3rem;
  border-radius: 5px;
  background: rgba(139, 92, 246, .14);
  color: rgb(167 139 250);
  font-size: .75rem;
  font-weight: 900;
  flex-shrink: 0;
}

.legal-toc__footer {
  display: flex;
  flex-direction: column;
  gap: .3rem;
  margin-top: .8rem;
  padding-top: .8rem;
  border-top: 1px solid rgba(255, 255, 255, .06);
}

.legal-toc__top,
.legal-toc__doc {
  border-radius: 8px;
  padding: .38rem .5rem;
  font-size: .76rem;
  font-weight: 700;
  color: rgb(100 116 139);
  transition: color .15s;
}

.legal-toc__top:hover { color: #fff; }
.legal-toc__doc:hover { color: #c4b0ff; }

/* ── Content sections ─────────────────────────────────── */
.legal-sections {
  display: flex;
  flex-direction: column;
  gap: .75rem;
}

.legal-section {
  padding: 1.25rem 1.5rem;
  scroll-margin-top: 5.5rem;
}

@media (min-width: 768px) {
  .legal-section { padding: 1.5rem 1.75rem; }
}

.legal-title {
  display: flex;
  align-items: center;
  gap: .6rem;
  color: rgb(248 250 252);
  font-size: 1.05rem;
  font-weight: 900;
  letter-spacing: -.02em;
  margin: 0;
}

.legal-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.55rem;
  height: 1.55rem;
  border-radius: 7px;
  background: rgba(139, 92, 246, .18);
  color: rgb(167 139 250);
  font-size: .75rem;
  font-weight: 900;
  flex-shrink: 0;
}

.legal-muted {
  margin-top: .7rem;
  color: rgb(148 163 184);
  font-size: .9rem;
  line-height: 1.75;
}

.legal-text {
  display: grid;
  gap: .7rem;
  margin-top: .9rem;
  color: rgb(203 213 225);
  font-size: .9rem;
  line-height: 1.8;
}

.legal-row {
  display: grid;
  grid-template-columns: 1.1rem minmax(0, 1fr);
  gap: .6rem;
  align-items: flex-start;
  border: 1px solid rgba(255, 255, 255, .07);
  border-radius: 10px;
  background: rgba(2, 6, 23, .3);
  padding: .75rem .9rem;
  color: rgb(203 213 225);
  font-size: .88rem;
  line-height: 1.7;
}

.legal-row__bullet {
  color: rgb(167 139 250);
  margin-top: .05rem;
  font-size: .75rem;
}

.legal-link {
  color: rgb(196 181 253);
  font-weight: 800;
  text-decoration: none;
}

.legal-link:hover { color: #fff; }

/* ── Bottom nav ───────────────────────────────────────── */
.legal-bottom-nav {
  display: flex;
  flex-wrap: wrap;
  gap: .5rem;
  margin-top: .25rem;
}
</style>
