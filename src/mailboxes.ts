import { nanohash } from '@eatonfyi/ids';
import { MboxStreamer } from '@eatonfyi/mbox-streamer';
import { Message, MessageSchema, toId } from '@eatonfyi/schema';
import is from '@sindresorhus/is';
import { AddressObject, ParsedMail } from 'mailparser';
import PQueue from 'p-queue';
import { Migrator, MigratorOptions } from './shared/migrator.js';

type MailFilter = (p: ParsedMail) => boolean;

export interface MailboxMigratorOptions extends MigratorOptions {
  matching?: MailFilter | string;
  mbox?: boolean;
  attachments?: boolean | MailFilter;
}

const defaults: MailboxMigratorOptions = {
  name: 'mailboxes',
  label: 'Archived unix mbox files',
  input: 'input/mailboxes',
  cache: 'cache/mailboxes',
  attachments: true,
};

export class MailboxMigrator extends Migrator {
  declare options: MailboxMigratorOptions;
  messages: Message[] = [];

  constructor(options: MailboxMigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  // For the moment, we'll just look for .eml and .txt files to parse;
  // Down the line we'll dig into .mbox files and use specific criteria
  // to choose what stuff is included.

  override async finalize() {
    const mb = new MboxStreamer();
    const q = new PQueue({ autoStart: false });

    mb.on('message', input => q.add(() => this.processMail(input)));

    for (const f of this.input.find({ matching: '**/*.mbox' }) ?? []) {
      this.log.info(`Processing ${f}`);
      q.add(() => mb.parse(this.input.path(f)));
    }

    q.start();

    await q.onIdle();
    return;
  }

  protected async processMail(input: ParsedMail) {
    const email = this.prepMail(input);
    if (!email) return;

    this.handleAttachments(input);
    await this.saveThing(email);
    return;
  }

  protected handleAttachments(input: ParsedMail) {
    if (
      this.options.attachments === true ||
      (is.function(this.options.attachments) && this.options.attachments(input))
    ) {
      for (const a of input.attachments) {
        this.cache.write(`attachments/${a.filename}`, a.content);
      }
    }
  }

  protected prepMail(input: ParsedMail) {
    return MessageSchema.parse({
      id: toId('email', nanohash(input.headerLines)),
      type: 'EmailMessage',
      name: input.subject,
      date: input.date?.toJSON(),
      from: this.cleanMails(input.from),
      to: this.cleanMails(input.to),
      cc: this.cleanMails(input.cc),
      bcc: this.cleanMails(input.bcc),
      replyTo: input.replyTo?.text,
      attachments: input.attachments.map(a => a.filename),
      text: input.text,
      headers: input.headerLines,
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
