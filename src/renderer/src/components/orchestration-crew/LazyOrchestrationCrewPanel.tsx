import { lazy, Suspense, useState, type ComponentProps } from 'react'
import { Button } from '@/components/ui/button'
import { useTranslate } from '@/i18n/use-translate'
import { RecoverableRenderErrorBoundary } from '../error-boundaries/RecoverableRenderErrorBoundary'
import type { OrchestrationCrewPanel as Panel } from './OrchestrationCrewPanel'

// Loaded when Team is selected.
// No background retry or reload: a failed load is dropped, and the next mount tries once more.
function lazyPanel() {
  const component = lazy(() =>
    import('./OrchestrationCrewPanel')
      .then((module) => ({ default: module.OrchestrationCrewPanel }))
      .catch((error: unknown) => {
        // React.lazy keeps a rejection forever; a fresh one lets turning the setting back on load again.
        if (current === component) {
          current = lazyPanel()
        }
        throw error
      })
  )
  return component
}
let current = lazyPanel()

export function LazyOrchestrationCrewPanel(props: ComponentProps<typeof Panel>): React.JSX.Element {
  // Pinned per mount, so a later replacement never remounts a panel that is already showing.
  const t = useTranslate()
  const [LoadedPanel] = useState(() => current)
  // Keep the chat usable if the optional panel cannot load.
  return (
    <RecoverableRenderErrorBoundary
      boundaryId="orchestration-panel"
      surface="overlay"
      fallback={() =>
        props.surface === 'sidebar' ? (
          <p role="status" className="px-3 py-4 text-xs text-muted-foreground">
            {t('components.orchestrationCrew.failedTeam', 'The team panel could not load.')}
          </p>
        ) : props.onClose ? (
          <div
            role="status"
            className="pointer-events-auto absolute right-2.5 top-[calc(var(--orca-pane-title-height)+var(--spacing)*2)] z-[15] rounded-lg border border-border bg-card p-3 text-xs text-card-foreground shadow-sm"
          >
            <p>{t('components.orchestrationCrew.failedTeam', 'The team panel could not load.')}</p>
            <Button variant="ghost" size="xs" onClick={props.onClose}>
              {t('components.orchestrationCrew.closeTeam', 'Close team panel')}
            </Button>
          </div>
        ) : null
      }
    >
      <Suspense fallback={null}>
        <LoadedPanel {...props} />
      </Suspense>
    </RecoverableRenderErrorBoundary>
  )
}
