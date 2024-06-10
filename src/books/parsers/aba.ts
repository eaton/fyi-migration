import { extract, type ExtractTemplateObject } from '@eatonfyi/html';
import { z } from 'zod';
import { BookSchema, Book } from '../../schemas/book.js';
import { expandIds, getBestId } from '../normalize-ids.js';

export async function abookapart(html: string) {
  const data = await extract(html, template, schema);
  
  const ids = expandIds(data.ids);
  const id = getBestId(ids);

  const book: Partial<Book> = {
    id,
    ids,
    title: data.title,
    subtitle: data.subtitle,
    
  };
  return BookSchema.parse(book);
}

/**
      if (parsed.data.features.Published) {
        let dateString = parsed.data.features.Published.replace('First Ed. ', '');
        dateString = dateString.split(';')[0]?.replace(/\s+/, ' ');
        parsed.data.date = Dates.reformat(dateString, 'MMM d, yyyy', 'yyyy-MM-dd');
      }

      for (const byline of parsed.data.bylines ?? []) {
        byline.name ??= byline.boldName;
        byline.boldName = undefined;
        byline.contribution = 'author';
      }

      const isbn = isbnOverride || parsed.data.features?.['ISBN'];
      if (typeof isbn === 'string') {
        parsed.data.id ??= {};
        if (audit(isbn).validIsbn) {
          parsed.data.id.isbn10 = asIsbn10(isbn);
          parsed.data.id.isbn13 = asIsbn13(isbn);
        }
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
  bylines: [{
    $: 'div.product-author__bio',
    name: '> p:nth-child(1) > a:nth-child(1) | text',
    boldName: '> p:nth-child(1) strong:nth-child(1) | text',
    url: '> p:nth-child(1) > a:nth-child(1) | attr:href',
  }],
  features: [{
    $: 'div.product-spec__specs ul li',
    key: '| split:\: | shift | trim',
    value: '| split:\: | pop | trim'
  }],
  topics: [{
    $: 'div.product-topics__text > ul > li',
    value: '| text'
  }]
}

const schema = z.object({
  ids: z.object({
    isbn10: z.string().optional(),
    isbn13: z.string().optional(),
  }).optional(),

  title: z.string().optional(),
  subtitle: z.string().optional(),
  date: z.string().optional(),
  pages: z.number().optional(),

  bylines: z.array(z.object({
    name: z.string().optional(),
    contribution: z.string().optional(),
    boldName: z.string().optional(),
    // url: z.string().optional(),
  })).optional(),

  features: z.array(
    z.object({
      key: z.string().transform(k => k.split('\n')[0]).transform(k => k.replace(':', '')).optional(),
      value: z.string().optional(),
    })
  ).transform(a => a
    .map(entry => [entry.key ?? 'delete', entry.value ?? 'delete'])
    .filter(e => e[0] !== 'delete' && e[1] !== 'delete')
  ).transform(a => Object.fromEntries(a)) .optional(),

  topics: z.array(
    z.object({ value: z.string() })
  ).transform(a => a.map(t => t.value)).optional()
});
