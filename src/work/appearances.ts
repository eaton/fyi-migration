import { z } from 'zod';
import { urlSchema } from '../schemas/fragments/index.js';
import { CreativeWorkSchema } from '../schemas/schema-org/creative-work.js';
import { Thing } from '../schemas/schema-org/thing.js';
import { getMeta, Migrator, MigratorOptions, toId } from '../shared/index.js';
import { fetchGoogleSheet } from '../util/fetch-google-sheet.js';

export interface AppearanceMigratorOptions extends MigratorOptions {
  documentId?: string;
  sheetName?: string;
}

const defaults: AppearanceMigratorOptions = {
  documentId: process.env.GOOGLE_SHEET_WORK,
  sheetName: 'appearances',
};

export class AppearanceMigrator extends Migrator {
  declare options: AppearanceMigratorOptions;
  things: Thing[] = [];

  constructor(options: AppearanceMigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async cacheIsFilled() {
    return this.cache.exists('appearances.ndjson') === 'file';
  }

  override async fillCache() {
    if (this.options.documentId) {
      const items = await fetchGoogleSheet(
        this.options.documentId,
        this.options.sheetName,
        schema,
        true,
      );
      this.cache.write('appearances.ndjson', items);
    }
    return;
  }

  override async readCache() {
    const data = this.cache.read('appearances.ndjson', 'auto');
    if (data && Array.isArray(data)) {
      const unserialized = data.map(e => schema.parse(e));
      for (const u of unserialized) {
        const venue = this.prepVenue(u);
        const appearance = this.prepAppearance(u);
        if (venue) this.things.push(venue);
        if (appearance) this.things.push(appearance);
      }
    }
    return;
  }

  override async finalize() {
    await this.saveThings(this.things);
    return;
  }

  prepVenue(item: ImportType) {
    if (item.venue?.id && item.venue?.type) {
      return CreativeWorkSchema.parse({
        ...item.venue,
        id: toId(item.venue?.type, item.venue?.id),
      });
    }
  }

  prepAppearance(item: ImportType) {
    const cw = CreativeWorkSchema.parse({
      id: toId(item.type, item.id),
      type: item.type ? getMeta(item.type).name : undefined,
      name: item.name,
      date: item.date,
      description: item.description,
      url: item.url,
      isPartOf: toId(item.venue?.type, item.venue?.id),
    });
    if (item.role) {
      cw.creator = {};
      cw.creator[item.role ?? 'guest'] = 'me';
    }
    return cw;
  }
}

const schema = z.object({
  id: z.string().optional(),
  type: z.string().optional(),
  episodeNumber: z.coerce.number().optional(),
  name: z.string(),
  description: z.string().optional(),
  date: z.coerce.date().optional(),
  url: urlSchema.optional(),
  role: z.string().optional(),
  venue: z
    .object({
      id: z.string().optional(),
      name: z.string().optional(),
      type: z.string().optional(),
      url: urlSchema.optional(),
    })
    .optional(),
});

type ImportType = z.infer<typeof schema>;
