import { toCase } from '@eatonfyi/text';
import { z } from 'zod';
import { urlSchema } from '../schemas/fragments/index.js';
import { Event, EventSchema } from '../schemas/schema-org/event.js';
import { Place, PlaceSchema } from '../schemas/schema-org/place.js';
import { Migrator, MigratorOptions } from '../shared/index.js';
import { fetchGoogleSheet } from '../util/fetch-google-sheet.js';

export interface ConferenceMigratorOptions extends MigratorOptions {
  documentId?: string;
  sheetName?: string;
}

const defaults: ConferenceMigratorOptions = {
  name: 'conferences',
  description: 'Conference dates, locations, and attendance over time',
  documentId: process.env.GOOGLE_SHEET_DATASETS,
  sheetName: 'conferences',
};

export class ConferenceMigrator extends Migrator {
  declare options: ConferenceMigratorOptions;

  places: Place[] = [];
  series: Event[] = [];
  events: Event[] = [];

  constructor(options: ConferenceMigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async cacheIsFilled() {
    return this.cache.exists('conferences.ndjson') === 'file';
  }

  override async fillCache() {
    if (this.options.documentId) {
      const items = await fetchGoogleSheet(
        this.options.documentId,
        this.options.sheetName,
        schema,
      );
      this.cache.write('conferences.ndjson', items);
    }
    return;
  }

  override async readCache() {
    const data = this.cache.read('conferences.ndjson', 'auto');

    if (data && Array.isArray(data)) {
      const events = data.map(e => schema.parse(e));
      for (const e of events) {
        const event = this.prepEvent(e);
        const place = this.prepPlace(e);
        const series = this.prepSeries(e);

        this.events.push(event);
        if (series) this.series.push(series);
        if (place) this.places.push(place);
      }
    }
    return;
  }

  override async finalize() {
    await this.saveThings(this.series);
    await this.saveThings(this.events);
    await this.saveThings(this.places);
    return;
  }

  prepEvent(item: ImportType) {
    return EventSchema.parse({
      id: 'event:' + item.id,
      isPartOf: 'event:' + item.isPartOf,
      name: item.name,
      url: item.url,
      location: item.place.id,
      date: item.dates?.start,
      dates: item.dates,
      attendees: item.attendees,
    });
  }

  prepSeries(item: ImportType) {
    if (item.isPartOf) {
      return EventSchema.parse({
        id: 'event:' + item.isPartOf,
        type: 'EventSeries',
        name: toCase.title(item.isPartOf),
      });
    } else {
      return undefined;
    }
  }

  prepPlace(item: ImportType) {
    if (item.place.name) {
      return PlaceSchema.parse({
        id: 'place:' + item.place.id,
        isPartOf: item.place.isPartOf ? 'place:' + item.place.isPartOf : undefined,
        name: item.place.name,
      });
    } else {
      return undefined;
    }
  }
}

const schema = z.object({
  id: z.string().optional(),
  name: z.string(),
  isPartOf: z.string().optional(),
  place: z.object({
    id: z.string(),
    name: z.string().optional(),
    isPartOf: z.string().optional(),
  }),
  dates: z
    .object({
      start: z.coerce.date().optional(),
      end: z.coerce.date().optional(),
    })
    .optional(),
  url: urlSchema.optional(),
  attendees: z.coerce.number().optional(),
});

type ImportType = z.infer<typeof schema>;
