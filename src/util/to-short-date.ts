/**
 * Given a Date object, or an ISO Date string, return the date in `yyyy-MM-dd` format.
 */
export function toShortDate(input: string | Date | undefined) {
  if (typeof input === 'string') return input.split('T')[0];
  return input?.toISOString()?.split('T')[0];
}
