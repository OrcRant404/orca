import '../../i18n/mobile-i18n'

export function getActiveTabIdForHandle(
  tabs: readonly { id: string; type: string; terminal?: string | null; isHidden?: boolean }[],
  terminalHandle: string | null
): string | null {
  if (!terminalHandle) {
    return null
  }
  if (
    tabs.some((tab) => tab.type === 'terminal' && tab.terminal === terminalHandle && tab.isHidden)
  ) {
    return null
  }
  return (
    tabs.find((tab) => tab.type === 'terminal' && tab.terminal === terminalHandle)?.id ??
    terminalHandle
  )
}
