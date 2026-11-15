import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { nativeChatScratchRootFor } from './native-chat-scratch-folder'

it('gives agent sandboxes a real scratch root when the profile is reached through a symlink', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'orca-scratch-profile-')))
  try {
    const profile = join(root, 'profile')
    const alias = join(root, 'legacy-profile')
    mkdirSync(profile)
    symlinkSync(profile, alias, 'junction')
    expect(await nativeChatScratchRootFor(alias)).toBe(join(root, 'profile', 'chat-scratch'))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

it('keeps the requested root when the profile directory does not exist', async () => {
  const root = mkdtempSync(join(tmpdir(), 'orca-scratch-missing-profile-'))
  try {
    expect(await nativeChatScratchRootFor(join(root, 'missing'))).toBe(
      join(root, 'missing', 'chat-scratch')
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
