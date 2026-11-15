import { EyeOff } from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
export function HiddenTabIndicator() {
  const t = useTranslate()
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-2xs font-normal text-muted-foreground">
      <EyeOff className="size-3" aria-hidden="true" />
      {t('tabs.hidden.indicator', 'Hidden')}
    </span>
  )
}
