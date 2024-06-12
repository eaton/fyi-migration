import { Migrator, MigratorOptions } from "../shared/migrator.js";
import { cleanLink } from "../util/clean-link.js";
import { CreativeWorkSchema } from "../schemas/creative-work.js";
import { TwitterArchive, ArchiveReadPart, TwitterHelpers, PartialTweet } from 'twitter-archive-reader';
import { z } from "zod";
import { ParsedUrl } from "@eatonfyi/urls";

export interface TwitterLinkMigratorOptions extends MigratorOptions {
  ignoreLinksToTweets?: boolean;
  ignoreReplies?: boolean;
  ignoreRetweets?: boolean;
}

const defaults: TwitterLinkMigratorOptions = {
  name: 'twitter',
  label: 'Twitter',
  description: 'Links shared on my Twitter account.',
  input: 'input/social/twitter',
  cache: 'cache/bookmarks',
  ignoreLinksToTweets: true,
  ignoreReplies: true,
  ignoreRetweets: true
}

export class TwitterBookmarkMigrator extends Migrator {
  declare options: TwitterLinkMigratorOptions;
  links: TwitterLink[] = [];

  constructor(options: TwitterLinkMigratorOptions = {}) {
    super({...defaults, ...options});
  }

  override async cacheIsFilled() {
    return this.cache.exists('twitter.ndjson') === 'file';
  }

  override async fillCache() {
    const linkMap = new Map<string, TwitterLink>();

    const archives: string[] = [];

    if (archives.length === 0) {
      archives.push(...this.input.find({ matching: 'twitter-*.zip' }));
    }

    for (const a of archives) {
      this.log.debug(`Processing links from ${a}`)
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
  
      const archive = new TwitterArchive(this.input.path(a), { ignore });
      await archive.ready();

      for (const t of archive.tweets.all) {
        // First one in wins.
        for (const link of this.processTweet(t)) {
          if (!linkMap.has(link.url)) {
            linkMap.set(link.url, link);
          }
        }
      }

      archive.releaseZip();
    }

    this.links = [...linkMap.values()];
    if (this.options.ignoreLinksToTweets) {
      this.links = this.links.filter(t => {
        const u = new ParsedUrl(t.url);
        return !['twitter.com', 't.co', 'x.com'].includes(u.domain)
      })
    }
    this.cache.write('twitter.ndjson', this.links);
    return this.links;
  }

  override async readCache() {
    if (this.links.length === 0) {
      const raw = this.cache.read('twitter.ndjson', 'auto') as undefined[] ?? [];
      this.links = raw.map(l => schema.parse(l)); 
    }
    return this.links;
  }
  
  override async finalize() {
    const linkStore = this.data.bucket('links');

    const cws = this.links.map(l => {
      const link = CreativeWorkSchema.parse({
        ...cleanLink(l.url),
        date: l.date,
        description: l.description,
        keywords: l.hashtags,
        isPartOf: `@${l.handle}`
      });
      return link;
    });

    for (const cw of cws) {
      linkStore.set(cw);
    }

    this.log.info(`Saved ${cws.length} links.`)
  }

  processTweet(input: PartialTweet): TwitterLink[] {
    const output: TwitterLink[] = [];
    let text = input.text.trim();

    if (this.options.ignoreRetweets && (input.retweeted_status || input.retweeted)) return [];
    if (this.options.ignoreReplies) {
      if (input.in_reply_to_user_id_str && (input.in_reply_to_user_id_str !== input.user.id_str)) return [];
    } else {
      while(text.length > 0 && text.startsWith('@')) {
        text = text.replace(/^@[a-zA-Z0-9_-]/, '').trim()
      }  
    }

    for (const hashTag of input.entities.hashtags.map(h => h.text)) {
      text = text.replace(`#${hashTag}`, '').trim();
    }

    for (const media of input.extended_entities?.media?.map(m => m.url) ?? []) {
      text = text.replace(media, '').trim();
    }

    for (const link of input.entities.urls) {
      if (text.endsWith(link.url) || text.startsWith(link.url)) {
        text = text.replace(link.url, '').trim();
      } else {
        text = text.replace(link.url, link.display_url).trim();
      }
    }
    
    text = text.trim();
    if (text.endsWith(':')) text = text.slice(0,-1);

    for (const u of input.entities.urls) {
      const link = schema.parse({
        url:  u.expanded_url,
        description: text.length ? text : undefined,
        handle: input.user.screen_name,
        date: TwitterHelpers.dateFromTweet(input),
        hashtags: input.entities.hashtags.map(h => h.text)
      });
      output.push(link)
    }

    return output;
  }
}

const schema = z.object({
  url: z.string().url(),
  description: z.string().optional(),
  date: z.coerce.date(),
  handle: z.string(),
  hashtags: z.array(z.string()).optional().transform(a => a?.length ? a : undefined)
});

type TwitterLink = z.infer<typeof schema>;