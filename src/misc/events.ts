import { z } from 'zod';
import { unflatten } from 'obby';
import { MigratorOptions, Migrator } from '../shared/index.js';
import { Talk } from '../schemas/talk.js';
import { Event } from '../schemas/event.js';
import { Place } from '../schemas/place.js';

export interface EventMigratorOptions extends MigratorOptions {
  googleSheetsUrl?: string,
}

const defaults: EventMigratorOptions = {
  name: '',
  label: '',
  output: 'src/events'
};

export class EventMigrator extends Migrator {
  declare options: EventMigratorOptions;

  constructor(options: EventMigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async fillCache() {
    const raw = this.input.read('drupalcons.tsv', 'auto') as Record<string, unknown>[] | undefined ?? [];
    const parsed = raw.map(i => customSchema.parse(unflatten(i)));
    this.cache.write('drupalcons.ndjson', parsed);
  }

  override async readCache() {
    const data = this.cache.read('drupalcons.ndjson', 'auto') as Record<string, unknown>[] ?? [];
    const rawTalks = data.map(t => customSchema.parse(t));
    for (const t of rawTalks) {
      // We use `date: yyyy-MM-dd` to store the first time the talk was given,
      // and `dates[eventId]: yyyy-MM-dd to store the individual places it was
      // presented at.
    }
  }

  protected prepTalk(input: CustomSchemaItem): Talk {
    const rawEvent = input.event;
  }

  protected prepEvent(input: CustomSchemaItem): Event {
  }

  protected prepPlace(input: CustomSchemaItem): Place {
  }
}

const customSchema = z.object({
  id: z.string(),
  name: z.string(),
  dates: z.record(z.coerce.date()).optional(),
});

type CustomSchemaItem = z.infer<typeof customSchema>;