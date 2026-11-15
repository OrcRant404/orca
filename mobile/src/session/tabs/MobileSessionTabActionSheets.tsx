import { ActionSheetModal } from '../../components/ActionSheetModal'
import { useMobileTranslation } from '../../i18n/use-mobile-translation'
import { FileText, RefreshCw } from 'lucide-react-native'
import { useMobileAllowAutoCloseActions } from './mobile-worker-auto-close'
import { useWorkspaceOnPairedHost } from '../../navigation/workspace-execution-host'
import type { MobileSessionController } from '../use-mobile-session-controller'
import { MobileHiddenTabsSheet } from '../hidden-tabs/MobileHiddenTabsSheet'
import { MobileBrowserTabActionSheet } from './MobileBrowserTabActionSheet'
import { getMobileTerminalActionSheetActions } from '../../terminal/session/mobile-terminal-action-sheet-actions'
import { isTerminalPhoneDisplayMode } from '../../terminal/session/terminal-phone-display-mode'
import { MobileAgentSessionTabActionSheet } from './MobileAgentSessionTabActionSheet'
export function MobileSessionTabActionSheets({
  controller
}: {
  controller: MobileSessionController
}) {
  const t = useMobileTranslation()
  const onPairedHost = useWorkspaceOnPairedHost()
  const terminalWorkerActions = useMobileAllowAutoCloseActions(
    controller.client,
    controller.actionTarget && { terminal: controller.actionTarget.handle }
  )
  const {
    sessionTabs,
    actionTarget,
    setActionTarget,
    markdownActionTarget,
    setMarkdownActionTarget,
    fileActionTarget,
    setFileActionTarget,
    browserActionTarget,
    setBrowserActionTarget,
    terminalModes,
    nativeChatController,
    toggleTabChatView,
    toggleDisplayMode,
    readFileTab,
    discardMarkdownLocalContent,
    copyMarkdownPath,
    handleBrowserNavigationCommand,
    handleClearTerminal,
    handleCloseTerminal,
    handleCloseSessionTab,
    bulkCloseActions,
    closeWithBulkActions,
    setRenameTarget
  } = controller
  return (
    <>
      <MobileHiddenTabsSheet controller={controller} />
      <ActionSheetModal
        visible={actionTarget != null}
        title={actionTarget?.title || t('session.sheets.terminal', 'Terminal')}
        actions={[
          ...controller.hiddenTabActions(
            sessionTabs.find(
              (tab) => tab.type === 'terminal' && tab.terminal === actionTarget?.handle
            ),
            () => setActionTarget(null)
          ),
          ...getMobileTerminalActionSheetActions({
            target: actionTarget,
            tabs: sessionTabs.filter((tab) => tab.type === 'terminal'),
            isTabChatView: nativeChatController.isTabChatView,
            nativeChatTranscriptIsLocalReadable: controller.nativeChatTranscriptIsLocalReadable,
            onDismiss: () => setActionTarget(null),
            onToggleChat: toggleTabChatView,
            isPhoneMode: (handle) => isTerminalPhoneDisplayMode(handle, terminalModes),
            onToggleDisplayMode: (handle) => void toggleDisplayMode(handle),
            onRename: setRenameTarget,
            onClear: (target) => void handleClearTerminal(target),
            onClose: (target) => void handleCloseTerminal(target),
            onCloseSessionTab: (tab) => void handleCloseSessionTab(tab),
            bulkCloseActions,
            workerActions: terminalWorkerActions
          })
        ]}
        onClose={() => setActionTarget(null)}
      />
      <ActionSheetModal
        visible={markdownActionTarget != null}
        title={markdownActionTarget?.title || t('session.sheets.markdown', 'Markdown')}
        actions={[
          {
            id: 'refresh',
            label: t('common.refresh', 'Refresh'),
            icon: RefreshCw,
            // Why: dirty refresh opens ConfirmModal; wait for this sheet's native
            // Modal to unmount first (same dual-Modal race as tab Rename, #10331).
            closeBeforePress: true,
            onPress: () => {
              const target = markdownActionTarget
              if (target) {
                discardMarkdownLocalContent(target)
              }
            }
          },
          {
            id: 'copyPath',
            label: t('session.sheets.copyPath', 'Copy Path'),
            icon: FileText,
            onPress: () => {
              const target = markdownActionTarget
              setMarkdownActionTarget(null)
              if (target) {
                void copyMarkdownPath(target)
              }
            }
          },
          ...controller.hiddenTabActions(markdownActionTarget, () => setMarkdownActionTarget(null)),
          ...closeWithBulkActions(markdownActionTarget, () => setMarkdownActionTarget(null))
        ]}
        onClose={() => setMarkdownActionTarget(null)}
      />
      <ActionSheetModal
        visible={fileActionTarget != null}
        title={fileActionTarget?.title || t('session.sheets.file', 'File')}
        actions={[
          {
            id: 'refresh',
            label: t('common.refresh', 'Refresh'),
            icon: RefreshCw,
            onPress: () => {
              const target = fileActionTarget
              setFileActionTarget(null)
              if (target) {
                void readFileTab(target)
              }
            }
          },
          ...controller.hiddenTabActions(fileActionTarget, () => setFileActionTarget(null)),
          ...closeWithBulkActions(fileActionTarget, () => setFileActionTarget(null))
        ]}
        onClose={() => setFileActionTarget(null)}
      />
      <MobileBrowserTabActionSheet
        target={browserActionTarget}
        hideActions={controller.hiddenTabActions(browserActionTarget, () =>
          setBrowserActionTarget(null)
        )}
        onClose={() => setBrowserActionTarget(null)}
        onNavigate={handleBrowserNavigationCommand}
        onCloseTab={handleCloseSessionTab}
        bulkCloseActions={bulkCloseActions}
      />
      <MobileAgentSessionTabActionSheet
        controller={controller}
        workspaceOnPairedHost={onPairedHost}
      />
    </>
  )
}
