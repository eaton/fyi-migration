import { Frontmatter } from "@eatonfyi/serializers";
import { autop } from "@eatonfyi/html";
import { Migrator, MigratorOptions } from "../util/migrator.js";

const defaults: MigratorOptions = {
  name: 'textfiles',
  label: 'Assorted text files',
  input: 'input/blogs/textfiles',
  output: 'src/entries/textfiles',
}

export class JournalMigrator extends Migrator {
  constructor(options: MigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async finalize() {
    const mds = new Frontmatter();
    const files = this.input.find({ matching: '**/*.txt' });
    const texts = new Set<string>();

    for (const file of files) {
      this.log.debug(`Processing ${file}`);
      const txt = mds.parse(this.input.read(file, 'utf8') ?? '');
      texts.add(txt.data?.textfile);
      txt.content = autop(txt.content ?? '', true);
      this.output.write(file.replace('.txt', '.md'), txt);
      return Promise.resolve(); 
    }
  }
}