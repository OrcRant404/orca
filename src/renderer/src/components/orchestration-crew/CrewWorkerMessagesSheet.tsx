import { useEffect, useEffectEvent, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription
} from '@/components/ui/sheet'
import { useTranslate } from '@/i18n/use-translate'
import type { OrchestrationCrewRow } from '../../../../shared/orchestration/orchestration-crew'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'
import { readCrewWorkerMessages, type CrewWorkerMessages } from './crew-worker-message-read'

export function CrewWorkerMessagesSheet({
  row,
  target,
  open,
  onOpenChange
}: {
  row: OrchestrationCrewRow
  target: RuntimeClientTarget
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslate()
  const [result, setResult] = useState<CrewWorkerMessages | null>(null)
  const [revision, setRevision] = useState(0)
  const host = target.kind === 'local' ? 'local' : target.environmentId
  const dispatch = row.dispatchId
  const loadMessages = useEffectEvent((signal: AbortSignal) =>
    readCrewWorkerMessages(target, row, signal)
  )
  useEffect(() => {
    if (!open || !dispatch) {
      return
    }
    const controller = new AbortController()
    setResult(null)
    void loadMessages(controller.signal).then((value) => {
      if (!controller.signal.aborted) {
        setResult(value)
      }
    })
    return () => controller.abort()
  }, [host, dispatch, open, revision])
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{row.label}</SheetTitle>
          <SheetDescription>
            {row.task?.title ??
              t('components.orchestrationCrew.workerMessages', 'Worker messages and output')}
          </SheetDescription>
        </SheetHeader>
        <div className="scrollbar-sleek min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pb-5">
          {!result ? (
            <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t('components.orchestrationCrew.loadingMessages', 'Loading worker messages…')}
            </p>
          ) : (
            <>
              {result.output !== null ? (
                <section>
                  <h3 className="mb-2 text-xs font-semibold">{result.source}</h3>
                  <pre className="whitespace-pre-wrap break-words font-mono text-xs">
                    {result.output ||
                      t('components.orchestrationCrew.noOutput', 'No output recorded yet.')}
                  </pre>
                </section>
              ) : (
                <p role="status" className="text-xs text-muted-foreground">
                  {t(
                    'components.orchestrationCrew.outputUnavailable',
                    'The full worker output is unavailable. Saved coordination messages are shown below.'
                  )}
                  {result.unavailable ? ` ${result.unavailable}` : ''}
                </p>
              )}
              <section>
                <h3 className="mb-2 text-xs font-semibold">
                  {t('components.orchestrationCrew.coordinationMessages', 'Coordination messages')}
                </h3>
                {result.messages.map((message) => (
                  <article key={message.id} className="mb-3 rounded-lg border border-border p-3">
                    <p className="text-xs font-medium">{message.subject}</p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-xs">{message.body}</p>
                  </article>
                ))}
                {result.messages.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {result.mailError ??
                      t(
                        'components.orchestrationCrew.noMessages',
                        'No coordination messages were saved for this worker.'
                      )}
                  </p>
                ) : null}
              </section>
            </>
          )}
        </div>
        <div className="border-t border-border p-3">
          <Button variant="outline" size="sm" onClick={() => setRevision((value) => value + 1)}>
            {t('components.orchestrationCrew.refreshMessages', 'Refresh output')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
