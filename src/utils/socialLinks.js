// Social links a player can attach to their public profile.
// Keep `key`s in sync with SOCIAL_LINK_HOSTS in minecraft_backend/apps/api/app/schemas/profile.py —
// the backend rejects unknown platforms and links pointing to other hosts.
export const SOCIAL_PLATFORMS = [
  { key: 'twitch', label: 'Twitch', color: '#9146ff', placeholder: 'https://twitch.tv/nickname', icon: 'M4.5 2 3 5.8V20h4.8v2.5h2.7L13 20h3.8L21 15.8V2Zm14.8 12.9-2.7 2.7h-4.3l-2.3 2.3v-2.3H6.3V3.7h13Zm-3.4-7.6h-1.7v5h1.7Zm-4.6 0H9.6v5h1.7Z' },
  { key: 'youtube', label: 'YouTube', color: '#ff0033', placeholder: 'https://youtube.com/@channel', icon: 'M22 8.1a3 3 0 0 0-2.1-2.1C18 5.5 12 5.5 12 5.5s-6 0-7.9.5A3 3 0 0 0 2 8.1 31 31 0 0 0 1.5 12a31 31 0 0 0 .5 3.9 3 3 0 0 0 2.1 2.1c1.9.5 7.9.5 7.9.5s6 0 7.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-3.9 31 31 0 0 0-.5-3.9ZM10 15.2V8.8l5.2 3.2Z' },
  { key: 'tiktok', label: 'TikTok', color: '#25f4ee', placeholder: 'https://tiktok.com/@nickname', icon: 'M16.6 2h-3.3v13.3a2.9 2.9 0 1 1-2-2.8V9.1a6.3 6.3 0 1 0 5.3 6.2V8.6A7.9 7.9 0 0 0 21 10V6.7a4.4 4.4 0 0 1-4.4-4.4Z' },
  { key: 'telegram', label: 'Telegram', color: '#2aabee', placeholder: 'https://t.me/channel', icon: 'M21.4 3.6 2.9 10.7c-1.3.5-1.2 1.2-.2 1.5l4.7 1.5 1.8 5.6c.2.6.1.9.8.9.5 0 .7-.2 1-.5l2.3-2.2 4.8 3.5c.9.5 1.5.2 1.7-.8l3.2-15c.3-1.3-.5-1.9-1.6-1.1ZM9.6 14.1l-.4 4 -1.4-4.6 10.9-6.9Z' },
  { key: 'discord', label: 'Discord', color: '#5865f2', placeholder: 'https://discord.gg/invite', icon: 'M19.3 5.3A16.5 16.5 0 0 0 15.2 4l-.5 1a15.3 15.3 0 0 0-5.4 0l-.5-1a16.4 16.4 0 0 0-4.1 1.3C2.1 9.2 1.4 13 1.7 16.7a16.6 16.6 0 0 0 5 2.5l1.1-1.7a10.7 10.7 0 0 1-1.7-.8l.4-.3a11.8 11.8 0 0 0 11 0l.4.3-1.7.8 1.1 1.7a16.5 16.5 0 0 0 5-2.5c.4-4.3-.7-8.1-3-11.4ZM8.5 14.4c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm7 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z' },
  { key: 'vk', label: 'VK', color: '#0077ff', placeholder: 'https://vk.com/nickname', icon: 'M13.2 18.5C6.4 18.5 2.5 13.8 2.3 6h3.4c.1 5.7 2.6 8.2 4.6 8.7V6h3.2v4.9c2-.2 4-2.5 4.8-4.9h3.2a9.4 9.4 0 0 1-4.4 6.2 9.9 9.9 0 0 1 5.1 6.3h-3.5a6.2 6.2 0 0 0-5.2-4.5v4.5Z' },
]

// Only platforms that actually have a link, in display order.
export function filledSocialLinks(links) {
  if (!links) return []
  return SOCIAL_PLATFORMS.filter((p) => typeof links[p.key] === 'string' && links[p.key]).map((p) => ({
    ...p,
    url: links[p.key],
  }))
}
