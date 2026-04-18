/**
 * Generates icons/icon16.png, icon48.png, icon128.png
 * using only Node.js built-ins (no extra dependencies).
 * Colors: gradient from #667eea (blue-purple) to #764ba2 (purple).
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const START = { r: 102, g: 126, b: 234 }; // #667eea
const END   = { r: 118, g:  75, b: 162 }; // #764ba2

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function buildPNG(size) {
  const rowBytes = 1 + size * 3; // filter byte + RGB pixels
  const raw = Buffer.alloc(size * rowBytes);

  for (let y = 0; y < size; y++) {
    raw[y * rowBytes] = 0; // filter type: None
    for (let x = 0; x < size; x++) {
      const t = (x + y) / (2 * (size - 1));
      const off = y * rowBytes + 1 + x * 3;
      raw[off]     = lerp(START.r, END.r, t);
      raw[off + 1] = lerp(START.g, END.g, t);
      raw[off + 2] = lerp(START.b, END.b, t);
    }
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });

  const sig  = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = chunk('IHDR', buildIHDR(size));
  const idat = chunk('IDAT', compressed);
  const iend = chunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdr, idat, iend]);
}

function buildIHDR(size) {
  const b = Buffer.alloc(13);
  b.writeUInt32BE(size, 0);
  b.writeUInt32BE(size, 4);
  b[8]  = 8; // bit depth
  b[9]  = 2; // colour type: RGB
  b[10] = 0; // compression
  b[11] = 0; // filter
  b[12] = 0; // interlace
  return b;
}

function chunk(type, data) {
  const tBuf = Buffer.from(type, 'ascii');
  const len  = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([tBuf, data])) >>> 0, 0);
  return Buffer.concat([len, tBuf, data, crcBuf]);
}

function crc32(buf) {
  const table = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[i] = c;
    }
    return t;
  })();
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ table[(c ^ buf[i]) & 0xff];
  return (c ^ 0xffffffff);
}

const iconsDir = path.join(__dirname, '..', 'icons');
fs.mkdirSync(iconsDir, { recursive: true });

for (const size of [16, 48, 128]) {
  const outPath = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(outPath, buildPNG(size));
  console.log(`  created ${outPath}`);
}
console.log('Icons generated.');
