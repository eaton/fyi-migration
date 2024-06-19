import { nanoid } from '@eatonfyi/ids';
import { KeynoteApp, type KeynoteDeck } from '@eatonfyi/keynote-extractor';
import { toSlug } from '@eatonfyi/text';
import { emptyDeep, set, unflatten } from 'obby';
import { z } from 'zod';
import { Talk, TalkEventSchema, TalkSchema } from '../schemas/talk.js';
import { Migrator, MigratorOptions } from '../shared/index.js';
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
  assets: '_static/talks',
  keynote: '/Users/jeff/Library/Mobile Documents/com~apple~Keynote/Documents',
  documentId: process.env.GOOGLE_SHEET_WORK,
  sheetName: 'talks',
};

export class TalkMigrator extends Migrator {
  declare options: TalkMigratorOptions;
  talks: CustomSchemaItem[] = [];

  constructor(options: TalkMigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async fillCache() {
    if (this.input.exists('talks.tsv')) {
      const data = this.input.read('talks.tsv', 'auto') as object[] | undefined;
      if (data) {
        this.talks = data.map(i => schema.parse(unflatten(i)));
      }
    } else if (this.options.documentId) {
      this.talks = await fetchGoogleSheet(this.options.documentId, this.options.sheetName, schema);
    }
    if (this.talks.length) {
      this.cache.write('podcast-episodes.ndjson', this.talks);
    }
    return;
  }

  override async readCache() {
    const data = this.cache.read('talks.ndjson', 'auto');
    if (data && Array.isArray(data)) {
      this.talks = data.map(i => schema.parse(i));
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
    for (const t of Object.values(this.talks)) {
      const file = this.makeFilename(t);
      const { text, ...frontmatter } = t;
      this.output.write(file, { content: text ?? '', data: frontmatter });
      this.log.debug(`Wrote ${file}`);
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

  protected prepTalkEvent(input: CustomSchemaItem) {
    return TalkEventSchema.parse({
      event: input.presentedAt,
      date: input.date,
      withTitle: input.name,
      isFeaturedVersion: input.feature,
      url: input.url
    });
  }

  protected async handleKeynote(input: CustomSchemaItem) {
    const id = input.id;
    const deck = input.keynoteFile;
    const isFeaturedVersion = input.feature;
    const event = input.presentedAt;
    await exportKeynoteFile()
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

const schema = z.object({
  id: z.string(),
  name: z.string(),
  date: z.coerce.date().optional(),
  presentedAt: z.string(),
  url: z.string().optional(),
  videoUrl: z.string().optional(),
  keynoteFile: z.string().optional(),
  pdf: z.string().optional(),
  feature: z.coerce.boolean().default(false),
});

type CustomSchemaItem = z.infer<typeof schema>;
