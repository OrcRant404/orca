import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UpdateCheckOptions } from '../../shared/update-status-types'
import { loadUpdaterModule, warmUpdaterModule } from './testing/updater-test-module-loader'
import { updaterMainWindow } from './testing/updater-test-main-window'

const { appMock, autoUpdaterMock, moduleFactories, resetUpdaterMocks } = await vi.hoisted(
  async () => (await import('./testing/updater-test-harness')).createUpdaterMocks()
)
const boundaries = vi.hoisted(() => ({ forbidden: false }))

function refuseUpdaterBoundary(): never {
  throw new Error('forbidden_updater_boundary')
}

vi.mock('electron', () => ({
  ...moduleFactories.electron(),
  net: { fetch: refuseUpdaterBoundary }
}))
vi.mock('./electron-updater-loader', () => ({
  loadElectronAutoUpdater: () => {
    if (boundaries.forbidden) {
      refuseUpdaterBoundary()
    }
    return moduleFactories.electronUpdaterLoader().loadElectronAutoUpdater()
  }
}))
vi.mock('../ipc/pty/kill-all', () => ({ killAllPty: refuseUpdaterBoundary }))
vi.mock('./linux-package/linux-update-package-type', () => moduleFactories.linuxUpdatePackageType())
vi.mock('./updater-lifecycle-diagnostics', () => moduleFactories.updaterLifecycleDiagnostics())
vi.mock('./releases/updater-changelog', () => moduleFactories.updaterChangelog())
vi.mock('./nudges/nudge-campaign', () => ({
  fetchNudge: (...args: unknown[]) => {
    if (boundaries.forbidden) {
      refuseUpdaterBoundary()
    }
    return moduleFactories.updaterNudge().fetchNudge(...args)
  },
  shouldApplyNudge: (...args: unknown[]) => moduleFactories.updaterNudge().shouldApplyNudge(...args)
}))
vi.mock('./releases/updater-prerelease-feed', () => moduleFactories.updaterPrereleaseFeed())
vi.mock('../local-builds/local-build-switch', () => ({ chooseLocalBuild: refuseUpdaterBoundary }))
vi.mock('../local-builds/local-build-feed-server', () => ({
  startLocalBuildFeed: refuseUpdaterBoundary
}))

warmUpdaterModule()

describe('packaged manual-fork updater policy', () => {
  let packageDirectory: string

  beforeEach(() => {
    resetUpdaterMocks()
    boundaries.forbidden = true
    packageDirectory = mkdtempSync(join(tmpdir(), 'orca-updater-package-'))
    writeFileSync(
      join(packageDirectory, 'package.json'),
      '{"name":"orca-local","version":"1.4.255-local.123","orcaManualUpdates":true}'
    )
    appMock.getAppPath.mockReturnValue(packageDirectory)
    appMock.quit.mockImplementation(refuseUpdaterBoundary)
  })

  afterEach(() => {
    rmSync(packageDirectory, { recursive: true, force: true })
  })

  it('keeps startup and background checks idle and refuses remote self-updates', async () => {
    const updater = await loadUpdaterModule()
    updater.checkForUpdates()
    expect(updater.getUpdateStatus()).toEqual({ state: 'idle' })

    updater.setupAutoUpdater(null, { installMode: 'supervised-headless-serve' })
    updater.checkForUpdates()

    expect(updater.getUpdateStatus()).toEqual({ state: 'idle' })
    expect(updater.getRemoteServerUpdateSupport()).toEqual({
      installMode: 'supervised-headless-serve',
      automatic: false,
      reason: 'updater-unavailable'
    })
    expect(() => updater.checkForRemoteServerUpdate('remote-host', { localBuild: true })).toThrow(
      'remote_update_manual_required'
    )
    expect(() => updater.downloadRemoteServerUpdate('remote-host')).toThrow(
      'remote_update_manual_required'
    )
    expect(() => updater.installRemoteServerUpdate('remote-host')).toThrow(
      'remote_update_manual_required'
    )
  })

  it.each<{ name: string; options: UpdateCheckOptions | undefined }>([
    { name: 'default', options: undefined },
    { name: 'local build', options: { localBuild: true } },
    { name: 'pinned release', options: { channel: 'stable', targetTag: 'v1.4.200' } },
    { name: 'pinned dev channel', options: { channel: 'adhoc', targetTag: 'v1.4.200-adhoc.1' } },
    { name: 'prerelease', options: { includePrerelease: true } },
    { name: 'performance prerelease', options: { includePerfPrerelease: true } },
    { name: 'delay bypass', options: { ignoreUpdateDelay: true } }
  ])('refuses $name checks before and after setup', async ({ options }) => {
    const deferred = await loadUpdaterModule()
    deferred.checkForUpdatesFromMenu(options)
    expect(deferred.getUpdateStatus()).toMatchObject({ state: 'error', userInitiated: true })

    vi.resetModules()
    const updater = await loadUpdaterModule()
    let deliveredStatus: unknown
    const window = updaterMainWindow((channel, status) => {
      if (channel === 'updater:status') {
        deliveredStatus = status
      }
    })
    updater.setupAutoUpdater(null, { getMainWindow: () => window })
    updater.checkForUpdatesFromMenu(options)
    expect(updater.getUpdateStatus()).toMatchObject({ state: 'error', userInitiated: true })
    expect(deliveredStatus).toMatchObject({ state: 'error', userInitiated: true })
  })

  it.each(['downloadUpdate', 'quitAndInstall'] as const)(
    'refuses %s without quitting',
    async (action) => {
      const updater = await loadUpdaterModule()
      updater.setupAutoUpdater(null)
      updater[action]()
      expect(updater.getUpdateStatus()).toMatchObject({ state: 'error', userInitiated: true })
      expect(updater.isQuittingForUpdate()).toBe(false)
    }
  )

  it('does not enumerate upstream builds before or after setup', async () => {
    const updater = await loadUpdaterModule()
    expect(await updater.listAvailableReleaseBuilds('stable')).toEqual([])
    updater.setupAutoUpdater(null)
    expect(await updater.listAvailableReleaseBuilds('adhoc', { force: true })).toEqual([])
    expect(updater.getUpdateStatus()).toEqual({ state: 'idle' })
  })

  it.each([
    '{"name":"orca-local","version":"1.4.255-local.123"}',
    '{"orcaManualUpdates":false}',
    '{"orcaManualUpdates":"true"}'
  ])('preserves packaged upstream checks for unmarked metadata %s', async (metadata) => {
    writeFileSync(join(packageDirectory, 'package.json'), metadata)
    boundaries.forbidden = false
    autoUpdaterMock.checkForUpdates.mockImplementation(() => {
      autoUpdaterMock.emit('checking-for-update')
      autoUpdaterMock.emit('update-not-available')
      return Promise.resolve(null)
    })
    const updater = await loadUpdaterModule()
    updater.setupAutoUpdater(null, { getLastUpdateCheckAt: () => Date.now() })
    updater.checkForUpdatesFromMenu()
    await vi.waitFor(() => {
      expect(updater.getUpdateStatus()).toEqual({ state: 'not-available', userInitiated: true })
    })
  })

  it('preserves unpackaged checks even with marked metadata', async () => {
    appMock.isPackaged = false
    const updater = await loadUpdaterModule()
    updater.setupAutoUpdater(null)
    updater.checkForUpdates()
    expect(updater.getUpdateStatus()).toEqual({ state: 'not-available' })
    updater.checkForUpdatesFromMenu({ localBuild: true })
    expect(updater.getUpdateStatus()).toEqual({ state: 'not-available', userInitiated: true })
    expect(updater.getRemoteServerUpdateSupport()).toEqual({
      installMode: 'interactive',
      automatic: false,
      reason: 'unpackaged-build'
    })
  })

  it('fails closed when packaged metadata cannot be read', async () => {
    rmSync(join(packageDirectory, 'package.json'))
    await expect(loadUpdaterModule()).rejects.toMatchObject({ code: 'MODULE_NOT_FOUND' })
  })
})
