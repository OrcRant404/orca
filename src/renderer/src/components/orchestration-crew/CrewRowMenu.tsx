import { MoreHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useTranslate } from '@/i18n/use-translate'
import type { OrchestrationCrewRow } from '../../../../shared/orchestration/orchestration-crew'
import { useCrewMenuFocus } from './use-crew-menu-focus'

export function CrewRowMenu({
  row,
  open,
  canMention,
  mention,
  viewMessages,
  openTerminal,
  closeWorker,
  closing
}: {
  row: OrchestrationCrewRow
  open: () => void
  canMention: boolean
  mention: () => void
  viewMessages?: () => void
  openTerminal?: () => void
  closeWorker?: () => void
  closing?: boolean
}) {
  const t = useTranslate()
  const menu = useCrewMenuFocus()
  return (
    <DropdownMenu modal={false} open={menu.open} onOpenChange={menu.onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          ref={menu.triggerRef}
          aria-label={t('components.orchestrationCrew.more', 'More for {{name}}', {
            name: row.label
          })}
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        ref={menu.contentRef}
        align="end"
        onPointerDownOutside={menu.onPointerDownOutside}
        onCloseAutoFocus={menu.onCloseAutoFocus}
      >
        <DropdownMenuItem
          disabled={!canMention || !row.sendAddress}
          // Let Radix dismiss the source before the composer claims focus.
          onSelect={() => queueMicrotask(mention)}
        >
          {t('components.orchestrationCrew.mentionInMessage', 'Mention in message')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={open}>
          {row.openTarget?.kind === 'terminal'
            ? t('components.orchestrationCrew.openOutput', 'View worker output')
            : t('components.orchestrationCrew.openChat', 'Open its chat')}
        </DropdownMenuItem>
        {row.openTarget?.kind === 'terminal' && openTerminal ? (
          <DropdownMenuItem onSelect={openTerminal}>
            {t('components.orchestrationCrew.openTerminal', 'Open terminal')}
          </DropdownMenuItem>
        ) : null}
        {row.dispatchId && viewMessages ? (
          <DropdownMenuItem onSelect={viewMessages}>
            {t('components.orchestrationCrew.viewMessages', 'View worker messages')}
          </DropdownMenuItem>
        ) : null}
        {row.role === 'worker' && row.dispatchId && closeWorker && row.openTarget ? (
          <DropdownMenuItem
            disabled={closing}
            onSelect={() => queueMicrotask(closeWorker)}
            variant="destructive"
          >
            {closing
              ? t('components.orchestrationCrew.stopping', 'Stopping…')
              : t('components.orchestrationCrew.closeWorker', 'Stop and close worker')}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem
          disabled={!row.sendAddress}
          onSelect={() => {
            if (row.sendAddress) {
              void window.api.ui.writeTerminalClipboardText(row.sendAddress).then(() =>
                toast.success(
                  t('components.orchestrationCrew.copiedAddress', "Copied {{name}}'s address", {
                    name: row.label
                  })
                )
              )
            }
          }}
        >
          {t('components.orchestrationCrew.copyAddress', 'Copy address')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
