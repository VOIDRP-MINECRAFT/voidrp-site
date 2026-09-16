<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AccountTabs from '../components/AccountTabs.vue'
import ItemIcon from '../components/ItemIcon.vue'
import { apiRequest } from '../services/apiBase'
import { resendVerification } from '../services/authApi'
import { getMyNation } from '../services/nationsApi'
import { getMyPublicProfile } from '../services/profileApi'
import { getPlayerProgression } from '../services/progressionApi'
import { getBattlePassProfileByNick } from '../services/battlepassApi'
import { getTelegramStatus, unlinkTelegram } from '../services/telegramApi'
import { toastError, toastSuccess } from '../services/toast'
import { reloadMe, useAuthStore } from '../stores/authStore'
import { serverFeatureEnabled } from '../stores/serverStore'

const { t, locale } = useI18n()
const auth = useAuthStore()

const loading = ref(true)
const sendingVerification = ref(false)
const publicProfile = ref(null)
const myNation = ref(null)
const progression = ref(null)
const bpProfile = ref(null)
const telegram = ref(null)
const tgUnlinking = ref(false)
const roadmap = ref(null)
const headStage = ref(0)

// Keys and key items must match epochs.list in the GameSync config.yml (the plugin unlocks an
// epoch when this item first lands in the inventory). Titles and hints come from the roadmap.
const MAIN_EPOCHS = [
  { key: 'mechanisms_age', item: 'create:precision_mechanism' },
  { key: 'steel_age', item: 'ftbmaterials:steel_ingot' },
  { key: 'energy_age', item: 'mekanism:steel_casing' },
  { key: 'automation_age', item: 'ae2:controller' },
  { key: 'industry_age', item: 'modern_industrialization:advanced_machine_hull' },
  { key: 'quantum_age', item: 'modern_industrialization:quantum_chestplate' },
  { key: 'singularity_age', item: 'ftbevolution:ultimate_singularity' },
  { key: 'transcendence', item: 'ftbevolution:realized_transcendence' },
]
const BRANCH_EPOCHS = [
  { key: 'magic_path', item: 'ars_nouveau:enchanting_apparatus' },
  { key: 'arcane_path', item: 'forbidden_arcanus:clibano_core' },
  { key: 'hunter_path', item: 'cataclysm:ignitium_ingot' },
  { key: 'starlight_path', item: 'eternal_starlight:starcore' },
  { key: 'draconic_path', item: 'draconicevolution:chaotic_core' },
]

const lang = computed(() => (String(locale.value).startsWith('en') ? 'en' : 'ru'))
const tx = (o) => (o ? o[lang.value] || o.ru || '' : '')
const dateFmt = (iso, opts = { day: 'numeric', month: 'long', year: 'numeric' }) =>
  iso ? new Intl.DateTimeFormat(lang.value === 'en' ? 'en-US' : 'ru-RU', opts).format(new Date(iso)) : ''

const nick = computed(() => auth.state.playerAccount?.minecraft_nickname || '')
const displayName = computed(() => publicProfile.value?.display_name || auth.displayName.value || t('app.playerFallback'))
const avatarUrl = computed(() => publicProfile.value?.assets?.avatar_url || publicProfile.value?.assets?.avatar_preview_url || '')
const headUrl = computed(() => {
  if (!nick.value || headStage.value >= 2) return ''
  const n = encodeURIComponent(nick.value)
  return headStage.value === 0 ? `/api/v1/public/player-head/${n}` : `https://mc-heads.net/avatar/${n}/128`
})
const avatarText = computed(() => displayName.value.slice(0, 1).toUpperCase())
const publicProfileUrl = computed(() => (publicProfile.value?.slug ? `/u/${publicProfile.value.slug}` : ''))
const memberSince = computed(() => dateFmt(auth.state.user?.created_at))

const nationRoleText = computed(() => {
  switch (String(myNation.value?.viewer_role || '').toLowerCase()) {
    case 'leader': return t('profile.roleLeader')
    case 'officer': return t('profile.roleOfficer')
    case 'member': return t('profile.roleMember')
    default: return ''
  }
})
const nationIcon = computed(() => {
  const n = myNation.value
  return n?.assets?.icon_preview_url || n?.assets?.icon_url || n?.icon_preview_url || n?.icon_url || ''
})
const canManageNation = computed(() => Boolean(myNation.value?.viewer_can_manage))

// Only what is still missing; the card disappears once everything is set up.
const todo = computed(() => {
  const list = []
  if (!auth.emailVerified.value) list.push({ key: 'email', icon: 'mail' })
  if (!publicProfile.value?.bio && !avatarUrl.value) list.push({ key: 'profile', icon: 'user', to: '/profile/public' })
  if (!myNation.value?.slug) list.push({ key: 'nation', icon: 'flag', to: '/nations' })
  return list
})

// ── path through the pack ──────────────────────────────────
const unlocked = computed(() => {
  const map = new Map()
  for (const tier of progression.value?.tiers || []) map.set(tier.tier_name, tier.unlocked_at)
  return map
})
const roadmapSteps = computed(() => {
  const map = new Map()
  for (const block of [...(roadmap.value?.stages || []), ...(roadmap.value?.branches || [])]) {
    for (const step of block.steps) if (!map.has(step.item)) map.set(step.item, { step, block })
  }
  return map
})
// A later main epoch implies the earlier ones (players can skip the detection of a step).
const mainEpochs = computed(() => {
  let lastDone = -1
  MAIN_EPOCHS.forEach((e, i) => { if (unlocked.value.has(e.key)) lastDone = i })
  return MAIN_EPOCHS.map((e, i) => ({
    ...e,
    done: i <= lastDone,
    at: unlocked.value.get(e.key) || null,
    next: i === lastDone + 1,
  }))
})
const doneCount = computed(() => mainEpochs.value.filter((e) => e.done).length)
const currentEpoch = computed(() => [...mainEpochs.value].reverse().find((e) => e.done) || null)
const nextEpoch = computed(() => mainEpochs.value.find((e) => e.next) || null)
const nextTarget = computed(() => {
  if (!nextEpoch.value) return null
  const hit = roadmapSteps.value.get(nextEpoch.value.item)
  return {
    epoch: nextEpoch.value,
    title: hit ? tx(hit.step.title) : '',
    hint: hit ? tx(hit.step.hint) : '',
    chapter: hit ? tx(hit.block.questbook) : '',
  }
})
const branches = computed(() => BRANCH_EPOCHS.map((b) => ({ ...b, done: unlocked.value.has(b.key) })))

// ── battle pass ────────────────────────────────────────────
const bp = computed(() => {
  const p = bpProfile.value
  if (!p) return null
  const max = Number(p.max_level || 0)
  const level = Number(p.level || 0)
  return {
    level,
    max,
    pct: max > 0 ? Math.min(100, (level / max) * 100) : 0,
    xp: Number(p.xp || 0).toLocaleString(lang.value === 'en' ? 'en-US' : 'ru-RU'),
    premium: Boolean(p.has_premium),
    premiumUntil: p.has_premium && p.premium_expires_at ? dateFmt(p.premium_expires_at) : '',
    season: p.season_name || '',
  }
})

async function loadData() {
  loading.value = true
  headStage.value = 0
  try {
    await reloadMe()
    const n = auth.state.playerAccount?.minecraft_nickname
    const [profilePayload, nationPayload, progressionPayload, bpPayload, roadmapPayload] = await Promise.all([
      auth.accessToken ? getMyPublicProfile(auth.accessToken).catch(() => null) : null,
      auth.accessToken ? getMyNation(auth.accessToken).catch(() => null) : null,
      n ? getPlayerProgression(n).catch(() => null) : null,
      n && serverFeatureEnabled('battlepass') ? getBattlePassProfileByNick(n).catch(() => null) : null,
      apiRequest('/game-ui/guide/roadmap', { toast: false }).catch(() => null),
    ])
    publicProfile.value = profilePayload || null
    myNation.value = nationPayload || null
    progression.value = progressionPayload || null
    bpProfile.value = bpPayload || null
    roadmap.value = roadmapPayload || null
    if (auth.accessToken) {
      telegram.value = await getTelegramStatus(auth.accessToken).catch(() => null)
    }
  } catch (e) {
    toastError(e.message || t('profile.loadError'))
  } finally {
    loading.value = false
  }
}

async function sendVerificationAgain() {
  if (!auth.state.user?.email) return
  sendingVerification.value = true
  try {
    await resendVerification({ email: auth.state.user.email })
    toastSuccess(t('profile.verificationSent'))
  } catch (e) {
    toastError(e?.message || t('profile.verificationError'))
  } finally {
    sendingVerification.value = false
  }
}

async function unlinkTg() {
  if (!auth.accessToken) return
  tgUnlinking.value = true
  try {
    telegram.value = await unlinkTelegram(auth.accessToken)
    toastSuccess(t('profile.tgUnlinked'))
  } catch (e) {
    toastError(e?.message || t('profile.tgUnlinkError'))
  } finally {
    tgUnlinking.value = false
  }
}

async function copyLink() {
  if (!publicProfileUrl.value || typeof window === 'undefined') return
  try {
    await navigator.clipboard.writeText(`${window.location.origin}${publicProfileUrl.value}`)
    toastSuccess(t('profile.linkCopied'))
  } catch {
    toastError(t('profile.linkCopyError'))
  }
}

onMounted(loadData)
</script>

<template>
  <section class="cab-page">
    <div class="container-shell cab">
      <!-- who you are -->
      <header class="cab-hero">
        <div class="cab-avatar" :class="{ 'cab-avatar--pixel': !avatarUrl && headUrl }">
          <img v-if="avatarUrl" :src="avatarUrl" alt="" />
          <img v-else-if="headUrl" :src="headUrl" alt="" @error="headStage++" />
          <span v-else>{{ avatarText }}</span>
        </div>
        <div class="cab-hero__text">
          <p class="cab-hello">{{ t('profile.hello') }}</p>
          <h1 class="cab-name">{{ displayName }}</h1>
          <div class="cab-chips">
            <span v-if="currentEpoch" class="cab-chip cab-chip--epoch">{{ t('ages.' + currentEpoch.key) }}</span>
            <RouterLink v-if="myNation?.slug" :to="`/nation/${myNation.slug}`" class="cab-chip">
              <img v-if="nationIcon" :src="nationIcon" alt="" />
              {{ myNation.title }}<span v-if="nationRoleText" class="cab-chip__dim">{{ nationRoleText }}</span>
            </RouterLink>
            <span v-if="bp?.premium" class="cab-chip cab-chip--gold">Premium</span>
            <span v-if="memberSince" class="cab-since">{{ t('profile.memberSince', { date: memberSince }) }}</span>
          </div>
        </div>
        <div class="cab-hero__actions">
          <RouterLink v-if="publicProfileUrl" :to="publicProfileUrl" class="cab-btn cab-btn--primary">
            <svg class="cab-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z"/><circle cx="12" cy="12" r="3"/></svg>
            {{ t('profile.openPublic') }}
          </RouterLink>
          <RouterLink to="/profile/public" class="cab-btn">
            <svg class="cab-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16Z"/><path d="m13.5 6.5 4 4"/></svg>
            {{ t('profile.appearance') }}
          </RouterLink>
          <button v-if="publicProfileUrl" type="button" class="cab-btn cab-btn--icon" :title="t('profile.copyLink')" :aria-label="t('profile.copyLink')" @click="copyLink">
            <svg class="cab-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3.2-3.2a4.5 4.5 0 0 0-6.4-6.4L11.5 6M14 10a4.5 4.5 0 0 0-6.4 0l-3.2 3.2a4.5 4.5 0 0 0 6.4 6.4l1.7-1.6"/></svg>
          </button>
        </div>
      </header>

      <AccountTabs />

      <div v-if="loading" class="cab-grid">
        <div class="skeleton cab-skel cab-skel--main"></div>
        <div class="skeleton cab-skel"></div>
      </div>

      <template v-else>
        <!-- what is still missing -->
        <section v-if="todo.length" class="cab-card cab-todo">
          <h2 class="cab-h">{{ t('profile.todoTitle') }}</h2>
          <ul class="cab-todo__list">
            <li v-for="item in todo" :key="item.key" class="cab-todo__item">
              <span class="cab-todo__text">
                <b>{{ t(`profile.todo.${item.key}.title`) }}</b>
                <span>{{ t(`profile.todo.${item.key}.desc`) }}</span>
              </span>
              <button v-if="item.key === 'email'" type="button" class="cab-btn cab-btn--sm" :disabled="sendingVerification" @click="sendVerificationAgain">
                <span v-if="sendingVerification" class="spinner"></span>
                {{ sendingVerification ? t('profile.resending') : t('profile.todo.email.action') }}
              </button>
              <RouterLink v-else :to="item.to" class="cab-btn cab-btn--sm">{{ t(`profile.todo.${item.key}.action`) }}</RouterLink>
            </li>
          </ul>
        </section>

        <div class="cab-grid">
          <!-- path through the pack -->
          <section class="cab-card cab-path">
            <div class="cab-path__head">
              <div>
                <h2 class="cab-h">{{ t('profile.pathTitle') }}</h2>
                <p class="cab-muted">{{ t('profile.pathSub') }}</p>
              </div>
              <RouterLink to="/leaderboard" class="cab-link">{{ t('profile.leaderboard') }}</RouterLink>
            </div>

            <template v-if="progression">
              <div class="cab-progress">
                <div class="cab-progress__label">
                  <span>{{ currentEpoch ? t('ages.' + currentEpoch.key) : t('profile.pathNotStarted') }}</span>
                  <b>{{ t('profile.epochsOf', { n: doneCount, total: mainEpochs.length }) }}</b>
                </div>
                <div class="cab-segments" role="progressbar" :aria-valuenow="doneCount" aria-valuemin="0" :aria-valuemax="mainEpochs.length">
                  <span v-for="e in mainEpochs" :key="e.key" :class="{ done: e.done, next: e.next }"></span>
                </div>
              </div>
            </template>

            <div v-if="nextTarget" class="cab-next">
              <span class="cab-next__icon"><ItemIcon :itemKey="nextTarget.epoch.item" :size="52" /></span>
              <div class="cab-next__text">
                <p class="cab-next__label">{{ t('profile.nextGoal', { epoch: t('ages.' + nextTarget.epoch.key) }) }}</p>
                <p class="cab-next__title">{{ nextTarget.title || t('ages.' + nextTarget.epoch.key) }}</p>
                <p v-if="nextTarget.hint" class="cab-next__hint">{{ nextTarget.hint }}</p>
                <p class="cab-next__tip">{{ t('profile.roadmapTip') }}</p>
              </div>
            </div>
            <p v-else-if="progression && doneCount === mainEpochs.length" class="cab-done">{{ t('profile.pathComplete') }}</p>

            <ol class="cab-epochs">
              <li v-for="(e, i) in mainEpochs" :key="e.key" class="cab-epoch" :class="{ done: e.done, next: e.next }">
                <span class="cab-epoch__num" aria-hidden="true">
                  <svg v-if="e.done" viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>
                  <template v-else>{{ i + 1 }}</template>
                </span>
                <span class="cab-epoch__name">{{ t('ages.' + e.key) }}</span>
                <span class="cab-epoch__meta">{{ e.at ? dateFmt(e.at, { day: 'numeric', month: 'short' }) : e.next ? t('profile.epochNext') : '' }}</span>
              </li>
            </ol>

            <div class="cab-branches">
              <p class="cab-branches__title">{{ t('profile.branchesTitle') }}</p>
              <div class="cab-branches__list">
                <span v-for="b in branches" :key="b.key" class="cab-branch" :class="{ done: b.done }">
                  <ItemIcon :itemKey="b.item" :size="20" />
                  {{ t('ages.' + b.key) }}
                </span>
              </div>
            </div>

            <p v-if="!progression" class="cab-muted cab-empty">{{ nick ? t('profile.noProgression') : t('profile.noNickname') }}</p>
          </section>

          <aside class="cab-side">
            <!-- battle pass -->
            <section v-if="serverFeatureEnabled('battlepass')" class="cab-card cab-bp" :class="{ 'cab-bp--premium': bp?.premium }">
              <div class="cab-card__top">
                <h2 class="cab-h">Battle Pass</h2>
                <span v-if="bp?.premium" class="cab-tag cab-tag--gold">Premium</span>
                <span v-else-if="bp" class="cab-tag">{{ t('profile.bpNoPremium') }}</span>
              </div>
              <template v-if="bp">
                <p v-if="bp.season" class="cab-muted">{{ bp.season }}</p>
                <p class="cab-bp__level">
                  <span class="cab-bp__lvl">{{ bp.level }}</span>
                  <small v-if="bp.max">{{ t('profile.bpOfLevels', { max: bp.max }) }}</small>
                </p>
                <div v-if="bp.max" class="cab-bar"><div class="cab-bar__fill" :style="{ width: Math.max(bp.pct, 1.5) + '%' }"></div></div>
                <dl class="cab-rows cab-rows--tight">
                  <div><dt>{{ t('profile.bpXp') }}</dt><dd>{{ bp.xp }}</dd></div>
                  <div v-if="bp.premiumUntil"><dt>{{ t('profile.bpPremiumActive') }}</dt><dd>{{ bp.premiumUntil }}</dd></div>
                </dl>
              </template>
              <p v-else class="cab-muted">{{ t('profile.bpNoData') }}</p>
            </section>

            <!-- nation -->
            <section class="cab-card">
              <div class="cab-card__top">
                <h2 class="cab-h">{{ t('profile.nationKicker') }}</h2>
                <span v-if="myNation?.tag" class="cab-tag">{{ myNation.tag }}</span>
              </div>
              <template v-if="myNation">
                <div class="cab-nation">
                  <img v-if="nationIcon" :src="nationIcon" alt="" class="cab-nation__icon" />
                  <div class="cab-nation__text">
                    <b>{{ myNation.title }}</b>
                    <span v-if="nationRoleText">{{ nationRoleText }}</span>
                  </div>
                </div>
                <p v-if="myNation.short_description" class="cab-quote">{{ myNation.short_description }}</p>
                <div class="cab-actions">
                  <RouterLink :to="`/nation/${myNation.slug}`" class="cab-btn cab-btn--sm">{{ t('profile.openNation') }}</RouterLink>
                  <RouterLink v-if="canManageNation" to="/nation/studio" class="cab-btn cab-btn--sm">{{ t('profile.manage') }}</RouterLink>
                </div>
              </template>
              <template v-else>
                <p class="cab-muted">{{ t('profile.noNationDesc') }}</p>
                <div class="cab-actions">
                  <RouterLink to="/nations" class="cab-btn cab-btn--sm">{{ t('profile.nationsList') }}</RouterLink>
                  <RouterLink to="/nation/studio" class="cab-btn cab-btn--sm">{{ t('profile.createNation') }}</RouterLink>
                </div>
              </template>
            </section>

            <!-- account -->
            <section class="cab-card">
              <h2 class="cab-h">{{ t('profile.dataTitle') }}</h2>
              <dl class="cab-rows">
                <div><dt>{{ t('profile.loginLabel') }}</dt><dd>{{ auth.state.user?.site_login || '—' }}</dd></div>
                <div>
                  <dt>{{ t('profile.emailLabel') }}</dt>
                  <dd class="cab-email">
                    <span :title="auth.state.user?.email">{{ auth.state.user?.email || '—' }}</span>
                    <span class="cab-state" :class="auth.emailVerified.value ? 'ok' : 'warn'">
                      {{ auth.emailVerified.value ? t('profile.emailVerified') : t('profile.emailNotVerified') }}
                    </span>
                  </dd>
                </div>
                <div><dt>{{ t('profile.nicknameLabel') }}</dt><dd>{{ nick || t('profile.noNickname') }}</dd></div>
                <div>
                  <dt>Telegram</dt>
                  <dd v-if="telegram?.linked" class="cab-tg">
                    {{ telegram.telegram_username ? '@' + telegram.telegram_username : t('profile.tgLinked') }}
                    <button type="button" class="cab-unlink" :disabled="tgUnlinking" @click="unlinkTg">{{ t('profile.tgUnlink') }}</button>
                  </dd>
                  <dd v-else class="cab-dim">{{ t('profile.tgNotLinked') }}</dd>
                </div>
                <div><dt>{{ t('profile.loginMode') }}</dt><dd>{{ auth.accountModeText.value }}</dd></div>
              </dl>
            </section>
          </aside>
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.cab-page { padding-block: 24px 48px; }
.cab {
  --c-surface: rgba(19, 16, 33, 0.8);
  --c-line: rgba(255, 255, 255, 0.08);
  --c-line-2: rgba(255, 255, 255, 0.14);
  --c-text: #eeecf7;
  --c-muted: #9d99b6;
  --c-accent: #8b5cf6;
  --c-accent-2: #a78bfa;
  --c-green: #34d399;
  --c-gold: #f2c14e;
  color: var(--c-text);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ── hero ─────────────────────────────────────────────── */
.cab-hero {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 22px;
  padding: 24px 28px;
  border-radius: 24px;
  border: 1px solid var(--c-line);
  background:
    radial-gradient(90% 140% at 0% 0%, rgba(139, 92, 246, 0.2), transparent 55%),
    var(--c-surface);
  backdrop-filter: blur(18px);
}
.cab-avatar {
  width: 96px; height: 96px; border-radius: 24px; overflow: hidden;
  display: grid; place-items: center;
  background: #1a1530; border: 3px solid #15122a;
  box-shadow: 0 0 0 1px rgba(167, 139, 250, 0.4), 0 16px 36px rgba(0, 0, 0, 0.45);
  font-size: 2.4rem; font-weight: 900; color: var(--c-accent-2);
}
.cab-avatar img { width: 100%; height: 100%; object-fit: cover; }
.cab-avatar--pixel img { image-rendering: pixelated; }
.cab-hello { margin: 0; font-size: 0.9rem; color: var(--c-muted); }
.cab-name { margin: 2px 0 0; font-size: clamp(1.7rem, 1.2rem + 1.2vw, 2.4rem); font-weight: 900; line-height: 1.05; letter-spacing: -0.02em; overflow-wrap: anywhere; }
.cab-chips { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 12px; }
.cab-chip {
  display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px; border-radius: 8px;
  font-size: 0.84rem; font-weight: 700; color: var(--c-text); text-decoration: none; white-space: nowrap;
  border: 1px solid var(--c-line-2); background: rgba(255, 255, 255, 0.05);
}
a.cab-chip:hover { border-color: rgba(167, 139, 250, 0.45); background: rgba(139, 92, 246, 0.12); }
.cab-chip img { width: 18px; height: 18px; border-radius: 5px; object-fit: cover; }
.cab-chip__dim { color: var(--c-muted); font-weight: 600; }
.cab-chip--epoch { color: #ddd6fe; border-color: rgba(167, 139, 250, 0.45); background: rgba(139, 92, 246, 0.16); }
.cab-chip--gold { color: var(--c-gold); border-color: rgba(242, 193, 78, 0.42); background: rgba(242, 193, 78, 0.1); }
.cab-since { font-size: 0.86rem; color: var(--c-muted); margin-left: 4px; }
.cab-hero__actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }

.cab-ico { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; flex: none; }
.cab-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  height: 42px; padding: 0 16px; border-radius: 12px;
  font: inherit; font-size: 0.92rem; font-weight: 700; color: var(--c-text); text-decoration: none; white-space: nowrap;
  background: rgba(255, 255, 255, 0.06); border: 1px solid var(--c-line-2); cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s;
}
.cab-btn:hover { background: rgba(255, 255, 255, 0.1); }
.cab-btn:disabled { opacity: 0.6; cursor: default; }
.cab-btn--primary { color: #fff; background: var(--c-accent); border-color: transparent; box-shadow: 0 10px 28px -12px rgba(139, 92, 246, 0.8); }
.cab-btn--primary:hover { background: #7c4dff; }
.cab-btn--icon { width: 42px; padding: 0; }
.cab-btn--sm { height: 36px; padding: 0 14px; font-size: 0.86rem; border-radius: 10px; }
.cab-btn:focus-visible, .cab-chip:focus-visible, .cab-link:focus-visible, .cab-unlink:focus-visible { outline: 2px solid var(--c-accent-2); outline-offset: 2px; }

/* ── cards ────────────────────────────────────────────── */
.cab-card {
  border-radius: 20px; border: 1px solid var(--c-line); background: var(--c-surface);
  padding: 22px 24px; backdrop-filter: blur(18px); min-width: 0;
}
.cab-card__top { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 4px; }
.cab-card__top .cab-h { margin: 0; }
.cab-h { margin: 0 0 14px; font-size: 1.1rem; font-weight: 800; letter-spacing: -0.01em; }
.cab-muted { margin: 0; font-size: 0.9rem; line-height: 1.5; color: var(--c-muted); }
.cab-link { font-size: 0.88rem; font-weight: 700; color: var(--c-accent-2); text-decoration: none; white-space: nowrap; }
.cab-link:hover { color: #c4b5fd; }
.cab-tag { font-size: 0.76rem; font-weight: 800; color: var(--c-muted); padding: 3px 9px; border-radius: 999px; background: rgba(255, 255, 255, 0.07); white-space: nowrap; }
.cab-tag--gold { color: #1b1405; background: linear-gradient(135deg, #f7d27a, #e0a526); }
.cab-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }

.cab-todo { border-color: rgba(242, 193, 78, 0.28); background: radial-gradient(80% 140% at 0% 0%, rgba(242, 193, 78, 0.08), transparent 60%), var(--c-surface); }
.cab-todo__list { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 10px; }
.cab-todo__item { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 12px 14px; border-radius: 14px; background: rgba(255, 255, 255, 0.035); border: 1px solid var(--c-line); }
.cab-todo__text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.cab-todo__text b { font-size: 0.95rem; }
.cab-todo__text span { font-size: 0.84rem; color: var(--c-muted); line-height: 1.4; }

.cab-grid { display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 16px; align-items: start; }
.cab-side { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.cab-skel { height: 320px; border-radius: 20px; }
.cab-skel--main { height: 520px; }

/* ── path ─────────────────────────────────────────────── */
.cab-path__head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 18px; }
.cab-path__head .cab-h { margin-bottom: 4px; }
.cab-progress__label { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 10px; }
.cab-progress__label span { font-size: 1.35rem; font-weight: 900; letter-spacing: -0.01em; }
.cab-progress__label b { font-size: 0.9rem; font-weight: 700; color: var(--c-muted); white-space: nowrap; }
.cab-segments { display: grid; grid-template-columns: repeat(8, 1fr); gap: 5px; }
.cab-segments span { height: 8px; border-radius: 999px; background: rgba(255, 255, 255, 0.08); }
.cab-segments span.done { background: linear-gradient(90deg, #7c6bff, #a78bfa); }
.cab-segments span.next { background: rgba(52, 211, 153, 0.35); }

.cab-next {
  display: flex; gap: 16px; align-items: center; margin-top: 18px; padding: 16px 18px; border-radius: 16px;
  border: 1px solid rgba(52, 211, 153, 0.35);
  background: linear-gradient(135deg, rgba(52, 211, 153, 0.1), rgba(52, 211, 153, 0.02));
}
.cab-next__icon { flex: none; width: 72px; height: 72px; display: grid; place-items: center; border-radius: 14px; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(52, 211, 153, 0.3); }
.cab-next__text { min-width: 0; }
.cab-next__label { margin: 0; font-size: 0.84rem; font-weight: 700; color: var(--c-green); }
.cab-next__title { margin: 2px 0 0; font-size: 1.12rem; font-weight: 800; }
.cab-next__hint { margin: 4px 0 0; font-size: 0.9rem; line-height: 1.45; color: #cfcbe3; }
.cab-next__tip { margin: 8px 0 0; font-size: 0.82rem; color: var(--c-muted); }
.cab-done { margin: 18px 0 0; padding: 14px 16px; border-radius: 14px; font-weight: 700; color: #a7f3d0; background: rgba(52, 211, 153, 0.1); border: 1px solid rgba(52, 211, 153, 0.3); }

.cab-epochs { list-style: none; margin: 18px 0 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 10px; }
.cab-epoch { display: grid; grid-template-columns: 28px minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 8px 12px 8px 8px; border-radius: 12px; background: rgba(255, 255, 255, 0.025); color: var(--c-muted); }
.cab-epoch__num { width: 28px; height: 28px; border-radius: 999px; display: grid; place-items: center; font-size: 0.78rem; font-weight: 800; background: rgba(255, 255, 255, 0.06); }
.cab-epoch__num svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round; }
.cab-epoch__name { font-size: 0.93rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cab-epoch__meta { font-size: 0.8rem; white-space: nowrap; }
.cab-epoch.done { color: var(--c-text); background: rgba(139, 92, 246, 0.1); }
.cab-epoch.done .cab-epoch__num { background: rgba(139, 92, 246, 0.3); color: #ddd6fe; }
.cab-epoch.done .cab-epoch__meta { color: var(--c-muted); }
.cab-epoch.next { color: var(--c-text); background: rgba(52, 211, 153, 0.08); box-shadow: inset 0 0 0 1px rgba(52, 211, 153, 0.35); }
.cab-epoch.next .cab-epoch__num { background: rgba(52, 211, 153, 0.2); color: var(--c-green); }
.cab-epoch.next .cab-epoch__meta { color: var(--c-green); font-weight: 700; }

.cab-branches { margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--c-line); }
.cab-branches__title { margin: 0 0 10px; font-size: 0.9rem; font-weight: 700; color: var(--c-muted); }
.cab-branches__list { display: flex; flex-wrap: wrap; gap: 8px; }
.cab-branch { display: inline-flex; align-items: center; gap: 7px; height: 34px; padding: 0 12px 0 8px; border-radius: 10px; font-size: 0.86rem; font-weight: 600; color: var(--c-muted); border: 1px dashed var(--c-line-2); }
.cab-branch :deep(img) { opacity: 0.45; filter: grayscale(0.7); }
.cab-branch.done { color: var(--c-text); border-style: solid; border-color: rgba(167, 139, 250, 0.4); background: rgba(139, 92, 246, 0.12); }
.cab-branch.done :deep(img) { opacity: 1; filter: none; }
.cab-empty { margin-top: 16px; }

/* ── side ─────────────────────────────────────────────── */
.cab-bp--premium { border-color: rgba(242, 193, 78, 0.3); background: radial-gradient(120% 90% at 100% 0%, rgba(242, 193, 78, 0.1), transparent 60%), var(--c-surface); }
.cab-bp__level { margin: 14px 0 10px; display: flex; align-items: baseline; gap: 8px; }
.cab-bp__lvl { font-size: 2.6rem; font-weight: 900; line-height: 0.9; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
.cab-bp__level small { font-size: 0.95rem; color: var(--c-muted); font-weight: 600; }
.cab-bar { height: 8px; border-radius: 999px; background: rgba(255, 255, 255, 0.07); overflow: hidden; }
.cab-bar__fill { height: 100%; border-radius: inherit; background: linear-gradient(90deg, #7c6bff, #a78bfa); }
.cab-bp--premium .cab-bar__fill { background: linear-gradient(90deg, #e0a526, #f7d27a); }

.cab-rows { margin: 0; display: flex; flex-direction: column; }
.cab-rows > div { display: flex; justify-content: space-between; align-items: center; gap: 14px; padding: 10px 0; border-top: 1px solid var(--c-line); min-width: 0; }
.cab-rows > div:first-child { border-top: 0; padding-top: 2px; }
.cab-rows--tight { margin-top: 14px; }
.cab-rows--tight > div:first-child { border-top: 1px solid var(--c-line); padding-top: 10px; }
.cab-rows dt { font-size: 0.9rem; color: var(--c-muted); white-space: nowrap; }
.cab-rows dd { margin: 0; font-size: 0.92rem; font-weight: 700; text-align: right; min-width: 0; overflow-wrap: anywhere; }
.cab-email { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
.cab-email > span:first-child { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cab-state { font-size: 0.74rem; font-weight: 800; padding: 2px 8px; border-radius: 999px; }
.cab-state.ok { color: #a7f3d0; background: rgba(52, 211, 153, 0.12); }
.cab-state.warn { color: #fde68a; background: rgba(242, 193, 78, 0.12); }
.cab-dim { color: var(--c-muted) !important; font-weight: 600 !important; }
.cab-tg { display: flex; align-items: center; gap: 8px; }
.cab-unlink { font: inherit; font-size: 0.78rem; font-weight: 700; color: #fca5a5; background: none; border: 1px solid rgba(248, 113, 113, 0.35); border-radius: 8px; padding: 2px 8px; cursor: pointer; }
.cab-unlink:hover { background: rgba(248, 113, 113, 0.1); }

.cab-nation { display: flex; align-items: center; gap: 12px; margin-top: 10px; }
.cab-nation__icon { width: 44px; height: 44px; border-radius: 12px; object-fit: cover; border: 1px solid var(--c-line-2); }
.cab-nation__text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.cab-nation__text b { font-size: 1.02rem; }
.cab-nation__text span { font-size: 0.85rem; color: var(--c-muted); }
.cab-quote { margin: 12px 0 0; font-size: 0.88rem; line-height: 1.5; color: #cfcbe3; padding-left: 12px; border-left: 2px solid rgba(167, 139, 250, 0.4); }

/* ── responsive ───────────────────────────────────────── */
@media (max-width: 1100px) {
  .cab-grid { grid-template-columns: minmax(0, 1fr); }
  .cab-hero { grid-template-columns: auto minmax(0, 1fr); }
  .cab-hero__actions { grid-column: 1 / -1; justify-content: flex-start; }
}
@media (max-width: 640px) {
  .cab-page { padding-block: 12px 32px; }
  .cab-hero { padding: 18px; gap: 14px; }
  .cab-avatar { width: 72px; height: 72px; border-radius: 18px; font-size: 1.8rem; }
  .cab-hero__actions .cab-btn--primary { flex: 1; }
  .cab-card { padding: 18px; }
  .cab-epochs { grid-template-columns: minmax(0, 1fr); }
  .cab-next { flex-direction: column; align-items: flex-start; }
  .cab-todo__item { flex-direction: column; align-items: stretch; }
  .cab-since { margin-left: 0; flex-basis: 100%; }
}
</style>
