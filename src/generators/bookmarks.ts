import { aql } from 'arangojs';
import { z } from 'zod';
import { NormalizedUrl } from '@eatonfyi/urls';
import { Migrator, MigratorOptions } from '../shared/index.js';

export interface BookmarkGeneratorOptions extends MigratorOptions {}

const defaults: BookmarkGeneratorOptions = {
  name: 'bookmarks',
  description: 'Generates a pinboard style export of every bookmark ever',
  output: 'src',
};

export class BookmarkGenerator extends Migrator {
  declare options: BookmarkGeneratorOptions;

  constructor(options: BookmarkGeneratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async finalize() {
    const collection = this.arango.collection('things');
    const q = aql`
      FOR t IN ${collection}
      FILTER t.type == 'Bookmark'
      SORT t.date ASC
      RETURN {
        url: t.sharedContent,
        title: t.name == NULL ? '' : t.name,
        note: t.description == NULL ? '' : t.description,
        created: t.date,
        tags: t.keywords == NULL ? [] : t.keywords,
        folder: t.isPartOf == NULL ? '' : t.isPartOf,
      }
    `;

    const results = await this.arango.query(q).then(cursor => cursor.all());
    const urls = z.array(urlSchema).parse(results);

    const urlsToSave = urls
      .filter(u => !u.url.isIp)
      .map(u => {
        const [folder, tag] = u.folder?.split('.') ?? [];
        if (u.url.toString() === u.title) u.title = undefined;
        const output = {
          url: u.url.toString(),
          title: u.title ?? undefined,
          note: u.note ?? undefined,
          tags: u.tags ?? [],
          created: u.created?.toISOString().replace('T', ' ').replace('Z', ''),
          folder,
        };
        if (tag) output.tags.push('import:' + tag);
        return output;
      });
    this.output.write('raindrop.csv', urlsToSave);
    return;
  }
}

const urlSchema = z.object({
  url: z.string().transform(s => new NormalizedUrl(s)),
  folder: z.string().optional(),
  title: z.coerce.string().optional(),
  note: z.coerce.string().optional(),
  created: z.coerce.date().optional(),
  tags: z.array(z.string()).default([]),
})