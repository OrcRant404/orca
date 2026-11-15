export function agentSessionForkTurnItems<T extends { itemId: string }>(
  items: readonly T[],
  nextItemId: string | null,
  member: (item: T) => string | undefined
): T[] {
  let end =
    nextItemId === null ? items.length : items.findIndex((item) => item.itemId === nextItemId)
  if (end < 0) {
    throw new Error('agent_session_fork:missing-boundary')
  }
  const next = items[end]
  if (next) {
    const nextTurn = member(next)
    end = items.findIndex(
      (item) => item === next || (nextTurn !== undefined && member(item) === nextTurn)
    )
  }
  const keptTurns = new Set(items.slice(0, end).flatMap((item) => member(item) ?? []))
  return items.filter((item, index) => index < end || keptTurns.has(member(item) ?? ''))
}
