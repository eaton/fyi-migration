import { z } from 'zod';
import { urlSchema } from '../schemas/fragments/index.js';
import {
  CreativeWork,
  CreativeWorkSchema,
} from '../schemas/schema-org/creative-work.js';
import {
  Episode,
  EpisodeSchema,
} from '../schemas/schema-org/CreativeWork/episode.js';
import { Migrator, MigratorOptions } from '../shared/index.js';
import { fetchGoogleSheet } from '../util/fetch-google-sheet.js';
import { toId } from '../schemas/index.js';

export interface PodcastMigratorOptions extends MigratorOptions {
  documentId?: string;
  sheetName?: string;
}

const defaults: PodcastMigratorOptions = {
  documentId: process.env.GOOGLE_SHEET_WORK,
  sheetName: 'podcasts',
};

export class PodcastMigrator extends Migrator {
  declare options: PodcastMigratorOptions;

  series: CreativeWork[] = [];
  episodes: Episode[] = [];

  constructor(options: PodcastMigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async cacheIsFilled() {
    return this.cache.exists('podcast-episodes.ndjson') === 'file';
  }

  override async fillCache() {
    if (this.options.documentId) {
      const items = await fetchGoogleSheet(
        this.options.documentId,
        this.options.sheetName,
        schema,
      );
      this.cache.write('podcast-episodes.ndjson', items);
    }
    return;
  }

  override async readCache() {
    const data = this.cache.read('podcast-episodes.ndjson', 'auto');
    if (data && Array.isArray(data)) {
      const episodes = data.map(e => schema.parse(e));
      for (const ep of episodes) {
        this.episodes.push(this.prepEpisode(ep));
        if (ep.podcast) {
          const series = this.prepSeries(ep);
          if (series) this.series.push(series);
        }
      }
    }
    return;
  }

  override async finalize() {
    await this.saveThings(this.series);
    await this.saveThings(this.episodes);
    return;
  }

  prepEpisode(item: ImportType) {
    return EpisodeSchema.parse({
      id: toId(
        'episode',
        [item.isPartOf, item.position.toString().padStart(3, '0')].join('-'),
      ),
      type: 'PodcastEpisode',
      isPartOf: toId('podcast', item.isPartOf),
      name: item.name,
      description: item.description,
      url: item.url,
    });
  }

  prepSeries(item: ImportType) {
    if (item.podcast) {
      return CreativeWorkSchema.parse({
        id: toId('podcast', item.isPartOf),
        type: 'PodcastSeries',
        name: item.podcast.name,
        url: item.podcast.url,
      });
    } else {
      return undefined;
    }
  }
}

const schema = z.object({
  id: z.string().optional(),
  isPartOf: z.string(),
  position: z.coerce.number(),
  name: z.string(),
  description: z.string(),
  url: urlSchema.optional(),
  podcast: z
    .object({
      name: z.string(),
      url: urlSchema,
    })
    .optional(),
});

type ImportType = z.infer<typeof schema>;
