export default function isListUpdated(a: any[], b: any[]): boolean {
  if (a.length !== b.length) {
    return true;
  }
  for (let i = 0, len = a.length; i < len; i++) {
    if (!Object.is(a[i], b[i])) {
      return true;
    }
  }
  return false;
}