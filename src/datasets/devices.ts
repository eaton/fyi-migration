import { Migrator, MigratorOptions } from '../shared/migrator.js'
import { fetchGoogleSheet } from '../util/fetch-google-sheet.js';
import { Device, DeviceSchema } from '../schemas/index.js';

// This is very much in progress; unit conversions and such will need to be done.
// in particular the 'connection speed' property will need to be split into modem,
// wireless, and wired.

// https://tripplite.eaton.com/products/ethernet-cable-types has ethernet connection speeds
// https://www.wiisfi.com has wifi standard speeds
// https://www.gbmb.org/mbps-to-kbs has a handy-dandy converter

// 2,000kbps is the standard speed for Cat5 ethernet
// 125,00kbps is the standard speed for Cat5 ethernet
// 128,000kbps is the standard speed for Cat6 ethernet

// Raw speed needs to be calculated with some creativity; the wide variation in
// processor families makes it a real hell of a thing.

export interface DeviceMigratorOptions extends MigratorOptions {
  documentId?: string;
  sheetName?: string;
}

const defaults: DeviceMigratorOptions = {
  name: 'devices',
  output: 'src/_data',
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
