import { nanohash } from '@eatonfyi/ids';
import { toSlug } from '@eatonfyi/text';
import is from '@sindresorhus/is';
import { get } from 'obby';
import { toShortDate } from './to-short-date.js';

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
  const date = get(input, 'date dates.start date.publish dates.*');
  if (is.date(date)) parts.push(toShortDate(date)!);

  const name = get(input, 'slug name id');
  if (is.string(name)) {
    const slug = toSlug(name);
    if (slug.length) parts.push(slug);
  }

  if (parts.length === 0) return nanohash(input) + suffix;
  return parts.join('-') + suffix;
}
