import { defineFixture } from '../../component-fixtures/component-fixture'
import type { HostedTerminalQuickCommand } from '@/hooks/use-terminal-quick-command-hosts'
import { TabBarQuickCommandsMenu } from './TabBarQuickCommandsMenu'

const command: HostedTerminalQuickCommand = {
  key: 'local\0fixture',
  hostId: 'local',
  hostLabel: 'This Mac',
  command: {
    id: 'fixture',
    label: 'Bounded Research & Implementation for a long project',
    command: 'echo fixture',
    appendEnter: true,
    scope: { type: 'global' }
  }
}
const noop = (): void => {}

function SelectedCommand(): React.JSX.Element {
  return (
    <div className="@container/tab-strip flex h-8 items-center bg-tab-bar px-2">
      <TabBarQuickCommandsMenu
        isFocused
        repoCommands={[]}
        globalCommands={[command]}
        mostRecent={command}
        addHosts={[]}
        hostLoadFailed={false}
        hostOwnershipPending={false}
        onAddCommand={noop}
        onDeleteCommand={noop}
        onEditCommand={noop}
        onMenuOpen={noop}
        onRunCommand={noop}
      />
    </div>
  )
}

export const selectedLongLabel = defineFixture({
  width: 600,
  render: () => <SelectedCommand />
})

export const selectedLongLabelFocused = defineFixture({
  width: 600,
  render: () => <SelectedCommand />,
  interact: (frame) => {
    frame.querySelector('button')?.focus()
  }
})
