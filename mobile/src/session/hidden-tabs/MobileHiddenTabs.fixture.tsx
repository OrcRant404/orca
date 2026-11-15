import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Plus } from 'lucide-react-native'
import { MobileHiddenTabsButton } from './MobileHiddenTabsButton'
import { MobileHiddenTabsSheetContent } from './MobileHiddenTabsSheet'
import type { MobileSessionTab } from '../tabs/mobile-session-tabs'
import { colors, spacing, typography } from '../../theme/mobile-theme'
import { useMobileColorScheme } from '../../theme/use-mobile-color-scheme'

const inventory: MobileSessionTab[] = [
  {
    type: 'terminal',
    id: 'terminal-pane',
    parentTabId: 'terminal-tab',
    title: 'Tab recovery plan',
    terminal: 'pty-1',
    launchAgent: 'codex',
    isActive: false,
    isHidden: true
  },
  {
    type: 'browser',
    id: 'browser-tab',
    title: 'Application preview',
    browserWorkspaceId: 'browser',
    browserPageId: 'page',
    url: 'http://localhost:3000',
    loading: false,
    loadError: null,
    canGoBack: false,
    canGoForward: false,
    isActive: false,
    isHidden: true
  },
  {
    type: 'file',
    id: 'file-tab',
    title: 'STYLEGUIDE.md',
    filePath: '/repo/docs/STYLEGUIDE.md',
    relativePath: 'docs/STYLEGUIDE.md',
    mode: 'edit',
    isDirty: false,
    isActive: false,
    isHidden: true
  }
]
export function MobileHiddenTabsFixture({
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
  useMobileColorScheme()
  const [rows, setRows] = useState(
    empty
      ? []
      : longLabels
        ? inventory.map((tab) =>
            tab.type === 'file'
              ? {
                  ...tab,
                  title:
                    'authenticated-session-middleware-with-refresh-token-rotation-and-replay-protection.ts',
                  relativePath:
                    'packages/platform/server/src/authentication/session/refresh-token/rotation/middleware/authenticated-session-middleware.ts'
                }
              : tab
          )
        : inventory
  )
  const [open, setOpen] = useState(false)
  const unhide = (tab: MobileSessionTab) =>
    setRows((current) => current.filter((row) => row.id !== tab.id))
  return (
    <View style={{ minHeight: 800, backgroundColor: colors.bgBase }}>
      <View style={{ height: 60, paddingHorizontal: spacing.lg, justifyContent: 'center' }}>
        <Text style={{ color: colors.textPrimary, fontSize: typography.titleSize }}>
          feat/hide-tabs
        </Text>
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-end',
          borderBottomWidth: 1,
          borderBottomColor: colors.borderSubtle,
          paddingRight: spacing.sm
        }}
      >
        <MobileHiddenTabsButton
          count={rows.length}
          pending={pending}
          onPress={() => setOpen(true)}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New tab"
          style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Plus size={18} color={colors.textMuted} />
        </Pressable>
      </View>
      {open ? (
        <View
          style={{
            marginTop: spacing.xl,
            paddingVertical: spacing.md,
            borderTopWidth: 1,
            borderTopColor: colors.borderSubtle,
            backgroundColor: colors.sheetSurface
          }}
        >
          <MobileHiddenTabsSheetContent
            controller={{
              hiddenSessionTabs: rows,
              hiddenTabsPending: pending,
              hiddenTabsError: error
                ? 'The host has not confirmed the tab change. Try again.'
                : null,
              hiddenTabsSupported: true,
              connState: 'connected',
              setShowHiddenTabs: setOpen,
              unhideAllSessionTabs: () => setRows([]),
              unhideSessionTab: unhide,
              activateHiddenSessionTab: (tab) => {
                unhide(tab)
                setOpen(false)
              },
              retryHiddenTabAction: () => {}
            }}
          />
        </View>
      ) : (
        <View style={{ padding: spacing.xl }}>
          <Text style={{ color: colors.textMuted, fontSize: typography.bodySize }}>
            All tabs are hidden. Open Hidden tabs or create a tab.
          </Text>
        </View>
      )}
    </View>
  )
}
