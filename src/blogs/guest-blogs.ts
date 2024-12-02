import { nanohash } from '@eatonfyi/ids';
import { SocialMediaPostingSchema, toId } from '@eatonfyi/schema';
import { Frontmatter } from '@eatonfyi/serializers';
import { Migrator, MigratorOptions } from '../shared/migrator.js';

const defaults: MigratorOptions = {
  name: 'guestblogs',
  description: 'Posts from multi-contributor blogs I participated in',
  input: 'input/blogs/guestblogs',
};

export class GuestBlogMigrator extends Migrator {
  constructor(options: MigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async finalize(): Promise<void> {
    const parser = new Frontmatter();
    for (const f of this.input.find({ matching: '**/*.md' })) {
      const raw = this.input.read(f, 'utf8');
      if (!raw) continue;
      const markdown = parser.parse(raw);

      if (markdown.data.things) {
        const things = this.prepThings(markdown.data.things);
        await this.saveThings(things);
      }

      const post = SocialMediaPostingSchema.safeParse({
        id: toId('post', markdown.data.id || nanohash(markdown.data)),
        type: 'BlogPosting',
        name: markdown.data.name ?? markdown.data.title,
        date: markdown.data.date,
        text: markdown.content,
        isPartOf: markdown.data.isPartOf || undefined,
        description: markdown.data.summary || undefined,
        publisher: markdown.data.publisher || undefined,
        about: markdown.data.about || undefined,
        url: markdown.data.url || undefined,
        archivedAt: markdown.data.archivedAt || undefined,
        keywords: markdown.data.keywords || undefined,
      });

      if (post.success) {
        await this.saveThing(post.data);
      } else {
        this.log.error(post.error, `Could not parse blog post`);
        continue;
      }
    }

    await this.copyAssets('images', 'blogs');
    return;
  }
}
