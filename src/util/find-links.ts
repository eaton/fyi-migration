import * as linkify from 'linkifyjs';

export function findLinks(input: string, type?: string) {
  return linkify.find(input, type);
}
