import { get } from 'obby';
import { CreativeWorkSchema } from '../schemas/creative-work.js';
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
    this.data.bucket('things').set(
      'medium',
      CreativeWorkSchema.parse({
        type: 'Blog',
        id: 'medium',
        name: 'Medium',
        url: 'https://medium.com/@eaton',
        hosting: 'Medium',
      }),
    );

    for (const f of this.input.find({ matching: 'posts/*.md' })) {
      const markdown = this.input.read(f, 'auto');
      const { text, ...frontmatter } = CreativeWorkSchema.parse({
        type: 'BlogPosting',
        id: get(markdown, 'data.id') || undefined,
        name: get(markdown, 'data.title') || undefined,
        description: get(markdown, 'data.summary') || undefined,
        slug: get(markdown, 'data.slug') || undefined,
        image: get(markdown, 'data.image') || undefined,
        url: get(markdown, 'data.url') || undefined,
        date: get(markdown, 'data.date') || undefined,
        text: get(markdown, 'content') || undefined,
        isPartOf: this.name,
      });

      const file = this.makeFilename(frontmatter);
      this.output.write(file, { content: text, data: frontmatter });
      if (this.options.store == 'arango') {
        await this.arango.set({ ...frontmatter, text });
      }
    }

    await this.copyAssets('images', 'medium');

    return;
  }
}
