<script setup>
// «Плагины»: наши плагины и моды — что стоит, что предлагаем, что изменится, скачать.
import { computed, ref } from 'vue'
import { toastError, toastSuccess } from '../../../services/toast'
import { downloadConfig, downloadRelease } from '../../../services/integrationApi'
import { MODULE_NAMES, ago, fmtDate, fmtSize } from './util'

const props = defineProps({
  data: { type: Object, required: true },
  now: { type: Number, required: true },
  canConfig: { type: Boolean, default: false },
})

const ours = computed(() => (props.data.items || []).filter((i) => i.kind === 'ours'))
// Зависимости — и сторонние плагины, и наши (VoidRP Client Info → VoidRpGuard).
const byKey = computed(() => Object.fromEntries((props.data.items || []).map((i) => [i.key, i])))

function status(it) {
  if (it.client_side) return { cls: '', text: 'в пак игроков' }
  if (!it.installed) return { cls: '', text: 'не установлен' }
  if (!it.installed.fresh) return { cls: 'adm-badge--warn', text: 'сервер молчит' }
  if (it.outdated) return { cls: it.changes_since_installed?.some((c) => c.important) ? 'adm-badge--err' : 'adm-badge--warn', text: 'есть обновление' }
  return { cls: 'adm-badge--ok', text: 'актуален' }
}

const busy = ref('')
async function dl(r) {
  busy.value = `r:${r.id}`
  try { await downloadRelease(r.id, r.filename) } catch (e) { toastError(e?.message || 'Не удалось скачать') } finally { busy.value = '' }
}
async function cfg(it) {
  busy.value = `c:${it.key}`
  try {
    await downloadConfig(it.key, it.config_path.split('/').pop())
    toastSuccess(`Конфиг ${it.name} скачан — положите его в ${it.config_path}`)
  } catch (e) { toastError(e?.message || 'Не удалось скачать конфиг') } finally { busy.value = '' }
}
const open = ref(new Set())
function toggle(key) {
  const s = new Set(open.value)
  s.has(key) ? s.delete(key) : s.add(key)
  open.value = s
}
</script>

<template>
  <div class="pl">
    <article v-for="it in ours" :key="it.key" class="adm-card pl-card" :class="{ 'pl-card--old': it.outdated }">
      <header class="pl-head">
        <div class="pl-title">
          <span class="pl-name">{{ it.name }}</span>
          <span class="adm-badge" :class="status(it).cls">{{ status(it).text }}</span>
          <span v-if="it.required" class="adm-badge adm-badge--acc">обязательный</span>
        </div>
        <div class="pl-acts">
          <button v-if="it.latest" class="adm-btn adm-btn--acc adm-btn--sm" :disabled="busy === `r:${it.latest.id}`" @click="dl(it.latest)">Скачать {{ it.latest.version }}</button>
          <button v-if="it.has_config && canConfig" class="adm-btn adm-btn--sm" :disabled="busy === `c:${it.key}`" @click="cfg(it)">Конфиг</button>
        </div>
      </header>
      <p class="pl-sum">{{ it.summary }}</p>

      <div class="pl-vers">
        <div class="pl-ver">
          <span class="pl-ver__label">{{ it.client_side ? 'В паке игроков' : 'На сервере' }}</span>
          <span class="pl-ver__val">{{ it.installed?.version || '—' }}</span>
          <span v-if="it.installed" class="pl-ver__sub">отчёт {{ ago(it.installed.reported_at, now) }}</span>
        </div>
        <span class="pl-arrow">→</span>
        <div class="pl-ver">
          <span class="pl-ver__label">Предлагаем</span>
          <span class="pl-ver__val">{{ it.latest?.version || '—' }}</span>
          <span v-if="it.latest" class="pl-ver__sub">{{ fmtDate(it.latest.published_at) }} · MC {{ it.latest.mc_versions.join(', ') }}</span>
        </div>
        <div v-if="it.modules?.length" class="pl-mods">
          <span v-for="m in it.modules" :key="m" class="pl-mod" :class="{ 'pl-mod--on': it.installed?.modules?.[m]?.ok }">{{ MODULE_NAMES[m] || m }}</span>
        </div>
      </div>

      <div v-if="it.outdated && it.changes_since_installed?.length" class="pl-changes">
        <div class="pl-changes__title">Что изменится</div>
        <div v-for="c in it.changes_since_installed" :key="c.version" class="pl-change">
          <div class="pl-change__v"><b>{{ c.version }}</b> <span v-if="c.important" class="adm-badge adm-badge--err">важное</span></div>
          <div v-if="c.changelog" class="pl-log">{{ c.changelog }}</div>
        </div>
      </div>

      <footer class="pl-foot">
        <span class="adm-mono pl-path">{{ it.client_side ? 'клиентский пак: ' : '' }}{{ it.install_as }}<template v-if="it.config_path"> · {{ it.config_path }}</template></span>
        <span v-if="it.needs?.length" class="pl-deps">нужны:
          <template v-for="n in it.needs" :key="n">
            <a v-if="byKey[n]?.url" :href="byKey[n].url" target="_blank" rel="noopener">{{ byKey[n].name }} {{ byKey[n].version }}</a>
            <span v-else>{{ byKey[n]?.name || n }}</span>
          </template>
        </span>
        <button v-if="it.releases?.length" class="pl-more" @click="toggle(it.key)">{{ open.has(it.key) ? 'Скрыть версии' : `Все версии (${it.releases.length})` }}</button>
      </footer>

      <div v-if="open.has(it.key)" class="pl-releases">
        <div v-for="r in it.releases" :key="r.id" class="pl-rel">
          <div class="pl-rel__head">
            <b>{{ r.version }}</b>
            <span v-if="r.recommended" class="adm-badge adm-badge--ok">рекомендуем</span>
            <span v-if="r.channel === 'beta'" class="adm-badge adm-badge--warn">бета</span>
            <span v-if="r.important" class="adm-badge adm-badge--err">важное</span>
            <span class="pl-muted">{{ fmtDate(r.published_at) }} · MC {{ r.mc_versions.join(', ') }} · {{ r.platforms.join(', ') }} · {{ fmtSize(r.size) }}</span>
            <a v-if="r.source_url" class="pl-gh" :href="r.source_url" target="_blank" rel="noopener">GitHub</a>
            <button class="adm-btn adm-btn--sm pl-rel__dl" :disabled="busy === `r:${r.id}`" @click="dl(r)">Скачать</button>
          </div>
          <div v-if="r.changelog" class="pl-log">{{ r.changelog }}</div>
          <div class="pl-sha adm-mono" title="Контрольная сумма SHA-256">sha256 {{ r.sha256 }}</div>
        </div>
      </div>
    </article>
  </div>
</template>

<style scoped>
.pl { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 480px), 1fr)); gap: 1rem; }
.pl-card { padding: 1rem 1.1rem; display: flex; flex-direction: column; gap: 0.7rem; }
.pl-card--old { border-color: color-mix(in srgb, var(--adm-warn) 45%, var(--adm-line)); }
.pl-head { display: flex; justify-content: space-between; gap: 0.6rem; flex-wrap: wrap; align-items: flex-start; }
.pl-title { display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap; }
.pl-name { font-size: 1.05rem; font-weight: 800; color: var(--adm-text); }
.pl-acts { display: flex; gap: 0.4rem; flex-wrap: wrap; }
.pl-sum { margin: 0; font-size: 0.85rem; color: var(--adm-dim); line-height: 1.45; }
.pl-muted { color: var(--adm-dim); font-size: 0.78rem; }

.pl-vers { display: flex; align-items: center; gap: 0.8rem; flex-wrap: wrap; padding: 0.6rem 0.75rem; border-radius: var(--adm-r-sm); background: var(--adm-card-2); border: 1px solid var(--adm-line); }
.pl-ver { display: flex; flex-direction: column; gap: 0.05rem; }
.pl-ver__label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--adm-faint); }
.pl-ver__val { font-size: 1.05rem; font-weight: 800; color: var(--adm-text); font-family: var(--adm-mono); }
.pl-ver__sub { font-size: 0.72rem; color: var(--adm-dim); }
.pl-arrow { color: var(--adm-faint); font-weight: 800; }
.pl-mods { margin-left: auto; display: flex; gap: 0.3rem; flex-wrap: wrap; justify-content: flex-end; }
.pl-mod { font-size: 0.7rem; padding: 0.1rem 0.45rem; border-radius: 999px; border: 1px solid var(--adm-line); color: var(--adm-faint); }
.pl-mod--on { color: var(--adm-ok); border-color: color-mix(in srgb, var(--adm-ok) 40%, transparent); }

.pl-changes { border-left: 3px solid var(--adm-warn); padding: 0.2rem 0 0.2rem 0.75rem; display: flex; flex-direction: column; gap: 0.45rem; }
.pl-changes__title { font-size: 0.78rem; font-weight: 700; color: var(--adm-text); }
.pl-change__v { font-size: 0.84rem; color: var(--adm-text); }
.pl-log { font-size: 0.82rem; color: var(--adm-text); white-space: pre-line; line-height: 1.45; }

.pl-foot { display: flex; flex-wrap: wrap; gap: 0.4rem 0.9rem; align-items: center; font-size: 0.75rem; color: var(--adm-dim); }
.pl-path { font-size: 0.72rem; }
.pl-deps { display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: center; }
.pl-deps a, .pl-gh { color: var(--adm-acc-text); text-decoration: none; }
.pl-deps a:hover, .pl-gh:hover { text-decoration: underline; }
.pl-more { margin-left: auto; border: 0; background: none; padding: 0; color: var(--adm-acc-text); font-size: 0.8rem; cursor: pointer; }

.pl-releases { border-top: 1px solid var(--adm-line); padding-top: 0.6rem; display: flex; flex-direction: column; gap: 0.65rem; }
.pl-rel__head { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; font-size: 0.84rem; color: var(--adm-text); }
.pl-rel__dl { margin-left: auto; }
.pl-sha { font-size: 0.68rem; color: var(--adm-faint); word-break: break-all; margin-top: 0.15rem; }
</style>
