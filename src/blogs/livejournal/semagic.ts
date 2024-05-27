  /**
   * Semagic was an early-aughts LJ client for windows. Among other things it saved local
   * copies of posts after you'd sent them; this made it handy for recovering lost journal
   * data.
   * 
   * The format consists of a few fixed-length data fields, and a large number of variable
   * length text fields. All text fields start with a \xFF\xFE\xFF delimiter, followed by the
   * length of the text. \x00 indicates an empty field, \xFF indicates the FOLLOWING two bytes 
   * contain the field length, and anything else is just the field length. The actual text is
   * utf16le encoded.
   * 
   * Fields:
   * 
   *  0. 16 bytes of header data. Always appears to be the same, might be app version/signature.
   *  1. Text, always empty
   *  2. Text, always empty
   *  3. Text, always empty
   *  4. Text, always empty
   *  5. Text, always empty
   *  6. Text, always empty
   *  7. Text, always empty
   *  8. Text, always empty
   *  9. Text, always empty
   * 10. Text, always empty
   * 11. Text, always empty
   * 12. Little-endian UInt32 containing the post ID
   * 13. Text, LJ handle
   * 14. Text, LJ display name
   * 15. Text, Post body
   * 16. Text, Post subject
   * 17: UInt32, always empty
   * 18: UInt32, always empty
   * 19. Little-endian UInt32 containing post's creation timestamp.
   * 20: UInt32, always empty.
   * 21: UInt32, always empty.
   * 22: UInt32, always empty.
   * 23: Text, Current Music
   * 24: Text, Current Mood
   * 25: UInt32, always empty.
   * 26: Text, Avatar
   * 
   * One of the 'always empty/unknown' fields probably contains things like post visibility settings,
   * but without te docs it's a bit of a shot in the dark.
   */
  export function parseSemagicFile(data: Buffer) {
    // This is a really crude way of ding it, and frankly we shouldn't.
    const chunks = splitBuffer(data, Buffer.from([255,254,255]));
    return {
      id:  chunks[11].slice(0,2).readUInt16LE(),
      subject: chunks[15].slice(0, -24).toString('utf16le') || undefined,
      flags: chunks[15].slice(-24,-16),
      date: new Date(1000 * chunks[15].slice(-16,-12).readUInt32LE()),
      body: chunks[14].toString('utf16le').slice(1) || undefined,
      music: chunks[16].toString('utf16le') || undefined,
      mood: chunks[17].slice(-4).toString('utf16le') || undefined,
      avatar: chunks[18].toString('utf16le'),
    }
    
    function splitBuffer(b: Buffer, delimiter: Buffer) {
      const ret = [];
      let s = 0;
      let i = b.indexOf(delimiter, s);
      while (i >= 0) {
        if (i >= 0) {
          ret.push(b.slice(s + 3, i));
        }
        s = i + 1;
        i = b.indexOf(delimiter, s);
      }
      ret.push(b.slice(s + 3));
      return ret;
    }
  }
