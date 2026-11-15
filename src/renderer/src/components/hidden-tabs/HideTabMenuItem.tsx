import { EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { ContextMenuItem } from '@/components/ui/context-menu'
import { useTranslate } from '@/i18n/use-translate'
import { setTabHiddenAndConfirm, useHiddenTabsCapability } from './hidden-tab-actions'

export function HideTabMenuItem({
  worktreeId,
  unifiedTabId
}: {
  worktreeId: string
  unifiedTabId: string
}) {
  const t = useTranslate()
  const supported = useHiddenTabsCapability(worktreeId)
  const hide = () => {
    const progress = toast.loading(t('tabs.hidden.hiding', 'Hiding tab…'))
    void setTabHiddenAndConfirm(worktreeId, unifiedTabId, true).then(
      () => toast.dismiss(progress),
      (error: unknown) =>
        toast.error(error instanceof Error ? error.message : String(error), {
          id: progress,
          action: { label: t('common.retry', 'Retry'), onClick: hide }
        })
    )
  }
  if (supported !== true) {
    return null
  }
  return (
    <ContextMenuItem onSelect={hide}>
      <EyeOff className="size-3.5" />
      {t('tabs.hidden.hideTab', 'Hide tab')}
    </ContextMenuItem>
  )
}
