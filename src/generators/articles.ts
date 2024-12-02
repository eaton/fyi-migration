import { ArticleSchema } from '@eatonfyi/schema';
import { aql } from 'arangojs';
import { Migrator, MigratorOptions } from '../shared/index.js';

export interface ArticleGeneratorOptions extends MigratorOptions {}

const defaults: ArticleGeneratorOptions = {
  name: 'articles',
  description: 'Reprints of articles published elsewhere',
  input: 'input/articles',
  output: 'src/reprints',
};

export class ArticleGenerator extends Migrator {
  declare options: ArticleGeneratorOptions;

  constructor(options: ArticleGeneratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async finalize() {
    const collection = this.arango.collection('works');
    const q = aql`FOR w in ${collection}
    FILTER w.type == 'Article'
    RETURN UNSET(w, '_id', '_key', '_rev')`;

    const results = await this.arango.query(q).then(cursor => cursor.all());
    const cws = results.map(r => ArticleSchema.parse(r));

    for (const post of cws) {
      const filename = this.makeFilename(post);
      const { text, ...frontmatter } = post;
      try {
        this.output.write(filename, { data: frontmatter, content: text });
        this.log.info(`Wrote ${filename}`);
      } catch (err: unknown) {
        this.log.error(`Error writing ${filename}`, err);
      }
    }
    return;
  }
}
