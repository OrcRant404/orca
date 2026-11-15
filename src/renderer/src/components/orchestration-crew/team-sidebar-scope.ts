import { useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'
import { useOrchestrationCrew } from '../native-chat/worker-lifetime/use-orchestration-crew'
import type {
  OrchestrationCrewSnapshot,
  OrchestrationCrewRow
} from '../../../../shared/orchestration/orchestration-crew'

export type TeamSidebarScope = {
  target: RuntimeClientTarget
  party: string
  sessionId?: string
  canMention: boolean
  mention: (rows: OrchestrationCrewRow[]) => void
}
let scopes = new Map<string, TeamSidebarScope & { snapshot: OrchestrationCrewSnapshot }>()
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())
export const teamSidebarScopeKey = (tabId: string, paneKey?: string) =>
  paneKey ? `pane:${paneKey}` : `tab:${tabId}`

/** Observe visible panes so Team appears only for panes with a lead/worker chain. */
export function useTeamSidebarScopeRegistration(
  key: string,
  scope: (TeamSidebarScope & { isVisible?: boolean }) | null
): void {
  const mention = useRef(scope?.mention)
  useLayoutEffect(() => {
    mention.current = scope?.mention
  })
  const kind = scope?.target.kind
  const environmentId =
    scope?.target.kind === 'environment' ? scope.target.environmentId : undefined
  const party = scope?.party
  const sessionId = scope?.sessionId
  const canMention = scope?.canMention ?? false
  const visible = scope !== null && scope.isVisible !== false
  const snapshot = useOrchestrationCrew(scope?.target ?? null, visible ? (party ?? null) : null)
  const value = useMemo<(TeamSidebarScope & { snapshot: OrchestrationCrewSnapshot }) | null>(() => {
    const target: RuntimeClientTarget | null =
      kind === 'local'
        ? { kind: 'local' }
        : environmentId
          ? { kind: 'environment', environmentId }
          : null
    return target && party && visible
      ? {
          target,
          party,
          sessionId,
          canMention,
          snapshot,
          mention: (rows) => mention.current?.(rows)
        }
      : null
  }, [kind, environmentId, party, sessionId, canMention, visible, snapshot])
  useEffect(() => {
    if (!value) {
      return
    }
    const registration = { ...value }
    scopes = new Map(scopes).set(key, registration)
    notify()
    return () =>
      queueMicrotask(() => {
        if (scopes.get(key) === registration) {
          scopes = new Map(scopes)
          scopes.delete(key)
          notify()
        }
      })
  }, [key, value])
}
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
export function useTeamSidebarScopes() {
  return useSyncExternalStore(subscribe, () => scopes)
}
export function useTeamSidebarScope(key: string | null) {
  return useTeamSidebarScopes().get(key ?? '')
}
