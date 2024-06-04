import { max, min } from '@eatonfyi/dates';
import { nanohash } from '@eatonfyi/ids';
import { Frontmatter } from '@eatonfyi/serializers';
import { toSlug } from '@eatonfyi/text';
import { CreativeWork, CreativeWorkSchema } from '../schemas/creative-work.js';
import { Migrator, MigratorOptions } from '../shared/migrator.js';

const defaults: MigratorOptions = {
  name: 'textfiles',
  label: 'Assorted text files',
  input: 'input/blogs/textfiles',
  output: 'src/entries/textfiles',
};

export class TextJournalsMigrator extends Migrator {
  constructor(options: MigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async finalize() {
    const mds = new Frontmatter();
    const files = this.input.find({ matching: '**/*.txt' });
    const textStore = this.data.bucket('txt');
    const textFiles: Record<string, CreativeWork> = {};

    for (const file of files) {
      const txt = mds.parse(this.input.read(file, 'utf8') ?? '');
      const txtId = toSlug(txt.data.textfile);
      textFiles[txtId] ??= this.prepTextFile(txtId, txt.data.textfile);

      const cw = CreativeWorkSchema.parse({
        id: 'txt-' + nanohash(txt.data),
        date: txt.data.date,
        ifPartOf: txtId,
        text: txt.content,
      });

      // This... is exceptionally jank.
      if (cw.date && textFiles[txtId]) {
        if (cw.date !== undefined) {
          const cStart = textFiles[txtId]?.dates?.start ?? cw.date;
          const cEnd = textFiles[txtId]?.dates?.end ?? cw.date;
          textFiles[txtId].dates = {
            start: min([cStart, cw.date]),
            end: max([cEnd, cw.date]),
          };
        }
      }
      this.output.write(file.replace('.txt', '.md'), txt);
    }

    for (const [id, cw] of Object.entries(textFiles)) {
      textStore.set(id, cw);
    }

    return Promise.resolve();
  }

  protected prepTextFile(id: string, name: string) {
    return CreativeWorkSchema.parse({ id, name, software: 'BBEdit' });
  }
}
