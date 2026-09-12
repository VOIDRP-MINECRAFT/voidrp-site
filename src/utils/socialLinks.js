// Social links a player can attach to their public profile.
// Keep `key`s in sync with SOCIAL_LINK_HOSTS in minecraft_backend/apps/api/app/schemas/profile.py —
// the backend rejects unknown platforms and links pointing to other hosts.
export const SOCIAL_PLATFORMS = [
  { key: 'twitch', label: 'Twitch', color: '#9146ff', placeholder: 'https://twitch.tv/nickname' },
  { key: 'youtube', label: 'YouTube', color: '#ff0033', placeholder: 'https://youtube.com/@channel' },
  { key: 'tiktok', label: 'TikTok', color: '#25f4ee', placeholder: 'https://tiktok.com/@nickname' },
  { key: 'telegram', label: 'Telegram', color: '#2aabee', placeholder: 'https://t.me/channel' },
  { key: 'discord', label: 'Discord', color: '#5865f2', placeholder: 'https://discord.gg/invite' },
  { key: 'vk', label: 'VK', color: '#0077ff', placeholder: 'https://vk.com/nickname' },
]

// Only platforms that actually have a link, in display order.
export function filledSocialLinks(links) {
  if (!links) return []
  return SOCIAL_PLATFORMS.filter((p) => typeof links[p.key] === 'string' && links[p.key]).map((p) => ({
    ...p,
    url: links[p.key],
  }))
}
