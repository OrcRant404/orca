import { ipcRenderer } from 'electron'
import type { RuntimeMobileSessionTabMove } from '../../shared/runtime-session-contracts'

type HiddenChange = { worktreeId: string; tabId: string; isHidden: boolean }
type TabMove = { worktreeId: string } & RuntimeMobileSessionTabMove

export type UiSessionTabEventApi = {
  onSetSessionTabHidden?: (callback: (data: HiddenChange) => void) => () => void
  onMoveSessionTab: (callback: (data: TabMove) => void) => () => void
}

export const uiSessionTabEventsApi = {
  onSetSessionTabHidden: (callback: (data: HiddenChange) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: HiddenChange) => callback(data)
    ipcRenderer.on('ui:setSessionTabHidden', listener)
    return () => ipcRenderer.removeListener('ui:setSessionTabHidden', listener)
  },
  onMoveSessionTab: (callback: (data: TabMove) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: TabMove) => callback(data)
    ipcRenderer.on('ui:moveSessionTab', listener)
    return () => ipcRenderer.removeListener('ui:moveSessionTab', listener)
  }
} satisfies UiSessionTabEventApi
