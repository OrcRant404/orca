import { useId } from 'react'
import { getAgentSessionOptionCatalog } from '../../../../shared/agent-session/options/agent-session-option-catalog'
import type { TerminalQuickCommandLaunchOptions } from '../../../../shared/terminal/quick-commands/terminal-quick-command-types'
import type { TuiAgent } from '../../../../shared/agent-launch/catalog/tui-agent'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useTranslate } from '@/i18n/use-translate'
import {
  getTerminalQuickCommandEffortChoices,
  QUICK_COMMAND_FAST_SERVICE_TIER,
  QUICK_COMMAND_LAUNCH_MODEL_MAX_LENGTH,
  supportsTerminalQuickCommandFastMode
} from './terminal-quick-command-launch-option-fields'

// Why: Radix Select reserves the empty string, so "Default" needs its own value.
const DEFAULT_EFFORT_VALUE = '__default__'

type TerminalQuickCommandLaunchOptionsFieldsProps = {
  disabled: boolean
  hostSupported: boolean
  agent: TuiAgent
  launchOptions: TerminalQuickCommandLaunchOptions | undefined
  onChange: (launchOptions: TerminalQuickCommandLaunchOptions | undefined) => void
}

export function TerminalQuickCommandLaunchOptionsFields({
  disabled,
  hostSupported,
  agent,
  launchOptions,
  onChange
}: TerminalQuickCommandLaunchOptionsFieldsProps): React.JSX.Element | null {
  const t = useTranslate()
  const modelId = useId()
  const effortId = useId()
  const hintId = useId()
  if (!launchOptions && !getAgentSessionOptionCatalog(agent)) {
    return null
  }
  const model = launchOptions?.model ?? ''
  const hasModel = model.trim().length > 0
  const fieldsDisabled = disabled || !hostSupported
  const dependentDisabled = fieldsDisabled || !hasModel
  const effortChoices = getTerminalQuickCommandEffortChoices(agent, model.trim())
  const effort = launchOptions?.effort
  // Why: keep a saved effort visible even when the catalog no longer lists it.
  const visibleEffortChoices =
    effort && !effortChoices.some((choice) => choice.value === effort)
      ? [...effortChoices, { value: effort, label: effort }]
      : effortChoices
  const showFast = supportsTerminalQuickCommandFastMode(agent)
  const defaultLabel = t(
    'auto.components.terminal.quick.commands.TerminalQuickCommandLaunchOptionsFields.default',
    'Default'
  )

  return (
    <div className="space-y-2 pt-2">
      <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto]">
        <div className="min-w-0 space-y-2">
          <Label htmlFor={modelId}>
            {t(
              'auto.components.terminal.quick.commands.TerminalQuickCommandLaunchOptionsFields.model',
              'Model ID'
            )}
          </Label>
          <Input
            id={modelId}
            value={model}
            maxLength={QUICK_COMMAND_LAUNCH_MODEL_MAX_LENGTH}
            disabled={fieldsDisabled}
            spellCheck={false}
            aria-describedby={hintId}
            placeholder={defaultLabel}
            onChange={(event) => {
              const nextModel = event.target.value
              // Why: effort and speed are model-specific, so a different model starts from defaults.
              onChange(nextModel ? { model: nextModel } : undefined)
            }}
          />
        </div>
        <div className="min-w-0 space-y-2">
          <Label htmlFor={effortId}>
            {t(
              'auto.components.terminal.quick.commands.TerminalQuickCommandLaunchOptionsFields.effort',
              'Effort'
            )}
          </Label>
          <Select
            value={effort ?? DEFAULT_EFFORT_VALUE}
            disabled={dependentDisabled || visibleEffortChoices.length === 0}
            onValueChange={(value) => {
              if (!launchOptions) {
                return
              }
              const { effort: _previous, ...rest } = launchOptions
              onChange(value === DEFAULT_EFFORT_VALUE ? rest : { ...rest, effort: value })
            }}
          >
            <SelectTrigger id={effortId} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={DEFAULT_EFFORT_VALUE}>{defaultLabel}</SelectItem>
              {visibleEffortChoices.map((choice) => (
                <SelectItem key={choice.value} value={choice.value}>
                  {choice.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {showFast ? (
          <label className="flex h-9 cursor-pointer items-center gap-2 has-[:disabled]:cursor-not-allowed">
            <Switch
              checked={launchOptions?.serviceTier === QUICK_COMMAND_FAST_SERVICE_TIER}
              disabled={dependentDisabled}
              onCheckedChange={(checked) => {
                if (!launchOptions) {
                  return
                }
                const { serviceTier: _previous, ...rest } = launchOptions
                onChange(checked ? { ...rest, serviceTier: QUICK_COMMAND_FAST_SERVICE_TIER } : rest)
              }}
            />
            <span className="text-sm">
              {t(
                'auto.components.terminal.quick.commands.TerminalQuickCommandLaunchOptionsFields.fast',
                'Fast'
              )}
            </span>
          </label>
        ) : null}
      </div>
      <p id={hintId} className="text-xs text-muted-foreground">
        {hostSupported
          ? t(
              'auto.components.terminal.quick.commands.TerminalQuickCommandLaunchOptionsFields.hint',
              'Optional. Setting a model opens a Chat with these options; the prompt can then be blank.'
            )
          : t(
              'auto.components.terminal.quick.commands.TerminalQuickCommandLaunchOptionsFields.host_unsupported',
              'Update Orca on this host to set a model.'
            )}
      </p>
    </div>
  )
}
