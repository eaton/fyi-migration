// Stage 1
// Build per-year, per-account NDJson files for tweets, perhaps?
// Copy Tweet media

// Stage 2
// Generate 'thread' pages for multi-tweet threads, store by year

import { parse as parsePath } from 'path';
import {
  ArchiveReadPart,
  PartialTweet,
  TwitterArchive,
} from 'twitter-archive-reader';
import { z } from 'zod';
import { Migrator, MigratorOptions } from '../util/migrator.js';
import { toText } from '@eatonfyi/html';

export interface TwitterMigratorOptions extends MigratorOptions {
  makeThreads?: boolean;
  saveMedia?: boolean;
  saveFavorites?: boolean;
  saveRetweets?: boolean;
}

const defaults: TwitterMigratorOptions = {
  name: 'twitter',
  description: 'Tweets from multiple accounts',
  input: '/Volumes/archives/Backup/Service Migration Downloads/twitter',
  cache: '/Volumes/Syntax/scratch/social/twitter',
  output: 'src/social',
  makeThreads: true,
  saveMedia: true,
  saveFavorites: false,
  saveRetweets: false,
};

export class TwitterMigrator extends Migrator {
  declare options: TwitterMigratorOptions;
  tweets = new Map<string, ParsedTweet>();
  threads = new Map<string, Set<string>>();

  constructor(options: TwitterMigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async cacheIsFilled(): Promise<boolean> {
    return Promise.resolve(this.cache.exists('tweets.ndjson') === 'file');
  }

  override async fillCache(): Promise<unknown> {
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
    const archiveFiles = this.input.find({ matching: 'twitter-*.zip' });
    for (const file of archiveFiles) {
      this.log.debug(`Loading ${file}`);
      const archive = new TwitterArchive(this.input.path(file), { ignore });
      await archive.ready();
      this.log.debug(`Processing tweets for ${archive.info.user.screen_name}`);
      for (const pt of archive.tweets.sortedIterator('asc')) {
        if (this.isOwnTweet(pt, archive)) {
          const tweet = this.parseTweet(pt);
          if (this.options.saveMedia) {
            tweet.media = await this.saveTweetMedia(archive, pt);
          }
          this.tweets.set(tweet.id, tweet);
        }
      }
      this.cache.write(`accounts/${archive.user.screen_name}/${archive.hash}.json`, archive.synthetic_info);
      this.log.debug(`Done with ${file}`);
      archive.releaseZip();
    }

    for (const t of this.tweets.values()) {
      t.thread = this.findAncestor(t)?.id;
      if (t.thread) {
        if (!this.threads.has(t.thread)) this.threads.set(t.thread, new Set<string>);
        this.threads.get(t.thread)?.add(t.id);
      }
    }

    this.cache.write('tweets.ndjson', [...this.tweets.values()]);
    this.cache.write('threads.ndjson', [...this.threads.entries()].map(e => [e[0], [...e[1].values()]]));

    return Promise.resolve();
  }

  override async readCache(): Promise<unknown> {
    if (this.tweets.size === 0) {
      const tweets = this.cache.read('tweets.ndjson', 'auto') as ParsedTweet[] | undefined;
      if (tweets) {
        for (const t of tweets) this.tweets.set(t.id, t);
      }
    }

    if (this.threads.size === 0) {
      const threads = this.cache.read('threads.ndjson', 'auto') as Record<string, string[]> | undefined;
      if (threads) {
        for (const [thread, children] of Object.entries(threads)) {
          this.threads.set(thread, new Set<string>(...children));
        }
      }
    }

    return Promise.resolve({ tweets: this.tweets, threads: this.threads });
  }

  override async finalize() {
    // Write a giant datafile with ndjson for each year of each tweet.
    // Build a thread for each thread.
  }

  protected findAncestor(tweet: ParsedTweet): ParsedTweet | undefined {
    if (tweet.about) {
      const parent = this.tweets.get(tweet.about);
      if (parent) {
        return this.findAncestor(parent) ?? parent;
      }
    }
    return undefined;
  }

  protected parseTweet(tweet: PartialTweet) {
    return tweetSchema.parse({
      id: tweet.id_str,
      date: tweet.created_at_d,
      handle: tweet.user.screen_name,
      text: tweet.text,

      about: tweet.in_reply_to_status_id_str,
      aboutId: tweet.in_reply_to_user_id_str,
      links: Object.fromEntries(
        tweet.entities.urls.map(u => [u.url, u.expanded_url]),
      ),

      source: toText(tweet.source),
      favorites: tweet.favorite_count,
      retweets: tweet.retweet_count,
    });
  }

  protected cacheTweet(tweet: ParsedTweet) {
    this.cache.write(
      `accounts/${tweet.handle}/${tweet.date.getFullYear()}/${tweet.id}.json`,
      tweet,
    );
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
          this.log.debug(`Missing media file for https://twitter.com/${tweet.user.screen_name}/status/${tweet.id_str}`);
          return undefined;
        });

      if (buffer && filename) {
        this.cache.write(`media/${filename}`, buffer);
        mediaMap[em.url] ??= [];
        mediaMap[em.url].push(`media/${filename}`);
      }
    }
    return mediaMap;
  }

  protected isOwnTweet(tweet: PartialTweet, archive: TwitterArchive) {
    return tweet.user.id_str === archive.user.id && !this.isRetweet(tweet);
  }

  protected isRetweet(tweet: PartialTweet) {
    return tweet.retweeted_status || tweet.retweeted;
  }

  protected isOtherReply(tweet: PartialTweet) {
    return (
      tweet.in_reply_to_status_id_str &&
      tweet.in_reply_to_user_id_str !== tweet.user.id_str
    );
  }

  protected isOwnReply(tweet: PartialTweet) {
    return (
      tweet.in_reply_to_status_id_str &&
      tweet.in_reply_to_user_id_str === tweet.user.id_str
    );
  }
}

const tweetSchema = z.object({
  id: z.coerce.string(),
  date: z.date(),
  handle: z.string(),
  text: z.string(),

  thread: z
    .string()
    .optional()
    .describe('The ID of the topmost parent in a string of replies'),
  about: z
    .string()
    .optional()
    .describe(
      'If the tweet is a reply, the ID of the status it is in reply to',
    ),
  aboutId: z
    .string()
    .optional()
    .describe('If the tweet is a reply, the ID of account it is replying to'),
  links: z.record(z.string().url()).optional(),
  media: z.record(z.array(z.string().url())).optional(),

  source: z.string().optional(),
  favorites: z.number().default(0),
  retweets: z.number().default(0),
});
type ParsedTweet = z.infer<typeof tweetSchema>;
