import { nanohash } from '@eatonfyi/ids';
import { MboxStreamer } from '@eatonfyi/mbox-streamer';
import is from '@sindresorhus/is';
import { AddressObject, ParsedMail, Source, simpleParser } from 'mailparser';
import micromatch from 'micromatch';
import { promisify } from 'util';
import {
  Message,
  MessageSchema,
} from '../schemas/schema-org/CreativeWork/message.js';
import { Migrator, MigratorOptions } from '../shared/migrator.js';
import { toId } from '../shared/schemer.js';

const parseMail = promisify<Source, ParsedMail>(simpleParser);

type MailFilter = (p: ParsedMail) => boolean;
export interface TextEmailMigratorOptions extends MigratorOptions {
  matching?: MailFilter | string;
  mbox?: boolean;
  attachments?: boolean | MailFilter;
}

const defaults: TextEmailMigratorOptions = {
  name: 'txt-email',
  label: 'Email drifting through the ether',
  input: 'input/textfiles/email',
  output: 'src/txt/email',
  mbox: false,
  attachments: true,
};

export class TextEmailMigrator extends Migrator {
  declare options: TextEmailMigratorOptions;
  stories: Message[] = [];

  constructor(options: TextEmailMigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  // For the moment, we'll just look for .eml and .txt files to parse;
  // Down the line we'll dig into .mbox files and use specific criteria
  // to choose what stuff is included.

  override async finalize() {
    // First handle basic text and email files
    for (const f of this.input.find({ matching: '*.{txt,eml}' }) ?? []) {
      const raw = this.input.read(f);
      if (raw) {
        const message = await parseMail(raw);
        await this.processMail(message, raw);
      }
    }

    if (this.options.mbox) {
      const mb = new MboxStreamer();
      for (const f of this.input.find({ matching: '*.mbox' }) ?? []) {
        mb.parse(f);
      }
    }
    return;
  }

  protected async processMail(input: ParsedMail, raw?: string) {
    if (!this.messageMatches(input, raw)) {
      this.log.debug(`Skipped message, did not match filter.`);
      return;
    }

    const email = this.prepMail(input);
    await this.saveThing(email);
    this.handleAttachments(input);

    return;
  }

  protected messageMatches(input: ParsedMail, raw?: string) {
    if (raw && typeof this.options.matching === 'string') {
      if (!micromatch.isMatch(raw, this.options.matching)) {
        return false;
      }
    } else if (
      is.function(this.options.matching) &&
      !this.options.matching(input)
    ) {
      return false;
    }
    return true;
  }

  protected handleAttachments(input: ParsedMail) {
    if (
      this.options.attachments === true ||
      (is.function(this.options.attachments) && this.options.attachments(input))
    ) {
      for (const a of input.attachments) {
        this.cache.write(`/attachments/${a.filename}`, a.content);
      }
    }
  }

  protected prepMail(input: ParsedMail) {
    return MessageSchema.parse({
      id: toId('email', nanohash(input.headerLines)),
      name: input.subject,
      date: input.date?.toJSON(),
      from: this.cleanMails(input.from),
      to: this.cleanMails(input.to),
      cc: this.cleanMails(input.cc),
      bcc: this.cleanMails(input.bcc),
      replyTo: input.replyTo?.text,
      attachments: input.attachments.map(a => a.filename),
      text: input.text,
    });
  }

  protected cleanMails(input?: AddressObject | AddressObject[]) {
    if (input === undefined) return;
    const addresses = Array.isArray(input) ? input : [input];
    if (addresses.length === 0) return undefined;
    if (addresses.length === 1) return addresses[0].text;
    return addresses.flatMap(a => a.text).filter(a => a !== undefined);
  }
}
