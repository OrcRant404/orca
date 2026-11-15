import { useEffect, useRef, useState } from 'react'
import { EyeOff } from 'lucide-react-native'
import type { ActionSheetAction } from '../../components/ActionSheetModal'
import { useMobileTranslation } from '../../i18n/use-mobile-translation'
import { useMobileSessionHiddenTabs } from '../tabs/use-mobile-session-hidden-tabs'
import { activateMobileSessionTab } from '../tabs/mobile-session-tab-activation'
import type { MobileSessionTab } from '../tabs/mobile-session-tabs'
import type { MobileSessionBulkCloseModel } from '../tabs/use-mobile-session-bulk-close'

export function useMobileHiddenTabController(scope: MobileSessionBulkCloseModel) {
  const t = useMobileTranslation()
  const { hiddenSessionTabs, setSessionTabHidden } = useMobileSessionHiddenTabs(scope)
  const [showHiddenTabs, setShowHiddenTabs] = useState(false)
  const [hiddenTabsPending, setPending] = useState(false)
  const [hiddenTabsError, setError] = useState<string | null>(null)
  const pendingRef = useRef(false)
  const retry = useRef<(() => Promise<void>) | null>(null)
  const mounted = useRef(true)
  const confirmations = useRef(new Set<(error?: Error) => void>())
  useEffect(() => {
    for (const check of confirmations.current) {
      check()
    }
  }, [scope.sessionTabs])
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      for (const check of confirmations.current) {
        check(new Error('Session closed'))
      }
    }
  }, [])
  const write = async (tab: MobileSessionTab, hidden: boolean) => {
    await setSessionTabHidden(tab.id, hidden)
    if (!mounted.current) {
      throw new Error('Session closed')
    }
    await new Promise<void>((resolve, reject) => {
      const finish = (error?: Error) => {
        clearTimeout(timer)
        confirmations.current.delete(check)
        if (error) {
          reject(error)
        } else {
          resolve()
        }
      }
      const check = (error?: Error) => {
        if (error) {
          finish(error)
          return
        }
        const current = scope.sessionTabsRef.current.find((row) => row.id === tab.id)
        if (!current) {
          finish(new Error(t('session.hidden.missing', 'Tab no longer exists')))
        } else if ((current.isHidden === true) === hidden) {
          finish()
        }
      }
      const timer = setTimeout(
        () =>
          finish(
            new Error(
              t('session.hidden.timeout', 'The host has not confirmed the tab change. Try again.')
            )
          ),
        15_000
      )
      confirmations.current.add(check)
      check()
      void scope.fetchSessionTabs().catch(() => {})
    })
  }
  const run = (action: () => Promise<void>) => {
    if (pendingRef.current) {
      return
    }
    pendingRef.current = true
    retry.current = action
    setPending(true)
    setError(null)
    void action()
      .catch((error: unknown) => {
        if (!mounted.current) {
          return
        }
        setError(error instanceof Error ? error.message : String(error))
        setShowHiddenTabs(true)
      })
      .finally(() => {
        pendingRef.current = false
        if (mounted.current) {
          setPending(false)
        }
      })
  }
  const activate = async (tab: MobileSessionTab) => {
    await write(tab, false)
    if (!scope.client) {
      throw new Error(t('session.hidden.disconnected', 'Reconnect to open this tab'))
    }
    const response = await activateMobileSessionTab(scope.client, {
      worktree: `id:${scope.worktreeId}`,
      tabId: tab.id,
      notifyClients: false,
      navigation: 'caller',
      intent: 'user'
    })
    if (!mounted.current) {
      throw new Error('Session closed')
    }
    if (!response.ok) {
      throw new Error(response.error.message)
    }
    await scope.fetchSessionTabs()
    if (!mounted.current) {
      throw new Error('Session closed')
    }
    const current = scope.sessionTabsRef.current.find((row) => row.id === tab.id)
    if (!current || current.isHidden) {
      throw new Error(t('session.hidden.missing', 'Tab no longer exists'))
    }
    scope.switchSessionTab(current, { activate: false })
    setShowHiddenTabs(false)
  }
  const hiddenTabActions = (
    tab: MobileSessionTab | null | undefined,
    dismiss: () => void
  ): ActionSheetAction[] =>
    tab && scope.hiddenTabsSupported === true
      ? [
          {
            id: 'hideTab',
            label: t('session.hidden.hideTab', 'Hide tab'),
            icon: EyeOff,
            disabled: hiddenTabsPending || scope.connState !== 'connected',
            closeBeforePress: true,
            onPress: () => {
              dismiss()
              run(() => write(tab, true))
            }
          }
        ]
      : []
  return {
    hiddenSessionTabs,
    showHiddenTabs,
    setShowHiddenTabs,
    hiddenTabsPending,
    hiddenTabsError,
    hiddenTabActions,
    openHiddenTabs: () => setShowHiddenTabs(true),
    retryHiddenTabAction: () => {
      if (retry.current) {
        run(retry.current)
      }
    },
    unhideSessionTab: (tab: MobileSessionTab) => run(() => write(tab, false)),
    activateHiddenSessionTab: (tab: MobileSessionTab) => run(() => activate(tab)),
    unhideAllSessionTabs: () =>
      run(async () => {
        for (const tab of hiddenSessionTabs) {
          if (scope.sessionTabsRef.current.some((row) => row.id === tab.id && row.isHidden)) {
            await write(tab, false)
          }
        }
      })
  }
}
