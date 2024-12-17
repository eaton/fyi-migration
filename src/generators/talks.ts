import { TalkSchema } from '@eatonfyi/schema';
import { aql } from 'arangojs';
import { isEmpty } from 'emptier';
import { Migrator, MigratorOptions } from '../shared/index.js';

const defaults: MigratorOptions = {
  name: 'talks',
  description: 'Presentations',
  input: 'input/talks',
  output: 'src/talks',
};

export class TalkGenerator extends Migrator {
  constructor(options: MigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async finalize() {
    const collection = this.arango.collection('things');
    const q = aql`FOR w in ${collection}
    FILTER w.type == 'Presentation'
    FILTER w.name != null
    RETURN UNSET(w, '_id', '_key', '_rev')`;

    const results = await this.arango.query(q).then(cursor => cursor.all());
    const cws = results.map(r => TalkSchema.parse(r));

    for (const talk of cws) {
      if (isEmpty(talk, { all: true })) continue;

      const filename = this.makeFilename(talk);
      const { text, ...frontmatter } = talk;
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
