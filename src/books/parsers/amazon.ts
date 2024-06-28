import { extract } from '@eatonfyi/html';
import { emptyDeep } from 'empty-deep';
import { BookSchema, PartialBook } from '../../schemas/schema-org/CreativeWork/book.js';
import { expandIds, getBestId } from '../normalize-ids.js';
import { schema, template } from './amazon-schema.js';
import { fixAmazonBookData } from './fix-amazon-data.js';

export async function amazon(
  html: string,
  patterns?: Record<string, string[]>,
) {
  let data = await extract(html, template, schema);
  data = fixAmazonBookData(data, patterns);

  const ids = emptyDeep(expandIds(data?.ids)) as Record<string, string>;
  const id = getBestId({ ...ids });

  const book: PartialBook = {
    id,
    ids,
    name: data.title,
    subtitle: data.subtitle,
    edition: data.edition,
    series: data.series,
    publisher: data.publisher,
    imprint: data.imprint,
    format: data.format,
    pages: data.pages,
    creator: data.creator,
    image: data.image,
    dimensions: data.dimensions,
    category: data.category,
  };

  if (data.date) book.dates = { publish: new Date(data.date) };

  const output = BookSchema.safeParse(book);
  if (output.success) return output.data;
  else return undefined;
}
