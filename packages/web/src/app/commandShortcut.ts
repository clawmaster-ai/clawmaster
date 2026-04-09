export function isAppleClientPlatform(platform: string | null | undefined): boolean {
  const value = String(platform ?? '').toLowerCase()
  return value.includes('mac') || value.includes('iphone') || value.includes('ipad') || value.includes('ipod')
}

export function getCommandShortcutLabel(platform: string | null | undefined): string {
  return isAppleClientPlatform(platform) ? 'Cmd K' : 'Ctrl K'
}
