import { MobileSessionTabActionSheets } from './tabs/MobileSessionTabActionSheets'
import { Platform } from 'react-native'
import { useMobileTranslation } from '../i18n/use-mobile-translation'
import { getRepoIdFromWorktreeId } from '../../../src/shared/worktree/id'
import { useClipboardWriter } from '../platform/clipboard'
import { Copy, FileText, Globe, SquareTerminal } from 'lucide-react-native'
import { MobileSessionTerminalLayoutSheet } from '../terminal/session/MobileSessionTerminalLayoutSheet'
import { QuickCommandsSheet } from '../terminal/quick-commands/QuickCommandsSheet'
import { triggerSuccess, triggerError } from '../platform/haptics'
import { ActionSheetModal } from '../components/ActionSheetModal'
import { TextInputModal } from '../components/TextInputModal'
import { MobileTerminalRenameModal } from '../terminal/session/MobileTerminalRenameModal'
import { ConfirmModal } from '../components/ConfirmModal'
import { CustomKeyModal } from '../components/CustomKeyModal'
import { MobileDictationSetupSheet } from '../components/MobileDictationSetupSheet'
import { useWorkspaceOnPairedHost } from '../navigation/workspace-execution-host'
import type { MobileSessionController } from './use-mobile-session-controller'

export function MobileSessionSheets({ controller }: { controller: MobileSessionController }) {
  const t = useMobileTranslation()
  const {
    worktreeId,
    isFolderWorkspaceRoute,
    isFloatingWorkspaceRoute,
    client,
    worktreeName,
    pendingDiffNotesDelivery,
    setPendingDiffNotesDelivery,
    showCreateTabDrawer,
    setShowCreateTabDrawer,
    showQuickCommands,
    setShowQuickCommands,
    setShowCreateBrowserModal,
    showCreateBrowserModal,
    showTerminalLayout,
    setShowTerminalLayout,
    discardMarkdownTarget,
    setDiscardMarkdownTarget,
    leaveDrafts,
    setLeaveDrafts,
    setCustomKeys,
    showCustomKeyModal,
    setShowCustomKeyModal,
    deleteKeyTarget,
    setDeleteKeyTarget,
    showDictationSetup,
    closeDictationSetup,
    browserScreencastSupported,
    quickCommandsSupported,
    showToast,
    leaveSessionDroppingDrafts,
    confirmDiscardMarkdown,
    handleDeleteCustomKey,
    handleManageShortcuts,
    handleCreateTerminal,
    launchQuickCommand,
    handleCreateMarkdownNote,
    handleCreateBrowser,
    bulkCloseConfirm,
    createTabAgentActions,
    sendDiffNotesAgentActions
  } = controller
  const clipboard = useClipboardWriter()
  const onPairedHost = useWorkspaceOnPairedHost()
  return (
    <>
      <MobileSessionTerminalLayoutSheet
        controller={controller}
        visible={showTerminalLayout}
        onClose={() => setShowTerminalLayout(false)}
      />
      <QuickCommandsSheet
        visible={showQuickCommands && quickCommandsSupported === true}
        onClose={() => setShowQuickCommands(false)}
        client={client}
        repoId={
          isFolderWorkspaceRoute || isFloatingWorkspaceRoute
            ? null
            : getRepoIdFromWorktreeId(worktreeId) || null
        }
        repoName={worktreeName || null}
        agentPromptMaxLength={controller.quickCommandAgentPromptMaxLength}
        onLaunch={launchQuickCommand}
      />
      <ActionSheetModal
        visible={showCreateTabDrawer}
        title={t('session.sheets.newTab', 'New Tab')}
        actions={[
          ...createTabAgentActions,
          {
            id: 'terminal',
            label: t('session.sheets.terminal', 'Terminal'),
            icon: SquareTerminal,
            onPress: () => {
              setShowCreateTabDrawer(false)
              void handleCreateTerminal()
            }
          },
          // Why: browser/markdown creation resolve a real worktree on the host
          // (browser.tabCreate, files.createFile); the floating sentinel is
          // terminal-only over RPC, so those options hide there.
          ...(isFloatingWorkspaceRoute
            ? []
            : [
                {
                  id: 'browser',
                  label: t('session.sheets.browser', 'Browser'),
                  icon: Globe,
                  closeBeforePress: true,
                  onPress: () => {
                    if (browserScreencastSupported !== true) {
                      showToast(
                        t(
                          'session.sheets.browserUpdateRequired',
                          'Desktop update required for mobile browser streaming'
                        ),
                        1600
                      )
                      return
                    }
                    setShowCreateBrowserModal(true)
                  }
                },
                ...(onPairedHost
                  ? [
                      {
                        id: 'markdownNote',
                        label: t('session.sheets.markdownNote', 'Markdown Note'),
                        icon: FileText,
                        onPress: () => {
                          setShowCreateTabDrawer(false)
                          void handleCreateMarkdownNote()
                        }
                      }
                    ]
                  : [])
              ])
        ]}
        onClose={() => setShowCreateTabDrawer(false)}
      />
      <ActionSheetModal
        visible={pendingDiffNotesDelivery !== null}
        title={t('session.sheets.sendReviewNotes', 'Send Review Notes')}
        message={t('session.sheets.notesHint', 'Choose an agent session for the current notes.')}
        actions={[
          ...sendDiffNotesAgentActions,
          {
            id: 'copyNotes',
            label: t('session.sheets.copyNotes', 'Copy Notes'),
            icon: Copy,
            onPress: () => {
              const delivery = pendingDiffNotesDelivery
              setPendingDiffNotesDelivery(null)
              if (!delivery) {
                return
              }
              void clipboard
                .writeText(delivery.prompt)
                .then(() => {
                  triggerSuccess()
                  showToast(t('session.sheets.notesCopied', 'Notes copied'))
                })
                .catch(() => {
                  triggerError()
                  showToast(t('session.sheets.copyNotesFailed', "Couldn't copy notes"), 1500)
                })
            }
          }
        ]}
        onClose={() => setPendingDiffNotesDelivery(null)}
      />
      <MobileSessionTabActionSheets controller={controller} />
      <ActionSheetModal
        visible={leaveDrafts != null}
        title={t('session.sheets.unsavedMarkdown', 'Unsaved markdown changes')}
        message={t('session.sheets.draftsHint', 'Copy or discard phone drafts before leaving.')}
        actions={[
          {
            id: 'copyAllAndLeave',
            label: t('session.sheets.copyAllAndLeave', 'Copy All & Leave'),
            icon: FileText,
            onPress: () => {
              const drafts = leaveDrafts ?? []
              const combined = drafts
                .map((draft) => `# ${draft.title}\n\n${draft.content}`)
                .join('\n\n---\n\n')
              void clipboard
                .writeText(combined)
                .then(() => {
                  setLeaveDrafts(null)
                  leaveSessionDroppingDrafts(drafts)
                })
                .catch(() => {
                  triggerError()
                  showToast(t('session.sheets.copyDraftsFailed', "Couldn't copy drafts"), 1500)
                })
            }
          },
          {
            id: 'discardAndLeave',
            label: t('session.sheets.discardAndLeave', 'Discard & Leave'),
            destructive: true,
            onPress: () => {
              setLeaveDrafts(null)
              leaveSessionDroppingDrafts(leaveDrafts ?? [])
            }
          }
        ]}
        onClose={() => setLeaveDrafts(null)}
      />
      <ConfirmModal
        visible={discardMarkdownTarget != null}
        title={t('session.sheets.discardChanges', 'Discard Changes')}
        message={t(
          'session.sheets.discardMessage',
          'Replace the phone draft with the latest desktop file?'
        )}
        confirmLabel={t('session.sheets.discard', 'Discard')}
        destructive
        onConfirm={confirmDiscardMarkdown}
        onCancel={() => setDiscardMarkdownTarget(null)}
      />
      <ConfirmModal {...bulkCloseConfirm} />
      <MobileTerminalRenameModal controller={controller} />
      <TextInputModal
        visible={showCreateBrowserModal}
        title={t('session.sheets.newBrowser', 'New Browser')}
        message={t('session.sheets.urlPrompt', 'Enter a URL, or leave blank for a new tab.')}
        defaultValue=""
        placeholder="https://example.com"
        submitLabel={t('common.open', 'Open')}
        allowEmpty
        selectTextOnFocus
        // The session page reports 'web', where RN Web maps 'url' to the URL keyboard.
        keyboardType={Platform.OS === 'android' ? 'default' : 'url'}
        onSubmit={(value) => {
          void handleCreateBrowser(value).then((created) => {
            if (created) {
              setShowCreateBrowserModal(false)
            }
          })
        }}
        onCancel={() => setShowCreateBrowserModal(false)}
      />
      <CustomKeyModal
        visible={showCustomKeyModal}
        onClose={() => setShowCustomKeyModal(false)}
        onKeysChanged={setCustomKeys}
        onManageShortcuts={handleManageShortcuts}
      />
      <MobileDictationSetupSheet
        visible={showDictationSetup}
        client={client}
        onClose={closeDictationSetup}
        onReady={closeDictationSetup}
      />
      <ActionSheetModal
        visible={deleteKeyTarget != null}
        title={deleteKeyTarget?.label ?? t('session.sheets.shortcut', 'Shortcut')}
        message={t('session.sheets.removeShortcutMessage', 'Remove this custom shortcut?')}
        actions={[
          {
            id: 'remove',
            label: t('common.remove', 'Remove'),
            destructive: true,
            onPress: () => {
              if (deleteKeyTarget) {
                void handleDeleteCustomKey(deleteKeyTarget)
              }
              setDeleteKeyTarget(null)
            }
          }
        ]}
        onClose={() => setDeleteKeyTarget(null)}
      />
    </>
  )
}
