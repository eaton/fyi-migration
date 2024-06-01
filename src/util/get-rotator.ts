/**
 * Given a list of items, returns a function that returns the next item
 * in the list each time it's called. If the `loop` parameter is `true`
 * (the default), the list will cycle when the end is reached; otherwise,
 * all calls will return `undefined` after the list is exhausted.
 *
 * @example
 * ```js
 * const oddEven = getRotator(['row-odd', 'row-even']);
 * for (const row in myHtmlTable) {
 *   row.class = oddEven();
 * }
 * ```
 */
export function getRotator<T>(items: T[], loop = true) {
  const r = () => {
    if (loop && r.index > r.items.length - 1) r.index = 0;
    return r.items[r.index++];
  };
  r.items = items;
  r.index = 0;
  return r;
}
