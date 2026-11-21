import { afterEach, expect, it, vi } from 'vitest'
import { subscribeCrew } from './crew-stream'
import {
  emptyCrew,
  type OrchestrationCrewFrame
} from '../../../../shared/orchestration/orchestration-crew'

afterEach(() => vi.useRealTimers())

it('delivers the latest snapshot after a burst and drops pending delivery on unsubscribe', () => {
  vi.useFakeTimers()
  let snapshot = emptyCrew('unknown')
  let changed = () => {}
  const frames: OrchestrationCrewFrame[] = []
  const stop = subscribeCrew(
    () => snapshot,
    (wake) => {
      changed = wake
      return () => {}
    },
    (frame) => frames.push(frame),
    250
  )
  frames.length = 0
  snapshot = emptyCrew('ok')
  changed()
  snapshot.sections.managing = [
    {
      partyKey: 'worker',
      role: 'worker',
      label: 'Completed review',
      agentKind: 'codex',
      status: 'idle',
      task: { title: 'Review', state: 'completed' }
    }
  ]
  changed()
  vi.advanceTimersByTime(250)
  expect(frames).toEqual([
    { type: 'begin', status: 'ok' },
    {
      type: 'rows',
      section: 'managing',
      rows: [
        {
          partyKey: 'worker',
          role: 'worker',
          label: 'Completed review',
          agentKind: 'codex',
          status: 'idle',
          task: { title: 'Review', state: 'completed' }
        }
      ]
    },
    { type: 'complete' }
  ])
  frames.length = 0
  snapshot = emptyCrew('unknown')
  changed()
  stop()
  vi.runAllTimers()
  expect(frames).toEqual([])
})
