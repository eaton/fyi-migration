import { toSlug } from '@eatonfyi/text';
import { get } from 'obby';
import { toShortDate } from './to-short-date.js';
import { isDate, isString } from './type-guards.js';

type baseInput = Record<string, unknown>;

/**
 * Given a Thing object, returns a filename in the form of:
 *
 * `yyyy-MM-dd-slug-title-or-id.suffix`
 *
 * If no date is present on the object, it will be omitted from the filename.
 * If no suffix is given, `.md` will be used.
 */
export function toFilename(input: baseInput, suffix = '.md') {
  const parts: string[] = [];
  const date = get(input, 'date dates.*');
  if (isDate(date)) parts.push(toShortDate(date)!);

  const name = get(input, 'slug name id');
  if (isString(name)) parts.push(toSlug(name));

  return parts.join('-') + suffix;
}
