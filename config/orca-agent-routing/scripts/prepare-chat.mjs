import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { join } from 'node:path'

const args = process.argv.slice(2)
const flags = new Map()
for (let index = 0; index < args.length; index += 1) {
  const key = args[index]
  if (
    !['--profile', '--worktree', '--operation-id', '--review', '--dry-run'].includes(key) ||
    flags.has(key)
  ) {
    throw new Error(`Unknown or repeated option: ${key}`)
  }
  if (key === '--review' || key === '--dry-run') {
    flags.set(key, true)
  } else {
    const value = args[++index]
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${key}`)
    }
    flags.set(key, value)
  }
}
const role = flags.get('--profile')
const worktree = flags.get('--worktree')
if (
  typeof role !== 'string' ||
  typeof worktree !== 'string' ||
  !/^(id|identity|folder|path):.+/.test(worktree)
) {
  throw new Error(
    'Use --profile <role> --worktree <exact Orca workspace selector>; do not pass current/active'
  )
}
const { profiles } = JSON.parse(readFileSync(new URL('../profiles.json', import.meta.url), 'utf8'))
const preset = profiles[role]
if (!preset || !['codex', 'claude', 'grok'].includes(preset.provider)) {
  throw new Error(
    `Profile ${role} has no supported native chat route; inspect support before choosing a fallback`
  )
}
if (
  typeof preset.model !== 'string' ||
  !preset.model ||
  typeof preset.thinkingOptionId !== 'string' ||
  !preset.thinkingOptionId
) {
  throw new Error(`Profile ${role} is missing its saved model or reasoning effort`)
}
if (preset.provider !== 'grok' && !['auto', 'auto-review'].includes(preset.modeId)) {
  throw new Error(`Unsupported saved worker permission mode: ${preset.modeId}`)
}
if (flags.has('--review') && preset.provider !== 'claude') {
  throw new Error('The saved independent-review route requires Claude')
}
const chatOptions = {
  ...(preset.provider === 'grok' ? preset.launchOptions : { permissionMode: 'auto' }),
  model: preset.model,
  effort: preset.thinkingOptionId,
  ...(preset.provider === 'codex' && preset.featureValues?.fast_mode
    ? { serviceTier: 'priority' }
    : {}),
  ...(flags.has('--review') ? { interactionMode: 'plan' } : {})
}
const operationId =
  flags.get('--operation-id') ?? `${Date.now()}-${randomBytes(16).toString('hex')}`
const request = {
  agent: preset.provider,
  operationId,
  target: { kind: 'existing', worktree },
  surface: 'chat',
  presentation: 'background',
  chatOptions
}
if (flags.has('--dry-run')) {
  process.stdout.write(`${JSON.stringify({ method: 'agent.launch', params: request }, null, 2)}\n`)
} else {
  if (process.platform !== 'darwin' && !process.env.ORCA_APP_PATH) {
    throw new Error('This local adapter needs ORCA_APP_PATH pointing to the selected Orca build')
  }
  const app = process.env.ORCA_APP_PATH ?? join(homedir(), 'Applications', 'Orca.app')
  const require = createRequire(import.meta.url)
  const { RuntimeClient } = require(
    join(app, 'Contents/Resources/app.asar.unpacked/out/cli/runtime-client.js')
  )
  const client = new RuntimeClient(
    process.env.ORCA_USER_DATA_PATH ?? join(homedir(), 'Library/Application Support/Orca')
  )
  let launch
  process.stderr.write(`${JSON.stringify({ operationId, stage: 'preparing-native-chat' })}\n`)
  try {
    launch = (await client.call('agent.launch', request)).result
    if (launch.outcome?.kind !== 'structured') {
      throw new Error(`Orca did not create a native chat: ${JSON.stringify(launch)}`)
    }
    const options = (
      await client.call('agentSession.options', { sessionId: launch.outcome.sessionId })
    ).result
    const mismatches = Object.entries(chatOptions).filter(
      ([key, value]) => options.current[key] !== value
    )
    if (mismatches.length) {
      throw new Error(
        `Chat settings were not preserved: ${JSON.stringify({ mismatches, current: options.current })}`
      )
    }
    process.stdout.write(
      `${JSON.stringify({ operationId, launch, options: options.current, readyForDispatch: true }, null, 2)}\n`
    )
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify({ operationId, launch, message: error.message, readyForDispatch: false })}\n`
    )
    process.exitCode = 1
  }
}
