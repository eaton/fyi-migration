import { Migrator, MigratorOptions } from '../util/migrator.js';

const defaults: MigratorOptions = {
  name: 'articles',
  description: 'Article reprints',
  input: 'input/articles',
  output: 'src/articles',
};

export class ArticleReprintMigrator extends Migrator {
  constructor(options: MigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async finalize(): Promise<void> {
    this.log.debug('Copying article reprints');
    this.input.copy(this.input.path('reprints'), this.output.path(), {
      overwrite: true,
    });
    await this.copyAssets('images', 'reprints');
  }
}
