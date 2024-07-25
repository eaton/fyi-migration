import { Migrator, MigratorOptions } from "../shared/index.js";
import { aql } from "arangojs";
import { getId, CreativeWorkSchema } from "@eatonfyi/schema";
import is from "@sindresorhus/is";

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
    const ignore: string[] = rawIgnore.map((i: unknown) => {
      if ((is.object(i) && 'id' in i && typeof i.id === 'string')) {
        return i.id.trim();
      } else {
        return 'error';
      }
    }); 

    const collection = this.arango.collection('works');
    const q = aql`FOR w in ${collection}
    FILTER w.type == 'BlogPosting'
    RETURN UNSET(w, '_id', '_key', '_rev')`;

    const results = await this.arango.query(q).then(cursor => cursor.all());
    const cws = results.map(r => CreativeWorkSchema.parse(r));

    for (const post of cws) {
      if (ignore.includes(post.id)) {
        this.log.debug(`Skipped ${post.id}: ignore list`);
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