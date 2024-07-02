import { nanohash } from '@eatonfyi/ids';
import { Frontmatter } from '@eatonfyi/serializers';
import { SocialMediaPosting, SocialMediaPostingSchema } from '../schemas/schema-org/CreativeWork/social-media-post.js';
import {
  CreativeWork,
  CreativeWorkSchema,
} from '../schemas/schema-org/creative-work.js';
import { BlogMigrator, BlogMigratorOptions } from './blog-migrator.js';
import { z } from 'zod';
import { toId } from '../shared/schema-meta.js';

const defaults: BlogMigratorOptions = {
  name: 'kingdomcome',
  label: 'Kingdom Come',
  description:
    'A multi-author blog exploring the Christian experience across continents and denominations',
  input: 'input/blogs/kingdomcome',
  output: 'src/entries/kingdomcome',
};

export class KingdomComeMigrator extends BlogMigrator {
  entries: SocialMediaPosting[] = [];

  constructor(options: BlogMigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async cacheIsFilled(): Promise<boolean> {
    return true;
  }

  override async readCache() {
    const files = this.input.find({ matching: '*.md' });
    for (const file of files) {
      this.log.debug(`Parsing ${file}`);
      await this.input
        .readAsync(file, 'auto')
        .then((data: Frontmatter) =>
          schema.safeParse(data),
        )
        .then(result => {
          if (result.success) {
            const cw = this.prepEntry(result.data);
            this.entries.push(cw);
          } else {
            this.log.error(result.error.message);
          }
        });
    }

    return this.entries;
  }

  override async finalize() {
    if (this.entries.length === 0) {
      await this.readCache();
    }

    await this.saveThing(
      CreativeWorkSchema.parse({
        type: 'Blog',
        id: toId('blog', 'kingdomcome'),
        url: 'http://kingdomcome.blogspot.com',
        name: this.label,
        description: this.description
      }),
    );

    for (const e of this.entries) {
      await this.saveThings(e);
    }


    return Promise.resolve();
  }

  protected prepEntry(input: FrontmatterFile): CreativeWork {
    return SocialMediaPostingSchema.parse({
      type: 'BlogPosting',
      id: toId('blog', nanohash(input.data.url)),
      date: input.data.date,
      name: input.data.title,
      text: input.content,
      isPartOf: toId('blog', this.name),
    });
  }
}

const schema = z.object({
  data: z.object({
    date: z.coerce.date().optional(),
    title: z.coerce.string().optional(),
    url: z.string()
  }),
  content: z.string(),
})

type FrontmatterFile = z.infer<typeof schema>;
