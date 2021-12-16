export default function isListUpdated(a: any[] | undefined, b: any[] | undefined): boolean {
  if (a == null && b != null) {
    return true;
  }
  if (a != null && b == null) {
    return true;
  }
  if (a && b) {
    if (a.length !== b.length) {
      return true;
    }
    for (let i = 0, len = a.length; i < len; i++) {
      if (!Object.is(a[i], b[i])) {
        return true;
      }
    }
  }
  return false;
}
