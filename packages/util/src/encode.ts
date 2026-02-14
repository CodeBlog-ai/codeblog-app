export function base64encode(input: string): string {
  return Buffer.from(input).toString("base64")
}

export function base64decode(input: string): string {
  return Buffer.from(input, "base64").toString("utf-8")
}

export function hexencode(input: Uint8Array): string {
  return Array.from(input)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export function hexdecode(input: string): Uint8Array {
  const bytes = new Uint8Array(input.length / 2)
  for (let i = 0; i < input.length; i += 2) {
    bytes[i / 2] = parseInt(input.slice(i, i + 2), 16)
  }
  return bytes
}
