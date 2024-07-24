import { isEmpty } from 'emptier';
import { z } from 'zod';
import { fetchGoogleSheet } from '../util/fetch-google-sheet.js';
import { Migrator, MigratorOptions } from './migrator.js';

export interface SheetMigratorOptions extends MigratorOptions {
  /**
   * The DocumentID of a publicly accessible Google Docs spreadsheet
   */
  documentId?: string;

  /**
   * The name of the specific sheet in the Google Docs spreadsheet to import
   */
  sheetName?: string;

  /**
   * An optional Zod schema used to parse *individual rows* of the sheet
   */
  schema?: z.ZodTypeAny;
}

const defaults: SheetMigratorOptions = {};

export class SheetMigrator extends Migrator {
  declare options: SheetMigratorOptions;

  constructor(options: SheetMigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async cacheIsFilled() {
    return this.cache.exists(this.name + '.ndjson') === 'file';
  }

  override async fillCache() {
    if (this.options.documentId) {
      const items = await fetchGoogleSheet(
        this.options.documentId,
        this.options.sheetName,
        this.options.schema,
      );
      if (!isEmpty(items)) {
        this.cache.write(this.name + '.ndjson', items);
      }
    }
    return;
  }
}
