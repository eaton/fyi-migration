import { toText } from '@eatonfyi/html';
import { toCase, toSlug } from '@eatonfyi/text';
import { parse as parsePath } from 'path';
import {
  ArchiveReadPart,
  PartialTweet,
  TwitterArchive,
} from 'twitter-archive-reader';
import { Tweet, TweetSchema, TweetThread } from '../schemas/tweet.js';
import { Migrator, MigratorOptions } from '../shared/migrator.js';
import { CreativeWork, CreativeWorkSchema } from '../schemas/creative-work.js';
import { parseRawArchive } from './raw-archive.js';

export interface TwitterMigratorOptions extends MigratorOptions {
  raw?: string[];
  makeThreads?: boolean;
  saveMedia?: boolean;
  saveFavorites?: boolean;
  saveRetweets?: boolean;
}

const defaults: TwitterMigratorOptions = {
  name: 'twitter',
  description: 'Tweets from multiple accounts',
  input: '/Volumes/archives/Backup/Service Migration Downloads/twitter',
  raw: ['schmeaton'],
  cache: 'cache/twitter',
  output: 'src/threads',
  makeThreads: true,
  saveMedia: true,
  saveFavorites: false,
  saveRetweets: false,
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

    // Find zipped archives and process them. For now, we ignore retweets.
    const archiveFiles = this.input.find({ matching: 'twitter-*.zip' });
    for (const file of archiveFiles) {
      this.log.debug(`Loading ${file}`);
      const archive = new TwitterArchive(this.input.path(file), { ignore });
      await archive.ready();
      this.log.debug(`Processing tweets for ${archive.info.user.screen_name}`);
      for (const pt of archive.tweets.sortedIterator('asc')) {
        const tweet = this.parseTweet(pt);
        if (this.options.saveMedia) {
          tweet.media = await this.saveTweetMedia(archive, pt);
        }
        this.tweets.set(tweet.id, tweet);
      }

      const user = this.prepUser(archive);
      this.users.set(user.id, user);

      this.log.debug(`Done with ${file}`);
      archive.releaseZip();
    }

    // If there are any 'raw' archives unparsed by the twitter-archive app,
    // handle them now.
    for (const raw of this.options.raw ?? []) {
      const rawDir = this.input.dir(raw);
      const media = rawDir.dir('tweets_media');

      const { user, tweets } = await parseRawArchive(rawDir.path());
      this.users.set(user.id, CreativeWorkSchema.parse(user));

      for (const t of tweets) {
        this.tweets.set(t.id, t);
      }
      for (const mf of media.find({ directories: false, files: true })) {
        media.copy(mf, this.cache.path('media/' + mf), { overwrite: true });
      }
      this.log.debug(`Processed raw tweets and media for ${raw}`);
    }
  
    // Build threads
    for (const t of this.tweets.values()) {
      t.thread = this.findAncestor(t)?.id;
      if (t.thread) {
        if (!this.threads.has(t.thread))
          this.threads.set(t.thread, new Set<string>());
        this.threads.get(t.thread)?.add(t.id);
      }
    }

    // Dump the raw user accounts, tweets, and threads to the cache
    this.cache.write('users.ndjson', [...this.users.values()]);  
    this.cache.write('tweets.ndjson', [...this.tweets.values()]);
    this.cache.write(
      'threadids.ndjson',
      [...this.threads.entries()].map(e => [e[0], [...e[1].values()]]),
    );

    return;
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

    return { tweets: this.tweets, threads: this.threads };
  }

  override async finalize() {
    // Write a giant datafile with ndjson for each year of each tweet.
    // Build a thread for each thread.

    for (const th of [...this.threads.entries()]) {
      const first = this.tweets.get(th[0]);
      const children = [...th[1].values()]
        .map(id => this.tweets.get(id))
        .filter(tw => tw !== undefined);
      if (first && first.aboutId === undefined) {
        const thread: TweetThread = {
          id: first.id,
          handle: first.handle,
          start: first.date,
          end: first.date,
          aboutId: first.aboutId,
          aboutHandle: first.aboutHandle,
          favorites: 0,
          retweets: 0,
          length: children.length + 1,
          tweets: [first, ...children],
        };
        thread.favorites = thread.tweets
          .map(t => t.favorites)
          .reduce((partialSum, a) => partialSum + a, 0);
        thread.retweets = thread.tweets
          .map(t => t.retweets)
          .reduce((partialSum, a) => partialSum + a, 0);
        thread.end = thread.tweets
          .map(t => t.date)
          .sort()
          .pop()!;

        const content = this.threadToMarkdown(thread);
        const name = content.replaceAll('\n', ' ').slice(0, 48);
        const data = {
          id: `${thread.id}`,
          name: toCase.title(name),
          slug: toSlug(name),
          date: thread.start,
          endDate: thread.end,
          account: thread.handle,
          tweets: thread.tweets.map(t => t.id),
          favorites: thread.favorites,
          retweets: thread.retweets,
        };
        const dateString = thread.start.toISOString().split('T')[0];
        this.output.write(
          `${thread.start.getFullYear()}/${dateString}-t${data.id}.md`,
          { content, data },
        );
      }
    }

    this.cache.copy('media', this.output.path('../_static/twitter'));
  }

  protected findAncestor(tweet: Tweet): Tweet | undefined {
    if (tweet.aboutId) {
      const parent = this.tweets.get(tweet.aboutId);
      if (parent) {
        return this.findAncestor(parent) ?? parent;
      }
    }
    return undefined;
  }

  protected parseTweet(tweet: PartialTweet) {
    return TweetSchema.parse({
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
            `Missing media file for https://twitter.com/${tweet.user.screen_name}/status/${tweet.id_str}`,
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

  protected prepUser(info: Record<string, string> | TwitterArchive) {
    if (info instanceof TwitterArchive) {
      return CreativeWorkSchema.parse({
        id: 'twt-@' + info.user.screen_name,
        id_str: info.user.id,
        name: info.user.screen_name,
        displayName: info.user.name,
        date: info.user.created_at,
        image: info.user.profile_img_url,
        description: info.user.bio,
        url: `https://x.com/${info.user.screen_name}`,
        hosting: 'Twitter'
      });
    } else {
      return CreativeWorkSchema.parse({
        ...info,
        url: `https://x.com/${info.handle}`,
        hosting: 'Twitter'
      });
    }
  }

  protected prepTweet(tweet: Tweet) {
    return CreativeWorkSchema.parse({
      id: 'twt-' + tweet.id,
      type: 'SocialMediaPosting',
      about: tweet.aboutId ? `https://x.com/${tweet.aboutHandle}/status/${tweet.aboutHandle}` : undefined,
      date: tweet.date,
      text: this.tweetToMarkdown(tweet),
      isPartOf: `twt-@${tweet.handle}`,
      favorites: tweet.favorites,
      retweets: tweet.retweets,
      software: tweet.source,
    })
  }

  protected prepThread(thread: TweetThread) {
    return CreativeWorkSchema.parse({
      id: 'twt-' + thread.id + 't',
      type: 'SocialMediaPosting',
      about: thread.aboutId ? `https://x.com/${thread.aboutHandle}/status/${thread.aboutId}` : undefined,
      dates: {
        start: thread.start,
        end: thread.end,
      },
      text: this.threadToMarkdown(thread),
      isPartOf: `twt-@${thread.handle}`,
      hasPart: thread.tweets.map(t => `https://www.x.com/${t.handle}/status/${t.id}`),
      favorites: thread.favorites,
      retweets: thread.retweets,
    })
  }

  protected threadToMarkdown(thread: TweetThread) {
    return thread.tweets.map(t => this.tweetToMarkdown(t)).join('\n\n');
  }

  protected tweetToMarkdown(tweet: Tweet) {
    let output = tweet.text;
    output = output.replaceAll(/\n+/g, '\n\n');

    // Remove the single link to the twitpic URL, and put each media item on its own line.
    // Later, we can wrap them in something.
    for (const [short, mediaFiles] of Object.entries(tweet.media ?? {})) {
      output = output.replaceAll(short, '');
      output += mediaFiles.map(
        m => `\n\n![](media://${m.replace('media', 'twitter')})`,
      );
    }

    // Humanize URLs; deal with expanding link shorteners later.
    for (const [short, long] of Object.entries(tweet.links ?? {})) {
      output = output.replaceAll(short, `[${long}](${long})`);
    }

    if (output.startsWith(`@${tweet.handle} `)) {
      output = output.replace(`@${tweet.handle} `, '');
    }

    return output;
  }
}
