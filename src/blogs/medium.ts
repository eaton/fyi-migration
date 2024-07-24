import { get } from 'obby';
import { SocialMediaPostingSchema } from '../schemas/schema-org/CreativeWork/social-media-post.js';
import { CreativeWorkSchema } from '../schemas/schema-org/creative-work.js';
import { toId } from '../schemas/mapper.js';
import { BlogMigrator, BlogMigratorOptions } from './blog-migrator.js';

const defaults: BlogMigratorOptions = {
  name: 'medium',
  label: 'Medium',
  description: 'Stuff I dumped onto Medium that never appeared elsewhere',
  input: 'input/blogs/medium',
  output: 'src/entries/medium',
};

export class MediumMigrator extends BlogMigrator {
  constructor(options: BlogMigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async finalize() {
    const blog = CreativeWorkSchema.parse({
      type: 'Blog',
      id: toId('blog', this.name),
      name: this.label,
      url: 'https://medium.com/@eaton',
    });

    await this.saveThing(blog);

    for (const f of this.input.find({ matching: 'posts/*.md' })) {
      const markdown = this.input.read(f, 'auto');
      const post = SocialMediaPostingSchema.parse({
        type: 'BlogPosting',
        id: toId('post', get(markdown, 'data.id')),
        name: get(markdown, 'data.title') || undefined,
        description: get(markdown, 'data.summary') || undefined,
        slug: get(markdown, 'data.slug') || undefined,
        image: get(markdown, 'data.image') || undefined,
        url: get(markdown, 'data.url') || undefined,
        date: get(markdown, 'data.date') || undefined,
        text: get(markdown, 'content') || undefined,
        isPartOf: blog.id,
      });
      await this.saveThing(post);
    }

    await this.copyAssets('images', 'medium');

    return;
  }
}
