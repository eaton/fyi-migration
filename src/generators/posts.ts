import { CreativeWorkSchema, getId } from '@eatonfyi/schema';
import is from '@sindresorhus/is';
import { aql } from 'arangojs';
import { Migrator, MigratorOptions } from '../shared/index.js';

const defaults: MigratorOptions = {
  name: 'posts',
  description: 'Blog posts, with a layer of filtering',
  input: 'input/blogs',
  output: 'src/archive',
};

export class PostGenerator extends Migrator {
  constructor(options: MigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async finalize() {
    const rawIgnore = this.input.read('ignore.tsv', 'auto') ?? [];
    const ignore: Record<string, string> = Object.fromEntries(
      rawIgnore
        .map((i: unknown) => {
          if (is.object(i)) {
            return Object.values(i);
          }
        })
        .filter((i: unknown) => i !== undefined),
    );

    const collection = this.arango.collection('things');
    const q = aql`FOR w in ${collection}
    FILTER w.type == 'BlogPosting'
    RETURN UNSET(w, '_id', '_key', '_rev')`;

    const results = await this.arango.query(q).then(cursor => cursor.all());
    const cws = results.map(r => CreativeWorkSchema.parse(r));

    for (const post of cws) {
      if (ignore[post.id] !== undefined) {
        this.log.info(`Skipped ${post.id}: ${ignore[post.id]}`);
        continue;
      }

      const path = [];
      if (typeof post.isPartOf === 'string') {
        path.push(getId(post.isPartOf));
      }
      if (post.date) {
        path.push(post.date.getFullYear().toString());
      }
      path.push(this.makeFilename(post));
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
