export type StreamEventType =
  | "run-start"
  | "text-delta"
  | "tool-start"
  | "tool-result"
  | "error"
  | "run-finish"

interface StreamEventBase {
  type: StreamEventType
  runId: string
  seq: number
}

export interface RunStartEvent extends StreamEventBase {
  type: "run-start"
  modelID: string
  messageCount: number
}

export interface TextDeltaEvent extends StreamEventBase {
  type: "text-delta"
  text: string
}

export interface ToolStartEvent extends StreamEventBase {
  type: "tool-start"
  callID: string
  name: string
  args: unknown
}

export interface ToolResultEvent extends StreamEventBase {
  type: "tool-result"
  callID: string
  name: string
  result: unknown
}

export interface ErrorEvent extends StreamEventBase {
  type: "error"
  error: Error
}

export interface RunFinishEvent extends StreamEventBase {
  type: "run-finish"
  text: string
  aborted: boolean
}

export type StreamEvent =
  | RunStartEvent
  | TextDeltaEvent
  | ToolStartEvent
  | ToolResultEvent
  | ErrorEvent
  | RunFinishEvent

export function createRunEventFactory(runId: string = crypto.randomUUID()) {
  let seq = 0
  const next = <T extends StreamEventType, P extends Record<string, unknown>>(type: T, payload: P) =>
    ({ type, runId, seq: ++seq, ...payload }) as unknown as Extract<StreamEvent, { type: T }>
  return { runId, next }
}
