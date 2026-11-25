/**
 * Module-level cache keyed by `(colors, factory)` so every component sharing a stylesheet
 * (e.g. dozens of `Button`, `SectionCard`, `CardListItem`, `OfferGroupCard` instances) reuses
 * a single `StyleSheet.create` result per theme instead of re-creating styles per mount.
 */
const cache = new WeakMap<object, WeakMap<object, unknown>>();

export function getCachedThemedStyles<C extends object, T>(
  colors: C,
  factory: (colors: C) => T,
): T {
  let byFactory = cache.get(colors);
  if (!byFactory) {
    byFactory = new WeakMap<object, unknown>();
    cache.set(colors, byFactory);
  }
  if (byFactory.has(factory)) {
    return byFactory.get(factory) as T;
  }
  const styles = factory(colors);
  byFactory.set(factory, styles);
  return styles;
}
