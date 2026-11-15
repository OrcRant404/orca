/** Strip/navigation projection only; canonical inventories and orders retain hidden tabs. */
export function visibleTabOrder(
  order: readonly string[],
  tabs: readonly { id: string; isHidden?: boolean }[]
): string[] {
  const visible = new Set(tabs.filter((tab) => tab.isHidden !== true).map((tab) => tab.id))
  return order.filter((id) => visible.has(id))
}

/** Keep a view's selection unless it became hidden; preserve order and recency records. */
export function visibleActiveTabId(
  order: readonly string[],
  recent: readonly string[] | undefined,
  active: string | null,
  tabs: readonly { id: string; isHidden?: boolean }[]
): string | null {
  const visible = visibleTabOrder(order, tabs)
  if (active === null || visible.includes(active)) {
    return active
  }
  const previous = recent?.findLast((id) => id !== active && visible.includes(id))
  const index = order.indexOf(active)
  return (
    previous ?? order.slice(index + 1).find((id) => visible.includes(id)) ?? visible.at(-1) ?? null
  )
}
