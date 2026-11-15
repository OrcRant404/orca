import { useMemo } from 'react'
import { useStructuredAgentSessionHostCapabilityState } from '@/runtime/native-chat/host-capabilities/structured-agent-session-host-capability'
import { AGENT_SESSION_TURN_FORK_CONTEXT_RUNTIME_CAPABILITY } from '../../../../../../shared/agent-session/agent-session-runtime-capabilities'
import {
  latestAgentSessionContextClearSequence,
  agentSessionContextFloorSequence
} from '../../../../../../shared/agent-session/agent-session-context-clear'
import { nativeChatForkInventory } from '../../../../../../shared/native-chat/native-chat-fork-offer'
import type { AgentJournalRenderItem } from '../../../../../../shared/agent-session/journal/agent-session-journal-types'
import type { AgentJournalCursor } from '../../../../../../shared/agent-session/journal/agent-session-journal-identity'
import type {
  NativeChatForkSurface,
  NativeChatForkRowAction
} from '../../messages/actions/use-native-chat-fork'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { withTimeout } from '../../../../../../shared/promise-timeout-fallback'
import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useAppStore } from '@/store'
import { structuredChatTabById } from '@/lib/structured-chat-tab-index'
import { useStructuredChatTabConversationName } from '@/runtime/native-chat/naming/structured-conversation-name'
import { AgentSessionContinuationDialog } from '@/components/agent-session-continuation/AgentSessionContinuationDialog'
import {
  buildAgentSessionContinuationPrompt,
  type AgentSessionContinuationRequest
} from '@/lib/agent-session-continuation'
import { isTuiAgent } from '../../../../../../shared/agent-launch/catalog/tui-agent-config'
import { callStructuredAgentSession } from '@/runtime/native-chat/requests/structured-agent-session-call'
import { supportsStructuredAgentSessionContinuationContext } from '@/runtime/native-chat/host-capabilities/structured-agent-session-host-support'
import type { AgentSessionContinuationContext } from '../../../../../../shared/agent-session/agent-session-wire'
import { executionHostIdForStructuredTarget } from '@/runtime/native-chat/session-ownership/structured-agent-session-owner'
import type { NativeChatMessage } from '../../../../../../shared/native-chat/native-chat-types'
import type { NativeChatStructuredViewProps } from '../../native-chat-view-types'
import type { NativeChatFileLinkContext } from '../../links/actions/native-chat-file-link-context'
import { buildAgentSessionHandoffContext } from '../../../../../../shared/agent-session-handoff-context'

export type NativeChatHandOff = {
  /** This chat can seed another agent from its owning workspace. */
  available: boolean
  preparing: boolean
  open: () => void
  /** Drops a pending or open hand-off, e.g. when the conversation it describes moves on. */
  reset: () => void
  dialog: ReactNode
  turnFork: NativeChatForkSurface | undefined
}

export function useNativeChatHandOff({
  pane,
  directory,
  messages,
  epoch,
  journalItems,
  contextFloor,
  focusComposer
}: {
  pane: Pick<
    NativeChatStructuredViewProps,
    'tabId' | 'groupId' | 'sessionId' | 'target' | 'agent' | 'isVisible'
  >
  directory: NativeChatFileLinkContext | null
  messages: readonly NativeChatMessage[]
  epoch: string | null
  journalItems: readonly AgentJournalRenderItem[]
  contextFloor: AgentJournalCursor | undefined
  focusComposer: () => void
}): NativeChatHandOff {
  const pointSupport = useStructuredAgentSessionHostCapabilityState(
    pane.target,
    AGENT_SESSION_TURN_FORK_CONTEXT_RUNTIME_CAPABILITY
  )
  const intentKey = JSON.stringify([
    executionHostIdForStructuredTarget(pane.target),
    pane.sessionId,
    pane.agent,
    pane.isVisible,
    epoch,
    directory
  ])
  const operationSerial = useRef(0)
  type Attempt = { key: string; operation: number; throughItemId?: string } & (
    | { phase: 'preparing' }
    | { phase: 'prepared'; request: AgentSessionContinuationRequest }
  )
  const active = useRef<Attempt | null>(null)
  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const retire = useCallback(() => {
    active.current = null
    setAttempt(null)
  }, [])
  useLayoutEffect(() => {
    retire()
    return () => {
      retire()
    }
  }, [intentKey, retire])
  const chatTab = useAppStore((state) =>
    directory
      ? structuredChatTabById(state.unifiedTabsByWorktree, directory.worktreeId, pane.tabId)
      : undefined
  )
  const conversationName = useStructuredChatTabConversationName(chatTab)
  const currentAttempt = attempt === active.current && attempt?.key === intentKey ? attempt : null
  const request = currentAttempt?.phase === 'prepared' ? currentAttempt.request : null
  // The dialog launches in the chat's workspace, so it must be the same host the chat runs on.
  const available = Boolean(
    pane.isVisible &&
    epoch &&
    directory &&
    isTuiAgent(pane.agent) &&
    directory.runtimeEnvironmentId ===
      (pane.target.kind === 'environment' ? pane.target.environmentId : null)
  )
  const prepare = useCallback(
    async (throughItemId?: string): Promise<void> => {
      if (!available || !directory || !epoch || !isTuiAgent(pane.agent)) {
        return
      }
      if (active.current || (throughItemId && pointSupport !== 'supported')) {
        return
      }
      const current: Attempt = {
        key: intentKey,
        operation: ++operationSerial.current,
        phase: 'preparing',
        ...(throughItemId ? { throughItemId } : {})
      }
      active.current = current
      setAttempt(current)
      const context = await withTimeout(
        (async () => {
          if (
            !(await supportsStructuredAgentSessionContinuationContext(pane.target)) ||
            active.current !== current ||
            current.phase !== 'preparing'
          ) {
            return null
          }
          return callStructuredAgentSession<AgentSessionContinuationContext>(
            pane.target,
            'agentSession.continuationContext',
            {
              sessionId: pane.sessionId,
              workspaceId: directory.worktreeId,
              expectedCursor: { epoch, sequence: 0 },
              ...(throughItemId ? { throughItemId } : {})
            }
          )
        })(),
        30_000,
        null
      )
      if (active.current !== current || current.phase !== 'preparing') {
        return
      }
      if (context?.status === 'superseded' || (throughItemId && context?.status !== 'current')) {
        retire()
        if (throughItemId) {
          toast.error(
            translate(
              'components.native-chat.fork.contextUnavailable',
              'This turn could not be prepared for a fork. Reopen the chat and try again.'
            )
          )
        }
        return
      }
      const saved = context?.status === 'current' && typeof context.capturedText === 'string'
      const transcriptPath = saved ? context.transcriptPath : undefined
      const source = {
        sourceKind: 'chat' as const,
        sourceAgent: pane.agent,
        sourceTitle: chatTab?.customLabel?.trim() || conversationName || chatTab?.label,
        sourceWorkingDirectory: directory.worktreePath,
        transcriptPath,
        capturedText: saved
          ? (context.capturedText ?? '')
          : buildAgentSessionHandoffContext(messages)
      }
      if (
        buildAgentSessionContinuationPrompt(source, 'focused', throughItemId ? 'fork' : 'handoff')
      ) {
        const prepared: Attempt = {
          ...current,
          phase: 'prepared',
          request: {
            source,
            worktreeId: directory.worktreeId,
            workspacePath: directory.worktreePath,
            initialCwd: directory.worktreePath,
            groupId: pane.groupId,
            launchSource: 'native_chat'
          }
        }
        active.current = prepared
        setAttempt(prepared)
      } else {
        retire()
        toast.error(
          translate(
            'components.agentSessionContinuation.noContext',
            'No session context is available to continue in a new session.'
          )
        )
        focusComposer()
      }
    },
    [
      available,
      pointSupport,
      intentKey,
      retire,
      epoch,
      focusComposer,
      directory,
      pane.agent,
      pane.groupId,
      pane.sessionId,
      pane.target,
      chatTab,
      conversationName,
      messages
    ]
  )
  const open = useCallback(() => {
    void prepare()
  }, [prepare])
  const inventory = useMemo(() => nativeChatForkInventory(journalItems), [journalItems])
  const pointRequest = useCallback<NativeChatForkRowAction['request']>(
    async (throughItemId) => {
      await prepare(throughItemId)
      return undefined
    },
    [prepare]
  )
  const pointRow = useMemo<NativeChatForkRowAction>(
    () => ({
      support:
        pointSupport === 'supported' ? { kind: 'known', fork: 'checkpoint' } : { kind: 'unknown' },
      pendingItemId: currentAttempt?.throughItemId ?? null,
      request: pointRequest
    }),
    [pointSupport, currentAttempt?.throughItemId, pointRequest]
  )
  const turnFork = useMemo<NativeChatForkSurface | undefined>(
    () =>
      available && pointSupport !== 'unsupported'
        ? {
            ...pointRow,
            contextFloorSequence: Math.max(
              latestAgentSessionContextClearSequence(journalItems),
              agentSessionContextFloorSequence(contextFloor, epoch)
            ),
            ...inventory,
            rowAction: pointRow
          }
        : undefined,
    [available, pointSupport, pointRow, journalItems, contextFloor, epoch, inventory]
  )
  return {
    available,
    turnFork,
    preparing: currentAttempt?.phase === 'preparing',
    open,
    reset: retire,
    dialog: currentAttempt ? (
      <AgentSessionContinuationDialog
        key={currentAttempt.operation}
        open
        intent={currentAttempt.throughItemId ? 'fork' : 'handoff'}
        request={request}
        sourceWorkingDirectory={directory?.worktreePath}
        onOpenChange={(isOpen) => {
          if (!isOpen && active.current === currentAttempt) {
            retire()
          }
        }}
      />
    ) : null
  }
}

export function useNativeChatPaneHandOff(
  pane: Parameters<typeof useNativeChatHandOff>[0]['pane'],
  chat: Pick<
    Parameters<typeof useNativeChatHandOff>[0],
    'messages' | 'journalItems' | 'epoch' | 'contextFloor'
  >,
  directory: NativeChatFileLinkContext | null,
  focusComposer: () => void
): NativeChatHandOff {
  return useNativeChatHandOff({
    pane,
    directory,
    messages: chat.messages,
    journalItems: chat.journalItems,
    epoch: chat.epoch,
    contextFloor: chat.contextFloor,
    focusComposer
  })
}
