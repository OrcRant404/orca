import { useTranslate } from '@/i18n/use-translate'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import type { AgentSessionContinuationContextMode } from '@/lib/agent-session-continuation'

export function AgentSessionContinuationContextPicker({
  intent,
  mode,
  disabled,
  preparing,
  hasFullContext,
  sourceKind,
  onChange
}: {
  intent: 'handoff' | 'fork'
  mode: AgentSessionContinuationContextMode
  disabled: boolean
  preparing: boolean
  hasFullContext: boolean
  sourceKind?: 'chat'
  onChange: (mode: AgentSessionContinuationContextMode) => void
}) {
  const t = useTranslate()
  return (
    <div className="min-w-0 space-y-1.5">
      <label className="text-xs font-medium">
        {t('components.agentSessionContinuation.context', 'Context')}
      </label>
      <Select
        disabled={disabled}
        value={mode}
        onValueChange={(value) => {
          if (value === 'focused' || value === 'full') {
            onChange(value)
          }
        }}
      >
        <SelectTrigger className="min-w-0 w-full" size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="focused">
            {intent === 'fork'
              ? t(
                  'components.agentSessionContinuation.forkRecent',
                  'Recent context through this turn'
                )
              : t(
                  'components.agentSessionContinuation.modeFocused',
                  'Focused handoff (Recommended)'
                )}
          </SelectItem>
          <SelectItem value="full" disabled={!hasFullContext}>
            {intent === 'fork'
              ? t(
                  'components.agentSessionContinuation.forkFull',
                  'Conversation through this turn (Recommended)'
                )
              : t('components.agentSessionContinuation.modeFull', 'Full session transcript')}
          </SelectItem>
        </SelectContent>
      </Select>
      <p className="min-h-12 text-[11px] leading-4 text-muted-foreground">
        {preparing
          ? null
          : intent === 'fork'
            ? t(
                'components.agentSessionContinuation.forkContextDescription',
                'Copies conversation context through this completed turn. Workspace files stay in their current state. The new agent waits for your next instruction.'
              )
            : !hasFullContext
              ? sourceKind === 'chat'
                ? t(
                    'components.agentSessionContinuation.modeLoadedDescription',
                    'Uses recent messages currently loaded in this chat and the current workspace.'
                  )
                : t(
                    'components.agentSessionContinuation.modeCapturedDescription',
                    'Uses captured text and the current workspace.'
                  )
              : mode === 'focused'
                ? t(
                    'components.agentSessionContinuation.modeFocusedDescription',
                    'Uses the latest status and current workspace, reading older transcript details only when needed.'
                  )
                : t(
                    'components.agentSessionContinuation.modeFullDescription',
                    'Asks the new Agent to read the complete saved session before continuing. This can take longer and use significant context, plan usage, or API credits.'
                  )}
      </p>
    </div>
  )
}
