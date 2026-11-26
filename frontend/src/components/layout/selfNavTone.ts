const selfNavTones: Record<string, string> = {
  '/dashboard': 'blue', '/keys': 'blue', '/model-plaza': 'indigo',
  '/image-studio': 'pink', '/batch-image': 'pink', '/model-trace': 'amber',
  '/available-channels': 'teal', '/usage': 'cyan', '/buy-credits': 'violet',
  '/purchase': 'violet', '/redeem': 'violet', '/orders': 'cyan',
  '/support': 'teal', '/affiliate': 'violet', '/profile': 'slate', '/settings/mcp': 'slate',
}
export function selfNavTone(path: string): string {
  return selfNavTones[path] ?? 'slate'
}
