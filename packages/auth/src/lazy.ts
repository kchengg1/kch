/**
 * Wrap an object so it is only constructed on first property access.
 * Lets modules be imported at build time without env vars being present.
 */
export function lazy<T extends object>(factory: () => T): T {
  let instance: T | undefined;
  const get = () => (instance ??= factory());
  return new Proxy({} as T, {
    get: (_t, prop) => {
      const value = Reflect.get(get(), prop);
      return typeof value === "function" ? value.bind(get()) : value;
    },
    has: (_t, prop) => Reflect.has(get(), prop),
    ownKeys: () => Reflect.ownKeys(get()),
    getOwnPropertyDescriptor: (_t, prop) => {
      const d = Reflect.getOwnPropertyDescriptor(get(), prop);
      return d ? { ...d, configurable: true } : undefined;
    },
  });
}
