function isListUpdatedInternal(
  a: Record<string, any>,
  b: Record<string, any>,
): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  // Check if both objects has the same amount of keys
  if (aKeys.length !== bKeys.length) {
    return true;
  }
  // Merge keys
  const keys = new Set([...aKeys, ...bKeys]);
  // Now check if merged keys has the same amount of keys as the other two
  // for example: { a, b } and { a, c } produces { a, b, c }
  if (keys.size !== aKeys.length) {
    return true;
  }
  // Now compare each items
  for (const key of keys) {
    // This covers NaN. No need for Object.is since it's extreme for -0
    if (a[key] !== b[key] || (a[key] !== a[key] && b[key] !== b[key])) {
      return true;
    }
  }
  return false;
}

export default function isListUpdated(
  a: Record<string, any> | undefined,
  b: Record<string, any> | undefined,
): boolean {
  if (a && b) {
    return isListUpdatedInternal(a, b);
  }
  if (a == null && b != null) {
    return true;
  }
  if (a != null && b == null) {
    return true;
  }
  return false;
}
