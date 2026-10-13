<script setup>
// Грамоты по матчу королевской битвы: /print/royale/<id>. Лист A4 альбомом на каждого игрока —
// 1 место, призёры, участники; лучшим по убийствам, урону и выживанию — номинация.
// Ник → настоящее имя вписывает учитель, имена запоминаются в этом браузере. Печать или
// «Сохранить как PDF» — обычным диалогом печати.
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { authState } from '../../stores/authStore'
import { royaleMatch } from '../../services/royaleAdminApi'

const route = useRoute()
const match = ref(null)
const error = ref(null)

const NAMES_KEY = 'voidrp_royale_names_v1'
const SETTINGS_KEY = 'voidrp_royale_cert_v1'
const readJson = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key) || '') ?? fallback } catch { return fallback }
}
const names = ref(readJson(NAMES_KEY, {}))
const settings = ref({ who: 'all', event: 'Турнир «Королевская битва» в Minecraft', signer: 'Преподаватель', ...readJson(SETTINGS_KEY, {}) })
watch(settings, (v) => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(v)) } catch { /* private mode */ } }, { deep: true })

// The names box: one «ник — Имя Фамилия» per line.
const namesText = ref('')
function namesToText() {
  const players = match.value?.payload?.players || []
  namesText.value = players.map((p) => `${p.name} — ${names.value[p.name] || ''}`).join('\n')
}
function applyNames() {
  const next = { ...names.value }
  namesText.value.split('\n').forEach((line) => {
    const m = line.match(/^\s*([A-Za-z0-9_]{1,16})\s*[—\-–:=]\s*(.*)$/)
    if (!m) return
    const real = m[2].trim()
    if (real) next[m[1]] = real
    else delete next[m[1]]
  })
  names.value = next
  try { localStorage.setItem(NAMES_KEY, JSON.stringify(next)) } catch { /* private mode */ }
}

onMounted(async () => {
  if (!document.getElementById('cert-font')) {
    const link = document.createElement('link')
    link.id = 'cert-font'
    link.rel = 'stylesheet'
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&display=swap'
    document.head.appendChild(link)
  }
  try {
    match.value = await royaleMatch(authState.accessToken, route.params.id)
    namesToText()
    document.title = `Грамоты — ${match.value.map_title || match.value.map}`
  } catch (e) {
    error.value = e?.message || 'Не удалось загрузить матч'
  }
})

const players = computed(() => match.value?.payload?.players || [])
const date = computed(() => {
  const iso = match.value?.started_at
  return iso ? new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''
})

// Who was best at what: one nomination each, the first that applies.
const NOMINATIONS = [
  { key: 'kills', title: 'Больше всех убийств', min: 1 },
  { key: 'damage_dealt', title: 'Больше всех урона', min: 1 },
  { key: 'alive_seconds', title: 'Дольше всех в игре', min: 1 },
  { key: 'chests_opened', title: 'Больше всех найденных сундуков', min: 1 },
  { key: 'assists', title: 'Больше всех помощи команде', min: 1 },
]
const nominations = computed(() => {
  const out = {}
  for (const n of NOMINATIONS) {
    const top = [...players.value].sort((a, b) => (b[n.key] || 0) - (a[n.key] || 0))[0]
    if (!top || (top[n.key] || 0) < n.min || out[top.name]) continue
    out[top.name] = n.title
  }
  return out
})

const TEAM_HEX = { red: '#e5383b', blue: '#3a5bd9', green: '#2f9e44', yellow: '#d9a400', orange: '#e8590c', purple: '#8e3ab8', aqua: '#1c9fb8', pink: '#d6336c' }
const clock = (s) => `${Math.floor((s || 0) / 60)}:${String((s || 0) % 60).padStart(2, '0')}`
const hearts = (d) => (Math.round(((d || 0) / 2) * 10) / 10).toLocaleString('ru-RU')

const certificates = computed(() => {
  const who = settings.value.who
  return [...players.value]
    .filter((p) => who === 'all' || (who === 'top3' ? p.placement >= 1 && p.placement <= 3 : p.placement === 1))
    .sort((a, b) => (a.placement || 99) - (b.placement || 99) || (b.kills || 0) - (a.kills || 0))
    .map((p) => {
      const place = p.placement || 0
      const prize = place >= 1 && place <= 3
      return {
        nick: p.name,
        name: names.value[p.name] || p.name,
        named: Boolean(names.value[p.name]),
        title: prize ? 'Грамота' : 'Сертификат',
        lead: prize ? 'награждается' : 'вручается',
        reason: prize ? `за ${place} место` : 'за участие',
        team: p.team_title,
        hex: TEAM_HEX[p.team] || '#111',
        place,
        stats: [
          `убийств ${p.kills || 0}`,
          `урон ${hearts(p.damage_dealt)} ❤`,
          `в игре ${clock(p.alive_seconds)}`,
        ],
        nomination: nominations.value[p.name] || null,
      }
    })
})

const print = () => window.print()
</script>

<template>
  <div class="cert-page">
    <div class="cert-tools">
      <div v-if="error" class="cert-error">{{ error }}</div>
      <template v-else-if="match">
        <div class="cert-row">
          <div>
            <div class="cert-h">Грамоты · {{ match.map_title || match.map }} · {{ date }}</div>
            <div class="cert-sub">Лист A4 альбомом на каждого. В диалоге печати можно выбрать «Сохранить как PDF».</div>
          </div>
          <button class="cert-btn cert-btn--acc" :disabled="!certificates.length" @click="print">Печать / PDF ({{ certificates.length }})</button>
        </div>
        <div class="cert-grid">
          <label>Кому
            <select v-model="settings.who">
              <option value="all">Всем участникам</option>
              <option value="top3">Призёрам (1–3 места)</option>
              <option value="win">Только победителям</option>
            </select>
          </label>
          <label>За что
            <input v-model="settings.event" maxlength="120">
          </label>
          <label>Подпись
            <input v-model="settings.signer" maxlength="60">
          </label>
        </div>
        <details class="cert-names">
          <summary>Имена вместо ников (запоминаются в этом браузере)</summary>
          <p>По строке на игрока: <code>ник — Имя Фамилия</code>. Пусто — на грамоте будет ник.</p>
          <textarea v-model="namesText" rows="10" spellcheck="false" />
          <button class="cert-btn" @click="applyNames">Применить имена</button>
        </details>
      </template>
      <div v-else class="cert-sub">Загружаю матч…</div>
    </div>

    <section v-for="c in certificates" :key="c.nick" class="cert">
      <div class="cert-frame">
        <div class="cert-corner" />
        <header class="cert-brand">
          <div class="cert-logo">top<i /></div>
          <div class="cert-brand-t">КОМПЬЮТЕРНАЯ<br>АКАДЕМИЯ</div>
        </header>

        <div class="cert-body">
          <div class="cert-title" :class="{ prize: c.place >= 1 && c.place <= 3 }">{{ c.title }}</div>
          <div class="cert-lead">{{ c.lead }}</div>
          <div class="cert-name">{{ c.name }}</div>
          <div v-if="c.named" class="cert-nick">ник в игре: {{ c.nick }}</div>
          <div class="cert-reason">
            {{ c.reason }} — {{ settings.event }}
          </div>
          <div class="cert-team">команда <b :style="{ color: c.hex }">«{{ c.team }}»</b></div>
          <div v-if="c.nomination" class="cert-nom">Номинация: {{ c.nomination }}</div>
          <div class="cert-stats">{{ c.stats.join(' · ') }}</div>
        </div>

        <footer class="cert-foot">
          <span>{{ date }}</span>
          <span class="cert-sign">{{ settings.signer }} <i /></span>
        </footer>
        <div v-if="c.place >= 1 && c.place <= 3" class="cert-medal" :class="`m${c.place}`">{{ c.place }}</div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.cert-page { background: #e9e9ee; min-height: 100vh; padding: 24px 16px 48px; font-family: Inter, ui-sans-serif, system-ui, sans-serif; color: #111; }

.cert-tools { max-width: 1100px; margin: 0 auto 24px; background: #fff; border-radius: 12px; padding: 18px 20px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06); }
.cert-row { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
.cert-h { font-weight: 800; font-size: 18px; }
.cert-sub { color: #666; font-size: 13px; margin-top: 2px; }
.cert-error { color: #c92a2a; font-weight: 600; }
.cert-grid { display: grid; grid-template-columns: 220px 1fr 220px; gap: 12px; margin-top: 14px; }
.cert-grid label { display: grid; gap: 4px; font-size: 12px; color: #555; font-weight: 600; }
.cert-grid select, .cert-grid input, .cert-names textarea { font: inherit; font-size: 14px; color: #111; border: 1px solid #d0d0d8; border-radius: 8px; padding: 8px 10px; background: #fff; }
.cert-names { margin-top: 14px; font-size: 14px; }
.cert-names summary { cursor: pointer; font-weight: 600; }
.cert-names p { color: #666; font-size: 13px; }
.cert-names textarea { width: 100%; font-family: ui-monospace, monospace; box-sizing: border-box; margin-bottom: 8px; }
.cert-btn { font: inherit; font-weight: 700; font-size: 14px; border: 1px solid #d0d0d8; background: #fff; border-radius: 8px; padding: 9px 16px; cursor: pointer; }
.cert-btn--acc { background: #e8344e; border-color: #e8344e; color: #fff; }
.cert-btn:disabled { opacity: 0.5; cursor: default; }

/* The sheet: A4 landscape, shown at size on screen and printed one per page. */
.cert { width: 297mm; height: 210mm; margin: 0 auto 16px; background: #fff; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12); position: relative; overflow: hidden; box-sizing: border-box; padding: 9mm; }
.cert-frame { position: relative; height: 100%; border: 0.7mm solid #111; box-sizing: border-box; display: flex; flex-direction: column; padding: 11mm 16mm 10mm; }
.cert-corner { position: absolute; top: 6mm; right: 6mm; width: 26mm; height: 26mm; border-top: 4mm solid #e8344e; border-right: 4mm solid #e8344e; }

.cert-brand { display: flex; align-items: center; gap: 5mm; }
.cert-logo { position: relative; font-weight: 900; font-size: 15mm; line-height: 1; letter-spacing: -0.06em; padding-right: 5mm; }
.cert-logo i { position: absolute; top: -1mm; right: -1mm; width: 5mm; height: 5mm; border-top: 1.4mm solid #e8344e; border-right: 1.4mm solid #e8344e; }
.cert-brand-t { font-weight: 800; font-size: 3.6mm; letter-spacing: 0.08em; line-height: 1.25; border-left: 0.5mm solid #111; padding-left: 4mm; }

.cert-body { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.cert-title { font-weight: 900; font-size: 19mm; letter-spacing: 0.12em; text-transform: uppercase; line-height: 1; }
.cert-title.prize { color: #e8344e; }
.cert-lead { margin-top: 4mm; font-size: 5mm; color: #555; letter-spacing: 0.06em; }
.cert-name { margin-top: 5mm; font-weight: 800; font-size: 14mm; line-height: 1.1; border-bottom: 0.5mm solid #111; padding: 0 8mm 2mm; }
.cert-nick { margin-top: 2mm; font-size: 4mm; color: #777; }
.cert-reason { margin-top: 6mm; font-size: 6mm; font-weight: 600; max-width: 220mm; }
.cert-team { margin-top: 2.5mm; font-size: 5mm; color: #444; }
.cert-nom { margin-top: 4mm; display: inline-block; font-size: 5mm; font-weight: 800; color: #fff; background: #111; padding: 1.5mm 5mm; border-radius: 1mm; }
.cert-stats { margin-top: 4mm; font-size: 4.2mm; color: #666; }

.cert-foot { display: flex; justify-content: space-between; align-items: flex-end; font-size: 4.5mm; color: #333; }
.cert-sign { display: flex; align-items: flex-end; gap: 3mm; }
.cert-sign i { display: inline-block; width: 50mm; border-bottom: 0.4mm solid #111; }

.cert-medal { position: absolute; left: 16mm; bottom: 24mm; width: 22mm; height: 22mm; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 11mm; color: #fff; box-shadow: inset 0 0 0 1.2mm rgba(255, 255, 255, 0.45); }
.cert-medal.m1 { background: #d4a017; }
.cert-medal.m2 { background: #9aa0a8; }
.cert-medal.m3 { background: #b06a3b; }

@media screen and (max-width: 1150px) {
  .cert { transform: scale(0.5); transform-origin: top left; margin-bottom: calc(-105mm + 16px); }
  .cert-grid { grid-template-columns: 1fr; }
}

@media print {
  @page { size: A4 landscape; margin: 0; }
  .cert-page { background: #fff; padding: 0; }
  .cert-tools { display: none; }
  .cert { margin: 0; box-shadow: none; page-break-after: always; break-after: page; }
  .cert:last-child { page-break-after: auto; break-after: auto; }
  .cert, .cert * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
</style>
