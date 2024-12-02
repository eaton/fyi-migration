import { BookMigrator } from '../books/books.js';
import { Migrator } from '../shared/migrator.js';

export class MigrateEverything extends Migrator {
  override async run() {
    await this.arango.initialize();
    await new BookMigrator({ logger: this.log }).run();
    return;
  }
}

await new MigrateEverything({ logger: { level: 'debug' } }).run();
