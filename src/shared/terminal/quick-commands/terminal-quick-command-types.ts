import type { TuiAgent } from '../../agent-launch/catalog/tui-agent'
import type { TerminalQuickCommandLaunchOptions } from './terminal-quick-command-launch-options'

export type { TerminalQuickCommandLaunchOptions } from './terminal-quick-command-launch-options'

export type TerminalQuickCommandScope =
  | {
      type: 'global'
    }
  | {
      type: 'repo'
      repoId: string
    }

export type TerminalQuickCommandAction = 'terminal-command' | 'agent-prompt'

export type TerminalQuickCommandBase = {
  id: string
  label: string
  scope?: TerminalQuickCommandScope
}

export type TerminalCommandQuickCommand = TerminalQuickCommandBase & {
  action?: 'terminal-command'
  command: string
  appendEnter: boolean
}

export type TerminalAgentQuickCommand = TerminalQuickCommandBase & {
  action: 'agent-prompt'
  agent: TuiAgent
  prompt: string
  launchOptions?: TerminalQuickCommandLaunchOptions
}

export type TerminalQuickCommand = TerminalCommandQuickCommand | TerminalAgentQuickCommand
