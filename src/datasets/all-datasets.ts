import { Migrator } from '../shared/migrator.js';
import { ConferenceMigrator } from './conferences.js';

export class AllDatasetsMigrator extends Migrator {
  override async run() {
    await new ConferenceMigrator({ logger: this.log }).run();
  }
}
