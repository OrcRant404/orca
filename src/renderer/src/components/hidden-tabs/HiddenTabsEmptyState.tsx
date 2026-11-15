import { EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslate } from '@/i18n/use-translate'
import { HiddenTabsButton } from './HiddenTabsButton'
export function HiddenTabsEmptyState({
  worktreeId,
  onCreate,
  allHidden = true
}: {
  worktreeId: string
  onCreate: () => void
  allHidden?: boolean
}) {
  const t = useTranslate()
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
      <EyeOff className="size-5 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        {allHidden
          ? t('tabs.hidden.allHidden', 'All tabs in this group are hidden')
          : t('tabs.hidden.chooseTab', 'Choose a tab to continue')}
      </p>
      <div className="flex items-center gap-2">
        <HiddenTabsButton worktreeId={worktreeId} />
        <Button variant="outline" size="sm" onClick={onCreate}>
          {t('tabs.hidden.newTab', 'New tab')}
        </Button>
      </div>
    </div>
  )
}
