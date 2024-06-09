// Read 'talks' tsv file, create a talk record for each one
// Create an 'appearance' for each time a talk was presented
// export Keynote data for flagged talks

import { nanoid } from '@eatonfyi/ids';
import { KeynoteApp, type KeynoteDeck } from '@eatonfyi/keynote-extractor';
import { toSlug } from '@eatonfyi/text';
import { emptyDeep, set, unflatten } from 'obby';
import { z } from 'zod';
import { Event, EventSchema } from '../schemas/event.js';
import { Place, PlaceSchema } from '../schemas/place.js';
import { Talk, TalkSchema } from '../schemas/talk.js';
import { Migrator, MigratorOptions } from '../shared/index.js';

export interface TalkMigratorOptions extends MigratorOptions {
  googleSheetsUrl?: string;
}

const defaults: TalkMigratorOptions = {
  input: 'input/datasets',
  cache: 'cache/talks',
  output: 'src/talks',
  assets: '_static/talks',
};

export class TalkMigrator extends Migrator {
  declare options: TalkMigratorOptions;
  talks: Record<string, Talk> = {};
  events: Record<string, Event> = {};
  places: Record<string, Place> = {};

  constructor(options: TalkMigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async fillCache() {
    const raw =
      (this.input.read('talks.tsv', 'auto') as
        | Record<string, unknown>[]
        | undefined) ?? [];
    const unflattened = raw.map(i => emptyDeep(unflatten(i)));
    const parsed = unflattened.map(i => customSchema.parse(i));
    this.cache.write('talks.ndjson', parsed);
    this.log.debug(`Wrote talk index cache`);

    for (const talk of parsed.filter(t => t.keynoteFile !== undefined)) {
      if (this.cache.exists(talk.id) === 'dir') {
        this.log.debug(`Skipping export for ${talk.id}; already cached`);
      } else {
        await this.exportKeynoteFile(talk.id, talk.keynoteFile!);
        this.log.debug(`Cached Keynote slides for ${talk.id}`);
      }
    }

    return;
  }

  override async readCache() {
    const data =
      (this.cache.read('talks.ndjson', 'auto') as Record<string, unknown>[]) ??
      [];
    const rawTalks = data.map(t => customSchema.parse(t));
    for (const t of rawTalks) {
      // For now, let's use `date: yyyy-MM-dd` to store the first time the talk was given,
      // and `dates[eventId]: yyyy-MM-dd to store the individual places it was presented
      // at. That means we can ONLY store the date at the intersection, but for now, meh

      const tmpTalk = this.prepTalk(t);
      const tmpEvent = this.prepEvent(t);
      const tmpPlace = this.prepPlace(t);

      const talkId = tmpTalk.id;
      const eventId = tmpEvent?.id;
      const placeId = tmpPlace?.id;

      if (placeId) {
        this.places[placeId] ??= tmpPlace;
      }

      if (eventId) {
        this.events[eventId] ??= tmpEvent;
        set(this.events[eventId], 'places.venue', placeId);
      }

      if (talkId) {
        this.talks[talkId] ??= tmpTalk;
        set(this.talks[talkId], `dates.${eventId}`, tmpTalk.date);
      }
    }

    return;
  }

  override async process() {
    for (const talk of Object.values(this.talks)) {
      if (this.cache.dir(talk.id).exists('slides.json')) {
        const deck = this.cache
          .dir(talk.id)
          .read('slides.json', 'auto') as KeynoteDeck;
        const deckText: string[] = [];
        for (const slide of deck.slides) {
          const slideText = [
            `![Slide ${slide.number}](${slide.image})`,
            `### ${slide.title?.replaceAll('\n', ' ')}`,
            slide.notes ?? slide.body,
          ].join('\n\n');
          deckText.push(slideText);
        }
        talk.text = deckText.join('\n\n---\n\n');
      }
    }
    return;
  }

  override async finalize() {
    const placeStore = this.data.bucket('places');
    const eventStore = this.data.bucket('events');

    for (const t of Object.values(this.talks)) {
      const file = this.makeFilename(t);
      const { text, ...frontmatter } = t;
      this.output.write(file, { content: text ?? '', data: frontmatter });
      this.log.debug(`Wrote ${file}`);
    }

    for (const e of Object.values(this.events)) {
      eventStore.set(e);
      this.log.debug(`Wrote ${e.name}`);
    }

    for (const p of Object.values(this.places)) {
      placeStore.set(p);
      this.log.debug(`Wrote ${p.name}`);
    }

    return;
  }

  protected prepTalk(input: CustomSchemaItem): Talk {
    const t = TalkSchema.parse({
      id: input.id,
      name: input.name,
    });
    return t;
  }

  protected prepEvent(input: CustomSchemaItem): Event | undefined {
    if (input.event === undefined) {
      return undefined;
    }
    const e = EventSchema.parse({
      id: input.event.id,
      name: input.event.name,
      dates: input.event.dates,
    });
    return e;
  }

  protected prepPlace(input: CustomSchemaItem): Place | undefined {
    if (input.event?.city === undefined && input.event?.country === undefined) {
      return undefined;
    }
    const p = PlaceSchema.parse({
      id: nanoid(),
      name: input.event.city ?? input.event.country ?? 'Online',
      isPartOf: input.event?.country ? toSlug(input.event?.country) : undefined,
      isVirtual:
        !emptyDeep([input.event.city, input.event.country]) ?? undefined,
    });
    p.id = toSlug([p.name, p.isPartOf].filter(p => !!p).join(', '));

    return p;
  }

  protected async exportKeynoteFile(id: string, path: string) {
    if (!this.input.exists(path)) return;

    const app = await KeynoteApp.open(path);

    // Generate a JSON file with presentation metadata, and title/body/notes text
    // for each slide
    await app.export({ format: 'JSON with images', path: this.cache.path(id) });

    // Generate a standard Keynote PDF export
    await app.export({
      format: 'PDF',
      exportStyle: 'IndividualSlides',
      pdfImageQuality: 'Better',
      path: this.cache.path(id),
    });

    // Generate slide-by-slide images
    await app.export({
      format: 'slide images',
      allStages: true,
      exportStyle: 'IndividualSlides',
      path: this.cache.path(id),
    });

    // Generate an mp4 video of the presentation, including all transitions and
    // animations. It will be enormous and annoying, and export options can't be
    // controlled via the Applescript call.
    await app.export({
      format: 'QuickTime movie',
      movieFormat: 'format720p',
      movieFramerate: 'FPS12',
      movieCodec: 'h264',
      path: this.cache.path(id),
    });

    await app.close();
    return;
  }
}

const customSchema = z.object({
  id: z.string(),
  name: z.string(),
  date: z.coerce.date().optional(),
  event: z
    .object({
      id: z.string().optional(),
      name: z.string().optional(),
      url: z.string().optional(),
      city: z.string().optional(),
      country: z.string().optional(),
      dates: z
        .object({
          start: z.coerce.date().optional(),
          end: z.coerce.date().optional(),
        })
        .optional(),
    })
    .optional(),

  url: z.string().optional(),
  videoUrl: z.string().optional(),
  keynoteFile: z.string().optional(),
  feature: z.coerce.boolean().default(false),
});

type CustomSchemaItem = z.infer<typeof customSchema>;
