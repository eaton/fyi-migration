import { CommentSchema, getId } from '@eatonfyi/schema';
import is from '@sindresorhus/is';
import { aql } from 'arangojs';
import { Migrator, MigratorOptions } from '../shared/index.js';
import { groupBy } from '../util/group-by.js';

const defaults: MigratorOptions = {
  name: 'comments',
  description: 'Comments on the included posts',
  input: 'input/blogs',
  output: 'src/_data/comments',
};

export class CommentGenerator extends Migrator {
  constructor(options: MigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async finalize() {
    const rawIgnore = this.input.read('ignore.tsv', 'auto') ?? [];
    const ignore: string[] = rawIgnore.map((i: unknown) => {
      if (is.object(i) && 'id' in i && typeof i.id === 'string') {
        return i.id.trim();
      } else {
        return 'error';
      }
    });

    const collection = this.arango.collection('works');
    const q = aql`FOR w in ${collection}
    FILTER w.type == 'Comment'
    FILTER w.about != null
    RETURN UNSET(w, '_id', '_key', '_rev')`;

    const results = await this.arango.query(q).then(cursor => cursor.all());
    const allComments = results.map(r => CommentSchema.parse(r));
    const commentsByPost = groupBy(allComments, c => c.about);

    for (const [post, comments] of Object.entries(commentsByPost)) {
      if (ignore.includes(post)) continue;
      const path = [];
      if (comments[0].date) {
        path.push(comments[0].date.getFullYear().toString());
      }
      path.push(getId(post));
      const filename = path.join('/') + '.ndjson';
      try {
        this.output.write(filename, comments);
        this.log.info(`Wrote ${filename}`);
      } catch (err: unknown) {
        this.log.error(`Error writing ${filename}`, err);
      }
    }
    return;
  }
}
