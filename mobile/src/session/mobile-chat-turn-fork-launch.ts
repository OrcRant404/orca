import { translate } from '../i18n/mobile-i18n'
import type { TuiAgent } from '../../../src/shared/agent-launch/catalog/tui-agent'
import { buildAgentSessionTurnForkPrompt } from '../../../src/shared/agent-session/requests/agent-session-turn-fork-prompt'
import type { AgentSessionContinuationContext } from '../../../src/shared/agent-session/agent-session-wire'
import type { MobileSessionController } from './use-mobile-session-controller'
import {
  launchAgentInExistingWorkspace,
  reserveMobileAgentLaunch
} from './agent-launch/mobile-existing-agent-launch'
import {
  launchedSelection,
  withLaunchReply,
  withoutUnansweredLaunch
} from './tabs/pending-session-selection'
import { releaseTerminalCreateLock } from '../terminal/session/terminal-create-lock'

export async function launchMobileChatTurnFork(
  scope: MobileSessionController,
  input: {
    agent: TuiAgent
    model?: string
    mode: 'full' | 'focused'
    context: AgentSessionContinuationContext
    sourceAgent: string
  }
): Promise<'opened' | 'failed' | 'unknown'> {
  if (!scope.client || scope.creatingTerminalRef.current || input.context.status !== 'current') {
    return 'failed'
  }
  const prompt = buildAgentSessionTurnForkPrompt({
    ...input.context,
    capturedText: input.context.capturedText ?? '',
    mode: input.mode,
    sourceAgent: input.sourceAgent
  })
  if (!prompt) {
    return 'failed'
  }
  const lock = `mobile-turn-fork:${Date.now()}`
  const reservation = reserveMobileAgentLaunch(input.agent)
  scope.creatingTerminalRef.current = lock
  scope.setCreating(true)
  scope.pendingSelectionRef.current = launchedSelection(lock, {}, null)
  try {
    const launched = await launchAgentInExistingWorkspace({
      client: scope.client,
      hostCapabilities: scope.hostCapabilities,
      worktreeId: scope.worktreeId,
      agent: input.agent,
      surface: 'chat',
      reservation,
      prompt: { text: prompt, delivery: 'submit' },
      ...(input.model ? { chatOptions: { model: input.model } } : {})
    })
    if (launched.kind === 'launched' && launched.result.outcome.kind === 'structured') {
      void scope.fetchSessionTabs()
      if (launched.promptDelivered !== true) {
        scope.showToast(
          launched.promptDelivered === false
            ? translate(
                'chat.fork.contextNotSent',
                'The fork opened, but its context was not sent. Check Session History before retrying.'
              )
            : translate(
                'chat.fork.contextUnconfirmed',
                'The fork opened, but its context delivery could not be confirmed. Check Session History before retrying.'
              ),
          4000
        )
        return 'unknown'
      }
      scope.pendingSelectionRef.current = withLaunchReply(scope.pendingSelectionRef.current, lock, {
        sessionId: launched.result.outcome.sessionId
      })
      return 'opened'
    }
    scope.showToast(
      launched.kind === 'unknown'
        ? launched.message
        : translate(
            'chat.fork.openFailed',
            'The fork could not be opened. Check Session History before retrying.'
          ),
      4000
    )
    return launched.kind === 'unknown' || launched.kind === 'launched' ? 'unknown' : 'failed'
  } catch {
    scope.showToast(
      translate(
        'chat.fork.resultUnconfirmed',
        'The fork result could not be confirmed. Check Session History before retrying.'
      ),
      4000
    )
    return 'unknown'
  } finally {
    scope.pendingSelectionRef.current = withoutUnansweredLaunch(
      scope.pendingSelectionRef.current,
      lock
    )
    releaseTerminalCreateLock(scope, lock)
  }
}
