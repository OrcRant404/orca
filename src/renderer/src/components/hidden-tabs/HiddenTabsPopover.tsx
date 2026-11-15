import { useEffect, useRef, type CSSProperties } from 'react'
import {
  EyeOff,
  FileText,
  Globe,
  Loader2,
  MessageSquare,
  Smartphone,
  SquareTerminal,
  type LucideIcon
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslate } from '@/i18n/use-translate'
import type { Tab } from '../../../../shared/tab-types'

export type HiddenTabRow = { tab: Tab; title: string; detail: string; keywords: string[] }
type Props = {
  rows: HiddenTabRow[]
  open: boolean
  onOpenChange: (open: boolean) => void
  supported: boolean | null
  pending: boolean
  error: string | null
  onRetry: () => void
  onActivate: (row: HiddenTabRow) => void
  onUnhide: (row: HiddenTabRow) => void
  onUnhideAll: () => void
}
const triggerStyle: CSSProperties & { WebkitAppRegion: 'no-drag' } = { WebkitAppRegion: 'no-drag' }
const icons: Partial<Record<Tab['contentType'], LucideIcon>> = {
  terminal: SquareTerminal,
  browser: Globe,
  simulator: Smartphone,
  'agent-session': MessageSquare
}

export function HiddenTabsPopover({
  rows,
  open,
  onOpenChange,
  supported,
  pending,
  error,
  onRetry,
  onActivate,
  onUnhide,
  onUnhideAll
}: Props) {
  const t = useTranslate()
  const activated = useRef(false)
  const search = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (error) {
      activated.current = false
    }
  }, [error])
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <span className="ml-1 my-auto flex shrink-0 text-muted-foreground">
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="relative h-7 w-7"
                style={triggerStyle}
                aria-label={t('tabs.hidden.title', 'Hidden tabs')}
              >
                {pending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <EyeOff className="size-3.5" />
                )}
                {rows.length > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full border border-border bg-secondary px-0.5 text-3xs font-medium text-secondary-foreground"
                  >
                    {rows.length}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {t('tabs.hidden.title', 'Hidden tabs')}
            {rows.length ? ` (${rows.length})` : ''}
          </TooltipContent>
        </Tooltip>
      </span>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-80 max-w-[calc(100vw-1rem)]"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          search.current?.focus()
        }}
        onCloseAutoFocus={(event) => {
          if (activated.current) {
            event.preventDefault()
            activated.current = false
          }
        }}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <span className="text-xs font-medium">{t('tabs.hidden.title', 'Hidden tabs')}</span>
          <Button
            variant="ghost"
            size="sm"
            disabled={pending || supported !== true || !rows.length}
            onClick={onUnhideAll}
          >
            {t('tabs.hidden.unhideAll', 'Unhide all')}
          </Button>
        </div>
        <Command density="menu" aria-label={t('tabs.hidden.title', 'Hidden tabs')}>
          <CommandInput
            ref={search}
            placeholder={t('tabs.hidden.search', 'Search hidden tabs…')}
            readOnly={pending}
          />
          <CommandList aria-busy={pending} className="max-h-72">
            <CommandEmpty>{t('tabs.hidden.empty', 'No hidden tabs')}</CommandEmpty>
            <CommandGroup>
              {rows.map((row) => {
                const Icon = icons[row.tab.contentType] ?? FileText
                return (
                  <CommandItem
                    key={row.tab.id}
                    value={row.tab.id}
                    keywords={[row.title, row.detail, ...row.keywords]}
                    disabled={pending || supported !== true}
                    selection="palette"
                    onSelect={() => {
                      activated.current = true
                      onActivate(row)
                    }}
                  >
                    <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{row.title}</span>
                      <span className="block truncate text-2xs text-muted-foreground">
                        {row.detail}
                      </span>
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending || supported !== true}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.stopPropagation()
                        }
                      }}
                      onClick={(event) => {
                        event.stopPropagation()
                        onUnhide(row)
                        search.current?.focus()
                      }}
                      aria-label={`${t('tabs.hidden.unhide', 'Unhide')} ${row.title}`}
                    >
                      {t('tabs.hidden.unhide', 'Unhide')}
                    </Button>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
        {supported === false && (
          <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
            {t('tabs.hidden.unsupported', 'Update the execution host to manage hidden tabs.')}
          </p>
        )}
        {pending && (
          <p
            role="status"
            className="border-t border-border px-3 py-2 text-xs text-muted-foreground"
          >
            {t('tabs.hidden.waiting', 'Waiting for the host…')}
          </p>
        )}
        {error && (
          <div role="alert" className="border-t border-border px-3 py-2 text-xs">
            <p>{error}</p>
            <Button variant="ghost" size="sm" onClick={onRetry}>
              {t('common.retry', 'Retry')}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
