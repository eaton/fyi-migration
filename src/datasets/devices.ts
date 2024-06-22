import { Migrator, MigratorOptions } from '../shared/migrator.js'
import { fetchGoogleSheet } from '../util/fetch-google-sheet.js';
import { Device, DeviceSchema } from '../schemas/index.js';

export interface DeviceMigratorOptions extends MigratorOptions {
  documentId?: string;
  sheetName?: string;
}

const defaults: DeviceMigratorOptions = {
  name: 'devices',
  output: 'output/_data',
  description: 'Devices I have owned and used',
  documentId: process.env.GOOGLE_SHEET_DATASETS,
  sheetName: 'devices',
};


export class DeviceMigrator extends Migrator {
  declare options: DeviceMigratorOptions;
  devices: Device[] = [];

  constructor(options: DeviceMigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async cacheIsFilled() {
    return this.cache.exists('devices.ndjson') === 'file';
  }

  override async fillCache() {
    if (this.options.documentId) {
      const items = await fetchGoogleSheet(
        this.options.documentId,
        this.options.sheetName,
        DeviceSchema,
      );
      this.cache.write('devices.ndjson', items);
    }
    return;
  }

  override async readCache() {
    const data = this.cache.read('devices.ndjson', 'auto');

    if (data && Array.isArray(data)) {
      this.devices = data.map(e => DeviceSchema.parse(e));
    }
    return;
  }

  override async finalize() {
    await this.saveThings(this.devices);
    this.output.write('devices.ndjson', this.devices)
    return;
  }
}
