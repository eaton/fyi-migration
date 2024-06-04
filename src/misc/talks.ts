// Read 'talks' tsv file, create a talk record for each one
// Create an 'appearance' for each time a talk was presented
// export Keynote data for flagged talks

import { MigratorOptions } from '../shared/index.js';

export interface TalkMigratorOptions extends MigratorOptions {}

const defaults: TalkMigratorOptions = {};

export class TalkMigrator extends MigratorOptions {}
