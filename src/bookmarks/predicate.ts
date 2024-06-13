import { Migrator, MigratorOptions } from "../shared/migrator.js";
import { prepUrlForBookmark } from "../util/clean-link.js";
import { z } from "zod";
import { getMdbInfo, parseMdbTable } from "../helpers/parse-mdb.js";
import { BookmarkSchema } from "../schemas/bookmark.js";

export interface PredicateLinkMigratorOptions extends MigratorOptions {
  fakeStart?: Date;
  fakeEnd?: Date;
}

const defaults: PredicateLinkMigratorOptions = {
  name: 'predicate',
  input: 'input/datasets/access',
  cache: 'cache/bookmarks',
  fakeStart: new Date('2000-09-13'),
  fakeEnd: new Date('2000-10-20'),
}

export class PredicateLinkMigrator extends Migrator {
  declare options: PredicateLinkMigratorOptions;
  links: PredicateLink[] = [];

  constructor(options: PredicateLinkMigratorOptions = {}) {
    super({...defaults, ...options});
  }

  override async cacheIsFilled() {
    return this.cache.exists('predicate.ndjson') === 'file';
  }

  override async fillCache() {
    if (!this.input.exists('predicate.mdb')) return;
    this.links = parseMdbTable(this.input.path('predicate.mdb'), 'link', schema);
    this.cache.write('predicate.ndjson', this.links);
    return this.links;
  }

  override async readCache() {
    if (this.links.length === 0) {
      const raw = this.cache.read('predicate.ndjson', 'auto') as undefined[] ?? [];
      this.links = raw.map(l => schema.parse(l)); 
    }
    return this.links;
  }
  
  override async finalize() {
    const tempDate = getMdbInfo(this.input.path('predicate.mdb')).dateCreated;
    const linkStore = this.data.bucket('links');

    const cws = this.links.map(l => {
      const link = BookmarkSchema.parse({
        ...prepUrlForBookmark(l.url, this.options.name),
        name: l.title,
        date: l.date ?? tempDate,
        isPartOf: this.options.name
      });
      return link;
    });

    for (const cw of cws) {
      linkStore.set(cw);
    }

    this.log.info(`Saved ${cws.length} links.`)
  }
}

const schema = z.object({
  link_id: z.number(),
  title: z.string(),
  url: z.string().url(),
  date: z.number().or(z.coerce.date()).transform(d => typeof d === 'number' ? new Date(d * 1000) : d).optional(),
});

type PredicateLink = z.infer<typeof schema>;
