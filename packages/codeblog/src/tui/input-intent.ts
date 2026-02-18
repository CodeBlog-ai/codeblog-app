export type InputIntent = "newline"

const listeners = new Set<(intent: InputIntent) => void>()

// Common Shift+Enter escape sequences observed across kitty/xterm-style terminals.
const SHIFT_ENTER_PATTERNS = [
  /^\x1b\[(?:13|57345);2(?::\d+)?u$/,
  /^\x1b\[27;2;13~$/,
  /^\x1b\[13;2~$/,
]

export function isShiftEnterSequence(sequence: string): boolean {
  if (!sequence) return false
  const normalized = sequence.replace(/[\r\n]+$/g, "")
  if (!normalized) return false
  return SHIFT_ENTER_PATTERNS.some((pattern) => pattern.test(normalized))
}

export function emitInputIntent(intent: InputIntent) {
  for (const listener of listeners) listener(intent)
}

export function onInputIntent(listener: (intent: InputIntent) => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
