import { app } from 'electron'
import { createRequire } from 'node:module'
import { join } from 'node:path'

export const MANUAL_FORK_UPDATE_MESSAGE =
  'This Orca fork uses local builds. Update the fork source, rebuild it, and reinstall Orca to keep your custom features.'

function readManualUpdatePolicy(): boolean {
  if (!app.isPackaged) {
    return false
  }
  const metadata: unknown = createRequire(__filename)(join(app.getAppPath(), 'package.json'))
  if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new Error('Invalid packaged app metadata')
  }
  return 'orcaManualUpdates' in metadata && metadata.orcaManualUpdates === true
}

// Load package metadata at module startup, never on an updater action; failures stay closed.
const manualUpdates = readManualUpdatePolicy()

export function usesManualForkUpdates(): boolean {
  return app.isPackaged && manualUpdates
}
