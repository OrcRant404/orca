import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  renameSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { fileURLToPath } from 'node:url'
import { installDefaultOrchestrationInstructions } from './default-orchestration-instructions.mjs'

const app = process.env.ORCA_APP_PATH ?? join(homedir(), 'Applications', 'Orca.app')
const require = createRequire(import.meta.url)
const { RuntimeClient } = require(
  join(app, 'Contents/Resources/app.asar.unpacked/out/cli/runtime-client.js')
)
const profile =
  process.env.ORCA_USER_DATA_PATH ?? join(homedir(), 'Library/Application Support/Orca')
const client = new RuntimeClient(profile)
const skill = readFileSync(
  fileURLToPath(new URL('../../../orca-agent-routing/SKILL.md', import.meta.url)),
  'utf8'
)
const chatLauncher = readFileSync(
  fileURLToPath(new URL('../../../orca-agent-routing/scripts/prepare-chat.mjs', import.meta.url)),
  'utf8'
)
const routingHome = join(homedir(), '.agents/skills/orca-agent-routing')
const aliases = ['.claude/skills', '.grok/skills', '.pi/agent/skills'].map((directory) =>
  join(homedir(), directory, 'orca-agent-routing')
)
const stubPath = join(homedir(), '.agents/skills/orchestration/SKILL.md')
const paseoPath = join(homedir(), '.paseo/config.json')
const paseoConfig = JSON.parse(readFileSync(paseoPath, 'utf8'))
const paseoProfiles = (paseoConfig.daemon ?? paseoConfig).agentProfiles
if (!Array.isArray(paseoProfiles)) {
  throw new Error(`Missing Paseo agentProfiles: ${paseoPath}`)
}
const roles = {
  haiku: 'codex_worker_haiku_55',
  luna: 'agent_profile_muwu9r8e_fwyheqb6hzj',
  sol: 'agent_profile_muwub4mu_amrsj0x08kc',
  terra: 'codex_worker_terra_61',
  claude: 'agent_profile_muwubccp_mb65cg26qmp'
}

function atomicWrite(path, contents) {
  if (existsSync(path) && readFileSync(path, 'utf8') === contents) {
    return
  }
  mkdirSync(dirname(path), { recursive: true })
  const temporary = `${path}.tmp-${process.pid}`
  writeFileSync(temporary, contents, { mode: 0o644 })
  renameSync(temporary, path)
}

async function call(method, params) {
  const receipt = await client.call(method, params)
  if (!receipt.ok) {
    throw new Error(`${method}: ${JSON.stringify(receipt.error)}`)
  }
  return receipt.result
}

function nativeGrokShortcut(commands) {
  const existing = commands.find((entry) => entry.id === 'paseo-profile-grok')
  const native =
    existing?.action === 'agent-prompt' && existing.agent === 'grok'
      ? existing
      : commands.find((entry) => entry.id === 'orca-orchestrator-grok')
  if (native?.agent !== 'grok' || !native.launchOptions?.model || !native.launchOptions?.effort) {
    throw new Error('Missing native Orca Grok model/effort; do not fall back to Pi')
  }
  if (native === existing) {
    return existing
  }
  return {
    id: 'paseo-profile-grok',
    label: existing?.label ?? 'Supplemental Coding — Grok',
    scope: existing?.scope ?? { type: 'global' },
    action: 'agent-prompt',
    agent: 'grok',
    prompt:
      "Use Orca's native Grok agent and existing saved login for supplemental coding, audits, or an additional perspective. Follow the supplied task scope and report findings, changes, and validation. Do not route through Pi or pi-grok-cli. If this chat has a dispatched Task, follow its preamble and report through Orca. If no task is supplied, ask what to work on.",
    launchOptions: { ...native.launchOptions }
  }
}

function savedProfiles(commands) {
  const profiles = Object.fromEntries(
    Object.entries(roles).map(([role, id]) => {
      const saved = paseoProfiles.find((entry) => entry.id === id)
      const shortcut = commands.find((entry) => entry.id === `paseo-profile-${role}`)
      if (!saved || shortcut?.action !== 'terminal-command') {
        throw new Error(`Missing saved profile or terminal shortcut for ${role}`)
      }
      const command = shortcut.command
      const argv = JSON.parse(
        execFileSync(
          'python3',
          ['-c', 'import json, shlex, sys; print(json.dumps(shlex.split(sys.stdin.read())))'],
          { input: command, encoding: 'utf8' }
        )
      )
      const expected = ['--model', saved.model]
      if (saved.provider === 'codex') {
        if (saved.modeId !== 'auto-review') {
          throw new Error(`Unsupported saved Codex mode for ${role}`)
        }
        expected.push(
          '--approve-for-me',
          '-c',
          `model_reasoning_effort="${saved.thinkingOptionId}"`
        )
        if (saved.featureValues?.fast_mode) {
          expected.push('-c', 'service_tier="priority"')
        }
      } else if (saved.provider === 'claude') {
        expected.push('--effort', saved.thinkingOptionId, '--permission-mode', saved.modeId)
      } else {
        throw new Error(`Unsupported saved provider for ${role}: ${saved.provider}`)
      }
      if (basename(argv[0]) !== saved.provider || !isDeepStrictEqual(argv.slice(1), expected)) {
        throw new Error(
          `Orca shortcut and Paseo profile disagree for ${role}; reconcile them before installing`
        )
      }
      return [
        role,
        {
          id: saved.id,
          name: saved.name,
          provider: saved.provider,
          model: saved.model,
          modeId: saved.modeId,
          thinkingOptionId: saved.thinkingOptionId,
          featureValues:
            saved.featureValues?.fast_mode === undefined
              ? undefined
              : { fast_mode: saved.featureValues.fast_mode },
          notes: saved.notes,
          shortcutId: shortcut.id,
          command
        }
      ]
    })
  )
  const grok = nativeGrokShortcut(commands)
  return {
    ...profiles,
    grok: {
      id: 'orca-native-grok',
      name: grok.label,
      provider: 'grok',
      model: grok.launchOptions.model,
      thinkingOptionId: grok.launchOptions.effort,
      shortcutId: grok.id,
      launchOptions: grok.launchOptions,
      notes:
        "Use Orca's native grok agent with its normal launch settings and existing saved login for supplemental coding, requested audits, or an additional perspective. Use the native-chat preparation adapter with --profile grok, then register its structured handle with orchestration worker-start --terminal. Do not use Pi, pi-grok-cli, or grok-cli/grok-build. Stay within assigned ownership; report findings, changes, validation and blockers through Orca."
    }
  }
}

const markerStart = '<!-- orca-agent-routing:start -->'
const markerEnd = '<!-- orca-agent-routing:end -->'
const routingBlock = `${markerStart}
## User's saved worker routing

For research, codebase exploration, implementation, or visual work in an Orca lead chat, including Orca Mobile, read
\`../orca-agent-routing/SKILL.md\` relative to this file and its saved profiles.
Apply those user-authorized specialist/model/settings choices without requiring
a desktop shortcut. They override the generic worker-selection defaults; keep
the version-matched guide for the lifecycle. A worker assignment takes precedence:
stay within it and do not spawn nested workers unless explicitly assigned.
${markerEnd}`
const stubBefore = readFileSync(stubPath, 'utf8')
if (!/^name: orchestration$/m.test(stubBefore) || !/^# Orca Orchestration$/m.test(stubBefore)) {
  throw new Error(`Unrecognized Orca skill stub; leave it unchanged: ${stubPath}`)
}
const stubWithoutRouting = stubBefore.replace(
  new RegExp(`\\n*${markerStart}[\\s\\S]*?${markerEnd}\\n*`, 'g'),
  '\n\n'
)
const stubAfter = stubWithoutRouting.replace(
  '# Orca Orchestration\n',
  `# Orca Orchestration\n\n${routingBlock}\n`
)
if (!stubAfter.includes(markerStart)) {
  throw new Error(`Routing link was not inserted: ${stubPath}`)
}
for (const alias of aliases) {
  const entry = lstatSync(alias, { throwIfNoEntry: false })
  if (
    entry &&
    (!entry.isSymbolicLink() || resolve(dirname(alias), readlinkSync(alias)) !== routingHome)
  ) {
    throw new Error(`Refusing to replace an unrelated skill: ${alias}`)
  }
}

const retiredLeadShortcutIds = [
  'orca-orchestrator-astra',
  'orca-orchestrator-sol',
  'orca-orchestrator-grok'
]
const before = (await call('settings.getTerminalQuickCommands', {})).terminalQuickCommands
const grokShortcut = nativeGrokShortcut(before)
const profiles = savedProfiles(before)
const profileText = `${JSON.stringify({ sources: ['Orca live Quick Commands', paseoPath], profiles }, null, 2)}\n`
const defaultInstructions = installDefaultOrchestrationInstructions({ userHome: homedir() })
atomicWrite(join(routingHome, 'SKILL.md'), skill)
atomicWrite(join(routingHome, 'scripts/prepare-chat.mjs'), chatLauncher)
atomicWrite(join(routingHome, 'profiles.json'), profileText)
atomicWrite(stubPath, stubAfter)
for (const alias of aliases) {
  if (!existsSync(alias)) {
    mkdirSync(dirname(alias), { recursive: true })
    symlinkSync(routingHome, alias, 'dir')
  }
}
if (
  !isDeepStrictEqual(
    before.find(({ id }) => id === grokShortcut.id),
    grokShortcut
  )
) {
  await call('settings.updateTerminalQuickCommands', {
    mutation: { type: 'upsert', command: grokShortcut }
  })
}
for (const id of retiredLeadShortcutIds) {
  if (before.some((command) => command.id === id)) {
    await call('settings.updateTerminalQuickCommands', { mutation: { type: 'delete', id } })
    console.log(`Removed redundant orchestrator shortcut ${id}`)
  }
}
const after = (await call('settings.getTerminalQuickCommands', {})).terminalQuickCommands
for (const id of retiredLeadShortcutIds) {
  if (after.some((command) => command.id === id)) {
    throw new Error(`Retired orchestrator shortcut is still present: ${id}`)
  }
}
if (JSON.stringify(savedProfiles(after)) !== JSON.stringify(profiles)) {
  throw new Error('Worker shortcuts changed during installation')
}
for (const command of before) {
  if (retiredLeadShortcutIds.includes(command.id)) {
    continue
  }
  const expected = command.id === grokShortcut.id ? grokShortcut : command
  if (JSON.stringify(after.find((entry) => entry.id === command.id)) !== JSON.stringify(expected)) {
    throw new Error(`Unintended shortcut change: ${command.id}`)
  }
}
if (
  readFileSync(join(routingHome, 'SKILL.md'), 'utf8') !== skill ||
  readFileSync(join(routingHome, 'scripts/prepare-chat.mjs'), 'utf8') !== chatLauncher ||
  readFileSync(join(routingHome, 'profiles.json'), 'utf8') !== profileText ||
  readFileSync(stubPath, 'utf8') !== stubAfter
) {
  throw new Error('Routing skill did not persist')
}
console.log(
  `Verified default orchestration instructions for ${defaultInstructions.map(({ provider }) => provider).join(', ')}`
)
console.log(
  `Verified ${Object.keys(profiles).length} worker profiles, routing discovery, and unchanged shortcut launch settings`
)
