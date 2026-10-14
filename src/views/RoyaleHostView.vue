<script setup>
// Шпаргалка ведущего королевской битвы: /royale/host. Ссылок на неё нигде нет, поисковикам
// закрыта (noindex). Только по-русски — для ведущих ивента, как админка. Кода ведущего здесь нет.
import { onBeforeUnmount, onMounted } from 'vue'
import AcademyLogo from '../components/AcademyLogo.vue'

let robots = null
onMounted(() => {
  document.title = 'Шпаргалка ведущего — Королевская битва'
  robots = document.createElement('meta')
  robots.name = 'robots'
  robots.content = 'noindex, nofollow'
  document.head.appendChild(robots)
})
onBeforeUnmount(() => robots?.remove())

const panel = [
  ['Начать игру', 'Отсчёт 10 секунд (большие цифры над спавном), потом все на арену. Кто без команды — раскидает поровну.'],
  ['Перезапустить игру', 'Остановить текущую и сразу начать новую: новая арена, полные сундуки.'],
  ['Следующая фаза зоны', 'Зона начинает сужаться сейчас. Если игра затянулась — нажать пару раз.'],
  ['Остановить игру', 'Все возвращаются в лобби, итоги не считаются.'],
  ['Сбросить припасы', 'Сундук с алмазным лутом падает внутри зоны, над ним красный луч.'],
  ['Пауза / Продолжить', 'Всё замирает: зона, время, игроки стоят, урона нет. На проекторе — «ПАУЗА». Тем же местом в пульте — продолжить.'],
  ['Состояние', 'Сколько команд и игроков, идёт ли игра.'],
]

const commands = [
  ['/host <код>', 'Открыть пульт ведущего после входа'],
  ['/br start', 'Начать игру'],
  ['/br again', 'Перезапустить игру'],
  ['/br stop', 'Остановить игру'],
  ['/br phase', 'Следующая фаза зоны'],
  ['/br drop', 'Сбросить припасы'],
  ['/br pause, /br resume', 'Пауза и продолжение игры'],
  ['/br status', 'Состояние игры'],
  ['/br team <ник> <цвет>', 'Перевести игрока в команду: red, blue, green, yellow, orange, purple, aqua, pink; none — убрать из команды'],
  ['/br mute <ник> [минут]', 'Закрыть чат игроку (по умолчанию на 10 минут)'],
  ['/br unmute <ник>', 'Открыть чат'],
  ['/br clearresults', 'Убрать итоги тестовых игр с табло и пьедестала, сбросить рекорды паркура'],
  ['/br restart [секунд]', 'Перезапустить сервер; поднимется сам примерно через минуту'],
  ['/whitelist off', 'Открыть вход всем'],
  ['/tp <ник>', 'Телепортироваться к игроку'],
  ['/lobby', 'Вернуться в лобби (и ведущему, и выбывшим)'],
  ['/next', 'Зрителю: смотреть следующего игрока'],
]

const trouble = [
  ['Ребёнок вылетел во время игры', 'У него 2 минуты, чтобы зайти снова: вернётся к своей команде с тем, что было. Позже — выбывает.'],
  ['Ребёнок не может зайти', 'Адрес void-rp.ru:25568, версия Minecraft от 1.9 до 26.2 (1.8 не пустит). Ник с матом сервер не пускает — пусть зайдёт под другим. «You are not whitelisted» — /whitelist off.'],
  ['Мат в чате', 'Слова сами заменяются звёздочками, ведущим приходит строка [фильтр]. После 3 раз чат закрывается на 5 минут. Вручную: /br mute <ник> 10.'],
  ['Команды неравные', 'До старта: /br team <ник> <цвет>. Кто не выбрал, того игра раскидает сама так, чтобы никто не остался один.'],
  ['Нужно всё остановить (объяснить, перерыв, тревога)', '«Пауза» в пульте или /br pause: все замирают, урона нет, таймеры стоят. Потом «Продолжить» или /br resume. Кто вышел во время паузы, не выбывает за это время.'],
  ['Игра затянулась', '«Следующая фаза зоны» в пульте — несколько раз. Первые 10 минут без урона можно сократить так же: следующая фаза сразу начнёт сужать зону.'],
  ['Ведущий случайно попал в команду', 'Ведущего круги не записывают. Если вступил через компас — «Выйти из команды» в том же меню.'],
  ['Что-то сломалось на арене', '«Перезапустить игру»: арена каждый раз новая, всё, что разломали, вернётся.'],
  ['Сервер тормозит или завис', '/br restart 10. Через минуту можно заходить снова, команды придётся выбрать заново.'],
  ['Выбывший подсказывает своим', 'Выбывший видит только глазами живых союзников, свободно летать может только когда его команда выбыла целиком.'],
]
</script>

<template>
  <div class="hs-page">
  <div class="hs">
    <header class="hs-head">
      <AcademyLogo class="hs-logo" />
      <div>
        <h1>Шпаргалка ведущего</h1>
        <p>Королевская битва в Minecraft · сервер <b>void-rp.ru:25568</b></p>
      </div>
    </header>

    <section>
      <h2>Перед началом</h2>
      <p class="hs-lead">За 30 минут до прихода детей: сервер свежий, тестов на табло нет, вход открыт, на проекторе видно, как зайти.</p>
      <ol class="hs-check">
        <li>Зайти в игру и ввести <code>/host &lt;код&gt;</code> (код — у Мирона).</li>
        <li><code>/whitelist off</code> — открыть вход для всех.</li>
        <li><code>/br restart 10</code> — перезапустить сервер, через минуту зайти снова и снова ввести <code>/host &lt;код&gt;</code>.</li>
        <li><code>/br clearresults</code> — убрать итоги тестовых игр; в админке («Королевская битва») удалить тестовые матчи.</li>
        <li>На проекторе открыть <a href="/royale/live" target="_blank">void-rp.ru/royale/live</a> и нажать F11.</li>
        <li>Самим зайти по адресу с проектора и проверить, что пускает.</li>
      </ol>
    </section>

    <section>
      <h2>Вход ведущего</h2>
      <p>После каждого входа — <code>/host &lt;код&gt;</code>. Без кода у ника ведущего нет ни пульта, ни команд: на сервер заходят без пароля, и ребёнок может назваться вашим ником.</p>
      <ul>
        <li>Код не показывать детям и не вводить на проекторе.</li>
        <li>Три неверных кода подряд — сервер выкидывает, можно зайти снова.</li>
        <li>Ведущий без команды в игре не участвует: на старте попадает на арену зрителем и летает где угодно. Вернуться — <code>/lobby</code>.</li>
      </ul>
    </section>

    <section>
      <h2>Как провести игру</h2>
      <p class="hs-lead">Одна игра — 30–40 минут. Всё управление в пульте: огненный стержень в хотбаре, правая кнопка мыши.</p>
      <ol>
        <li><b>Сбор.</b> Дети встают на круг цвета своей команды (или выбирают компасом), до 5 человек. Составы видны над кругами и на проекторе.</li>
        <li><b>Старт</b> — «Начать игру». 10 секунд отсчёта (ещё можно сменить команду), около 20 секунд грузится арена.</li>
        <li><b>Высадка.</b> Команды далеко друг от друга, у каждого деревянный меч, хлеб и шлем цвета команды. 5 секунд стоят на месте.</li>
        <li><b>Первые 10 минут — ни драк, ни урона</b> (даже от падения): открывают сундуки, ищут оружие и броню. Раз в минуту приходит совет для новичков (броня, щит, лук, припасы, зона), за 5, 2 и 1 минуту — предупреждения.</li>
        <li><b>Зона</b> начинает сужаться на 10-й минуте, 6 фаз, последняя — примерно на 37-й. За краем зоны отнимается здоровье. Фаза и время — в полосе сверху и на проекторе.</li>
        <li><b>Припасы.</b> В начале фаз 2–5 (≈13, 20, 25 и 30 минута) с неба падает сундук с алмазным лутом, над ним красный луч.</li>
        <li><b>Выбывшие</b> смотрят глазами живых союзников (<code>/next</code> — сменить) или уходят в лобби: там на мониторах игра вживую, а за мостом — паркур и тренировка.</li>
        <li><b>Победа</b> — осталась одна команда. Через 20 секунд все в лобби: табло, пьедестал, фейерверк.</li>
        <li><b>Следующая игра</b> — снова «Начать игру». Команды сохраняются.</li>
      </ol>
    </section>

    <section>
      <h2>Что есть в лобби</h2>
      <ul>
        <li><b>Цветные круги</b> по бокам от спавна — встал на круг, и ты в команде. Над кругом — кто уже в ней.</li>
        <li><b>Мониторы:</b> между играми — итоги прошлой игры, во время игры — она вживую: кто жив, убийства, зона.</li>
        <li><b>Пьедестал</b> под буквами «АКАДЕМИЯ ТОП» — три лучшие команды прошлой игры.</li>
        <li><b>Остров за мостом</b> (на восток, между мониторами): тренировка — круг, где дают деревянный меч и никто не выбывает; паркур вокруг острова с чекпоинтами и табло рекордов.</li>
      </ul>
    </section>

    <section>
      <h2>Пульт ведущего</h2>
      <table>
        <tbody>
          <tr v-for="[name, what] in panel" :key="name"><td class="hs-k">{{ name }}</td><td>{{ what }}</td></tr>
        </tbody>
      </table>
    </section>

    <section>
      <h2>Команды</h2>
      <table>
        <tbody>
          <tr v-for="[cmd, what] in commands" :key="cmd"><td class="hs-k"><code>{{ cmd }}</code></td><td>{{ what }}</td></tr>
        </tbody>
      </table>
    </section>

    <section>
      <h2>Если что-то пошло не так</h2>
      <dl>
        <template v-for="[q, a] in trouble" :key="q">
          <dt>{{ q }}</dt>
          <dd>{{ a }}</dd>
        </template>
      </dl>
    </section>

    <section>
      <h2>После игры</h2>
      <ul>
        <li>В лобби: табло команд и всех игроков, на пьедестале — три лучшие команды.</li>
        <li>На проекторе — «Победа!» и название команды, потом снова сбор.</li>
        <li><b>Итоги дня</b>: очки за место команды (10, 6, 5, 4, 3, 2, 1, 1) и по очку за убийство, сложенные за все игры с утреннего <code>/br clearresults</code>. Видны на проекторе между играми и на мониторах в лобби (по очереди с итогами последней игры).</li>
        <li>Админка → «Королевская битва»: все игры с подробной статистикой, «Выгрузить (Excel)» для учебной части; кнопка «Итоги дня» — таблица команд и игроков за дату и её выгрузка.</li>
        <li>Там же у матча — «Грамоты (печать / PDF)»: впишите имена к никам, выберите, кому, и печатайте.</li>
      </ul>
    </section>
  </div>
  </div>
</template>

<style scoped>
.hs { --red: #e8344e; --line: #e4e4ea; --muted: #6b6b76; max-width: 880px; margin: 0 auto; padding: 32px 16px 64px; color: #111; background: #fff; font-family: Inter, ui-sans-serif, system-ui, sans-serif; font-size: 16px; line-height: 1.5; }
.hs-page { position: fixed; inset: 0; overflow-y: auto; background: #fff; z-index: 10; }
.hs-head { display: flex; align-items: center; gap: 24px; padding-bottom: 20px; border-bottom: 3px solid #111; margin-bottom: 8px; }
.hs-logo { font-size: 52px; flex: none; }
.hs-head h1 { margin: 0; font-size: 28px; font-weight: 900; line-height: 1.1; }
.hs-head p { margin: 4px 0 0; color: var(--muted); }
section { padding-top: 22px; }
h2 { margin: 0 0 10px; font-size: 20px; font-weight: 800; padding-left: 12px; border-left: 4px solid var(--red); }
.hs-lead { margin: 0 0 10px; }
p { margin: 0 0 10px; }
ol, ul { margin: 0; padding-left: 22px; display: grid; gap: 6px; }
ol { list-style: decimal; }
ul { list-style: disc; }
li::marker { color: var(--red); font-weight: 700; }
.hs-check { list-style: none; padding-left: 0; }
.hs-check li { position: relative; padding-left: 30px; }
.hs-check li::before { content: ''; position: absolute; left: 0; top: 3px; width: 16px; height: 16px; border: 2px solid #111; border-radius: 3px; }
code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.92em; background: #f2f2f5; border: 1px solid var(--line); border-radius: 4px; padding: 1px 5px; white-space: nowrap; }
a { color: var(--red); font-weight: 600; }
table { width: 100%; border-collapse: collapse; }
td { border-top: 1px solid var(--line); padding: 8px 10px 8px 0; vertical-align: top; }
tr:last-child td { border-bottom: 1px solid var(--line); }
.hs-k { width: 34%; font-weight: 700; }
dl { margin: 0; display: grid; gap: 4px; }
dt { font-weight: 700; margin-top: 8px; }
dd { margin: 0; }
@media (max-width: 600px) {
  .hs-head { flex-direction: column; align-items: flex-start; gap: 12px; }
  .hs-logo { font-size: 40px; }
  .hs-k { width: auto; }
  tr { display: grid; }
  td { border-top: 0; padding: 2px 0; }
  tr td:first-child { border-top: 1px solid var(--line); padding-top: 8px; }
  tr:last-child td { border-bottom: 0; }
  code { white-space: normal; }
}
@media print {
  .hs-page { position: static; overflow: visible; }
  .hs { padding: 0; max-width: none; font-size: 12px; }
  section { break-inside: avoid; }
}
</style>
