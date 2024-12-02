import { aql } from 'arangojs';
import 'dotenv/config';
import ollama from 'ollama';
import { ArangoDB } from '../shared/arango.js';

export interface SummarizerOptions {
  model?: string;
  titlePrompt?: string;
  summaryPrompt?: string;
}

const defaults: Required<SummarizerOptions> = {
  model: 'llama3.1',
  titlePrompt:
    'Summarize the following text in a single phrase, using the voice and tone of the text itself. ONLY reply with the summary itself, do not explain your reasoning or offer any other comments.\n\n',
  summaryPrompt:
    'You are the author of a blog reviewing a post before publishing it. When provided with text, you will write an 2-3 sentence summary of the post written in the first-person voice that describes its key themes. ONLY reply with the summary itself, do not explain your reasoning or offer any other comments.',
};

export class ThingSummarizer {
  opt: Required<SummarizerOptions>;
  arango: ArangoDB;

  constructor(options: SummarizerOptions = {}) {
    this.opt = { ...defaults, ...options };
    this.arango = new ArangoDB();
  }

  async runQuery() {
    const collection = this.arango.collection('works');
    const q = aql`FOR w in ${collection}
    FILTER w.type == 'SocialMediaThread'
    FILTER w.name == null || w.description == null
    FILTER w.text != null
    LIMIT 100

    RETURN {
      id: w._key,
      type: w.type,
      date: w.date,
      text: w.text,
    }`;

    const items = await this.arango.query(q).then(cursor => cursor.all());
    for (const i of items) {
      const title = await ollama.generate({
        model: this.opt.model,
        system: this.opt.titlePrompt,
        prompt: i.text,
      });
      //const summary = await ollama.generate({
      //  model: this.opt.model,
      //  system: this.opt.summaryPrompt,
      //  prompt: i.text
      //});

      console.log('---');
      console.log(i.date, title.response);
      //console.log(summary.response);
    }
  }
}

await new ThingSummarizer().runQuery();
