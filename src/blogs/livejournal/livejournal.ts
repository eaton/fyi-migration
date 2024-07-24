import { isAfter, isBefore } from '@eatonfyi/dates';
import { autop, toMarkdown } from '@eatonfyi/html';
import {
  Comment,
  CommentSchema,
} from '../../schemas/schema-org/CreativeWork/comment.js';
import { SocialMediaPosting, SocialMediaPostingSchema } from '../../schemas/schema-org/CreativeWork/social-media-post.js';
import {
  CreativeWorkSchema,
} from '../../schemas/schema-org/creative-work.js';
import { toId } from '../../schemas/mapper.js';
import { sortByParents } from '../../util/parent-sort.js';
import { BlogMigrator, BlogMigratorOptions } from '../blog-migrator.js';
export interface LivejournalMigrateOptions extends BlogMigratorOptions {
  ignoreBefore?: Date;
  ignoreAfter?: Date;
  ignoreComments?: boolean;
}
import {lja, parseCutTag, parseUserTags } from '@eatonfyi/ljarchive';

const defaults: LivejournalMigrateOptions = {
  name: 'lj',
  label: "Predicate's Livejournal",
  description: 'Posts, comments, and images from Livejournal',
  ignoreBefore: new Date('2001-06-01'),
  input: 'input/blogs/livejournal',
  cache: 'cache/blogs/livejournal',
  output: 'src/entries/lj',
  urlsToFix: {
    'http*://www.predicate.(net|org)/users/verb/lj/': 'media://lj/',
    'http*://www.predicate.(net|org)/': 'media://predicatenet/',
  }
};

export class LivejournalMigrator extends BlogMigrator {
  declare options: LivejournalMigrateOptions;
  journal: lja.LjArchiveFile | undefined = undefined;
  entries: SocialMediaPosting[] = [];
  comments: Record<string, Comment[]> = {};

  constructor(options: LivejournalMigrateOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async cacheIsFilled(): Promise<boolean> {
    return this.cache.find({ matching: '*.json', recursive: false }).length > 0;
  }

  override async readCache(): Promise<lja.LjArchiveFile | undefined> {
    if (this.journal === undefined) {
      const buffer = this.input.read('archive.lja', 'buffer');
      if (buffer !== undefined) {
        this.journal = lja.parse(buffer);
      } else {
        this.log.error('Error reading archive');
      }
    }
    return this.journal;
  }

  override async process() {
    const raw = await this.readCache();
    if (raw === undefined) return;

    const moods = Object.fromEntries(raw.moods.map(m => [m.id, m.name]));
    const users = Object.fromEntries(raw.users.map(u => [u.id, u.name]));
    
    const events = raw.events;

    // Construct a blog record for the journal

    for (const event of events) {
      // Ignore anything outside the optional dates, they're backdated duplicates from other sources
      if (this.options.ignoreBefore && isBefore(event.date, this.options.ignoreBefore)) {
        continue;
      }
      if (this.options.ignoreAfter && isAfter(event.date, this.options.ignoreAfter)) {
        continue;
      }

      // Swap in mood
      if (event.moodId) {
        event.mood ??= moods[event.moodId];
      }

      // Process other fields
      const cw = this.prepEntry(event);

      const comments = this.journal?.comments?.filter(c => c.eventId === event.id) ?? [];
      if (comments.length) {
        this.comments ??= {};
        this.comments[cw.id] ??= [];
      }
      for (const comment of comments) {
        if (comment.userId) {
          // Swap in comment author-name
          comment.userName ??= users[comment.userId] ?? users[0];
          this.comments[cw.id].push(
            this.prepComment(comment),
          )
        }
      }

      if (this.comments[cw.id] && this.comments[cw.id].length) {
        cw.commentCount = comments.length;
        sortByParents(this.comments[cw.id]);
      }

      this.entries.push(cw);
    }

    return;
  }

  override async finalize() {
    const lj = CreativeWorkSchema.parse({
      type: 'Blog',
      id: toId('blog', this.name),
      name: this.label,
      url: 'http://predicate.livejournal.com',
      hosting: 'Livejournal',
    });
    await this.saveThing(lj);

    for (const e of this.entries) {
      await this.saveThing(e);

      if (this.comments[e.id] && this.comments[e.id].length) {
        await this.saveThings(this.comments[e.id]);
      }
    }

    await this.copyAssets('media/lj-photos', 'lj');
    await this.copyAssets('media/lj-userpics', 'lj/userpics');
    return Promise.resolve();
  }

  protected prepEntry(entry: lja.LjArchiveEvent) {
    if (entry.security === 'usemask' && entry.audience) {
      entry.security = 'lj-mask/' + entry.audience?.toString();
    } else if (entry.security !== undefined) {
      entry.security = 'private';
    }
    return SocialMediaPostingSchema.parse({
      id: toId('post', `lj${entry.id}`),
      type: 'BlogPosting',
      date: entry.date,
      name: entry.subject,
      text: this.ljMarkupToMarkdown(entry.body),
      isPartOf: toId('blog', this.name),
      privacy: entry.security || undefined,
      avatar: entry.userPicKeyword?.replaceAll(/\W+/g, '-').toLocaleLowerCase(),
      mood: entry.mood,
      music: entry.music,
    });
  }

  protected prepComment(comment: lja.LjArchiveComment): Comment {
    return CommentSchema.parse({
      id: toId('comment', `lj${comment.id}`),
      parent: comment.parentId
        ? toId('comment', `lj${comment.parentId}`)
        : undefined,
      about: comment.eventId ? toId('post', `lj${comment.eventId}`) : undefined,
      commenter: { name: comment.userName },
      isPartOf: toId('blog', this.name),
      date: comment.date,
      text: this.ljMarkupToMarkdown(comment.body),
    });
  }

  // TODO: This is also where we should fix table photo layouts, and probably borked links as well.
  protected ljMarkupToMarkdown(text?: string) {
    let output = text;
    if (output) {
      // Replace `<lj-user name="foo">` with <a href="...">
      const users = parseUserTags(output);
      for (const [a, username] of Object.entries(users) ?? []) {
        output = output?.replaceAll(a, `<a href="https://www.livejournal.com/users/${username}">${username}</a>`);
      }

      const cut = parseCutTag(output, true);
      // We're not even going to attempt to include the cut text for now. Oh well.
      output = [cut.preCut || '', cut.hiddenText || '', cut.postCut || ''].join('\n\n'); 

      output = autop(output);
      output = toMarkdown(output);
      if (this.options.urlsToFix) {
        output = this.fixUrls(output);
      }
    }
    return output;
  }
}
