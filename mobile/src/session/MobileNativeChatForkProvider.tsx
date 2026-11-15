import { AGENT_SESSION_TURN_FORK_CONTEXT_RUNTIME_CAPABILITY } from '../../../src/shared/agent-session/agent-session-runtime-capabilities'
import { MobileChatTurnForkSheet, type MobileChatTurnForkPoint } from './MobileChatTurnForkSheet'
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useHostProtocolGates } from '../components/host-protocol-gates-context'
import type { TuiAgent } from '../../../src/shared/agent-launch/catalog/tui-agent'
import type { StructuredAgentSessionForkSource } from '../../../src/shared/agent-session/structured-agent-session-create'
import { MobileNativeChatForkedFromContext } from './mobile-native-chat-notice-context'
import { forkMobileStructuredChat } from './mobile-structured-chat-fork'
import {
  MobileNativeChatForkContext,
  useMobileNativeChatFork
} from './native-chat/use-mobile-native-chat-fork'
import { resolveMobileNativeChatSessionId } from './native-chat/mobile-native-chat-eligibility'
import type { MobileSessionController } from './use-mobile-session-controller'

/** The chat's "Fork from this response" and the chat a "Forked from" divider opens. */
export function MobileNativeChatForkProvider({
  controller,
  children
}: {
  controller: MobileSessionController
  children: React.ReactNode
}): React.JSX.Element {
  const { client, nativeChatController: chat, openNativeSession, worktreeId } = controller
  const { statusPending } = useHostProtocolGates()
  // The controller is rebuilt each render; a fork reads its session state at the press.
  const latestController = useRef(controller)
  useLayoutEffect(() => {
    latestController.current = controller
  })
  const [point, setPoint] = useState<MobileChatTurnForkPoint | null>(null)
  const finish = useRef<(() => void) | null>(null)
  const closePoint = useCallback(() => {
    setPoint(null)
    finish.current?.()
    finish.current = null
  }, [])
  const activeSource = resolveMobileNativeChatSessionId(controller.activeSessionTab)
  useLayoutEffect(() => {
    closePoint()
    return closePoint
  }, [client, worktreeId, activeSource, closePoint])
  const createFork = useCallback((agent: TuiAgent, forkFrom: StructuredAgentSessionForkSource) => {
    const current = latestController.current
    if (!current.hostCapabilities?.includes(AGENT_SESSION_TURN_FORK_CONTEXT_RUNTIME_CAPABILITY)) {
      return forkMobileStructuredChat(current, agent, forkFrom)
    }
    const expectedCursor = current.nativeChatController.nativeChatJournalCursor
    if (!expectedCursor) {
      return Promise.resolve()
    }
    return new Promise<void>((resolve) => {
      finish.current = resolve
      setPoint({ ...forkFrom, sourceAgent: agent, expectedCursor })
    })
  }, [])
  const fork = useMobileNativeChatFork({
    client,
    hostCapabilities: controller.hostCapabilities,
    hostStatusPending: statusPending || controller.connState !== 'connected',
    agent: chat.nativeChatAgent,
    sessionId: resolveMobileNativeChatSessionId(controller.activeSessionTab),
    messages: chat.nativeChatSession.messages,
    turnJournal: chat.nativeChatTurnJournal,
    agentWorking: chat.nativeChatTurnActive,
    sessionForkSupport: chat.nativeChatForkSupport,
    createFork
  })
  // A fork and its source share a workspace and host.
  const openSource = useMemo(
    () =>
      client
        ? (sourceSessionId: string) =>
            void openNativeSession({
              kind: 'history',
              structuredSession: { sessionId: sourceSessionId, workspaceId: worktreeId }
            })
        : undefined,
    [client, openNativeSession, worktreeId]
  )
  return (
    <MobileNativeChatForkContext.Provider value={fork}>
      <MobileNativeChatForkedFromContext.Provider value={openSource}>
        {children}
        {point ? (
          <MobileChatTurnForkSheet controller={controller} point={point} onClose={closePoint} />
        ) : null}
      </MobileNativeChatForkedFromContext.Provider>
    </MobileNativeChatForkContext.Provider>
  )
}
