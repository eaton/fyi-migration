import jetpack from '@eatonfyi/fs-jetpack';
import {
  KeynoteApp,
  type KeynoteDeck,
  type KeynoteSlide,
} from '@eatonfyi/keynote-extractor';
import { unflatten } from 'obby';
import { z } from 'zod';
import {
  Talk,
  TalkEventSchema,
  TalkInstance,
  TalkSchema,
} from '../schemas/custom/talk.js';
import { getId, Migrator, MigratorOptions, toId } from '../shared/index.js';
import { fetchGoogleSheet } from '../util/fetch-google-sheet.js';

export interface TalkMigratorOptions extends MigratorOptions {
  documentId?: string;
  sheetName?: string;
  keynote?: string;
}

const defaults: TalkMigratorOptions = {
  input: 'input',
  cache: 'cache/talks',
  output: 'src/talks',
  assets: 'src/_static/talks',
  keynote: '/Users/jeff/Library/Mobile Documents/com~apple~Keynote/Documents',
  documentId: process.env.GOOGLE_SHEET_WORK,
  sheetName: 'talks',
};

export class TalkMigrator extends Migrator {
  declare options: TalkMigratorOptions;
  rawTalks: CustomSchemaItem[] = [];
  talks: Talk[] = [];
  decks: Record<string, Record<string, KeynoteDeck>> = {};
  protected _keynotes?: typeof jetpack;

  constructor(options: TalkMigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  get keynotes() {
    this._keynotes ??= jetpack.dir(this.options.keynote ?? '.');
    return this._keynotes;
  }

  override async fillCache() {
    // First load the raw talk data, including event mapping and keynote deck directories
    if (this.input.exists('talks.tsv')) {
      const data = this.input.read('talks.tsv', 'auto') as object[] | undefined;
      if (data) {
        this.rawTalks = data.map(i => schema.parse(unflatten(i)));
      }
    } else if (this.options.documentId) {
      this.rawTalks = await fetchGoogleSheet(
        this.options.documentId,
        this.options.sheetName,
        schema,
      );
      this.rawTalks = this.rawTalks.map(t => {
        t.id = toId('talk', t.id);
        return t;
      });
    }
    if (this.rawTalks.length) {
      this.cache.write('raw-talks.ndjson', this.rawTalks);
    }

    // We're not going to do a bunch of preprocessing here, but we will
    // break out the talk-versus-eventTalk distinction.
    const performances: Record<string, TalkInstance[]> = {};

    for (const rawTalk of this.rawTalks) {
      if (!performances[rawTalk.id]) {
        this.talks.push(this.prepTalk(rawTalk));
        performances[rawTalk.id] = [];
      }
      performances[rawTalk.id].push(this.prepTalkEvent(rawTalk));
    }

    for (const talk of this.talks) {
      talk.performances = performances[talk.id] ?? [];
    }
    this.cache.write('talks.ndjson', this.talks);

    // Finally we're going to actually do the keynote exports for each flagged
    // talk; it's time consuming and is absolutely a time to cache some shit.
    for (const talk of this.talks) {
      for (const performance of talk.performances ?? []) {
        await this.exportKeynoteFile(talk, performance);
        this.log.debug(
          `Exported deck for ${performance.withTitle} at ${performance.event}`,
        );
      }
    }

    return;
  }

  override async readCache() {
    if (this.talks.length === 0) {
      const data = this.cache.read('talks.ndjson', 'auto');
      if (data && Array.isArray(data)) {
        this.talks = data.map(i => TalkSchema.parse(i));
      }
    }

    if (Object.values(this.decks).length === 0) {
      this.decks = {};
      for (const talkId of this.cache.find({
        files: false,
        directories: true,
      })) {
        for (const eventId of this.cache
          .dir(talkId)
          .find({ files: false, directories: true })) {
          if (this.cache.dir(talkId).dir(eventId).exists('deck.json')) {
            const deck = this.cache
              .dir(talkId)
              .dir(eventId)
              .read('deck.json', 'auto') as KeynoteDeck | undefined;
            if (deck) {
              this.decks[talkId] ??= {};
              this.decks[talkId][eventId] = deck;
            }
          }
        }
      }
    }

    return;
  }

  override async finalize() {
    for (const talk of this.talks) {
      const timesPerformed = talk.performances?.length;
      const tKey = getId(talk.id);
      const canon = talk.performances?.find(
        p => p.isCanonicalVersion,
      );
      for (const perf of talk.performances ?? []) {
        const pKey = getId(perf.event);

        if (timesPerformed === 1 || perf.event === canon?.event) {
          talk.name = perf.withTitle;
          talk.date = perf.date;

          // If there's a deck for the talk, copy over its supporting assets and generate
          // the talk's markdown text from the slide notes.
          if (this.decks[tKey]) {
            const deck = this.decks[tKey][pKey];
            if (deck && deck.slides) {
              talk.text = this.keynoteToMarkdown(talk, deck.slides);
            }
            this.cache
              .dir(tKey)
              .dir(pKey)
              .copy('.', this.assets.dir(tKey).path(), { overwrite: true });
          }
          await this.saveThing(talk);
        }

        const rel = {
          rel: 'performedAt',
          name: perf.withTitle,
          date: perf.date,
          recording: perf.recording,
          description: perf.description,
          url: perf.url,
        };

        await this.linkThings(talk, toId('event', perf.event), rel);
      }
    }
    return;
  }

  protected prepTalk(input: CustomSchemaItem): Talk {
    const t = TalkSchema.parse({ id: input.id });
    return t;
  }

  protected prepTalkEvent(input: CustomSchemaItem) {
    return TalkEventSchema.parse({
      event: toId('event', input.presentedAt),
      date: input.date,
      withTitle: input.name,
      isCanonicalVersion: input.canonical,
      url: input.url,
      recording: input.recording,
      pdf: input.pdf,
      keynoteFile: input.keynote,
    });
  }

  protected async exportKeynoteFile(talk: Talk, performance: TalkInstance) {
    if (!performance.keynoteFile) return;
    if (!this.keynotes.exists(performance.keynoteFile)) return;

    const talkId = getId(talk.id);
    const performanceId = getId(performance.event);

    const deckDir = this.cache.dir(talkId).dir(performanceId);
    if (deckDir.exists('deck.json')) return;

    const path = deckDir.path();
    const app = await KeynoteApp.open(
      this.keynotes.path(performance.keynoteFile),
    );

    // Generate a JSON file with presentation metadata, and title / body / notes
    // text for each slide. Most of it is trash but in some cases things are
    // structured such that we can use it.
    await app.export({ format: 'JSON with images', path });

    // Generate a standard Keynote PDF export
    await app.export({
      format: 'PDF',
      exportStyle: 'IndividualSlides',
      pdfImageQuality: 'Better',
      path,
    });

    // Generate a standard Keynote PDF export
    await app.export({
      format: 'PDF',
      exportStyle: 'IndividualSlides',
      pdfImageQuality: 'Better',
      allStages: true,
      path,
    });

    // Generate slide-by-slide images
    await app.export({
      format: 'slide images',
      allStages: true,
      exportStyle: 'IndividualSlides',
      path,
    });

    // Generate an mp4 video of the presentation, including all transitions and
    // animations. It will be enormous and annoying, and export options can't be
    // controlled via the Applescript call.
    // However, when there slides we need animated data from, it's handy.

    await app.export({
      format: 'QuickTime movie',
      movieFormat: 'format720p',
      movieFramerate: 'FPS12',
      movieCodec: 'h264',
      path,
    });

    await app.close();
    return;
  }

  keynoteToMarkdown(
    talk: Talk,
    slides: KeynoteSlide[],
    includeSkipped = false,
    useTitles = true,
  ) {
    const markdown = slides
      .map(slide => {
        const text: string[] = [];
        if (slide.skipped === false || (slide.skipped && includeSkipped)) {
          if (useTitles && slide.title.trim().length)
            text.push('## ' + slide.title.replaceAll(/[\s\n]/g, ' '));
          text.push(`![Slide ${slide.number}](${fixImage(slide.image ?? '')})`);
          text.push(slide.notes);
        }
        return text.join('\n\n');
      })
      .filter(s => s.trim().length)
      .join('\n\n---\n\n');

    return markdown;
    
    function fixImage(input: string) {
      return input.replace('./images/', `media://talks/${getId(talk.id)}/`);
    }
  }
}

const schema = z.object({
  id: z.string(),
  name: z.string(),
  date: z.coerce.date().optional(),
  presentedAt: z.string(),
  url: z.string().optional(),
  keynote: z.string().optional(),
  recording: z.string().optional(),
  pdf: z.string().optional(),
  canonical: z.coerce.boolean().default(false),
  featured: z.coerce.boolean().default(false),
});

type CustomSchemaItem = z.infer<typeof schema>;
