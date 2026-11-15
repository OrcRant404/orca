import { createRef, type RefObject } from 'react'
import { render, type RenderResult } from '@testing-library/react'
import type { OrchestrationCrewRow } from '../../../../../../shared/orchestration/orchestration-crew'
import type { OrchestrationAgentReference } from '../../../../../../shared/orchestration/mailbox/orchestration-agent-reference'
import { useTeamSidebarScope } from '../../../orchestration-crew/team-sidebar-scope'
import { CrewPanelContent } from '../../../orchestration-crew/OrchestrationCrewPanel'
import { NativeChatCrewPanel } from '../../../orchestration-crew/NativeChatCrewPanel'
import { TooltipProvider } from '../../../ui/tooltip'
import type { NativeChatComposerInput } from './native-chat-composer-input'
import type { NativeChatComposerHandle } from '../native-chat-composer-types'
import { NativeChatPromptEditor } from './NativeChatPromptEditor'
import { useNativeChatComposerHandle } from './use-native-chat-composer-handle'

export function mountedMention(
  crewRows: OrchestrationCrewRow[],
  first: OrchestrationAgentReference,
  managed = false,
  initialValue = 'Hello suffix'
): RenderResult & {
  input: RefObject<NativeChatComposerInput | null>
  handle: RefObject<NativeChatComposerHandle | null>
} {
  crewRows.push({
    partyKey: 'worker',
    role: 'worker',
    label: first.label,
    agentKind: 'codex',
    status: 'working',
    sendAddress: first.address,
    ...(managed ? { task: { title: 'Inspect', state: 'dispatched' as const } } : {})
  })
  const input = createRef<NativeChatComposerInput>()
  const handle = createRef<NativeChatComposerHandle>()
  function Team() {
    const scope = useTeamSidebarScope('tab:mention-fixture')
    return scope ? (
      <CrewPanelContent {...scope} snapshot={scope.snapshot} surface="sidebar" initialOpen />
    ) : null
  }
  function Pane() {
    useNativeChatComposerHandle(handle, {
      textareaRef: input,
      isComposing: () => false,
      setDraft: () => {},
      setCaret: () => {},
      setActiveSuggestion: () => {},
      attachmentScopeKey: 'menu',
      targetKey: 'menu',
      disabled: false,
      caret: 6,
      resolveAttachmentOwner: () => ({ kind: 'local' }),
      attachResolvedPaths: () => {},
      attachCopiedFiles: () => {},
      captureCopiedFiles: () => async () => {},
      beginPendingImageAttachment: () => null,
      resolvePendingImageAttachment: () => {},
      dropPendingImageAttachment: () => {},
      setNotice: () => {},
      pastedTextEditor: () => input.current
    })
    return (
      <TooltipProvider>
        <div data-native-chat-root>
          <NativeChatCrewPanel
            tabId="mention-fixture"
            target={{ kind: 'environment', environmentId: 'captured-host' }}
            party="term_self"
            canMention
            composerRef={handle}
          />
          <Team />
          <NativeChatPromptEditor
            scopeKey="menu"
            inputRef={input}
            initialValue={initialValue}
            disabled={false}
            placeholder="Current input"
            onChange={() => {}}
            onSelect={() => {}}
          />
        </div>
      </TooltipProvider>
    )
  }
  return { ...render(<Pane />), input, handle }
}
