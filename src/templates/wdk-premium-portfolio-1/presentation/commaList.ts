/** Present a list as a sentence. The stored value stays an array. */
export function commaSeparated(items: readonly string[]): string {
  return items.map((item) => item.trim()).filter(Boolean).join(", ");
}
