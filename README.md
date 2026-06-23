# 🌐 VoidRP Site

> Официальный сайт void-rp.ru — профили, нации, альянсы, магазин, Battle Pass, карта.

![Vue](https://img.shields.io/badge/Vue-3-42b883?logo=vuedotjs&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white)
![daisyUI](https://img.shields.io/badge/daisyUI-v5-5A0EF8)
![License](https://img.shields.io/badge/license-proprietary-red)

---

## 🗺️ Место в экосистеме

```
  Браузер игрока
        │ JWT (Authorization: Bearer)
        ▼
┌──────────────────────────────┐
│   voidrp-site (Vue 3)        │
│   void-rp.ru                 │
└───────────┬──────────────────┘
            │ /api/v1/* (Vite proxy → prod API)
            ▼
  minecraft-backend (FastAPI)
```

---

## ✨ Страницы и возможности

- **Авторизация** — регистрация, вход, сброс пароля
- **Профиль** — никнейм Minecraft, аватар, скин, статистика, реферальная ссылка
- **Нации** — создание, вступление, казна, члены, дипломатия, карта нации
- **Альянсы** — предложения, голосования, список союзников
- **Магазин** — модовые предметы с динамическими ценами, история сделок
- **Игровой рынок** — ордера на покупку/продажу между игроками
- **Battle Pass** — сезонный прогресс, Free + Premium треки, награды
- **Карта** — интерактивная Dynmap с нациями и игроками (iframe)
- **Лидерборд** — топ игроков по богатству, активности
- **Admin Panel** — управление игроками, античит, донат-верификация

---

## 📋 Требования

| Компонент | Версия |
|---|---|
| Node.js | 18+ |
| Yarn | 1.x |

---

## 🚀 Быстрый старт

```bash
cd VOIDRP-SITE
yarn
cp .env.example .env       # VITE_API_BASE_URL оставь пустым для dev
yarn dev --host            # dev-сервер на порту 5175
```

В dev-режиме `/api` и `/media` автоматически проксируются на production API.

```bash
yarn build                 # продакшн-сборка → dist/
```

---

## 🏗️ Архитектура

```
src/
├── stores/
│   └── authStore.js        # module-level reactive store, localStorage
├── services/
│   ├── apiBase.js          # apiRequest() — HTTP слой, auto-refresh на 401
│   ├── authApi.js          # /auth/*
│   ├── nationsApi.js       # /nations/*
│   ├── marketApi.js        # /market/*
│   ├── battlepassAdminApi.js
│   └── adminAnticheatApi.js
├── router/
│   └── index.js            # Vue Router 4, guard bootstrapAuth()
├── views/                  # страницы по доменам
│   ├── auth/
│   ├── profile/
│   ├── nations/
│   ├── market/
│   └── admin/
└── components/             # переиспользуемые компоненты
    └── GlobalToastStack.vue
```

**Auth flow:** `bootstrapAuth()` в роутере → `apiRequest()` → на 401 auto-refresh через `setUnauthorizedHandler`.

---

## 🔗 Связанные репозитории

| Репо | Связь |
|---|---|
| [minecraft-backend](https://github.com/VOIDRP-MINECRAFT/minecraft-backend) | REST API — все данные приходят отсюда |
| [voidrp-launcher-vue](https://github.com/VOIDRP-MINECRAFT/voidrp-launcher-vue) | Лаунчер — открывает сайт для регистрации |
| [voidrp-gamesync-plugin](https://github.com/VOIDRP-MINECRAFT/voidrp-gamesync-plugin) | Плагин — формирует данные для магазина |

---

<div align="center">
<a href="https://void-rp.ru">🌐 Сайт</a> ·
<a href="https://github.com/VOIDRP-MINECRAFT">🏠 Организация</a>
</div>
