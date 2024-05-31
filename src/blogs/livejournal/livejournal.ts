import { BlogMigrator, BlogMigratorOptions } from "../blog-migrator.js";
import { extract, fromLivejournal, toMarkdown, autop } from "@eatonfyi/html";
import { isBefore, isAfter } from '@eatonfyi/dates';

import { parseSemagicFile } from "./semagic.js";
import {
  xmlTemplate,
  xmlSchema,
  type LivejournalEntry,
} from './schema.js'
import { MarkdownPost } from "../../schemas/markdown-post.js";

export interface LivejournalMigrateOptions extends BlogMigratorOptions {
  ignoreBefore?: Date,
  ignoreAfter?: Date,
  ignoreComments?: boolean,
}

const defaults: LivejournalMigrateOptions = {
  name: 'lj',
  label: 'Livejournal',
  description: 'Posts, comments, and images from Livejournal',
  ignoreBefore: new Date('2001-06-01'),
  input: 'input/blogs/livejournal',
  cache: 'cache/blogs/livejournal',
  output: 'src/entries/lj',
}

export class LivejournaMigrator extends BlogMigrator<LivejournalEntry> {
  declare options: LivejournalMigrateOptions;

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
            this.cache.write(this.toFilename(entry.date, entry.subject || entry.id.toString(), '.json'), entry);
          }  
        } catch (err: unknown) {
          this.log.error({ err, file }, 'Error parsing Semagic file');
        }
      };
    }

    const xmlFiles = this.input.find({ matching: '*.xml', recursive: false });
    for (const file of xmlFiles) {
      this.log.debug(`Parsing ${file}`);
      const xml = this.input.read(file);
      if (xml) {
        const extracted = await extract(xml, xmlTemplate, xmlSchema, { xml: true });
        for (const entry of extracted) {
          const filename = this.toFilename(entry.date, entry.subject || entry.id.toString(), '.json');
          this.cache.write(filename, entry);
        }  
      };
    }

    return Promise.resolve();
  }

  override async readCache(): Promise<LivejournalEntry[]> {
    const entries: LivejournalEntry[] = [];
    const files = this.cache.find({ matching: '*.json', recursive: false });
    for (const file of files) {
      entries.push(this.cache.read(file, 'jsonWithDates') as LivejournalEntry);
    }
    return Promise.resolve(entries);
  }

  override async process() {
    this.queue = [];
    const data = await this.readCache();

    for (const e of data) {

      // Ignore anything outside the optional dates, they're backdated duplicates from other sources
      if (this.options.ignoreBefore && isBefore(e.date, this.options.ignoreBefore)) continue;
      if (this.options.ignoreAfter && isAfter(e.date, this.options.ignoreAfter)) continue;

      if (!this.options.ignoreComments) {
        for (const comment of e.comments ?? []) {
          comment.entry = e.id;
        }
      }

      const formattedEntry = {
        ...e,
        body: fromLivejournal(e.body ?? '', { breaks: true, usernames: true }),
        teaser: fromLivejournal(e.body ?? '', { breaks: true, usernames: true, teaser: true }),
      }

      this.queue.push(formattedEntry);
    }
    return Promise.resolve();
  }

  override async finalize() {
    for (const e of this.queue) {
      const { file, ...entry } = this.prepMarkdownFile(e);
      if (file) {
        this.log.debug(`Outputting ${file}`);
        this.output.write(file, entry);
      } else {
        this.log.error(e);
      }
    }

    this.data.bucket('sites').set('livejournal', {
      id: 'livejournal',
      url: 'https://predicate.livejournal.com',
      title: 'Livejournal',
      hosting: 'Livejournal',
    });

    await this.copyAssets('media/lj-photos', 'lj');
    return Promise.resolve();
  }

  protected override prepMarkdownFile(input: LivejournalEntry) {
    const md: MarkdownPost = { data: {} };

    md.file = this.toFilename(input.date, input.subject || input.id.toString());

    md.data.title = input.subject;
    md.data.date = input.date;
    md.data.id = `entry/lj-${input.id}`;
    
    md.content = input.body ? toMarkdown(autop(input.body, false)) : '';

    md.data.migration = {
      site: 'livejournal',
      entryId: input.id
    };
    if (input.mood) md.data.migration.mood = input.mood;
    if (input.music) md.data.migration.music = input.music;
    if (input.avatar) md.data.migration.avatar = input.avatar;
      
    if (input.comments?.length) md.data.engagement = { comments: input.comments.length };

    // If there's a table full of photos in the markup, we also want to set the layout
    // to 'photo post' or something like that; that comes later, though.
    // if (hasPhotoTable) md.data.layout = 'photos';

    return md;
  }

  protected processPhotoTable(input: LivejournalEntry) {
    return input;
  }
}