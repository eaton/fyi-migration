import { Migrator, MigratorOptions } from "../../util/migrator.js";
import { extract } from '@eatonfyi/html';
import * as schemas from './schema.js';

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
        this.cache.write(`thread-${t.dsqId}.json`, t);
      }
      for (const p of extracted.posts ?? []) {
        this.cache.write(`thread-${p.threadId}/post-${p.dsqid}.json`, p);
      }
    }

    return Promise.resolve();
  }
}
