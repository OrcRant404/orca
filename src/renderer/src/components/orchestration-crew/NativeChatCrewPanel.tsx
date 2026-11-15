import { formatOrcaSessionAddress, isOrcaSessionId } from '../../../../shared/orca-session-address'
import type { RefObject } from 'react'
import type { NativeChatComposerHandle } from '../native-chat/composer/native-chat-composer-types'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'
import { teamSidebarScopeKey, useTeamSidebarScopeRegistration } from './team-sidebar-scope'

export function NativeChatCrewPanel({
  tabId,
  paneKey,
  target,
  party: suppliedParty,
  sessionId,
  composerRef,
  canMention,
  isVisible = true
}: {
  tabId: string
  paneKey?: string
  target: RuntimeClientTarget | null
  party?: string | null
  sessionId?: string
  composerRef: RefObject<NativeChatComposerHandle | null>
  canMention: boolean
  isVisible?: boolean
}): null {
  const party =
    suppliedParty ??
    (sessionId && isOrcaSessionId(sessionId) ? formatOrcaSessionAddress(sessionId) : null)
  const hostKey = target?.kind === 'local' ? 'local' : (target?.environmentId ?? 'local')
  useTeamSidebarScopeRegistration(
    teamSidebarScopeKey(tabId, paneKey),
    target && party
      ? {
          target,
          party,
          sessionId,
          canMention,
          isVisible,
          mention: (rows) =>
            composerRef.current?.insertAgentReferences(
              rows.flatMap((row) =>
                row.sendAddress ? [{ label: row.label, address: row.sendAddress, hostKey }] : []
              )
            )
        }
      : null
  )
  return null
}
export function NativeChatCrewFrame({
  panel,
  children
}: {
  panel: React.ReactNode
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {panel}
      {children}
    </div>
  )
}
