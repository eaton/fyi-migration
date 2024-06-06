import { toText } from '@eatonfyi/html';
import { parse as parsePath } from 'path';
import { groupBy } from 'remeda';
import {
  ArchiveReadPart,
  PartialTweet,
  TwitterArchive,
} from 'twitter-archive-reader';
import { CreativeWork, CreativeWorkSchema } from '../schemas/creative-work.js';
import { Tweet, TweetSchema } from './schema.js';
import { Migrator, MigratorOptions } from '../shared/migrator.js';
import * as prep from './prep.js';

type GroupByType = 'year' | 'user' | 'thread';

export interface TwitterMigratorOptions extends MigratorOptions {
  archives?: string[];
  
  groupBy?: GroupByType;
  
  saveUsers?: boolean;
  saveMedia?: boolean;
  saveFavorites?: boolean;

  saveSingles?: boolean;
  ignoreSingleReplies?: boolean;
  ignoreSingleChildren?: boolean;
  ignoreSingleRetweets?: boolean;

  saveThreads?: boolean;
  ignoreOrphanThreads?: boolean;
}

const defaults: TwitterMigratorOptions = {
  name: 'twitter',
  description: 'Tweets from multiple accounts',
  input: '/Volumes/archives/Backup/Service Migration Downloads/twitter',
  cache: 'cache/twitter',
  output: 'src/threads',

  groupBy: 'year',

  saveUsers: true,
  saveMedia: true,
  saveFavorites: false,

  saveSingles: false,
  // ignoreSingleReplies: true,
  // ignoreSingleChildren: true,
  // ignoreSingleRetweets: true,

  saveThreads: true,
  ignoreOrphanThreads: true
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
    const archives = this.options.archives ?? [];

    if (archives.length === 0) {
      archives.push(...this.input.find({ matching: 'twitter-*.zip' }));
      const probableArchiveFolders = this.input.find({ matching: '*/Your Archive.html' });
      for (const f in probableArchiveFolders) {
        archives.push(parsePath(f).dir);
      }
    }

    for (const a of archives) {
      await this.processArchive(a);
    }

    this.cache.write('tweets.ndjson', [...this.tweets.values()]);
    this.cache.write('users.ndjson', [...this.users.values()]);

    // Build threads for later use
    this.buildThreads();
    this.cache.write(
      'threadids.ndjson',
      [...this.threads.entries()].map(e => [e[0], [...e[1].values()]]),
    );

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
        for (const u of users) this.users.set(u.id, CreativeWorkSchema.parse(u));
      }
    }

    return { tweets: this.tweets, threads: this.threads, users: this.users };
  }

  override async finalize() {
    // Write a giant datafile with ndjson for each year of each tweet.
    // Build a thread for each thread.

    const allTweets = [...this.tweets.values()];
    // Filter this based on the output rules; retweets, replies, non-threaded stuff, etc.

    const byYear = groupBy(allTweets, t => t.date.getFullYear().toString());
    for (const [year, tweets] of Object.entries(byYear)) {
      if (tweets) {
        this.output.write(`tweets-${year}.ndjson`, tweets);
      }
    }

    if (this.options.saveUsers) {
      for (const user of [...this.users.values()]) {
        this.data.bucket('things').set(user);
      }
    }

    if (this.options.saveThreads) {
      for (const th of [...this.threads.entries()]) {
        const first = this.tweets.get(th[0]);
        const children = [...th[1].values()]
          .map(id => this.tweets.get(id))
          .filter(t => t !== undefined) as Tweet[];

        if (first !== undefined) {
          children.unshift(first);
          const { text, ...frontmatter } = prep.thread(children);
          const file = this.makeFilename(frontmatter);
          this.output.write(file, { content: text, data: frontmatter });
        }
      }
    }

    if (this.options.saveMedia) {
      this.cache.copy('media', this.output.path('../_static/twitter'));
    }
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
      'mute'
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
    output.isRetweet = !!tweet.retweeted_status;
    return output;
  }

  protected async saveTweetMedia(archive: TwitterArchive, tweet: PartialTweet) {
    const mediaMap: Record<string, string[]> = {};
    for (const em of tweet.extended_entities?.media ?? []) {
      const variant = em.video_info?.variants
        ?.filter(v => v.content_type === 'video/mp4')
        .pop();
      const filename = parsePath(variant?.url ?? em.media_url_https).base.split(
        '?',
      )[0];

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

  /** Assorted Tweet Checks */
  isReply(tweet: Tweet) {
    return !!tweet.aboutId;
  }

  isSelfReply(tweet: Tweet) {
    return tweet.handle === tweet.aboutHandle;
  }

  isOtherReply(tweet: Tweet) {
    return (
      !!tweet.aboutHandle &&
      tweet.aboutHandle !== tweet.handle
    );
  }

  isAncestor(tweet: Tweet) {
    return !tweet.aboutId && [...this.tweets.values()].some(
      t => tweet.id === t.aboutId,
    );
  }
  
  isOrphan(tweet: Tweet) {
    return !!tweet.aboutId && !this.tweets.has(tweet.aboutId)
  }
    
  // Hierarchy
  getAncestor(tweet: Tweet): Tweet | undefined {
    if (tweet.aboutId) {
      const parent = this.tweets.get(tweet.aboutId);
      if (parent) {
        return this.getAncestor(parent) ?? parent;
      }
    }
    return undefined;
  }

  getParent(tweet: Tweet) {
    return tweet.aboutId ? this.tweets.get(tweet.aboutId) : undefined;
  }
  
  getDescendents(tweet: Tweet) {
    return [...this.threads.get(tweet.id)?.values() ?? []]
      .map(id => this.tweets.get(id))
      .filter(tweet => tweet !== undefined);
  }

  getChildren(tweet: Tweet) {
    return this.getDescendents(tweet).filter(t => t.aboutId === tweet.id);
  }
    
  // checks
  
  hasMedia(tweet: Tweet) {
    return !!tweet.media && Object.keys(tweet.media).length > 0;
  }
  
  hasLinks(tweet: Tweet) {
    return !!tweet.links && Object.keys(tweet.links).length > 0;
  }
}
