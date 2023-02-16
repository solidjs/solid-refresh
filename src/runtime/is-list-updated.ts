export default function (
  a: Record<string, any> | undefined, 
  b: Record<string, any> | undefined,
): boolean {
  if (a == null && b != null) {
    return true;
  }
  if (a != null && b == null) {
    return true;
  }
  if (a && b) {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    // Check if both objects has the same amount of keys
    if (aKeys.length !== bKeys.length) {
      return true;
    }
    // Merge keys
    const keys = new Set([
      ...aKeys,
      ...bKeys,
    ]);
    // Now check if merged keys has the same amount of keys as the other two
    // for example: { a, b } and { a, c } produces { a, b, c }
    if (keys.size !== aKeys.length) {
      return true;
    }
    // Now compare each items
    for (const key of keys.keys()) {
      if (!Object.is(a[key], b[key])) {
        return true;
      }
    }
  }
  return false;
}
