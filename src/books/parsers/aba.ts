import { parse as parseDate } from '@eatonfyi/dates';
import { extract, type ExtractTemplateObject } from '@eatonfyi/html';
import { emptyDeep } from 'empty-deep';
import { z } from 'zod';
import { BookSchema, PartialBook } from '../../schemas/schema-org/CreativeWork/book.js';
import { expandIds, getBestId } from '../normalize-ids.js';

export async function abookapart(html: string) {
  const data = await extract(html, template, schema);

  const ids =
    (emptyDeep(
      expandIds({
        isbn13: data.features.ISBN?.replaceAll('-', ''),
      }),
    ) as Record<string, string>) ?? {};
  const id = getBestId(ids);

  const book: PartialBook = {
    id,
    ids,
    pages: Number.parseInt(data.features.Paperback) ?? undefined,
    name: data.title,
    subtitle: data.subtitle,
    publisher: 'A Book Apart',
    format: 'Paperback',
    dimensions: { width: 5.5, height: 8.5 },
    category: 'Computers & Technology',
  };

  const authors: string[] = [];
  for (const a of data.bylines ?? []) {
    const name = a.boldName ?? a.name;
    if (name !== undefined) authors.push(name);
  }

  if (authors) {
    book.creator = {
      author: authors,
    };
  }

  if (data.features.Published) {
    const firstEdition = data.features.Published.split('; ')[0];
    const firstEditionDate = firstEdition.split('Ed. ').pop().trim();
    if (typeof firstEditionDate === 'string') {
      book.dates = {
        publish: parseDate(
          firstEditionDate.replaceAll(/\s+/g, ' '),
          'MMM d, yyyy',
          Date.now(),
        ),
      };
    }
  }

  const output = BookSchema.optional().safeParse(book);
  if (output.success) return output.data;
  return undefined;
}

const template: ExtractTemplateObject = {
  title: 'h1.product-header__header span.product-header__title | trim',
  subtitle: 'div.product-header__description > p',
  bylines: [
    {
      $: 'div.product-author__bio',
      name: '> p:nth-child(1) > a:nth-child(1) | text',
      boldName: '> p:nth-child(1) strong:nth-child(1) | text',
      url: '> p:nth-child(1) > a:nth-child(1) | attr:href',
    },
  ],
  features: [
    {
      $: 'div.product-spec__specs ul li',
      key: '| split:: | first | trim',
      value: '| split:: | last | trim',
    },
  ],
  topics: [
    {
      $: 'div.product-topics__text > ul > li',
      value: '| text',
    },
  ],
};

const schema = z.object({
  title: z.string().optional(),
  subtitle: z.string().optional(),

  bylines: z
    .array(
      z.object({
        name: z.string().optional(),
        contribution: z.string().optional(),
        boldName: z.string().optional(),
        // url: z.string().optional(),
      }),
    )
    .optional(),

  features: z
    .array(
      z.object({
        key: z
          .string()
          .transform(k => k.split('\n')[0])
          .transform(k => k.replace(':', ''))
          .optional(),
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
