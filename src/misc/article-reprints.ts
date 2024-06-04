import { Migrator, MigratorOptions } from '../shared/migrator.js';
import { ArticleSchema, Article } from '../schemas/article.js';
import { OrganizationSchema, Organization } from '../schemas/organization.js';
import { Frontmatter } from '@eatonfyi/serializers';

const defaults: MigratorOptions = {
  name: 'articles',
  description: 'Article reprints',
  input: 'input/articles',
  output: 'src/articles',
};

export class ArticleReprintMigrator extends Migrator {
  articles: Article[] = [];
  publishers: Record<string, Organization> = {};

  constructor(options: MigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async readCache(){
    const parser = new Frontmatter();
    for (const f of this.input.find({ matching: 'reprints/**/*.md' })) {
      const raw = this.input.read(f, 'utf8');
      if (!raw) continue;
      const markdown = parser.parse(raw);

      const article = ArticleSchema.parse({
        id: '',
        name: '',
        headline: '',
        description: '',
        section: '',
        publisher: '',
      })
    }
  }

  override async finalize(): Promise<void> {
    this.log.debug('Copying article reprints');
    this.input.copy(this.input.path('reprints'), this.output.path(), {
      overwrite: true,
    });
    await this.copyAssets('images', 'reprints');
  }
}
