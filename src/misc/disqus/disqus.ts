import { Migrator, MigratorOptions } from "../../util/migrator.js";
import { extract, toMarkdown } from '@eatonfyi/html';
import * as schemas from './schema.js';
import { nanohash } from "@eatonfyi/ids";

export interface DiscusMigratorOptions extends MigratorOptions {
  file?: string | string[];
}

const defaults: DiscusMigratorOptions = {
  input: 'input/datasets',
  cache: 'cache/disqus'
}

export class DisqusMigrator extends Migrator {
  declare options: DiscusMigratorOptions;

  constructor(options: DiscusMigratorOptions = {}) {
    super({ ...defaults, ...options});
  }
  
  override async cacheIsFilled(): Promise<boolean> {
    return Promise.resolve(this.cache.find({ matching: 'thread-*', directories: true }).length > 0);
  }

  override async fillCache(): Promise<unknown> {
    let files: string[] = [];
    if (typeof this.options?.file === 'string') {
      files.push(this.options.file);
    } else if (Array.isArray(this.options?.file)) {
      files.push(...this.options.file);
    } else {
      this.log.debug(`Scanning ${this.input.path()}`);
      files = this.input.find({ matching: 'disqus-*.xml' });
    }

    for (const file of files) {
      this.log.debug(`Parsing ${file}`);
      const extracted = await this.input.readAsync(file)
        .then(xml => 
          extract(xml ?? '', schemas.xmlTemplate, schemas.disqusSchema, { xml: true })
        );
      for (const c of extracted.categories) {
        this.cache.write(`forum-${c.forum}.json`, c);
      }
      for (const t of extracted.threads ?? []) {
        this.cache.write(`thread-${t.dsqId}/thread.json`, t);
      }
      for (const p of extracted.posts ?? []) {
        if (p.isSpam === 'true') continue;
        this.cache.write(`thread-${p.thread}/post-${p.dsqId}.json`, p);
      }
      this.log.debug(`Cached ${extracted.posts?.length ?? 0} comments`);
    }
    return Promise.resolve();
  }

  override async readCache(): Promise<schemas.Thread[]> {
    this.log.debug(`Loading cached Disqus comments`);
    const threads: schemas.Thread[] = [];
    const directories = this.cache.find({ directories: true, files: false });
    for (const d of directories) {
      const thread = this.cache.dir(d).read('thread.json', 'jsonWithDates') as schemas.Thread | undefined;
      const posts = this.cache.dir(d).find({ matching: 'post-*.json' })
        .map(p => this.cache.dir(d).read(p, 'jsonWithDates') as schemas.Post | undefined)
        .filter(p => p !== undefined);

      if (thread && posts.length) {
        thread.posts = posts;
        threads.push(thread);
      }
    }
    return Promise.resolve(threads);
  }

  // We skip a 'process' step here; finalize and process end up being…
  // kinda redundant, and force each migrator to do extra book-keeping
  // to sync everything up.
  override async finalize(): Promise<void> {
    const commentStore = this.data.bucket('comments');
    const threads = await this.readCache();
    for (const t of threads) {
      if (t.posts && t.posts.length) {
        const posts = t.posts?.map(p => ({
          id: `dsq-${p.dsqId}`,
          parent: p.parent ? `dsq-${p.parent}` : undefined,
          name: p.author.name,
          date: p.createdAt,
          body: toMarkdown(p.message),
        }));
        this.log.debug(`Wrote ${posts.length} comments for ${t.link}`);
        commentStore.set(nanohash(t.link), posts);
      }
    }
  }
}
