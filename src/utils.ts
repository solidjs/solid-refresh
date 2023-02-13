export function forEach<T>(arr: T[], callback: (value: T, index: number) => (boolean | void)) {
  for (let i = 0, len = arr.length; i < len; i += 1) {
    if (callback(arr[i], i)) {
      break;
    }
  }
}
