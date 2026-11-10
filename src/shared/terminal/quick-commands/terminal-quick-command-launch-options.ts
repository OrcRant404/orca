import type { z } from 'zod'
import { AgentSessionExecutionOptionsSchema } from '../../agent-session/options/agent-session-execution-options'

export const TerminalQuickCommandLaunchOptionsSchema = AgentSessionExecutionOptionsSchema.pick({
  model: true,
  effort: true,
  serviceTier: true
})
  .extend({ model: AgentSessionExecutionOptionsSchema.shape.model.unwrap().trim().min(1) })
  .strict()

export type TerminalQuickCommandLaunchOptions = z.infer<
  typeof TerminalQuickCommandLaunchOptionsSchema
>
