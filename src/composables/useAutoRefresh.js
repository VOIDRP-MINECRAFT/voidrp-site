// Живое обновление списков: раз в `ms`, пока вкладка видна, плюс подпись «обновлено N назад».
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

export function useAutoRefresh(load, ms = 60000) {
  const lastAt = ref(0)
  const now = ref(Date.now())
  let timer = null
  let clock = null
  async function refresh() {
    await load()
    lastAt.value = Date.now()
  }
  const tick = () => { if (document.visibilityState === 'visible') refresh() }
  const onVisible = () => { if (document.visibilityState === 'visible' && Date.now() - lastAt.value > ms) refresh() }
  onMounted(() => {
    refresh()
    timer = setInterval(tick, ms)
    clock = setInterval(() => { now.value = Date.now() }, 5000)
    document.addEventListener('visibilitychange', onVisible)
  })
  onBeforeUnmount(() => { clearInterval(timer); clearInterval(clock); document.removeEventListener('visibilitychange', onVisible) })
  const ago = computed(() => {
    if (!lastAt.value) return ''
    const s = Math.max(0, Math.round((now.value - lastAt.value) / 1000))
    if (s < 10) return 'обновлено только что'
    if (s < 60) return `обновлено ${s} с назад`
    return `обновлено ${Math.round(s / 60)} мин назад`
  })
  return { refresh, ago }
}
