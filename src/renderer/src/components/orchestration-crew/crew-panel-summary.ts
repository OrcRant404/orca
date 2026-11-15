import { formatStateCount } from '@/components/sidebar/workspace-card/activity/worktree-card-agent-summary'
import type { WorktreeStatus } from '@/lib/worktree-status'
import { translate } from '@/i18n/i18n'
import type { Translate } from '@/i18n/use-translate'
import {
  CREW_STATUS_GROUPS,
  crewStatusGroup,
  type CrewRowLook,
  type CrewStatusGroup
} from './CrewAgentIcons'
// One fixed sidebar icon per group, so a group's icon never changes with message order.
export const GROUP_STATUS = {
  needsYou: 'permission',
  working: 'working',
  idle: 'inactive',
  failed: 'failed'
} as const satisfies Record<CrewStatusGroup, WorktreeStatus>

function groupCount(group: CrewStatusGroup, count: number, t: Translate = translate): string {
  // The sidebar's "needs attention" count is singular in every form, so this one is the panel's own.
  return group === 'needsYou'
    ? t('components.orchestrationCrew.needsYou', '{{count}} need you', {
        count,
        defaultValue_one: '{{count}} needs you'
      })
    : formatStateCount(group, count, t)
}

export function crewTabSummary(
  workers: number,
  looks: readonly CrewRowLook[],
  t: Translate = translate
): { groups: { group: CrewStatusGroup; looks: CrewRowLook[] }[]; counts: string } {
  const byGroup = new Map<CrewStatusGroup, CrewRowLook[]>()
  for (const look of looks) {
    const group = crewStatusGroup(look.status)
    const members = byGroup.get(group)
    if (members) {
      members.push(look)
    } else {
      byGroup.set(group, [look])
    }
  }
  const groups = CREW_STATUS_GROUPS.flatMap((group) => {
    const members = byGroup.get(group)
    return members ? [{ group, looks: members }] : []
  })
  const counts = [
    ...(workers > 0
      ? [
          t('components.orchestrationCrew.workers', '{{count}} workers', {
            count: workers,
            defaultValue_one: '{{count}} worker'
          })
        ]
      : []),
    ...groups.map(({ group, looks: members }) => groupCount(group, members.length, t))
  ].join(', ')
  return { groups, counts }
}
