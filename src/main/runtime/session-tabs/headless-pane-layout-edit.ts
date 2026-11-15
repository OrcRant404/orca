import type {
  TerminalLayoutSnapshot,
  TerminalPaneLayoutNode
} from '../../../shared/workspace-layout/terminal-tab-types'
import {
  sameStringRecord,
  terminalLayoutNodeEqual
} from '../../../shared/workspace-layout/terminal-layout-equality'

export type HeadlessPaneLayoutEdit = {
  tabId: string
  root: TerminalPaneLayoutNode | null
  expandedLeafId: string | null
  chatLeafId?: string | null
  titlesByLeafId?: Record<string, string>
}

// Remounts resend unchanged layouts; avoid persisting and broadcasting them to every client.
export function paneLayoutEditIsNoOp(
  layout: Pick<TerminalLayoutSnapshot, 'root' | 'expandedLeafId' | 'chatLeafId' | 'titlesByLeafId'>,
  edit: HeadlessPaneLayoutEdit
): boolean {
  return (
    terminalLayoutNodeEqual(edit.root ?? layout.root, layout.root) &&
    (layout.expandedLeafId ?? null) === edit.expandedLeafId &&
    (edit.chatLeafId === undefined || (layout.chatLeafId ?? null) === (edit.chatLeafId ?? null)) &&
    (!edit.titlesByLeafId || sameStringRecord(layout.titlesByLeafId, edit.titlesByLeafId))
  )
}
