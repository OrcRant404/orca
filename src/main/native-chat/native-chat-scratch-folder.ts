// Store scratch files beside the host’s chat journal, outside the user’s workspace.

import { createHash } from 'node:crypto'
import { realpath } from 'node:fs/promises'
import { join } from 'node:path'

const NATIVE_CHAT_SCRATCH_DIR_NAME = 'chat-scratch'
const FOLDER_NAME = /^[0-9a-f]{32}$/

export async function nativeChatScratchRootFor(stateDirectory: string): Promise<string> {
  // Profile migrations can leave an alias that agent sandboxes refuse as a writable root.
  try {
    return join(await realpath(stateDirectory), NATIVE_CHAT_SCRATCH_DIR_NAME)
  } catch {
    return join(stateDirectory, NATIVE_CHAT_SCRATCH_DIR_NAME)
  }
}

/** Hash arbitrary session IDs into one safe path segment. */
export function nativeChatScratchFolderName(sessionId: string): string {
  return createHash('sha256').update(sessionId, 'utf8').digest('hex').slice(0, 32)
}

export function isNativeChatScratchFolderName(name: string): boolean {
  return FOLDER_NAME.test(name)
}

/** Session-only identity permits lookup/removal without a workspace record. */
export async function nativeChatScratchFolderFor(
  stateDirectory: string,
  sessionId: string
): Promise<string> {
  return join(
    await nativeChatScratchRootFor(stateDirectory),
    nativeChatScratchFolderName(sessionId)
  )
}
