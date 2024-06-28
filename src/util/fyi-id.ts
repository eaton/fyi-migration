import { nanohash } from "@eatonfyi/ids";

export function parseId(input: string) {
  const u = new URL(input);
  if (u.protocol === 'urn') {
    return u.toString();
  } else {
    return `urn:fyi:${u.protocol}${nanohash(u)}`;
  }
}