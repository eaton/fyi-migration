import { Csv } from '@eatonfyi/serializers';
import is from '@sindresorhus/is';
import { emptyDeep, unflatten } from 'obby';
import wretch from 'wretch';
import QueryStringAddon from 'wretch/addons/queryString';
import { z } from 'zod';

/**
 * Fetches a publicly accessible Google Sheet table as CSV data, optionally parsing each row using a Zod schema for type-safe data validation.
 */
export async function fetchGoogleSheet<T extends z.ZodTypeAny = z.ZodRecord>(
  documentId: string,
  sheet?: string | number,
  schema?: T,
  strict = false,
): Promise<z.infer<T>[]> {
  const target = `https://docs.google.com/spreadsheets/d/${documentId}/gviz/tq`;

  const query: Record<string, string | number> = {};
  query['tqx'] = 'out:csv';
  query['headers'] = 1;

  if (is.number(sheet) || is.numericString(sheet)) {
    query['gid'] = sheet.toString();
  } else if (is.string(sheet)) {
    query['sheet'] = sheet;
  }

  const raw = await wretch(target)
    .addon(QueryStringAddon)
    .query(query)
    .get()
    .text();

  const csv = new Csv().parse(raw);

  const emptied = emptyDeep(csv) as Record<string, unknown>[];
  const unflattened = emptied.map(row => unflatten(row));

  const parsingSchema = schema ?? z.record(z.unknown());
  return unflattened
    .map(row => {
      const parsed = parsingSchema.safeParse(row);
      if (parsed.success) {
        return parsed.data;
      } else {
        if (strict) {
          throw parsed.error;
        } else {
          return undefined;
        }
      }
    })
    .filter(row => row !== undefined);
}
