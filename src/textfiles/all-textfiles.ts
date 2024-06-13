import { Migrator } from '../shared/migrator.js';
import { TextEmailMigrator } from './email.js';
import { TextJournalsMigrator } from './journals.js';
import { TextFictionMigrator } from './fiction.js';

export class AllTextFilesMigrator extends Migrator {
  override async run() {
    await new TextJournalsMigrator({ logger: this.log }).run();
    await new TextFictionMigrator({ logger: this.log }).run();
    await new TextEmailMigrator({ logger: this.log }).run();
    return;
  }
}
