import { ChevronDown } from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
import { useVisibleTeamPanes } from './use-visible-team-panes'
import { useOrchestrationCrew } from '../native-chat/worker-lifetime/use-orchestration-crew'
import { CrewPanelContent } from './OrchestrationCrewPanel'
import type { OrchestrationCrewRow } from '../../../../shared/orchestration/orchestration-crew'

type Pane = ReturnType<typeof useVisibleTeamPanes>[number]
function PaneTeam({ pane }: { pane: Pane }): React.JSX.Element {
  const t = useTranslate()
  const { scope } = pane
  const parent = scope.snapshot.sections.managedBy[0]
  const lead = useOrchestrationCrew(scope.target, parent?.sendAddress ?? null)
  const self: OrchestrationCrewRow = {
    partyKey: scope.party,
    role: 'manager',
    label: pane.label,
    agentKind: pane.agent ?? 'unknown',
    sendAddress: scope.party,
    status: 'unknown'
  }
  const leadRow = parent ? { ...parent, task: undefined } : self
  const snapshot = {
    status: scope.snapshot.status,
    sections: {
      managedBy: [leadRow],
      managing:
        parent && lead.status === 'ok' ? lead.sections.managing : scope.snapshot.sections.managing,
      talkingWith: []
    }
  }
  return (
    <details open className="group/team border-b border-border" data-team-pane={pane.key}>
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-medium [&::-webkit-details-marker]:hidden">
        <ChevronDown className="size-3.5 shrink-0 -rotate-90 group-open/team:rotate-0" />
        <span className="min-w-0 flex-1 truncate">{pane.label}</span>
        <span className="text-2xs text-muted-foreground">
          {parent
            ? t('components.orchestrationCrew.workerRole', 'Worker')
            : t('components.orchestrationCrew.leadRole', 'Lead')}
        </span>
      </summary>
      <CrewPanelContent {...scope} snapshot={snapshot} surface="sidebar" initialOpen />
    </details>
  )
}
export default function TeamSidebarPanel(): React.JSX.Element | null {
  const panes = useVisibleTeamPanes()
  if (panes.length === 0) {
    return null
  }
  return (
    <div className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto">
      {panes.map((pane) => (
        <PaneTeam key={pane.key} pane={pane} />
      ))}
    </div>
  )
}
