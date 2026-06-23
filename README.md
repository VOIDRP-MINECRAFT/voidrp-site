# 🌐 VoidRP Site

> Официальный сайт void-rp.ru — профили, нации, альянсы, магазин, Battle Pass, карта, а также in-game UI страницы для Chromium внутри Minecraft.

![Vue](https://img.shields.io/badge/Vue-3-42b883?logo=vuedotjs&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white)
![daisyUI](https://img.shields.io/badge/daisyUI-v5-5A0EF8)
![i18n](https://img.shields.io/badge/i18n-RU_%2F_EN-blue)
![License](https://img.shields.io/badge/license-proprietary-red)

---

## 🗺️ Место в экосистеме

```
  Браузер игрока (обычный)          Minecraft Client (MCEF браузер)
        │ JWT (Authorization: Bearer)       │ webgui_token (query param)
        ▼                                   ▼
┌─────────────────────────────────────────────────────┐
│   voidrp-site (Vue 3)   void-rp.ru                  │
│   ├── /profile, /nations, /market, /admin           │
│   └── /game-ui/* ← только для MCEF, без navbar      │
└───────────────────────────┬─────────────────────────┘
                            │ /api/v1/*
                            ▼
                  minecraft-backend (FastAPI)
```

---

## ✨ Страницы и возможности

### Публичный сайт
- **Авторизация** — регистрация, вход, сброс пароля
- **Профиль** — никнейм Minecraft, аватар, скин, статистика, реферальная ссылка
- **Нации** — создание, вступление, казна, члены, дипломатия, карта нации
- **Альянсы** — предложения, голосования, список союзников
- **Магазин** — модовые предметы с динамическими ценами
- **Игровой рынок** — ордера на покупку/продажу между игроками
- **Battle Pass** — сезонный прогресс, Free + Premium треки, награды
- **Карта** — интерактивная Dynmap с нациями и игроками (iframe)
- **Лидерборд** — топ игроков по богатству, активности
- **Admin Panel** — управление игроками, античит, донат-верификация

### 🎮 In-Game UI (`/game-ui/*`)
Страницы, открываемые прямо в Minecraft через встроенный Chromium (MCEF). Нет навбара/футера (`hidePublicShell: true`). Авторизация через `webgui_token`.

| Маршрут | Компонент | Статус |
|---|---|---|
| `/game-ui#market` | `GameUiMarketView.vue` | ✅ Готово |
| `/game-ui/menu` | `GameUiMenuView.vue` | ✅ Готово |
| `/game-ui/hud` | `GameUiHudView.vue` | 🔄 Запланировано |
| `/game-ui#nation-market` | `GameUiNationMarketView.vue` | 🔄 Запланировано |
| `/game-ui#treasury` | `GameUiTreasuryView.vue` | 🔄 Запланировано |
| `/game-ui#battlepass` | `GameUiBattlePassView.vue` | 🔄 Запланировано |
| `/game-ui#quests` | `GameUiQuestsView.vue` | 🔄 Запланировано |

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
│   └── authStore.js           module-level reactive store, localStorage
├── services/
│   ├── apiBase.js             apiRequest() — HTTP слой, auto-refresh на 401
│   ├── authApi.js             /auth/*
│   ├── nationsApi.js          /nations/*
│   ├── marketApi.js           /market/*
│   ├── gameUiMarketApi.js     /game-ui/market/* (webgui_token)  ← WebGUI
│   ├── battlepassAdminApi.js
│   └── adminAnticheatApi.js
├── composables/
│   └── useWebGui.js           WebGUI bridge composables  ← WebGUI
├── router/
│   └── index.js               Vue Router 4, guard bootstrapAuth()
├── views/
│   ├── auth/
│   ├── profile/
│   ├── nations/
│   ├── market/
│   ├── game-ui/               ← /game-ui/* страницы для MCEF
│   │   ├── GameUiMarketView.vue
│   │   └── GameUiMenuView.vue
│   └── admin/
├── i18n/
│   └── locales/
│       ├── ru.js              ← все строки в обоих языках
│       └── en.js
└── components/
    └── GlobalToastStack.vue
```

**Auth flow:** `bootstrapAuth()` в роутере → `apiRequest()` → на 401 auto-refresh через `setUnauthorizedHandler`.

---

## 🎮 WebGUI Composables

Composables для работы со встроенным браузером (доступны только внутри Minecraft):

```js
// src/composables/useWebGui.js
import { useWebGuiClient, useWebGuiToken, isInMod, postToGame } from '@/composables/useWebGui.js'

// Токен из ?webgui_token= (для API запросов)
const token = useWebGuiToken()

// Реактивный объект с данными игрока из JS bridge (window.webgui.client)
const client = useWebGuiClient()
// client.value = { playerUuid, username, dimension, pos, server }

// Проверить — открыт ли сайт внутри мода
if (isInMod()) { ... }

// Управление игрой через CEF message router
await postToGame({ channel: "run_command", command: "/pm pickup" })
await postToGame({ channel: "open_gui", url: "https://void-rp.ru/game-ui#treasury" })
await postToGame({ channel: "open_hud", url: "https://void-rp.ru/game-ui/hud" })
```

### gameUiMarketApi.js

```js
import { getOrderBook, getMyOrders, postPendingAction } from '@/services/gameUiMarketApi.js'

// Все запросы автоматически добавляют webgui_token
const orderBook = await getOrderBook('minecraft:iron_ingot', token)
await postPendingAction({ action_type: 'buy', item_key: 'minecraft:iron', amount: 64, price: 100 }, token)
```

---

## 🌍 Интернационализация

Весь UI доступен на русском и английском языках. Новые строки добавляются в оба файла:

```bash
src/i18n/locales/ru.js   # ru.market.orderBook: "Книга ордеров"
src/i18n/locales/en.js   # en.market.orderBook: "Order Book"
```

---

## 🔗 Связанные репозитории

| Репо | Связь |
|---|---|
| [minecraft-backend](https://github.com/VOIDRP-MINECRAFT/minecraft-backend) | REST API — все данные приходят отсюда |
| [voidrp-webgui-neoforge](https://github.com/VOIDRP-MINECRAFT/voidrp-webgui-neoforge) | NeoForge мод — открывает наши `/game-ui/*` страницы в игре |
| [voidrp-gamesync-plugin](https://github.com/VOIDRP-MINECRAFT/voidrp-gamesync-plugin) | Плагин — отправляет webgui_token клиентам |
| [voidrp-launcher-vue](https://github.com/VOIDRP-MINECRAFT/voidrp-launcher-vue) | Лаунчер — открывает сайт для регистрации |

---

<div align="center">
<a href="https://void-rp.ru">🌐 Сайт</a> ·
<a href="https://github.com/VOIDRP-MINECRAFT">🏠 Организация</a> ·
<a href="https://github.com/VOIDRP-MINECRAFT/.github/blob/main/docs/WEBGUI_ARCHITECTURE.md">📐 WebGUI Architecture</a>
</div>
