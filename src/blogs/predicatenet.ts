import { extract, ExtractTemplateObject } from '@eatonfyi/html';
import { nanohash } from '@eatonfyi/ids';
import { normalize } from '@eatonfyi/urls';
import { z } from 'zod';
import { BlogMigrator, BlogMigratorOptions } from './blog-migrator.js';

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
      const link = {
        url: normalize(l.url),
        date: '2001-01-01',
        title: l.title,
        description: l.description,
        source: 'predicate-net',
      };
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
      quoteStore.set(nanohash(quote.content), {
        ...quote,
        site: 'predicate-net',
      });
    }
  }

  override async finalize() {
    this.data.bucket('sources').set('predicatenet', {
      id: 'predicate-net',
      url: 'https://predicate.net',
      title: 'Predicate.net',
      hosting: 'Site5 (IIS)',
      software: 'BBEdit',
    });

    await this.writeLinks();
    await this.writeQuotes();

    await this.copyAssets('files', 'predicatenet');
    return Promise.resolve();
  }
}
