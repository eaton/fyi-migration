// Read 'talks' tsv file, create a talk record for each one
// Create an 'appearance' for each time a talk was presented
// export Keynote data for flagged talks

import { Migrator, MigratorOptions } from "../shared/index.js";
import { KeynoteApp, KeynoteExportOptions } from '@eatonfyi/keynote-extractor';

export interface TalkMigratorOptions extends MigratorOptions {

};

const defaults: TalkMigratorOptions = {

};

export class TalkMigrator extends MigratorOptions {
  
}