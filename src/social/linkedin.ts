import { nanohash } from '@eatonfyi/ids';
import { z } from 'zod';
import { CreativeWorkSchema, urlSchema } from '../schemas/index.js';
import { SocialMediaPostingSchema } from '../schemas/schema-org/CreativeWork/social-media-post.js';
import { Migrator, MigratorOptions } from '../shared/index.js';
import { findLinks } from '../util/find-links.js';
import { toId } from '../schemas/index.js';

const defaults: MigratorOptions = {
  name: 'linkedin',
  label: 'LinkedIn',
  input: 'input/social/linkedin',
  cache: 'cache/social',
  output: 'src/entries/linked',
  assets: 'src/_static/linkedin',
};

export class LinkedInMigrator extends Migrator {
  constructor(options: MigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  shares: LinkedInPost[] = [];

  override async readCache() {
    const data = this.input.read('Shares.csv', 'auto');
    if (data) this.shares = z.array(schema).parse(data);
  }

  override async finalize() {
    for (const share of this.shares) {
      const post = this.prepPost(share);
      await this.saveThing(post);
    }

    const linkedIn = CreativeWorkSchema.parse({
      id: toId('blog', this.name),
      type: 'Blog',
      name: this.label,
      url: 'https://www.linkedin.com/in/jeffeaton/',
      isPartOf: toId('site', 'linkedin'),
    });
    await this.saveThing(linkedIn);

    await this.copyAssets('images');
    return;
  }

  prepPost(input: LinkedInPost) {
    let id = nanohash(input);
    if (input.ShareLink) {
      input.ShareLink.href = input.ShareLink.href.replaceAll('%3A', ':');
      id = input.ShareLink.href.split(':').pop()?.replace('/', '') ?? id;
    }

    return SocialMediaPostingSchema.parse({
      id: toId('post', `li${id}`),
      date: input.Date,
      url: input.ShareLink?.href || undefined,
      isPartOf: toId('blog', this.name),
      text:
        input.ShareCommentary?.replaceAll('"\n"', '\n\n').replaceAll(
          /\n\n+/g,
          '\n\n',
        ) || undefined,
      sharedContent:
        input.SharedUrl ||
        findLinks(input.ShareCommentary ?? '', 'url').map(l => l.href),
      image: input.MediaUrl || undefined,
    });
  }
}

const schema = z.object({
  Date: z.coerce.date(),
  ShareLink: urlSchema,
  ShareCommentary: z.string().optional(),
  SharedUrl: z.string().optional(),
  MediaUrl: z.string().optional(),
});

type LinkedInPost = z.infer<typeof schema>;
