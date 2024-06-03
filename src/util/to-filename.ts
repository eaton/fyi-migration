import { formatDate } from '@eatonfyi/dates';
import { toSlug } from '@eatonfyi/text';
import { get } from 'obby';
import { Thing } from '../schemas/index.js';
import { isDate, isString } from './type-guards.js';

/**
 * Given a Thing object, returns a filename in the form of:
 *
 * `yyyy-MM-dd-slug-title-or-id.suffix`
 *
 * If no date is present on the object, it will be omitted from the filename.
 * If no suffix is given, `.md` will be used.
 */
export function toFilename(input: Thing, suffix = '.md') {
  const parts: string[] = [];
  const date = get(input, 'date dates.*');
  if (isDate(date)) parts.push(formatDate(date, 'yyyy-MM-dd'));

  const name = get(input, 'slug title id');
  if (isString(name)) parts.push(toSlug(name));

  return parts.join('-') + suffix;
}
