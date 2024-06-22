import { nanohash } from "@eatonfyi/ids";
import { CreativeWorkSchema, urlSchema } from "../schemas/index.js";
import { SocialMediaPostingSchema } from "../schemas/social-media-post.js";
import { Migrator, MigratorOptions } from "../shared/index.js";
import { z } from 'zod';

const defaults: MigratorOptions = {
  name: 'linkedin',
  label: 'LinkedIn',
  input: 'social/linkedin',
  cache: 'cache/social',
  output: 'entries/linked',
  assets: 'src/_static/linkedin'
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
      id: this.name,
      type: 'Blog',
      name: this.label,
      url: 'https://www.linkedin.com/in/jeffeaton/'
    });
    await this.saveThing(linkedIn);

    await this.copyAssets('images');
    return;
  }

  prepPost(input: LinkedInPost) {
    const id = input.ShareLink?.searchParams.get('share') ??
      input.ShareLink?.searchParams.get('ugcPost') ??
      nanohash(input);
    
    return SocialMediaPostingSchema.parse({
      id: `li-${id}`,
      date: input.Date,
      url: input.ShareLink?.href,
      isPartOf: this.name,
      text: input.ShareCommentary,
      sharedContent: input.SharedUrl,
      image: input.MediaUrl,
    })
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