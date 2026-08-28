<script setup>
import { onMounted, onUnmounted, ref } from 'vue'

// Прозрачный HUD-оверлей: мод (voxel_engine) шлёт события через WebGUI emitToPage,
// страница их рисует. События: voxel:title, voxel:dialogue.

const title = ref(null)       // { text, sub, fadeMs, holdMs }
const titleVisible = ref(false)
const dialogue = ref(null)    // { speaker, lines }
const dialogueVisible = ref(false)

let titleTimers = []
let dialogueTimer = null

function parseDetail(detail) {
  if (detail == null) return {}
  if (typeof detail === 'string') {
    try { return JSON.parse(detail) } catch { return { text: detail } }
  }
  return detail
}

function showTitle(data) {
  titleTimers.forEach(clearTimeout); titleTimers = []
  const fade = Number(data.fadeMs ?? 500)
  const hold = Number(data.holdMs ?? 2500)
  title.value = data
  titleVisible.value = false
  requestAnimationFrame(() => { titleVisible.value = true })
  titleTimers.push(setTimeout(() => { titleVisible.value = false }, fade + hold))
  titleTimers.push(setTimeout(() => { title.value = null }, fade + hold + fade))
}

function showDialogue(data) {
  if (dialogueTimer) clearTimeout(dialogueTimer)
  dialogue.value = data
  dialogueVisible.value = true
  const lines = Array.isArray(data.lines) ? data.lines.length : 1
  const dur = Math.max(4000, lines * 3500)
  dialogueTimer = setTimeout(() => { dialogueVisible.value = false }, dur)
}

const onTitle = (e) => showTitle(parseDetail(e.detail))
const onDialogue = (e) => showDialogue(parseDetail(e.detail))

onMounted(() => {
  // Прозрачный фон, чтобы HUD не перекрывал игру (см. правило .webgui-hud в styles.css).
  document.documentElement.classList.add('webgui-hud')
  window.addEventListener('webgui:voxel:title', onTitle)
  window.addEventListener('webgui:voxel:dialogue', onDialogue)
})
onUnmounted(() => {
  document.documentElement.classList.remove('webgui-hud')
  window.removeEventListener('webgui:voxel:title', onTitle)
  window.removeEventListener('webgui:voxel:dialogue', onDialogue)
  titleTimers.forEach(clearTimeout)
  if (dialogueTimer) clearTimeout(dialogueTimer)
})
</script>

<template>
  <div class="hud">
    <!-- Заголовок -->
    <div v-if="title" class="hud-title" :class="{ 'is-on': titleVisible }"
         :style="{ transitionDuration: (title.fadeMs ?? 500) + 'ms' }">
      <div class="hud-title__text">{{ title.text }}</div>
      <div v-if="title.sub" class="hud-title__sub">{{ title.sub }}</div>
    </div>

    <!-- Диалог -->
    <transition name="hud-fade">
      <div v-if="dialogue && dialogueVisible" class="hud-dialogue">
        <div v-if="dialogue.speaker" class="hud-dialogue__speaker">{{ dialogue.speaker }}</div>
        <div class="hud-dialogue__lines">
          <p v-for="(l, i) in (dialogue.lines || [])" :key="i">{{ l }}</p>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.hud { position: fixed; inset: 0; pointer-events: none; overflow: hidden; font-family: Rubik, Inter, system-ui, sans-serif; }

.hud-title {
  position: absolute; top: 28%; left: 0; right: 0; text-align: center;
  opacity: 0; transform: scale(1.06); transition: opacity .5s ease, transform .5s ease;
  text-shadow: 0 3px 18px rgba(0,0,0,.7);
}
.hud-title.is-on { opacity: 1; transform: scale(1); }
.hud-title__text { font-size: clamp(34px, 6vw, 66px); font-weight: 900; color: #fff; letter-spacing: -.01em; }
.hud-title__sub { font-size: clamp(16px, 2.4vw, 26px); font-weight: 600; color: #818cf8; margin-top: 8px; }

.hud-dialogue {
  position: absolute; left: 50%; transform: translateX(-50%); bottom: 8%;
  width: min(760px, 86vw); background: rgba(9,13,24,.82); border: 1px solid rgba(129,140,248,.4);
  border-left: 3px solid rgba(129,140,248,.95); border-radius: 12px; padding: 16px 20px;
}
.hud-dialogue * { text-shadow: 0 1px 2px rgba(0,0,0,.9); }
.hud-dialogue__speaker { font-weight: 800; color: #818cf8; font-size: 17px; margin-bottom: 8px; }
.hud-dialogue__lines p { margin: 4px 0; color: #eceef5; font-family: Inter, sans-serif; font-size: 17px; line-height: 1.5; }

.hud-fade-enter-active, .hud-fade-leave-active { transition: opacity .35s ease, transform .35s ease; }
.hud-fade-enter-from, .hud-fade-leave-to { opacity: 0; transform: translateX(-50%) translateY(10px); }
</style>
