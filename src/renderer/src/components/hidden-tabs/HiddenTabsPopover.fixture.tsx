import { useState } from 'react'
import { Plus } from 'lucide-react'
import { defineFixture } from '../../component-fixtures/component-fixture'
import { Button } from '@/components/ui/button'
import { HiddenTabsPopover, type HiddenTabRow } from './HiddenTabsPopover'
const examples: [HiddenTabRow['tab']['contentType'], string, string][] = [
  ['terminal', 'API server', 'codex · feat/auth'],
  ['agent-session', 'Review auth flow', 'Claude · Session'],
  ['editor', 'middleware.ts', 'src/server/middleware.ts'],
  ['browser', 'Application preview', 'localhost:5173/settings'],
  ['simulator', 'iPhone 17', 'Mobile emulator']
]
const rows: HiddenTabRow[] = examples.map(([type, title, detail], index) => ({
  tab: {
    id: `hidden-${index}`,
    entityId: `entity-${index}`,
    worktreeId: 'fixture',
    groupId: 'group',
    contentType: type,
    label: title,
    customLabel: null,
    color: null,
    sortOrder: index,
    createdAt: 0,
    isHidden: true
  },
  title,
  detail,
  keywords: [detail]
}))
function RecoveryFixture({
  empty = false,
  pending = false,
  error = false,
  longLabels = false
}: {
  empty?: boolean
  pending?: boolean
  error?: boolean
  longLabels?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [inventory, setInventory] = useState(
    empty
      ? []
      : longLabels
        ? rows.map((row) =>
            row.tab.contentType === 'editor'
              ? {
                  ...row,
                  title:
                    'authenticated-session-middleware-with-refresh-token-rotation-and-replay-protection.ts',
                  detail:
                    'packages/platform/server/src/authentication/session/refresh-token/rotation/middleware/authenticated-session-middleware.ts'
                }
              : row
          )
        : rows
  )
  return (
    <div className="min-h-[480px] bg-background p-4 text-foreground">
      <div className="flex h-8 items-stretch border-b border-border bg-tab-bar">
        <span className="my-auto mr-4 truncate text-xs text-muted-foreground">Workspace</span>
        <HiddenTabsPopover
          rows={inventory}
          open={open}
          onOpenChange={setOpen}
          supported
          pending={pending}
          error={error ? 'The host has not confirmed the tab change. Try again.' : null}
          onRetry={() => {}}
          onActivate={(row) => {
            setInventory((current) => current.filter((item) => item.tab.id !== row.tab.id))
            setOpen(false)
          }}
          onUnhide={(row) =>
            setInventory((current) => current.filter((item) => item.tab.id !== row.tab.id))
          }
          onUnhideAll={() => setInventory([])}
        />
        <Button variant="ghost" size="icon-sm" aria-label="New tab">
          <Plus className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}
const open = (frame: HTMLElement) => {
  frame.querySelector<HTMLButtonElement>('button[aria-label="Hidden tabs"]')?.click()
}
export const desktop = defineFixture({
  width: 900,
  render: () => <RecoveryFixture />,
  interact: open
})
export const narrow = defineFixture({
  width: 360,
  render: () => <RecoveryFixture />,
  interact: open
})
export const zero = defineFixture({
  width: 360,
  render: () => <RecoveryFixture empty />,
  interact: open
})
export const waiting = defineFixture({
  width: 360,
  render: () => <RecoveryFixture pending />,
  interact: open
})
export const retry = defineFixture({
  width: 360,
  render: () => <RecoveryFixture error />,
  interact: open
})

export const longNarrow = defineFixture({
  width: 360,
  render: () => <RecoveryFixture longLabels />,
  interact: open
})
