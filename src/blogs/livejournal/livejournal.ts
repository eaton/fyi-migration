import { isAfter, isBefore } from '@eatonfyi/dates';
import { autop, extract, fromLivejournal, toMarkdown } from '@eatonfyi/html';
import { Comment, CommentSchema } from '../../schemas/comment.js';
import {
  CreativeWork,
  CreativeWorkSchema,
} from '../../schemas/creative-work.js';
import { BlogMigrator, BlogMigratorOptions } from '../blog-migrator.js';
import {
  LivejournalComment,
  xmlSchema,
  xmlTemplate,
  type LivejournalEntry,
} from './schema.js';
import { parseSemagicFile } from './semagic.js';
import { sortByParents } from '../../util/parent-sort.js';

export interface LivejournalMigrateOptions extends BlogMigratorOptions {
  ignoreBefore?: Date;
  ignoreAfter?: Date;
  ignoreComments?: boolean;
}

const defaults: LivejournalMigrateOptions = {
  name: 'lj',
  label: "Predicate's Livejournal",
  description: 'Posts, comments, and images from Livejournal',
  ignoreBefore: new Date('2001-06-01'),
  input: 'input/blogs/livejournal',
  cache: 'cache/blogs/livejournal',
  output: 'src/entries/lj',
};

export class LivejournaMigrator extends BlogMigrator {
  declare options: LivejournalMigrateOptions;
  rawEntries: LivejournalEntry[] = [];
  entries: CreativeWork[] = [];
  comments: Record<string, Comment[]> = {};

  constructor(options: LivejournalMigrateOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async cacheIsFilled(): Promise<boolean> {
    return this.cache.find({ matching: '*.json', recursive: false }).length > 0;
  }

  async fillCache(): Promise<void> {
    const sljFiles = this.input.find({ matching: '*.slj', recursive: false });
    for (const file of sljFiles) {
      this.log.debug(`Parsing ${file}`);
      const raw = this.input.read(file, 'buffer');
      if (raw) {
        try {
          const entry = parseSemagicFile(raw);
          if (entry) {
            this.cache.write(
              this.makeFilename(
                { name: entry.subject ?? entry.id, date: entry.date },
                '.json',
              ),
              entry,
            );
          }
        } catch (err: unknown) {
          this.log.error({ err, file }, 'Error parsing Semagic file');
        }
      }
    }

    const xmlFiles = this.input.find({ matching: '*.xml', recursive: false });
    for (const file of xmlFiles) {
      this.log.debug(`Parsing ${file}`);
      const xml = this.input.read(file);
      if (xml) {
        const extracted = await extract(xml, xmlTemplate, xmlSchema, {
          xml: true,
        });
        for (const entry of extracted) {
          if (
            this.options.ignoreBefore &&
            isBefore(entry.date, this.options.ignoreBefore)
          ) {
            continue;
          }
          if (
            this.options.ignoreAfter &&
            isAfter(entry.date, this.options.ignoreAfter)
          ) {
            continue;
          }

          const filename = this.makeFilename(
            { name: entry.subject ?? entry.id, date: entry.date },
            '.json',
          );
          this.cache.write(filename, entry);
        }
      }
    }

    return Promise.resolve();
  }

  override async readCache(): Promise<LivejournalEntry[]> {
    if (this.rawEntries.length === 0) {
      const files = this.cache.find({ matching: '*.json', recursive: false });
      for (const file of files) {
        this.rawEntries.push(this.cache.read(file, 'auto') as LivejournalEntry);
      }
    }
    return this.rawEntries;
  }

  override async process() {
    const raw = await this.readCache();

    for (const entry of raw) {
      // Ignore anything outside the optional dates, they're backdated duplicates from other sources
      const cw = this.prepEntry(entry);
      this.entries.push(cw);

      if (entry.comments && entry.comments.length) {
        this.comments[cw.id] ??= [];
        for (const comment of entry.comments) {
          this.comments[cw.id].push(this.prepComment({ entry: entry.id, ...comment }));
        }
        if (this.comments[cw.id].length) sortByParents(this.comments[cw.id]);
      }
    }
    return;
  }

  override async finalize() {
    for (const e of this.entries) {
      await this.saveThing(e);
      await this.saveThing(e, 'markdown');

      if (
        this.comments[e.id] &&
        this.comments[e.id].length
      ) {
        await this.saveThings(this.comments[e.id])
      }
    }

    const lj = CreativeWorkSchema.parse({
      type: 'Blog',
      id: this.name,
      name: this.label,
      url: 'http://predicate.livejournal.com',
      hosting: 'Livejournal',
    });
    await this.saveThing(lj);

    await this.copyAssets('media/lj-photos', 'lj');
    return Promise.resolve();
  }

  protected prepEntry(entry: LivejournalEntry) {
    return CreativeWorkSchema.parse({
      id: `lj-${entry.id}`,
      type: 'BlogPosting',
      date: entry.date,
      name: entry.subject,
      text: this.ljMarkupToMarkdown(entry.body),
      isPartOf: this.name,
      avatar: entry.avatar,
      mood: entry.mood,
      music: entry.music,
    });
  }

  protected prepComment(comment: LivejournalComment): Comment {
    return CommentSchema.parse({
      id: `lj-c${comment.id}`,
      parent: comment.parent ? `lj-c${comment.parent}` : undefined,
      about: comment.entry ? `lj-${comment.entry}` : undefined,
      commenter: {
        name: comment.name,
        mail: comment.email,
      },
      isPartOf: this.name,
      date: comment.date,
      text: this.ljMarkupToMarkdown(comment.body),
    });
  }

  // TODO: This is also where we should fix table photo layouts, and probably borked links as well.
  protected ljMarkupToMarkdown(text?: string) {
    if (text) {
      return toMarkdown(
        autop(fromLivejournal(text, { breaks: true, usernames: true })),
      );
    }
    return undefined;
  }
}
