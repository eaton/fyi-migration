import { max, min } from '@eatonfyi/dates';
import { nanohash } from '@eatonfyi/ids';
import { Frontmatter } from '@eatonfyi/serializers';
import { toSlug } from '@eatonfyi/text';
import { SocialMediaPostingSchema } from '../schemas/schema-org/CreativeWork/social-media-post.js';
import { CreativeWork } from '../schemas/schema-org/creative-work.js';
import { Migrator, MigratorOptions } from '../shared/migrator.js';
import { parse as parsePath } from 'path';
import { toId } from '../shared/schema-meta.js';

const defaults: MigratorOptions = {
  name: 'txt-journals',
  label: 'Journal files',
  input: 'input/textfiles/journals',
  output: 'src/txt/journals',
};

export class TextJournalsMigrator extends Migrator {
  constructor(options: MigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async finalize() {
    const mds = new Frontmatter();
    const files = this.input.find({ matching: '**/*.txt' });
    const textFiles: Record<string, CreativeWork> = {};

    for (const file of files) {
      const txt = mds.parse(this.input.read(file, 'utf8') ?? '');
      if (txt.data.textfile === undefined) {
        this.log.error(file);
      }

      const noExtension = parsePath(txt.data.textfile).name;
      const txtId = toSlug(noExtension);
      
      textFiles[txtId] ??= this.prepThings({
        id: toId('work', txtId),
        type: 'CreativeWork',
        name: txt.data.textfile,
        software: 'BBEdit',
      })[0];

      const cw = SocialMediaPostingSchema.parse({
        id: toId('journal', nanohash(txt.data)),
        type: 'JournalEntry',
        date: txt.data.date,
        isPartOf: toId('work', txtId),
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
      await this.saveThing(cw);
    }

    await this.saveThings(Object.values(textFiles));
    return;
  }
}
