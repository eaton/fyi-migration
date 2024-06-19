import { KeynoteApp, KeynoteSlide, type KeynoteDeck } from '@eatonfyi/keynote-extractor';
import { unflatten } from 'obby';
import { z } from 'zod';
import { Talk, TalkEventSchema, TalkInstance, TalkSchema } from '../schemas/talk.js';
import { Migrator, MigratorOptions } from '../shared/index.js';
import { fetchGoogleSheet } from '../util/fetch-google-sheet.js';
import jetpack from '@eatonfyi/fs-jetpack';

export interface TalkMigratorOptions extends MigratorOptions {
  documentId?: string;
  sheetName?: string;
  keynote?: string;
}

const defaults: TalkMigratorOptions = {
  input: 'input',
  cache: 'cache/talks',
  output: 'src/talks',
  assets: '_static/talks',
  keynote: '/Users/jeff/Library/Mobile Documents/com~apple~Keynote/Documents',
  documentId: process.env.GOOGLE_SHEET_WORK,
  sheetName: 'talks',
};

export class TalkMigrator extends Migrator {
  declare options: TalkMigratorOptions;
  rawTalks: CustomSchemaItem[] = [];
  talks: Talk[] = []
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
      this.rawTalks = await fetchGoogleSheet(this.options.documentId, this.options.sheetName, schema);
    }
    if (this.rawTalks.length) {
      this.cache.write('raw-talks.ndjson', this.rawTalks);
    }

    // We're not going to do a bunch of preprocessing here, but we will
    // break out the talk-versus-eventTalk distinction.
    const performances: Record<string, TalkInstance[]> = {};

    for (const rawTalk of this.rawTalks) {
      this.talks.push(this.prepTalk(rawTalk));
      performances[rawTalk.id] ??= [];
      performances[rawTalk.id].push(this.prepTalkEvent(rawTalk));
    }

    for (const talk of this.talks) {
      talk.performances = performances[talk.id] ?? [];
    }
    this.cache.write('talks.ndjson', this.rawTalks);


    // Finally we're going to actually do the keynote exports for each flagged
    // talk; it's time consuming and is absolutely a time to cache some shit.
    for (const talk of this.talks) {
      for (const performance of talk.performances ?? []) {
        await this.exportKeynoteFile(talk, performance);
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
    return;
  }

  override async process() {
    for (const talk of this.talks) {
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
    // So, uhhhh, not actually doing anything here yet.
    return;
  }

  protected prepTalk(input: CustomSchemaItem): Talk {
    const t = TalkSchema.parse({ id: input.id });
    return t;
  }

  protected prepTalkEvent(input: CustomSchemaItem) {
    return TalkEventSchema.parse({
      event: input.presentedAt,
      date: input.date,
      withTitle: input.name,
      isFeaturedVersion: input.featured,
      url: input.url,
      recording: input.recording,
      pdf: input.pdf,
      keynoteFile: input.keynote
    });
  }

  protected async exportKeynoteFile(talk: Talk, performance: TalkInstance) {
    if (!performance.keynoteFile) return;
    if (!this.keynotes.exists(performance.keynoteFile)) return;
    
    const app = await KeynoteApp.open(performance.keynoteFile);
    const path = this.cache.dir(talk.id).dir(performance.event).path()

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
    //
    // However, when there slides we need animated data from, it's handy. 
    
    await app.export({
      format: 'QuickTime movie',
      movieFormat: 'format720p',
      movieFramerate: 'FPS12',
      movieCodec: 'h264',
      path,
    });

    await app.close();
  }

  keynoteToMarkdown(slides: KeynoteSlide[]) {
    // media://talks/id/perf/whatever.jpg
    // loop through slides, make [image \n notes].join('\n\n---\n\n')
    // return resulting text
  
    return slides.map(slide => `![Slide ${slide.number}](slide.image)\n\n${slide.notes}`).join('\n\n---\n\n');
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
  featured: z.coerce.boolean().default(false),
});

type CustomSchemaItem = z.infer<typeof schema>;
