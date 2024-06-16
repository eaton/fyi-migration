import { toText } from '@eatonfyi/html';
import { parse as parsePath } from 'path';
import {
  ArchiveReadPart,
  PartialTweet,
  TwitterArchive,
} from 'twitter-archive-reader';
import { CreativeWork, CreativeWorkSchema } from '../schemas/creative-work.js';
import { Migrator, MigratorOptions } from '../shared/migrator.js';
import * as prep from './prep.js';
import { Tweet, TweetSchema } from './schema.js';

export interface TwitterMigratorOptions extends MigratorOptions {
  archiveGlob?: string;

  saveUsers?: boolean;
  saveMedia?: boolean;
  saveFavorites?: boolean;
  saveRetweets?: boolean;

  group?:
    | false
    | {
        year?: boolean;
        handle?: boolean;
        kind?: boolean;
      };

  saveSingles?: boolean;
  ignoreSingleReplies?: boolean;
  ignoreThreadMembers?: boolean;
  ignoreBots?: boolean;

  saveThreads?: boolean;
  ignoreReplyThreads?: boolean;
}

const defaults: TwitterMigratorOptions = {
  name: 'twitter',
  description: 'Tweets from multiple accounts',
  input: '/Volumes/archives/Backup/Service Migration Downloads/twitter',
  cache: 'cache/twitter',
  output: 'src/twitter',

  group: {
    kind: true,
    handle: true,
  },

  archiveGlob: 'twitter-*.zip',

  saveUsers: true,
  saveMedia: true,
  saveRetweets: false,
  saveFavorites: false,

  saveSingles: true,
  saveThreads: true,

  ignoreSingleReplies: true,
  ignoreThreadMembers: true,
  ignoreReplyThreads: true,
  ignoreBots: true,
};

export class TwitterMigrator extends Migrator {
  declare options: TwitterMigratorOptions;
  tweets = new Map<string, Tweet>();
  threads = new Map<string, Set<string>>();
  users = new Map<string, CreativeWork>();

  constructor(options: TwitterMigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async cacheIsFilled(): Promise<boolean> {
    return this.cache.exists('tweets.ndjson') === 'file';
  }

  override async fillCache(): Promise<unknown> {
    const archives: string[] = [];

    if (archives.length === 0) {
      archives.push(...this.input.find({ matching: this.options.archiveGlob }));
    }

    for (const a of archives) {
      await this.processArchive(a);
    }

    this.cache.write('tweets.ndjson', [...this.tweets.values()]);
    this.cache.write('users.ndjson', [...this.users.values()]);

    // Build threads for later use
    this.buildThreads();
    if (this.threads.size > 0) {
      this.cache.write(
        'threads.ndjson',
        [...this.threads.entries()].map(e => [e[0], [...e[1].values()]]),
      );
    }

    return;
  }

  buildThreads() {
    for (const t of this.tweets.values()) {
      t.thread = this.getAncestor(t)?.id;
      if (t.thread) {
        if (!this.threads.has(t.thread))
          this.threads.set(t.thread, new Set<string>());
        this.threads.get(t.thread)?.add(t.id);
      }
    }
  }

  override async readCache(): Promise<unknown> {
    if (this.tweets.size === 0) {
      const tweets = this.cache.read('tweets.ndjson', 'auto') as
        | Tweet[]
        | undefined;
      if (tweets) {
        for (const t of tweets) this.tweets.set(t.id, TweetSchema.parse(t));
      }
    }

    if (this.threads.size === 0) {
      const threads = this.cache.read('threads.ndjson', 'auto') as
        | [string, string[]]
        | undefined;
      if (threads) {
        for (const [thread, children] of threads) {
          this.threads.set(thread, new Set<string>(children));
        }
      }
    }

    if (this.users.size === 0) {
      const users = this.cache.read('users.ndjson', 'auto') as
        | CreativeWork[]
        | undefined;
      if (users) {
        for (const u of users) {
          this.users.set(u.id, CreativeWorkSchema.parse(u));
        }
      }
    }

    return { tweets: this.tweets, threads: this.threads, users: this.users };
  }

  override async finalize() {
    // Write a giant datafile with ndjson for each year of each tweet.
    // Build a thread for each thread.

    const allTweets = [...this.tweets.values()];
    const filesToCopy = new Set<string>();
    const toExport: CreativeWork[] = [];

    if (this.options.saveSingles) {
      for (const tweet of allTweets.filter(t => !this.threads.has(t.id))) {
        if (this.includeSingleTweet(tweet)) {
          toExport.push(prep.tweet(tweet));
          for (const m of Object.values(tweet.media ?? {}).flat()) {
            filesToCopy.add(m.replace('media://twitter/', ''));
          }
        }
      }
    }

    if (this.options.saveThreads !== false) {
      for (const [tid, cids] of [...this.threads.entries()]) {
        const first = this.tweets.get(tid);
        if (first === undefined) {
          continue;
        }
        if (first.aboutId && this.options.ignoreReplyThreads) {
          continue;
        }

        const children = [...cids.values()]
          .map(id => this.tweets.get(id))
          .filter(t => t !== undefined) as Tweet[];

        if (first !== undefined) {
          const mediaFiles = [first, ...children]
            .map(t => Object.values(t.media ?? {}).flat())
            .flat()
            .filter(m => m !== undefined);
          for (const m of mediaFiles) {
            filesToCopy.add(m.replace('media://twitter/', ''));
          }
          toExport.push(prep.thread([first, ...children]));
        }
      }
    }

    for (const smp of toExport) {
      const { text, ...frontmatter } = smp;
      let file = this.makeFilename(frontmatter);
      const segments: string[] = [];

      if (this.options.group) {
        if (this.options.group.handle && typeof frontmatter.handle === 'string')
          segments.push(frontmatter.handle.toLocaleLowerCase());
        if (this.options.group.kind) {
          if (frontmatter.hasPart) {
            segments.push('threads');
          } else if (frontmatter.isRetweet) {
            segments.push('retweets');
          } else if (frontmatter.about) {
            segments.push('replies');
          } else {
            segments.push('singles');
          }
        }
        if (this.options.group.year) segments.push(file.split('-')[0]);
      }
      segments.push(file);
      file = segments.join('/');

      this.output.write(file, { content: text, data: frontmatter });
      if (this.options.store === 'arango') await this.arango.set({ ...frontmatter, text });
      this.log.debug(`Wrote ${file}`);
    }

    if (this.options.saveUsers) {
      for (const user of [...this.users.values()]) {
        await this.saveThing(user);
      }
    }

    if (this.options.saveMedia) {
      let ct = 0;
      for (const f of [...filesToCopy.values()]) {
        this.cache.copy(
          'media/' + f,
          this.output.dir('../_static/twitter').path(f),
          { overwrite: true },
        );
        ct++;
      }
      this.log.debug(
        `Copied ${ct} files to ${this.output.path('../_static/twitter')}`,
      );
    }
    return;
  }

  async processArchive(fileOrFolder: string) {
    const ignore = [
      'ad',
      'block',
      'dm',
      'favorite',
      'follower',
      'following',
      'list',
      'moment',
      'mute',
    ] as ArchiveReadPart[];

    let archive: TwitterArchive;
    try {
      archive = new TwitterArchive(this.input.path(fileOrFolder), { ignore });
      await archive.ready();
    } catch (err: unknown) {
      this.log.error(err);
      return;
    }

    this.log.debug(`Processing tweets for ${archive.info.user.screen_name}`);
    for (const pt of archive.tweets.sortedIterator('asc')) {
      const tweet = this.parsePartialTweet(pt);
      if (this.options.saveMedia) {
        tweet.media = await this.saveTweetMedia(archive, pt);
      }

      this.tweets.set(tweet.id, tweet);
    }

    const user = prep.user(archive);
    if (user) {
      this.users.set(user.id, user);
    }

    this.log.debug(`Done with ${fileOrFolder}`);
    archive.releaseZip();
    return;
  }

  protected parsePartialTweet(tweet: PartialTweet) {
    const output = TweetSchema.parse({
      id: tweet.id_str,
      date: tweet.created_at_d,
      handle: tweet.user.screen_name,
      text: tweet.text,

      aboutId: tweet.in_reply_to_status_id_str,
      aboutHandle: tweet.in_reply_to_screen_name,
      links: Object.fromEntries(
        tweet.entities.urls.map(u => [u.url, u.expanded_url]),
      ),

      source: toText(tweet.source),
      favorites: tweet.favorite_count,
      retweets: tweet.retweet_count,
    });
    output.hashtags = [
      ...new Set(tweet.entities.hashtags.map(ht => ht.text)).values(),
    ];
    output.isRetweet = !!tweet.retweeted || !!tweet.retweeted_status;
    return output;
  }

  protected async saveTweetMedia(archive: TwitterArchive, tweet: PartialTweet) {
    const mediaMap: Record<string, string[]> = {};
    for (const em of tweet.extended_entities?.media ?? []) {
      const variant = em.video_info?.variants
        ?.filter(v => v.content_type === 'video/mp4')
        .pop();
      const filename =
        tweet.id_str +
        '-' +
        parsePath(variant?.url ?? em.media_url_https).base.split('?')[0];

      const buffer = await archive.medias
        .fromTweetMediaEntity(em, true)
        .then(b => Buffer.from(b as ArrayBuffer))
        .catch(() => {
          this.log.debug(
            `Missing media file for ${prep.tweetUrl(tweet.id_str, tweet.user.screen_name)}`,
          );
          return undefined;
        });

      if (buffer && filename) {
        this.cache.write(`media/${filename}`, buffer);
        mediaMap[em.url] ??= [];
        mediaMap[em.url].push(`media://twitter/${filename}`);
      }
    }
    return mediaMap;
  }

  protected includeSingleTweet(tweet: Tweet) {
    if (this.options.ignoreBots) {
      if (tweet.source?.startsWith('Cheap Bots,')) return false;
    }
    if (this.options.ignoreThreadMembers) {
      if (this.isSelfReply(tweet)) return false;
    }
    if (this.options.ignoreSingleReplies) {
      if (this.isOtherReply(tweet)) return false;
    }
    if (this.options.saveRetweets !== true) {
      if (tweet.isRetweet) return false;
    }
    return true;
  }

  /** Assorted Tweet Checks */
  isReply(tweet: Tweet) {
    return !!tweet.aboutId;
  }

  isSelfReply(tweet: Tweet) {
    return tweet.handle === tweet.aboutHandle;
  }

  isOtherReply(tweet: Tweet) {
    return !!tweet.aboutId && tweet.aboutHandle !== tweet.handle;
  }

  isAncestor(tweet: Tweet) {
    return (
      !tweet.aboutId &&
      [...this.tweets.values()].some(t => tweet.id === t.aboutId)
    );
  }

  isOrphan(tweet: Tweet) {
    return !!tweet.aboutId && !this.tweets.has(tweet.aboutId);
  }

  // Hierarchy
  getAncestor(tweet: Tweet): Tweet | undefined {
    if (tweet.aboutId) {
      const parent = this.tweets.get(tweet.aboutId);
      if (parent && parent.handle === tweet.handle) {
        return this.getAncestor(parent) ?? parent;
      }
    }
    return undefined;
  }

  getParent(tweet: Tweet) {
    return tweet.aboutId ? this.tweets.get(tweet.aboutId) : undefined;
  }

  getDescendents(tweet: Tweet) {
    return [...(this.threads.get(tweet.id)?.values() ?? [])]
      .map(id => this.tweets.get(id))
      .filter(tweet => tweet !== undefined);
  }

  getChildren(tweet: Tweet) {
    return this.getDescendents(tweet).filter(t => t?.aboutId === tweet.id);
  }

  // checks

  hasMedia(tweet: Tweet) {
    return !!tweet.media && Object.keys(tweet.media).length > 0;
  }

  hasLinks(tweet: Tweet) {
    return !!tweet.links && Object.keys(tweet.links).length > 0;
  }
}
