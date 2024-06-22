import { Migrator } from '../shared/migrator.js';
import { ConferenceMigrator } from './conferences.js';
import { DeviceMigrator } from './devices.js';

export class AllDatasetsMigrator extends Migrator {
  override async run() {
    await new ConferenceMigrator({ logger: this.log }).run();
    await new DeviceMigrator({ logger: this.log }).run();
    return;
  }
}
