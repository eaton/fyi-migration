import { min } from '@eatonfyi/dates';
import { nanohash } from '@eatonfyi/ids';
import { CreativeWork, CreativeWorkSchema } from '../schemas/creative-work.js';
import { Migrator, MigratorOptions } from '../shared/migrator.js';
import { parse as parsePath } from 'path';
import { toFilename } from '../util/to-filename.js';
import { toCase, toSlug } from '@eatonfyi/text';

const defaults: MigratorOptions = {
  name: 'txt-fiction',
  label: 'Fiction left in text files',
  input: 'input/textfiles/fiction',
  output: 'src/txt/fiction',
};

export class TextFictionMigrator extends Migrator {
  stories: CreativeWork[] = [];

  constructor(options: MigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async fillCache() {
    for (const f of this.input.list() ?? []) {
      const filePath = parsePath(f);

      if (filePath.ext.toLocaleLowerCase() === '.txt') {
        let storyDate =  this.input.inspect(f, { times: true })?.modifyTime ?? new Date();
        const [,pathDateStr,pathSlug] = filePath.name.match(/^(\d{4}-\d{2}-\d{2})?-?([^.]+)/) || [];
        if (pathDateStr) {
          const pathDate = new Date(pathDateStr.replace('-', '/'));
          storyDate = min([storyDate, pathDate]);
        }

        const raw = this.input.read(f);
        const story = this.prepStory({
          name: toCase.sentence(pathSlug),
          slug: toSlug(pathSlug),
          date: storyDate,
          textfile: f,
          text: raw,
        });
        if (story) {
          this.stories.push(story);
        }
      } else {
        this.log.debug(`Skipped ${f}`)
      }
    }
  }

  override async finalize() {
    for (const s of this.stories) {
      const { text, ...frontmatter } = s;
      const file = toFilename(frontmatter);
      if (file) {
        this.output.write(file, { content: text, data: frontmatter });
        this.log.debug(`Wrote ${file}`);
      } else {
        this.log.debug(`Couldn't write ${frontmatter}`);
      }
    }
  }

  protected prepStory(input: object) {
    const parsed = CreativeWorkSchema.safeParse({
      type: 'ShortStory',
      id: nanohash(input),
      ...input
    });
    if (parsed.success) {
      return parsed.data;
    } else {
      this.log.debug(input, 'Failed to parse');
      return undefined;
    }
  }
}
