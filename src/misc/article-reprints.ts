import { nanohash } from '@eatonfyi/ids';
import { Frontmatter } from '@eatonfyi/serializers';
import { toSlug } from '@eatonfyi/text';
import { Article, ArticleSchema } from '../schemas/article.js';
import { OrganizationSchema } from '../schemas/index.js';
import { Migrator, MigratorOptions } from '../shared/migrator.js';
import { toFilename } from '../util/to-filename.js';

const defaults: MigratorOptions = {
  name: 'articles',
  description: 'Article reprints',
  input: 'input/articles',
  output: 'src/articles',
};

export class ArticleReprintMigrator extends Migrator {
  articles: Article[] = [];

  constructor(options: MigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async readCache() {
    const parser = new Frontmatter();
    for (const f of this.input.find({ matching: 'reprints/**/*.md' })) {
      const raw = this.input.read(f, 'utf8');
      if (!raw) continue;
      const markdown = parser.parse(raw);
      const slug = toSlug(markdown.data.title) ?? nanohash(markdown.data);
      const headline =
        markdown.data.headline ?? markdown.data.subtitle
          ? markdown.data.title + ': ' + markdown.data.subtitle
          : undefined;
      const article = ArticleSchema.parse({
        id: `re-${slug}`,
        slug,
        name: markdown.data.title,
        headline,
        section: markdown.data.section,
        description: markdown.data.summary,
        publisher: markdown.data.publisher,
        about: markdown.data.about,
        url: markdown.data.url,
        archivedAt: markdown.data.archivedAt,
        text: markdown.content,
      });

      this.articles.push(article);
    }
  }

  override async finalize(): Promise<void> {
    for (const { text, ...frontmatter } of this.articles) {
      const file = toFilename(frontmatter);
      this.output.write(file, { content: text, data: frontmatter });
      this.log.debug(`Wrote ${file}`);
    }
    await this.copyAssets('images', 'articles');
  }

  protected savePublishers() {
    const orgStore = this.data.bucket('things');

    orgStore.set(
      'lullabot',
      OrganizationSchema.parse({
        id: 'lullabot',
        name: 'Lullabot',
        url: 'https://lullabot.com',
      }),
    );

    orgStore.set(
      'robis',
      OrganizationSchema.parse({
        id: 'robis',
        name: 'Robis Marketing',
        url: 'https://robis.net',
      }),
    );

    orgStore.set(
      'img',
      OrganizationSchema.parse({
        id: 'img',
        name: 'Inside Mac Games',
        url: 'https://www.insidemacgames.com/historical/archives/index.html',
      }),
    );

    orgStore.set(
      'eclipse-svc',
      OrganizationSchema.parse({
        id: 'eclipse-svc',
        name: 'Eclipse Services',
        url: 'https://www.eclipseservices.com/',
      }),
    );

    orgStore.set(
      'mac-action',
      OrganizationSchema.parse({
        id: 'mac-action',
        name: 'Mac Action Magazine',
        url: 'https://www.cix.co.uk/~macaction/',
      }),
    );

    orgStore.set(
      'pastrybox',
      OrganizationSchema.parse({
        id: 'pastrybox',
        name: 'The Pastry Box',
        url: 'https://the-pastry-box-project.net/',
      }),
    );
  }
}
