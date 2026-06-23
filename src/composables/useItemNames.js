import { ref } from 'vue'

const names = ref({})
let loaded = false

export function useItemNames() {
  if (!loaded) {
    loaded = true
    fetch('/item_names.json')
      .then(r => r.json())
      .then(data => { names.value = data })
      .catch(() => {})
  }
  return names
}
