import { onMounted, onUnmounted } from 'vue'

export function useReveal() {
  let observer = null
  let mutations = null

  const bind = () => {
    if (!observer) return
    document
      .querySelectorAll('[data-reveal]:not(.is-revealed)')
      .forEach((el) => observer.observe(el))
  }

  onMounted(() => {
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const delay = entry.target.dataset.delay || 0
            setTimeout(() => {
              entry.target.classList.add('is-revealed')
            }, Number(delay))
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' },
    )

    bind()

    // Элементы с [data-reveal], созданные ПОСЛЕ маунта (v-if-секции, данные,
    // смена сервера без ремаунта) иначе навсегда остаются с opacity:0 —
    // на странице появляются «пустые разрывы». Подхватываем их по мере
    // появления в DOM.
    mutations = new MutationObserver(bind)
    mutations.observe(document.body, { childList: true, subtree: true })
  })

  onUnmounted(() => {
    observer?.disconnect()
    mutations?.disconnect()
  })
}
