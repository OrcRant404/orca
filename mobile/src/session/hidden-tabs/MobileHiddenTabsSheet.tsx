import { useState } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { EyeOff, FileText, Globe, MessageSquare, SquareTerminal } from 'lucide-react-native'
import { BottomDrawer } from '../../components/bottom-drawer/BottomDrawer'
import { SheetHeader } from '../../components/nav-bar/SheetHeader'
import { MobileSearchField } from '../../components/MobileSearchField'
import { ListGroup, ListRow } from '../../components/list/ListGroup'
import { colors, feedback, radii, spacing, typography } from '../../theme/mobile-theme'
import { themedStyleSheet } from '../../theme/themed-styles'
import { useMobileColorScheme } from '../../theme/use-mobile-color-scheme'
import { useMobileTranslation } from '../../i18n/use-mobile-translation'
import { getMobileSessionTabTitle } from '../../terminal/session/mobile-terminal-tab-agent'
import type { MobileSessionController } from '../use-mobile-session-controller'

export function MobileHiddenTabsSheet({ controller }: { controller: MobileSessionController }) {
  return (
    <BottomDrawer
      visible={controller.showHiddenTabs}
      onClose={() => controller.setShowHiddenTabs(false)}
      contentScrollable
    >
      <MobileHiddenTabsSheetContent controller={controller} />
    </BottomDrawer>
  )
}
export function MobileHiddenTabsSheetContent({
  controller
}: {
  controller: Pick<
    MobileSessionController,
    | 'hiddenSessionTabs'
    | 'hiddenTabsPending'
    | 'hiddenTabsError'
    | 'hiddenTabsSupported'
    | 'connState'
    | 'setShowHiddenTabs'
    | 'unhideAllSessionTabs'
    | 'unhideSessionTab'
    | 'activateHiddenSessionTab'
    | 'retryHiddenTabAction'
  >
}) {
  const [query, setQuery] = useState('')
  useMobileColorScheme()
  const t = useMobileTranslation()
  const disabled =
    controller.hiddenTabsPending ||
    controller.hiddenTabsSupported !== true ||
    controller.connState !== 'connected'
  const rows = controller.hiddenSessionTabs.filter((tab) => {
    const detail =
      tab.type === 'file' || tab.type === 'markdown'
        ? tab.relativePath
        : tab.type === 'browser'
          ? tab.url
          : tab.type === 'agent-session'
            ? tab.agent
            : [tab.launchAgent, tab.agentStatus?.agentType].filter(Boolean).join(' ')
    return `${getMobileSessionTabTitle(tab)} ${detail ?? ''}`
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase())
  })
  return (
    <>
      <SheetHeader
        title={t('session.hidden.title', 'Hidden tabs')}
        onClose={() => controller.setShowHiddenTabs(false)}
      />
      <View style={styles.content}>
        <MobileSearchField
          value={query}
          onChangeText={setQuery}
          placeholder={t('session.hidden.search', 'Search hidden tabs…')}
        />
        <View style={styles.heading}>
          <Text style={styles.hint}>
            {t('session.hidden.hint', 'Open a tab, or unhide it without switching.')}
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={disabled || !controller.hiddenSessionTabs.length}
            onPress={controller.unhideAllSessionTabs}
            style={styles.action}
          >
            <Text
              style={[
                styles.actionText,
                (disabled || !controller.hiddenSessionTabs.length) && styles.disabled
              ]}
            >
              {t('session.hidden.unhideAll', 'Unhide all')}
            </Text>
          </Pressable>
        </View>
        <ListGroup>
          {rows.map((tab) => {
            const Icon =
              tab.type === 'terminal'
                ? SquareTerminal
                : tab.type === 'agent-session'
                  ? MessageSquare
                  : tab.type === 'browser'
                    ? Globe
                    : FileText
            const detail =
              tab.type === 'file' || tab.type === 'markdown'
                ? tab.relativePath
                : tab.type === 'browser'
                  ? tab.url
                  : tab.type === 'agent-session'
                    ? tab.agent
                    : null
            return (
              <ListRow
                key={tab.id}
                title={getMobileSessionTabTitle(tab)}
                subtitle={detail ?? undefined}
                leading={<Icon size={18} color={colors.textMuted} />}
                disabled={disabled}
                onPress={() => controller.activateHiddenSessionTab(tab)}
                accessory={
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${t('session.hidden.unhide', 'Unhide')} ${getMobileSessionTabTitle(tab)}`}
                    disabled={disabled}
                    onPress={(event) => {
                      event.stopPropagation()
                      controller.unhideSessionTab(tab)
                    }}
                    style={({ pressed }) => [styles.action, pressed && styles.pressed]}
                  >
                    <Text style={[styles.actionText, disabled && styles.disabled]}>
                      {t('session.hidden.unhide', 'Unhide')}
                    </Text>
                  </Pressable>
                }
              />
            )
          })}
        </ListGroup>
        {!rows.length && (
          <View style={styles.empty}>
            <EyeOff size={24} color={colors.textMuted} />
            <Text style={styles.hint}>{t('session.hidden.empty', 'No hidden tabs')}</Text>
          </View>
        )}
        {controller.hiddenTabsSupported === false && (
          <Text style={styles.hint}>
            {t('session.hidden.unsupported', 'Update the execution host to manage hidden tabs.')}
          </Text>
        )}
        {controller.hiddenTabsPending && (
          <View accessibilityLiveRegion="polite" style={styles.heading}>
            <ActivityIndicator size="small" color={colors.textMuted} />
            <Text style={styles.hint}>{t('session.hidden.waiting', 'Waiting for the host…')}</Text>
          </View>
        )}
        {controller.hiddenTabsError && (
          <View accessibilityRole="alert">
            <Text style={styles.error}>{controller.hiddenTabsError}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={controller.retryHiddenTabAction}
              style={styles.action}
            >
              <Text style={styles.actionText}>{t('common.retry', 'Retry')}</Text>
            </Pressable>
          </View>
        )}
      </View>
    </>
  )
}
const styles = themedStyleSheet(() => ({
  content: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  hint: { fontSize: typography.metaSize, color: colors.textMuted, flex: 1 },
  action: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.control
  },
  actionText: { fontSize: typography.bodySize, color: colors.textPrimary },
  disabled: { opacity: feedback.disabledOpacity },
  pressed: { opacity: feedback.pressedOpacity },
  empty: { minHeight: 120, gap: spacing.md, alignItems: 'center', justifyContent: 'center' },
  error: { fontSize: typography.metaSize, color: colors.statusRed }
}))
