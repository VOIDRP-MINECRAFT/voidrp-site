// «Хлебные крошки» админки: раздел берётся из меню, а страница может добавить свой
// последний шаг (например, имя открытого сервера или игрока). Сбрасывается при смене страницы.
import { reactive } from 'vue'

export const crumbState = reactive({ extra: [] })

/** items: [{ label, to? }] — шаги после названия раздела. */
export function setCrumbs(items) {
  crumbState.extra = (items || []).filter((i) => i && i.label)
}

export function clearCrumbs() {
  crumbState.extra = []
}
