import { extract, type ExtractTemplateObject } from '@eatonfyi/html';
import { z } from 'zod';
import { BookSchema } from '../../schemas/book.js';
import { getBestId } from '../normalize-ids.js';


export async function rosenfeldmedia(html: string) {
  const data = await extract(html, template, schema);
  return BookSchema.parse({
    id: getBestId(data.ids),
    ...data // Re-mapping goes here
  });
}

/**
      const isbn = isbnOverride || parsed.data.features?.['Paperback ISBN'];
      if (typeof isbn === 'string') {
        parsed.data.id ??= {};
        if (audit(isbn).validIsbn) {
          parsed.data.id.isbn10 = asIsbn10(isbn);
          parsed.data.id.isbn13 = asIsbn13(isbn);
        }
      }

      parsed.data.pages = parsed.data.features?.Paperback ? Number.parseInt(parsed.data.features?.Paperback?.replace(' pages', '')) : undefined;

      if (parsed.data.features.Published) {
        parsed.data.date = Dates.reformat('1 ' + parsed.data.features.Published, 'dd MMMM yyyy', 'yyyy-MM-dd');
        parsed.data.features.Published = undefined;
      }

      let book = BookSchema.parse({
        _key: parsed.data.id?.isbn10 ?? parsed.data.id?.isbn13,
        id: parsed.data.id,

        title: parsed.data.title,
        subtitle: parsed.data.subtitle,
        date: { published: parsed.data.date },
        creator: parsed.data.bylines,

        pages: parsed.data.pages,
        image: parsed.data.image,
        url: parsed.data.url,

        publisher: 'Rosenfeld Media',
        series: series ? { name: 'Digital Reality Checks' } : undefined,
        imprint: imprint ? 'Two Waves Books' : undefined,
        format: 'Paperback',
        dimensions: { width: 6, height: 9 },

        meta: { owned }
      });
 */

const template: ExtractTemplateObject = {
  $: 'div.u_tpl-single-product',
  title: 'h1[itemprop=name]',
  subtitle: 'h2.book-subtitle',
  description: 'div.content-overview',
  image: 'div.m_book-header div.image-wrapper > a | attr:href',
  bylines: [{
    $: 'p.author a',
    name: '| text',
    url: '| attr:href',
  }],
  features: [{
    $: 'div.book-meta > div',
    key: '| split:\: | shift | trim',
    value: '| split:\: | pop | trim'
  }],
}

const schema = z.object({
  ids: z.record(z.string()).optional(),
  url: z.string().optional(),
  title: z.string().optional(),
  id: z.object({
    isbn10: z.string().optional(),
    isbn13: z.string().optional(),
  }).optional(),
  subtitle: z.string().optional(),
  date: z.string().optional(),
  pages: z.number().optional(),
  image: z.string().optional(),
  bylines: z.array(z.object({
    name: z.string().optional(),
    role: z.string().optional(),
  })).optional(),
  features: z.array(
    z.object({
      key: z.string().optional(),
      value: z.string().optional(),
    })
  )
  .transform(a => a
    .map(entry => [entry.key ?? 'delete', entry.value ?? 'delete'])
    .filter(e => e[0] !== 'delete' && e[1] !== 'delete')
  )
  .transform(a => Object.fromEntries(a))
  .optional(),
  topics: z.array(
    z.object({ value: z.string() })
  )
  .transform(a => a.map(t => t.value))
  .optional()
});