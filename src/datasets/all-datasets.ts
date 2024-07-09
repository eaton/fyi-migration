import { Migrator, MigratorOptions } from '../shared/migrator.js';
import { ConferenceMigrator } from './conferences.js';
import { DeviceMigrator } from './devices.js';

const defaults: MigratorOptions = {
  name: 'datasets',
  input: 'input/datasets',
  output: 'src/_data',
};

export class AllDatasetsMigrator extends Migrator {
  constructor(options: MigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async run() {
    await new ConferenceMigrator({ logger: this.log }).run();
    await new DeviceMigrator({ logger: this.log }).run();

    const raw = [
      'email-month.tsv',
      'email-week.tsv',
      'iphone-photos.csv',
      'travel.tsv',
      'twitter-engagement.tsv',
    ];
    for (const file of raw) {
      this.input.copy(file, this.output.path(file), { overwrite: true });
    }
    return;
  }
}
