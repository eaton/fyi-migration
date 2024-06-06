import { toText } from '@eatonfyi/html';
import { toCase, toSlug } from '@eatonfyi/text';
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

type GroupByType = 'year' | 'user' | 'thread';
type FilterableType =
  | 'thread'
  | 'ancestor'
  | 'parent'
  | 'child'
  | 'orphan'
  | 'reply'
  | 'retweet'
  | 'media';

export interface TwitterMigratorOptions extends MigratorOptions {
  archives?: string[],
  include?: FilterableType | FilterableType[];
  ignore?: FilterableType | FilterableType[];
  groupBy?: GroupByType;
  saveUsers?: boolean;
  saveMedia?: boolean;
  saveFavorites?: boolean;
  saveThreads?: boolean;
}

const defaults: TwitterMigratorOptions = {
  name: 'twitter',
  description: 'Tweets from multiple accounts',
  input: '/Volumes/archives/Backup/Service Migration Downloads/twitter',
  cache: 'cache/twitter',
  output: 'src/threads',
  include: [],
  ignore: ['reply', 'retweet'],
  groupBy: 'thread',
  saveMedia: true,
  saveUsers: true,
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
          const { text, ...frontmatter } = this.prepThread(children);
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

    const exists = this.input.exists(fileOrFolder);
    if (exists === 'file') {
      this.log.debug(`Loading zip archive ${fileOrFolder}`);
    } else if (exists === 'dir') {
      if (!this.input.dir(fileOrFolder).exists('Your archive.html')) {
        this.log.debug(`Couldn't load ${fileOrFolder}`);
        return;
      } else {
        this.log.debug(`Loading folder archive ${fileOrFolder}`);
      }
      this.log.debug(`Loading folder archive ${fileOrFolder}`);
    } else {
      this.log.error(`Couldn't load ${fileOrFolder}`);
      return;
    }

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

    const user = this.prepUser(archive);
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
            `Missing media file for ${urlForTweet(tweet.id_str, tweet.user.screen_name)}`,
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
        url: urlForHandle(info.user.screen_name),
        hosting: 'Twitter',
      });
    } else {
      return CreativeWorkSchema.parse({
        ...info,
        url: urlForHandle(info.handle),
        hosting: 'Twitter',
      });
    }
  }

  protected prepTweet(tweet: Tweet) {
    return CreativeWorkSchema.parse({
      type: 'SocialMediaPosting',
      id: 'twt-' + tweet.id,
      about: tweet.aboutId
        ? urlForTweet(tweet.aboutId, tweet.aboutHandle)
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
    const text = tweets.map(t => this.tweetToMarkdown(t)).join('\n\n');
    const name = text.replaceAll('\n', ' ').slice(0, 48);

    const cw = CreativeWorkSchema.parse({
      type: 'SocialMediaPosting',
      id: `twt-${first.id}`,
      name: toCase.title(name),
      slug: toSlug(name),
      handle: first.handle,
      isPartOf: `twt-@${first.handle}`,
      about: first.aboutId
        ? urlForTweet(first.aboutId, first.aboutHandle)
        : undefined,
      dates: {
        start: first.date,
        end: tweets
          .map(t => t.date)
          .sort()
          .pop()!,
      },
      text,
      tweets: tweets.map(t => t.id),
      favorites: tweets
        .map(t => t.favorites)
        .reduce((partialSum, a) => partialSum + a, 0),
      retweets: tweets
        .map(t => t.retweets)
        .reduce((partialSum, a) => partialSum + a, 0),
      sharedContent: tweets.flatMap(t => Object.values(t.media ?? {}).flat()),
    });
    return cw;
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

export function urlForTweet(id: string, handle = 'twitter') {
  return `https://www.x.com/${handle}/status/${id}`;
}

export function urlForHandle(id: string, handle = 'twitter') {
  return `https://www.x.com/${handle}/status/${id}`;
}