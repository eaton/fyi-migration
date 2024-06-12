import { Migrator, MigratorOptions } from "../shared/migrator.js";
import { cleanLink } from "../util/clean-link.js";
import { CreativeWorkSchema } from "../schemas/creative-work.js";
import { TwitterArchive, ArchiveReadPart, TwitterHelpers } from 'twitter-archive-reader';
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
    return this.cache.exists('twitter.json') === 'file';
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
        let text = t.text.trim();

        if (this.options.ignoreRetweets && (t.retweeted_status || t.retweeted)) continue;
        if (this.options.ignoreReplies) {
          if (t.in_reply_to_user_id_str && (t.in_reply_to_user_id_str !== t.user.id_str)) continue;
        } else {
          while(text.length > 0 && text.startsWith('@')) {
            text = text.replace(/^@[a-zA-Z0-9_-]/, '').trim()
          }  
        }

        for (const hashTag of t.entities.hashtags.map(h => h.text)) {
          text = text.replace(`#${hashTag}`, '').trim();
        }

        for (const media of t.extended_entities?.media?.map(m => m.url) ?? []) {
          text = text.replace(media, '').trim();
        }

        for (const link of t.entities.urls) {
          if (text.endsWith(link.url) || text.startsWith(link.url)) {
            text = text.replace(link.url, '').trim();
          } else {
            text = text.replace(link.url, link.display_url).trim();
          }
        }
        
        text = text.trim();

        for (const u of t.entities.urls) {
          const link = schema.parse({
            url:  u.expanded_url,
            description: text.length ? text : undefined,
            handle: t.user.screen_name,
            date: TwitterHelpers.dateFromTweet(t),
            hashtags: t.entities.hashtags.map(h => h.text)
          });

          // First one in wins.
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
    this.cache.write('twitter.json', this.links);
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
}

const schema = z.object({
  url: z.string().url(),
  description: z.string().optional(),
  date: z.coerce.date(),
  handle: z.string(),
  hashtags: z.array(z.string()).optional().transform(a => a?.length ? a : undefined)
});

type TwitterLink = z.infer<typeof schema>;