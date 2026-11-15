import { useEffect, useRef, useState } from 'react'
import { Text, View } from 'react-native'
import { GitFork } from 'lucide-react-native'
import { BottomDrawer } from '../components/bottom-drawer/BottomDrawer'
import { SheetHeader } from '../components/nav-bar/SheetHeader'
import { ListGroup, ListRow } from '../components/list/ListGroup'
import { PickerModal } from '../components/PickerModal'
import { SheetPrimaryButton } from '../components/SheetPrimaryButton'
import { colors, spacing, typography } from '../theme/mobile-theme'
import { themedStyleSheet } from '../theme/themed-styles'
import { useMobileColorScheme } from '../theme/use-mobile-color-scheme'
import { useMobileTranslation } from '../i18n/use-mobile-translation'
import { isStructuredAgentId } from '../../../src/shared/agent-session/lifecycle/agent-session-provider-handle-encoding'
import type { TuiAgent } from '../../../src/shared/agent-launch/catalog/tui-agent'
import type { AgentJournalCursor } from '../../../src/shared/agent-session/journal/agent-session-journal-identity'
import type {
  AgentSessionContinuationContext,
  AgentSessionModelCatalogResult,
  AgentSessionModelOption
} from '../../../src/shared/agent-session/agent-session-wire'
import type { MobileSessionController } from './use-mobile-session-controller'
import { callAgentSession } from './mobile-structured-agent-session-rpc'
import { launchMobileChatTurnFork } from './mobile-chat-turn-fork-launch'

export type MobileChatTurnForkPoint = {
  sessionId: string
  throughItemId: string
  expectedCursor: AgentJournalCursor
  sourceAgent: TuiAgent
}

export function MobileChatTurnForkSheet({
  controller,
  point,
  onClose
}: {
  controller: MobileSessionController
  point: MobileChatTurnForkPoint
  onClose: () => void
}) {
  useMobileColorScheme()
  const t = useMobileTranslation()
  const { client, worktreeId } = controller
  const options = controller.createTabAgentOptions.filter((option) =>
    isStructuredAgentId(option.agent)
  )
  const [agent, setAgent] = useState<TuiAgent>(point.sourceAgent)
  const [model, setModel] = useState('')
  const [models, setModels] = useState<AgentSessionModelOption[]>([])
  const [mode, setMode] = useState<'full' | 'focused'>('full')
  const [picker, setPicker] = useState<'agent' | 'model' | 'context' | null>(null)
  const [context, setContext] = useState<AgentSessionContinuationContext | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const inFlight = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  useEffect(() => {
    if (!client) {
      return
    }
    let current = true
    void callAgentSession<AgentSessionContinuationContext>(
      client,
      'agentSession.continuationContext',
      {
        sessionId: point.sessionId,
        workspaceId: worktreeId,
        expectedCursor: point.expectedCursor,
        throughItemId: point.throughItemId
      }
    )
      .then((value) => {
        if (!current) {
          return
        }
        if (value.status !== 'current' || !value.transcriptPath) {
          setError(
            t(
              'chat.fork.contextUnavailable',
              'This turn could not be prepared. Reopen the chat and try again.'
            )
          )
        } else {
          setContext(value)
        }
      })
      .catch(() => {
        if (current) {
          setError(t('chat.fork.contextFailed', 'Could not prepare this turn. Try again.'))
        }
      })
    return () => {
      current = false
    }
  }, [client, point, worktreeId, t])
  useEffect(() => {
    setModels([])
    if (!client) {
      return
    }
    let current = true
    void callAgentSession<AgentSessionModelCatalogResult>(client, 'agentSession.modelCatalog', {
      agent,
      savedOnly: true
    })
      .then((value) => {
        if (current && value.origin !== 'unknown') {
          setModels(value.models)
        }
      })
      .catch(() => {})
    return () => {
      current = false
    }
  }, [client, agent])
  const start = async () => {
    if (
      inFlight.current ||
      !context ||
      error ||
      !options.some((option) => option.agent === agent)
    ) {
      return
    }
    inFlight.current = true
    setStarting(true)
    const opened = await launchMobileChatTurnFork(controller, {
      agent,
      model,
      context,
      mode,
      sourceAgent: point.sourceAgent
    })
    inFlight.current = false
    if (!mounted.current) {
      return
    }
    setStarting(false)
    if (opened === 'opened') {
      onClose()
    } else if (opened === 'unknown') {
      setError(
        t(
          'chat.fork.resultUnconfirmed',
          'The fork result could not be confirmed. Check Session History before retrying.'
        )
      )
    }
  }
  const close = () => {
    if (!starting) {
      onClose()
    }
  }
  return (
    <>
      <BottomDrawer visible onClose={close}>
        <SheetHeader
          title={t('chat.fork.title', 'Fork Chat from This Turn')}
          leading={{ label: t('common.cancel', 'Cancel'), onPress: close, disabled: starting }}
        />
        <View style={styles.body}>
          <Text style={styles.description}>
            {t(
              'chat.fork.description',
              'Start an independent chat with context through this turn. Later messages are excluded. Your original chat stays unchanged.'
            )}
          </Text>
          <ListGroup>
            <ListRow
              title={t('chat.fork.agent', 'Agent')}
              value={options.find((option) => option.agent === agent)?.label ?? agent}
              onPress={() => setPicker('agent')}
              disabled={starting}
              navigates
            />
            <ListRow
              title={t('chat.fork.model', 'Model')}
              value={
                models.find((option) => option.id === model)?.label ??
                t('chat.fork.defaultModel', 'Default model')
              }
              onPress={() => setPicker('model')}
              disabled={starting}
              navigates
            />
            <ListRow
              title={t('chat.fork.context', 'Context')}
              value={
                mode === 'full'
                  ? t('chat.fork.throughTurn', 'Conversation through this turn')
                  : t('chat.fork.recent', 'Recent context through this turn')
              }
              onPress={() => setPicker('context')}
              disabled={starting}
              navigates
            />
          </ListGroup>
          <Text style={styles.description}>
            {t(
              'chat.fork.filesUnchanged',
              'Workspace files stay in their current state. The new agent waits for your next instruction.'
            )}
          </Text>
          {error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          ) : null}
          <SheetPrimaryButton
            label={
              context || error
                ? t('chat.fork.create', 'Create Fork')
                : t('chat.fork.preparing', 'Preparing context…')
            }
            icon={GitFork}
            onPress={() => void start()}
            disabled={!context || !!error || !options.some((option) => option.agent === agent)}
            busy={starting}
          />
        </View>
      </BottomDrawer>
      <PickerModal
        visible={picker === 'agent'}
        title={t('chat.fork.chooseAgent', 'Choose Agent')}
        selected={agent}
        options={options.map((option) => ({ value: option.agent, label: option.label }))}
        onSelect={(value) => {
          setAgent(value)
          setModel('')
        }}
        onClose={() => setPicker(null)}
      />
      <PickerModal
        visible={picker === 'model'}
        title={t('chat.fork.chooseModel', 'Choose Model')}
        selected={model}
        options={[
          { value: '', label: t('chat.fork.defaultModel', 'Default model') },
          ...models.map((option) => ({ value: option.id, label: option.label }))
        ]}
        onSelect={setModel}
        onClose={() => setPicker(null)}
      />
      <PickerModal
        visible={picker === 'context'}
        title={t('chat.fork.context', 'Context')}
        selected={mode}
        options={[
          {
            value: 'full' as const,
            label: t('chat.fork.full', 'Conversation through this turn (Recommended)')
          },
          {
            value: 'focused' as const,
            label: t('chat.fork.recent', 'Recent context through this turn')
          }
        ]}
        onSelect={setMode}
        onClose={() => setPicker(null)}
      />
    </>
  )
}
const styles = themedStyleSheet(() => ({
  body: { padding: spacing.lg, gap: spacing.lg },
  description: { fontSize: typography.bodySize, color: colors.textSecondary },
  error: { fontSize: typography.bodySize, color: colors.statusRed }
}))
