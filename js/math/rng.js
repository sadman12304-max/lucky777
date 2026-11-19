// Крипто-стойкий ГПСЧ. Работает и в браузере, и в Node (globalThis.crypto).

const cryptoObj = globalThis.crypto;

export function randomUint32() {
  if (cryptoObj && cryptoObj.getRandomValues) {
    const a = new Uint32Array(1);
    cryptoObj.getRandomValues(a);
    return a[0];
  }
  return Math.floor(Math.random() * 4294967296);
}

/** Равномерное число [0, 1). */
export function randomFloat() {
  return randomUint32() / 4294967296;
}

/** Равномерное целое [0, n) без смещения. */
export function randomInt(n) {
  if (n <= 0) throw new Error('randomInt: n must be > 0');
  const limit = Math.floor(4294967296 / n) * n;
  let x = randomUint32();
  while (x >= limit) x = randomUint32();
  return x % n;
}

/** Выбор по весам: items = [{weight, ...}] или два массива. */
export function weightedPick(items) {
  let total = 0;
  for (const it of items) total += it.weight;
  let r = randomFloat() * total;
  for (const it of items) {
    r -= it.weight;
    if (r < 0) return it;
  }
  return items[items.length - 1];
}

export function pick(arr) {
  return arr[randomInt(arr.length)];
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
