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

export interface LivejournalMigrateOptions extends BlogMigratorOptions {
  ignoreBefore?: Date;
  ignoreAfter?: Date;
  ignoreComments?: boolean;
}

const defaults: LivejournalMigrateOptions = {
  name: 'lj',
  label: 'Livejournal',
  description: 'Posts, comments, and images from Livejournal',
  ignoreBefore: new Date('2001-06-01'),
  input: 'input/blogs/livejournal',
  cache: 'cache/blogs/livejournal',
  output: 'src/entries/lj',
};

export class LivejournaMigrator extends BlogMigrator {
  declare options: LivejournalMigrateOptions;
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
              this.toFilename(
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
          const filename = this.toFilename(
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
    const entries: LivejournalEntry[] = [];
    const files = this.cache.find({ matching: '*.json', recursive: false });
    for (const file of files) {
      entries.push(this.cache.read(file, 'auto') as LivejournalEntry);
    }
    return Promise.resolve(entries);
  }

  override async process() {
    const data = await this.readCache();

    for (const entry of data) {
      // Ignore anything outside the optional dates, they're backdated duplicates from other sources
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
      this.entries.push(this.prepEntry(entry));

      if (entry.comments && entry.comments.length) {
        this.comments[entry.id] ??= [];
        for (const comment of entry.comments) {
          this.comments[entry.id].push(this.prepComment(comment));
        }
      }
    }
    return { entries: this.entries, comments: this.comments };
  }

  protected prepEntry(entry: LivejournalEntry): CreativeWork {
    return CreativeWorkSchema.parse({
      id: `lj-${entry.id}`,
      date: entry.date,
      name: entry.subject,
      text: this.ljMarkupToMarkdown(entry.body),

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
        email: comment.email
      },
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

  override async finalize() {
    const commentStore = this.data.bucket('comments');

    for (const { text, ...frontmatter } of this.entries) {
      const file = this.toFilename(frontmatter);
      if (file) {
        this.log.debug(`Wrote ${file}`);
        this.output.write(file, { content: text, data: frontmatter });

        // write entry comments
        if (
          this.comments[frontmatter.id] &&
          this.comments[frontmatter.id].length
        ) {
          commentStore.set(frontmatter.id, this.comments[frontmatter.id]);
          this.log.debug(
            `Saved ${this.comments[frontmatter.id].length} comments for ${frontmatter.id}`,
          );
        }
      }

      this.data.bucket('sources').set('livejournal', {
        id: 'livejournal',
        url: 'https://predicate.livejournal.com',
        name: 'Livejournal',
        hosting: 'Livejournal',
      });

      await this.copyAssets('media/lj-photos', 'lj');
      return Promise.resolve();
    }
  }
}
