import { toText } from '@eatonfyi/html';
import { toCase, toSlug } from '@eatonfyi/text';
import { parse as parsePath } from 'path';
import {
  ArchiveReadPart,
  PartialTweet,
  TwitterArchive,
} from 'twitter-archive-reader';
import { CreativeWork, CreativeWorkSchema } from '../schemas/creative-work.js';
import { Tweet, TweetSchema } from '../schemas/tweet.js';
import { Migrator, MigratorOptions } from '../shared/migrator.js';
import { parseRawArchive } from './raw-archive.js';
import { toFilename } from '../util/to-filename.js';

export interface TwitterMigratorOptions extends MigratorOptions {
  raw?: string[];
  saveMedia?: boolean;
  saveFavorites?: boolean;
  saveRetweets?: boolean;
  saveReplies?: boolean;
  saveSingles?: boolean;
  saveThreads?: boolean;
}

const defaults: TwitterMigratorOptions = {
  name: 'twitter',
  description: 'Tweets from multiple accounts',
  input: '/Volumes/archives/Backup/Service Migration Downloads/twitter',
  raw: ['schmeaton'],
  cache: 'cache/twitter',
  output: 'src/threads',

  saveMedia: true,
  saveRetweets: true,
  saveReplies: true,
  saveSingles: true,
  saveThreads: true,
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
        if (!this.options.saveRetweets && this.isRetweet(pt)) {
          continue;
        }

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

    this.cache.write('users.ndjson', [...this.users.values()]);
    this.cache.write('tweets.ndjson', [...this.tweets.values()]);

    // Build threads
    if (this.options.saveThreads) {
      for (const t of this.tweets.values()) {
        t.thread = this.findAncestor(t)?.id;
        if (t.thread) {
          if (!this.threads.has(t.thread))
            this.threads.set(t.thread, new Set<string>());
          this.threads.get(t.thread)?.add(t.id);
        }
      }
      this.cache.write(
        'threadids.ndjson',
        [...this.threads.entries()].map(e => [e[0], [...e[1].values()]]),
      );  
    }

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

    const allTweets = [...this.tweets.values()];
    // Filter this based on the output rules; retweets, replies, non-threaded stuff, etc.

    const byYear = Object.groupBy(allTweets, t => t.date.getFullYear().toString());
    for (const [year, tweets] of Object.entries(byYear)) {
      if (tweets) {
        this.output.write(year + '.ndjson', tweets);
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
          const { text, ...frontmatter } = this.prepThread(children) ;
          const file = toFilename(frontmatter)
          this.output.write(file, { content: text, data: frontmatter });
        }
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
    return !!tweet.retweeted_status || !!tweet.retweeted;
  }

  protected isOtherReply(tweet: PartialTweet) {
    return (
      !!tweet.in_reply_to_status_id_str &&
      tweet.in_reply_to_user_id_str !== tweet.user.id_str
    );
  }

  protected isOwnReply(tweet: PartialTweet) {
    return (
      !!tweet.in_reply_to_status_id_str &&
      tweet.in_reply_to_user_id_str === tweet.user.id_str
    );
  }

  protected prepUser(info: Record<string, string> | TwitterArchive) {
    if (info instanceof TwitterArchive) {
      return CreativeWorkSchema.parse({
        type: 'Blog',
        id: 'twt-@' + info.user.screen_name,
        id_str: info.user.id,
        name: info.user.screen_name,
        subtitle: info.user.name,
        date: info.user.created_at,
        image: info.user.profile_img_url,
        description: info.user.bio,
        url: `https://x.com/${info.user.screen_name}`,
        hosting: 'Twitter',
      });
    } else {
      return CreativeWorkSchema.parse({
        ...info,
        url: `https://x.com/${info.handle}`,
        hosting: 'Twitter',
      });
    }
  }

  protected prepTweet(tweet: Tweet) {
    return CreativeWorkSchema.parse({
      type: 'SocialMediaPosting',
      id: 'twt-' + tweet.id,
      about: tweet.aboutId
        ? `https://x.com/${tweet.aboutHandle}/status/${tweet.aboutHandle}`
        : undefined,
      date: tweet.date,
      text: this.tweetToMarkdown(tweet),
      handle: tweet.handle,
      isPartOf: `twt-@${tweet.handle}`,
      favorites: tweet.favorites,
      retweets: tweet.retweets,
      software: tweet.source,
      sharedContent: Object.values(tweet.media ?? {}).flat(),
    });
  }

  protected prepThread(tweets: Tweet[]) {
    const first = tweets[0];
    const text = this.threadToMarkdown(tweets);
    const name = text.replaceAll('\n', ' ').slice(0, 48);
    
    const cw = CreativeWorkSchema.parse({
      type: 'SocialMediaPosting',
      id: `twt-${first.id}`,
      name: toCase.title(name),
      slug: toSlug(name),
      handle: first.handle,
      isPartOf: `twt-@${first.handle}`,
      about: first.aboutId
      ? `https://x.com/${first.aboutHandle}/status/${first.aboutHandle}`
      : undefined,
      dates: {
        start: first.date,
        end: tweets.map(t => t.date).sort().pop()!
      },
      text,
      tweets: tweets.map(t => t.id),
      favorites: tweets.map(t => t.favorites).reduce((partialSum, a) => partialSum + a, 0),
      retweets: tweets.map(t => t.retweets).reduce((partialSum, a) => partialSum + a, 0),
      sharedContent: tweets.flatMap(t =>
        Object.values(t.media ?? {}).flat(),
      )
    })
    return cw;
  }

  protected threadToMarkdown(thread: Tweet[]) {
    return thread.map(t => this.tweetToMarkdown(t)).join('\n\n');
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
