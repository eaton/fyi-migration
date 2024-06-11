import { parse as parseDate } from '@eatonfyi/dates';
import { extract, type ExtractTemplateObject } from '@eatonfyi/html';
import { emptyDeep } from 'empty-deep';
import { z } from 'zod';
import { Book, BookSchema } from '../../schemas/book.js';
import { expandIds, getBestId } from '../normalize-ids.js';

export async function abookapart(html: string) {
  const data = await extract(html, template, schema);

  const ids = emptyDeep(
    expandIds({
      isbn13: data.features.ISBN?.replaceAll('-', ''),
    }),
  ) as Record<string, string>;
  const id = getBestId(ids);

  const book: Partial<Book> = {
    id,
    ids,
    pages: Number.parseInt(data.features.Paperback) ?? undefined,
    name: data.title,
    subtitle: data.subtitle,
    publisher: 'A Book Apart',
    format: 'Paperback',
    dimensions: { width: 5.5, height: 8.5 },
  };

  const authors =  data.bylines?.map(b => b.name ?? b.boldName).filter(i => i !== undefined) ?? [];

  if (authors) {
    book.creator = {
      author: authors,
    };
  }

  if (data.features.Published) {
    book.dates = {
      publish: parseDate(
        data.features.Published.replaceAll(/\s+/g, ' '),
        'MMM d, yyyy',
        Date.now(),
      ),
    };
  }

  const output = BookSchema.safeParse(book);
  if (output.success) return output.data;
  else return undefined;
}

/**
      if (parsed.data.features.Published) {
        let dateString = parsed.data.features.Published.replace('First Ed. ', '');
        dateString = dateString.split(';')[0]?.replace(/\s+/, ' ');
        parsed.data.date = Dates.reformat(dateString, 'MMM d, yyyy', 'yyyy-MM-dd');
      }

      parsed.data.pages = parsed.data.features?.Paperback ? Number.parseInt(parsed.data.features?.Paperback?.replace(' pages', '')) : undefined;

      const book = BookSchema.parse({
        _key: parsed.data.id?.isbn10 ?? parsed.data.id?.isbn13,
        id: parsed.data.id,

        title: parsed.data.title,
        subtitle: parsed.data.subtitle,
        pages: parsed.data.pages,
        date: parsed.data.date ? { published: parsed.data.date } : undefined,
        creator: parsed.data.bylines,

        image: imgPath + imageSlug,
        url: parsed.data.url,

        publisher: 'A Book Apart',
        series: {
          name: 'aba' ? 'A Book Apart' : 'A Book Apart Briefs',
          order: seriesOrder
        },
        format: 'Paperback',
        dimensions: { width: 5.5, height: 8.5 },

        meta: { owned }
      });
 */

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
