# VoidRP Site

Сайт проекта VoidRP — регистрация, профиль, государства, альянсы, магазин, Battle Pass, лидерборд.

## Стек

- **Vue 3** (Composition API, `<script setup>`) · Vite 6
- **Vue Router 4** · без Pinia (module-level reactive store)
- **Tailwind CSS v4** · daisyUI v5
- Без TypeScript

## Быстрый старт

```bash
cd VOIDRP-SITE
yarn
cp .env.example .env   # VITE_API_BASE_URL оставь пустым для dev (работает через Vite proxy)
yarn dev --host        # dev-сервер на порту 5175
```

Продакшн-сборка:

```bash
yarn build   # → dist/
```

## Структура

```
src/
├── router/index.js          # маршруты, навигационный guard, meta.requiresAuth / requiresAdmin
├── stores/authStore.js      # auth state (reactive, localStorage voidrp_auth_v1)
├── services/
│   ├── apiBase.js           # центральный apiRequest(), перевод ошибок на русский
│   ├── authApi.js           # регистрация, логин, refresh, logout
│   ├── adminApi.js          # дашборд, статус сервера, метрика
│   ├── adminDonateApi.js    # EasyDonate overview, платежи
│   └── ...                  # profileApi, nationsApi, alliancesApi, marketApi, …
├── views/
│   ├── admin/               # AdminLayout + все вкладки админ-панели
│   └── ...                  # публичные страницы
├── features/
│   ├── nations/             # компоненты государств
│   └── alliances/           # компоненты альянсов
├── components/              # переиспользуемые UI компоненты
└── i18n/locales/            # ru.js + en.js (vue-i18n)
```

## Auth flow

1. Логин → получаем `access_token` (JWT) + `refresh_token` (opaque)
2. Все запросы к API идут с `Authorization: Bearer <access_token>`
3. При 401 — автоматический тихий refresh через `setUnauthorizedHandler`
4. Состояние сохраняется в `localStorage` под ключом `voidrp_auth_v1`

## Админ-панель

Доступна по `/admin` только для `is_admin` пользователей. Вкладки:
- Дашборд — общая статистика, метрика, быстрый доступ
- Донаты — EasyDonate платежи, выручка, графики
- Battle Pass — управление Premium подписками
- Игроки, Государства, Рынок, Сервер

## Важно

- Все тексты интерфейса добавляются в оба файла локализации: `src/i18n/locales/ru.js` и `en.js`
- Ошибки API переводятся на русский в `apiBase.js` (таблица `FIELD_LABELS` должна совпадать с `_FIELD_LABELS` в бэкенде)
