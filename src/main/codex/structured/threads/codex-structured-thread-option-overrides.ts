/** Per-chat settings must be present before Codex opens or forks the thread. */
export function codexThreadOptionOverrides(options: Readonly<Record<string, string>> = {}) {
  const config: Record<string, unknown> = {}
  if (options.effort) {
    config.model_reasoning_effort = options.effort
  }
  if (options.personality) {
    config.personality = options.personality
  }
  return {
    ...(options.model ? { model: options.model } : {}),
    ...(options.serviceTier
      ? { serviceTier: options.serviceTier === 'default' ? null : options.serviceTier }
      : {}),
    ...(Object.keys(config).length ? { config } : {})
  }
}
