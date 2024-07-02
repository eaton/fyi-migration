import { Migrator } from './shared/migrator.js';

import { AllWorkMigrator } from './work/all-work.js';

export class MigrateEverything extends Migrator {
  override async run() {
    await this.arango.initialize();
    await this.arango.reset(() => Promise.resolve(true));

    await new AllWorkMigrator({ logger: this.log }).run();
    return;
  }
}

await new MigrateEverything({ logger: { level: 'debug' } }).run();
