import { CreativeWorkSchema, getId } from '@eatonfyi/schema';
import { aql } from 'arangojs';
import { Migrator, MigratorOptions } from '../shared/index.js';

const defaults: MigratorOptions = {
  name: 'textfiles',
  description: 'Text files and emails',
  input: 'input/textfiles',
  output: 'src/archive/textfiles',
};

export class TextGenerator extends Migrator {
  constructor(options: MigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async finalize() {
    const collection = this.arango.collection('works');
    const q = aql`FOR w in ${collection}
    FILTER w.type IN ['Message', 'JournalEntry']
    RETURN UNSET(w, '_id', '_key', '_rev')`;

    const results = await this.arango.query(q).then(cursor => cursor.all());
    const cws = results.map(r => CreativeWorkSchema.parse(r));

    for (const post of cws) {
      const path = [];
      if (typeof post.isPartOf === 'string') {
        path.push(getId(post.isPartOf));
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
