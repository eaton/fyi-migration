import { Migrator, MigratorOptions } from '../shared/migrator.js';
import { Message, MessageSchema } from '../schemas/message.js';
import { AddressObject, MboxStreamer } from "@eatonfyi/mbox-streamer";
import { nanohash } from '@eatonfyi/ids';
import { toFilename } from '../util/to-filename.js';

const defaults: MigratorOptions = {
  name: 'txt-email',
  label: 'Email drifting through the ether',
  input: 'input/textfiles/email',
  output: 'src/txt/email'
};

export class TextEmailMigrator extends Migrator {
  stories: Message[] = [];

  constructor(options: MigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  // For the moment, we'll just look for .eml and .txt files to parse;
  // Down the line we'll dig into .mbox files and use specific criteria
  // to choose what stuff is included.

  override async finalize() {
    for (const f of this.input.find({ matching: '*.txt'}) ?? []) {
      const mbs = new MboxStreamer();
      mbs.on('message', message => {
        const email = MessageSchema.parse({
          id: 'msg-' + nanohash(message.headerLines),
          name: message.subject,
          date: message.date,
          creator: this.cleanMails(message.from),
          to: this.cleanMails(message.to),
          cc: this.cleanMails(message.cc),
          bcc: this.cleanMails(message.bcc),
          replyTo: message.replyTo?.text,
          attachments: message.attachments.map(a => a.filename),
          text: message.text,
        });
        const file = toFilename(email);
        if (file === '.md') {
          return;
        }

        const { text, ...frontmatter } = email
        this.output.write(file, { content: text, data: frontmatter });
        this.log.debug(`Wrote ${file}`);
        return;
      });

      await mbs.parse(this.input.path(f));
    }
  }

  protected cleanMails(input?: AddressObject | AddressObject[]) {
    if (input === undefined) return;
    const addresses = Array.isArray(input) ? input : [input];
    if (addresses.length === 0) return undefined;
    if (addresses.length === 1) return addresses[0].text;
    return addresses.flatMap(a => a.text).filter(a => a !== undefined);
  }
}