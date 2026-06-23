const BASE_URL = 'https://void-rp.ru'
const SITE_NAME = 'VoidRP'
const DEFAULT_IMAGE = `${BASE_URL}/og-cover.jpg`

function setMeta(name, content, attr = 'name') {
  let el = document.querySelector(`meta[${attr}="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, name)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function setLink(rel, href) {
  let el = document.querySelector(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

function setJsonLd(id, data) {
  let el = document.querySelector(`script[data-ld="${id}"]`)
  if (!el) {
    el = document.createElement('script')
    el.setAttribute('type', 'application/ld+json')
    el.setAttribute('data-ld', id)
    document.head.appendChild(el)
  }
  el.textContent = JSON.stringify(data)
}

function removejsonLd(id) {
  const el = document.querySelector(`script[data-ld="${id}"]`)
  if (el) el.remove()
}

/**
 * @param {{ title?: string, description?: string, image?: string, url?: string, noindex?: boolean, breadcrumbs?: Array<{name: string, url?: string}> }} opts
 * breadcrumbs — массив от корня к текущей странице, например:
 *   [{ name: 'Главная', url: '/' }, { name: 'Государства', url: '/nations' }]
 *   Последний элемент — текущая страница (url можно не указывать).
 */
export function usePageMeta(opts = {}) {
  const {
    title = SITE_NAME,
    description = 'VoidRP — Minecraft roleplay сервер с экономикой, государствами и альянсами.',
    image = DEFAULT_IMAGE,
    url = BASE_URL + window.location.pathname,
    noindex = false,
    breadcrumbs = null,
  } = opts

  const fullTitle = title === SITE_NAME ? title : `${title} — ${SITE_NAME}`

  document.title = fullTitle

  setMeta('description', description)
  setMeta('robots', noindex ? 'noindex, nofollow' : 'index, follow')

  setMeta('og:title', fullTitle, 'property')
  setMeta('og:description', description, 'property')
  setMeta('og:image', image, 'property')
  setMeta('og:url', url, 'property')
  setMeta('og:type', 'website', 'property')
  setMeta('og:site_name', SITE_NAME, 'property')

  setMeta('twitter:title', fullTitle)
  setMeta('twitter:description', description)
  setMeta('twitter:image', image)

  setLink('canonical', url)

  if (breadcrumbs && breadcrumbs.length > 0) {
    setJsonLd('breadcrumb', {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbs.map((crumb, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: crumb.name,
        ...(crumb.url ? { item: BASE_URL + crumb.url } : {}),
      })),
    })
  } else {
    removejsonLd('breadcrumb')
  }
}
