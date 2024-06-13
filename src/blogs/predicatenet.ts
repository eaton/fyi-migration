import { extract, ExtractTemplateObject } from '@eatonfyi/html';
import { nanohash } from '@eatonfyi/ids';
import { z } from 'zod';
import { CreativeWorkSchema } from '../schemas/creative-work.js';
import { prepUrlForBookmark } from '../util/clean-link.js';
import { BlogMigrator, BlogMigratorOptions } from './blog-migrator.js';
import { BookmarkSchema } from '../schemas/bookmark.js';

const defaults: BlogMigratorOptions = {
  name: 'predicate-net',
  label: 'Predicate.net',
  input: 'input/blogs/predicatenet',
};

export class PredicateNetMigrator extends BlogMigrator {
  constructor(options: BlogMigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  protected async writeLinks() {
    const template: ExtractTemplateObject[] = [
      {
        $: 'link',
        title: '| attr:name',
        url: '| attr:url',
        description: '| attr:description',
      },
    ];

    const schema = z.array(
      z.object({
        title: z.string(),
        url: z.string().url(),
        description: z.string().optional(),
      }),
    );

    const links = await this.input
      .readAsync('links.xml')
      .then(xml => extract(xml ?? '', template, schema, { xml: true }));

    const linkStore = this.data.bucket('links');
    for (const l of links ?? []) {
      const link = BookmarkSchema.parse({
        ...prepUrlForBookmark(l.url, this.name),
        date: '2001-01-01',
        name: l.title,
        description: l.description,
        isPartOf: this.name,
      });
      linkStore.set(nanohash(link.url), link);
    }
  }

  protected async writeQuotes() {
    const template: ExtractTemplateObject[] = [
      { $: 'quote', content: '| attr:content', speaker: '| attr:source' },
    ];
    const schema = z.array(
      z.object({ content: z.string(), speaker: z.string() }),
    );

    const quotes = await this.input
      .readAsync('quotes.xml')
      .then(xml => extract(xml ?? '', template, schema, { xml: true }));

    const quoteStore = this.data.bucket('quotes');
    for (const quote of quotes ?? []) {
      const cw = CreativeWorkSchema.parse({
        id: nanohash(quote.content),
        type: 'Quotation',
        isPartOf: this.name,
        text: quote.content,
        spokenBy: quote.speaker ?? undefined,
      });
      quoteStore.set(cw.id, cw);
    }
  }

  override async finalize() {
    this.data.bucket('things').set(
      'predicate-net',
      CreativeWorkSchema.parse({
        id: 'predicate-net',
        type: 'Blog',
        url: 'http://predicate.net',
        name: 'Predicate.net',
        hosting: 'Site5 (IIS)',
        software: 'BBEdit',
      }),
    );

    await this.writeLinks();
    await this.writeQuotes();

    await this.copyAssets('files', 'predicatenet');
    return Promise.resolve();
  }
}
