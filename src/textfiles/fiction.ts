import { min } from '@eatonfyi/dates';
import { nanohash } from '@eatonfyi/ids';
import { toCase, toSlug } from '@eatonfyi/text';
import { parse as parsePath } from 'path';
import {
  CreativeWork,
  CreativeWorkSchema,
} from '../schemas/schema-org/creative-work.js';
import { Migrator, MigratorOptions } from '../shared/migrator.js';
import { toId } from '../schemas/mapper.js';

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
        let storyDate =
          this.input.inspect(f, { times: true })?.modifyTime ?? new Date();
        const [, pathDateStr, pathSlug] =
          filePath.name.match(/^(\d{4}-\d{2}-\d{2})?-?([^.]+)/) || [];
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
        this.log.debug(`Skipped ${f}`);
      }
    }
    return;
  }

  override async finalize() {
    await this.saveThings(this.stories);
    return;
  }

  protected prepStory(input: object) {
    const parsed = CreativeWorkSchema.safeParse({
      type: 'ShortStory',
      id: toId('story', nanohash(input)),
      ...input,
    });
    if (parsed.success) {
      return parsed.data;
    } else {
      this.log.debug(input, 'Failed to parse');
      return undefined;
    }
  }
}
