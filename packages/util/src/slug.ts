export function slug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

export function truncate(input: string, max: number, suffix = "..."): string {
  if (input.length <= max) return input
  return input.slice(0, max - suffix.length) + suffix
}
