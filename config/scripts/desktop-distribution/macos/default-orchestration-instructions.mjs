import { lstatSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const START = '<!-- orca-default-orchestration:start -->'
const END = '<!-- orca-default-orchestration:end -->'

const DEFAULT_ROUTING = `${START}
## Default orchestration in Orca

For work requested in an Orca chat, use Orca orchestration automatically, including
ordinary chats and Orca Mobile. Do not wait for /orchestrate, another slash command,
or an Orchestrator shortcut. Keep this chat's selected model and settings.

Apply this only with this chat's own Orca runtime/session/terminal context. If the
context is unclear, check only ORCA_AGENT_SESSION_ID, ORCA_TERMINAL_HANDLE,
ORCA_TERMINAL_ID, ORCA_CLI_COMMAND and ORCA_USER_DATA_PATH. An installed executable
alone is not Orca context. Leave Paseo-led and other non-Orca chats on their own
rules.

An assigned Task/Dispatch or worker brief takes precedence: complete that assignment
and report through Orca. Do not become a lead or create nested workers unless the
assignment explicitly asks for that. Otherwise this ordinary Orca chat is the lead.

Before project lookup, research, implementation or visual work, read
\`~/.agents/skills/orca-agent-routing/SKILL.md\` and its \`profiles.json\` and follow
them. Use the saved Haiku/Luna/Terra/Sol/Claude/Grok roles, native-chat preparation,
naming, lifetime, reuse and cleanup rules without asking the user to invoke a
shortcut. Use the version-matched orchestration guide for supervision and delivery.
Simple answers and trivial administrative actions can be handled directly. A chat
without a supplied task does not start workers or modify files.

Default small guided code edits and narrow tests to Haiku or Luna. Use Terra for
small guided UI/visual fixes. Reserve Sol for complex debugging and substantial
implementation, and Claude for new design or substantial UI/interaction changes.
Implementation work or several touched files alone do not require a larger worker.

Workers are Task only by default: accept their result, preserve the saved
conversation, then release and close them. Keep a worker open only for an immediate
named follow-up in this task or the user's explicit request. Reopen saved workers
when needed; do not keep idle workers open for possible future reuse. Before the
final report, close this task's workers unless the user asked to retain them.

Use only this chat's authenticated identity and existing permissions. If supervised
launch is unavailable, report the gap and continue authorized work directly when
possible; do not borrow another lead's handle or create untracked workers.
${END}`

function instructionsWithDefaultRouting(before, path) {
  const starts = before.split(START).length - 1
  const ends = before.split(END).length - 1
  if (starts === 0 && ends === 0) {
    return `${before}${before ? (before.endsWith('\n') ? '\n' : '\n\n') : ''}${DEFAULT_ROUTING}\n`
  }
  if (starts !== 1 || ends !== 1 || before.indexOf(END) < before.indexOf(START)) {
    throw new Error(`Malformed managed default-routing block; preserved ${path}`)
  }
  return (
    before.slice(0, before.indexOf(START)) +
    DEFAULT_ROUTING +
    before.slice(before.indexOf(END) + END.length)
  )
}

export function installDefaultOrchestrationInstructions({ userHome }) {
  const targets = [
    ['codex', '.codex', 'AGENTS.md'],
    ['claude', '.claude', 'CLAUDE.md'],
    ['grok', '.grok', 'Agents.md']
  ].map(([provider, directory, name]) => {
    const path = join(userHome, directory, name)
    const entry = lstatSync(path, { throwIfNoEntry: false })
    if (entry && !entry.isFile()) {
      throw new Error(`Preserve the managed or non-file instruction path: ${path}`)
    }
    const before = entry ? readFileSync(path, 'utf8') : ''
    return {
      provider,
      path,
      before,
      after: instructionsWithDefaultRouting(before, path),
      mode: entry ? entry.mode & 0o777 : 0o644
    }
  })
  for (const target of targets) {
    if (target.before === target.after) {
      continue
    }
    mkdirSync(dirname(target.path), { recursive: true })
    const temporary = `${target.path}.tmp-${process.pid}`
    writeFileSync(temporary, target.after, { mode: target.mode })
    renameSync(temporary, target.path)
  }
  return targets.map(({ provider, path, before, after }) => ({
    provider,
    path,
    changed: before !== after
  }))
}
