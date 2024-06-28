import { parse as parseDate } from '@eatonfyi/dates';
import { extract, type ExtractTemplateObject } from '@eatonfyi/html';
import { emptyDeep } from 'empty-deep';
import { z } from 'zod';
import { BookSchema, PartialBook } from '../../schemas/schema-org/CreativeWork/book.js';
import { expandIds, getBestId } from '../normalize-ids.js';

export async function rosenfeldmedia(html: string) {
  const data = await extract(html, template, schema);

  const ids =
    (emptyDeep(
      expandIds({
        isbn13: data.features['Paperback ISBN']?.replaceAll('-', ''),
      }),
    ) as Record<string, string>) ?? {};
  const id = getBestId(ids);

  const book: PartialBook = {
    id,
    ids,
    pages: Number.parseInt(data.features.Paperback) ?? undefined,
    name: data.title,
    subtitle: data.subtitle,
    publisher: 'Rosenfeld Media',
    format: 'Paperback',
    dimensions: { width: 6, height: 9 },
    image: data.image,
    category: 'Computers & Technology',
  };

  const authors: string[] = [];
  for (const a of data.bylines ?? []) {
    if (a.name !== undefined) authors.push(a.name);
  }

  if (authors) {
    book.creator = {
      author: authors,
    };
  }

  if (data.features.Published) {
    book.dates = {
      publish: parseDate(
        '1 ' + data.features.Published,
        'dd MMMM yyyy',
        Date.now(),
      ),
    };
  }

  const output = BookSchema.optional().safeParse(book);
  if (output.success) return output.data;
  return undefined;
}

const template: ExtractTemplateObject = {
  $: 'div.u_tpl-single-product',
  title: 'h1[itemprop=name]',
  subtitle: 'h2.book-subtitle',
  description: 'div.content-overview',
  image: 'div.m_book-header div.image-wrapper > a | attr:href',
  bylines: [
    {
      $: 'p.author a',
      name: '| text',
      url: '| attr:href',
    },
  ],
  features: [
    {
      $: 'div.book-meta > div',
      key: '| split:: | first | trim',
      value: '| split:: | last | trim',
    },
  ],
};

const schema = z.object({
  ids: z.record(z.string()).optional(),
  url: z.string().optional(),
  title: z.string().optional(),
  id: z
    .object({
      isbn10: z.string().optional(),
      isbn13: z.string().optional(),
    })
    .optional(),
  subtitle: z.string().optional(),
  date: z.string().optional(),
  pages: z.number().optional(),
  image: z.string().optional(),
  bylines: z
    .array(
      z.object({
        name: z.string().optional(),
        role: z.string().optional(),
      }),
    )
    .optional(),
  features: z
    .array(
      z.object({
        key: z.string().optional(),
        value: z.string().optional(),
      }),
    )
    .transform(a =>
      a
        .map(entry => [entry.key ?? 'delete', entry.value ?? 'delete'])
        .filter(e => e[0] !== 'delete' && e[1] !== 'delete'),
    )
    .transform(a => Object.fromEntries(a))
    .optional(),
  topics: z
    .array(z.object({ value: z.string() }))
    .transform(a => a.map(t => t.value))
    .optional(),
});
