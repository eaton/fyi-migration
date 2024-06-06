import { ExtractTemplateObject, extract, toMarkdown } from '@eatonfyi/html';
import { z } from 'zod';
import { CreativeWorkSchema } from '../schemas/creative-work.js';
import { BlogMigrator, BlogMigratorOptions } from './blog-migrator.js';

const defaults: BlogMigratorOptions = {
  name: 'futurism',
  label: 'Futurism',
  description: 'Projection, speculation, and connecting the dots.',
  input: 'input/blogs/futurism',
  output: 'src/entries/futurism',
};

export class FuturismMigrator extends BlogMigrator {
  constructor(options: BlogMigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async finalize() {
    for (const f of this.input.find({ matching: '*.html' })) {
      const html = this.input.read(f) ?? '';
      const parsed = await extract(html, template, schema);

      const { text, ...frontmatter } = CreativeWorkSchema.parse({
        type: 'BlogPosting',
        id: 'tp-' + parsed.id,
        name: parsed.name.trim(),
        date: parsed.date,
        text: toMarkdown(parsed.text),
        isPartOf: 'futurism',
      });

      const file = this.makeFilename(frontmatter);
      this.output.write(file, { content: text, data: frontmatter });
      this.log.debug(`'Wrote ${file}`);
    }

    this.data.bucket('things').set(
      this.name,
      CreativeWorkSchema.parse({
        type: 'Blog',
        id: this.name,
        name: this.label,
        description: this.description,
        url: 'http://future.viapositiva.net',
        hosting: 'TypePad',
      }),
    );

    return;
  }
}

const template: ExtractTemplateObject = {
  id: 'div.content > a:nth-child(1) | attr:id',
  name: 'div.content > h3',
  text: 'div.content > :not(h3,p.posted) | html',
  date: 'div.content > p.posted',
};

const schema = z.object({
  id: z.string(),
  name: z.string(),
  text: z.string(),
  date: z.string().transform(s => s.split('|')[0].split(' on ').pop()?.trim()),
});
