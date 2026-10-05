/**
 * TokenTrim - Minimal ZIP reader for OOXML (pptx/xlsx/docx/epub).
 * No dependency: parses central directory + inflates with
 * DecompressionStream('deflate-raw') (Chrome 80+). Falls back to
 * stored (uncompressed) entries. Local-only.
 */

function readU16(dv, off) { return dv.getUint16(off, true); }
function readU32(dv, off) { return dv.getUint32(off, true); }

function decodeName(bytes) {
  try { return new TextDecoder('utf-8').decode(bytes); }
  catch { return String.fromCharCode(...bytes); }
}

/**
 * List + extract entries: returns Map<path, Uint8Array (raw compressed or stored bytes) + meta>.
 * We keep it lazy: extractFile() inflates on demand.
 */
export async function unzipFiles(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // Find End Of Central Directory
  let eocd = -1;
  const minEocd = Math.max(0, bytes.length - 66000);
  for (let i = bytes.length - 22; i >= minEocd; i--) {
    if (readU32(dv, i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('CORRUPT_FILE');

  const count = readU16(dv, eocd + 10);
  let cdOff = readU32(dv, eocd + 16);
  const files = new Map();

  for (let n = 0; n < count; n++) {
    if (readU32(dv, cdOff) !== 0x02014b50) break;
    const method = readU16(dv, cdOff + 10);
    const compSize = readU32(dv, cdOff + 20);
    const fNameLen = readU16(dv, cdOff + 28);
    const extraLen = readU16(dv, cdOff + 30);
    const commentLen = readU16(dv, cdOff + 32);
    const lhOff = readU32(dv, cdOff + 42);
    const nameBytes = bytes.subarray(cdOff + 46, cdOff + 46 + fNameLen);
    const name = decodeName(nameBytes);
    files.set(name, { method, compSize, lhOff });
    cdOff += 46 + fNameLen + extraLen + commentLen;
  }

  return {
    names() { return [...files.keys()]; },
    has(p) { return files.has(p); },
    async readText(path) {
      const data = await this.readBytes(path);
      return new TextDecoder('utf-8').decode(data);
    },
    async readBytes(path) {
      const meta = files.get(path);
      if (!meta) throw new Error(`Missing entry: ${path}`);
      // Local header: sig(4) ver(2) flag(2) method(2) time(2) date(2) crc(4) comp(4) uncomp(4) fnLen(2) extraLen(2)
      const lh = meta.lhOff;
      if (readU32(dv, lh) !== 0x04034b50) throw new Error('CORRUPT_FILE');
      const fnLen = readU16(dv, lh + 26);
      const exLen = readU16(dv, lh + 28);
      const dataStart = lh + 30 + fnLen + exLen;
      const raw = bytes.subarray(dataStart, dataStart + meta.compSize);
      if (meta.method === 0) return raw.slice();
      if (meta.method === 8) {
        if (typeof DecompressionStream === 'undefined') throw new Error('CORRUPT_FILE');
        const ds = new DecompressionStream('deflate-raw');
        const stream = new Blob([raw]).stream().pipeThrough(ds);
        const ab = await new Response(stream).arrayBuffer();
        return new Uint8Array(ab);
      }
      throw new Error('CORRUPT_FILE');
    }
  };
}

/** Convenience: read first existing path from candidates. */
export async function readFirstText(zip, candidates) {
  for (const c of candidates) {
    if (zip.has(c)) {
      try { return await zip.readText(c); } catch { /* try next */ }
    }
  }
  return null;
}

export default { unzipFiles, readFirstText };
