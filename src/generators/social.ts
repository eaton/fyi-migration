import { getId, SocialMediaPostingSchema } from '@eatonfyi/schema';
import { aql } from 'arangojs';
import { Migrator, MigratorOptions } from '../shared/index.js';

export interface SocialGeneratorOptions extends MigratorOptions {
  threadMinLength?: number;
  singleMinFavorites?: number;
}

const defaults: SocialGeneratorOptions = {
  name: 'social',
  description: 'Popular tweets and long threads',
  output: 'src/social',
  threadMinLength: 5,
  singleMinFavorites: 50,
};

export class SocialGenerator extends Migrator {
  declare options: SocialGeneratorOptions;

  constructor(options: SocialGeneratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async finalize() {
    const collection = this.arango.collection('things');
    const q = aql`FOR w in ${collection}
    FILTER
    ((w.type == 'SocialMediaPosting' && w.favorites >= ${this.options.singleMinFavorites}) ||
    (w.type == 'SocialMediaThread' && LENGTH(w.hasPart) >= ${this.options.threadMinLength} ))
    RETURN UNSET(w, '_id', '_key', '_rev')`;

    const results = await this.arango.query(q).then(cursor => cursor.all());
    const cws = results.map(r => SocialMediaPostingSchema.parse(r));

    for (const post of cws) {
      const path = [];
      if (post.date) {
        path.push(post.date.getFullYear().toString());
      }
      path.push(getId(post) + '.md');
      const { text, ...frontmatter } = post;
      try {
        this.output.write(path.join('/'), { data: frontmatter, content: text });
        this.log.info(`Wrote ${path.join('/')}`);
      } catch (err: unknown) {
        this.log.error(`Error writing ${path.join('/')}`, err);
      }
    }
    return;
  }
}
