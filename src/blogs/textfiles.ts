import { BlogMigrator, BlogMigratorOptions } from "./blog-migrator.js";
import { Frontmatter } from "@eatonfyi/serializers";
import { autop } from "@eatonfyi/html";
import { unset, get } from 'obby';

const defaults: BlogMigratorOptions = {
  name: 'textfiles',
  label: 'Assorted text files',
  input: 'input/blogs/textfiles',
  output: 'src/entries/textfiles',
}

export class TextfilesMigrator extends BlogMigrator {
  constructor(options: BlogMigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async finalize() {
    const mds = new Frontmatter();

    const files = this.input.find({ matching: '**/*.txt' });
    for (const file of files) {
      this.log.debug(`Processing ${file}`);
      const txt = mds.parse(this.input.read(file, 'utf8') ?? '');

      if (get(txt, 'data.extra.cms') === 'textfiles') {
        // Get the name of the text file if it exists in the frontmatter, or retrieve it from the file path
      }

      unset(txt, 'data.title');
      unset(txt, 'data.slug');

      txt.content = autop(txt.content ?? '', true);
      this.output.write(file.replace('.txt', '.md'), txt);
      return Promise.resolve(); 
    }
  }
}