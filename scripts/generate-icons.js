/**
 * Generates icons/icon16.png, icon48.png, icon128.png from SVG using sharp.
 * Design: gradient background + play triangle + dual subtitle bars.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

function makeSVG(size) {
  const r = Math.round(size * 0.20);       // background corner radius

  // Play circle
  const cx = size * 0.50;
  const cy = size * 0.38;
  const cr = size * 0.19;

  // Play triangle (right-pointing, inside circle)
  const tx = cx - cr * 0.32;
  const ty = cy - cr * 0.58;
  const bx = cx + cr * 0.52;
  const by = cy;
  const lx = tx;
  const ly = cy + cr * 0.58;

  // Subtitle bar 1 (original – white)
  const b1w  = size * 0.70;
  const b1h  = size * 0.11;
  const b1x  = (size - b1w) / 2;
  const b1y  = size * 0.62;
  const b1r  = b1h / 2;

  // Subtitle bar 2 (translated – teal, slightly shorter)
  const b2w  = size * 0.56;
  const b2h  = size * 0.11;
  const b2x  = (size - b2w) / 2;
  const b2y  = b1y + b1h + size * 0.055;
  const b2r  = b2h / 2;

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"
    xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="${size}" y2="${size}" gradientUnits="userSpaceOnUse">
      <stop offset="0%"   stop-color="#667eea"/>
      <stop offset="100%" stop-color="#764ba2"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="38%" r="45%">
      <stop offset="0%"   stop-color="#ffffff" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="${size * 0.02}" stdDeviation="${size * 0.04}"
        flood-color="#000" flood-opacity="0.35"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="url(#bg)"/>
  <!-- Top glow -->
  <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="url(#glow)"/>

  <!-- Play circle -->
  <circle cx="${cx}" cy="${cy}" r="${cr}" fill="rgba(0,0,0,0.22)" filter="url(#shadow)"/>

  <!-- Play triangle -->
  <polygon
    points="${tx},${ty} ${bx},${by} ${lx},${ly}"
    fill="white" opacity="0.95"/>

  <!-- Bar 1 – original subtitle (white) -->
  <rect x="${b1x}" y="${b1y}" width="${b1w}" height="${b1h}"
    rx="${b1r}" ry="${b1r}" fill="white" opacity="0.92"
    filter="url(#shadow)"/>

  <!-- Bar 2 – translated subtitle (teal) -->
  <rect x="${b2x}" y="${b2y}" width="${b2w}" height="${b2h}"
    rx="${b2r}" ry="${b2r}" fill="#4ecca3" opacity="0.92"
    filter="url(#shadow)"/>
</svg>`;
}

async function run() {
  const iconsDir = path.join(__dirname, '..', 'icons');
  fs.mkdirSync(iconsDir, { recursive: true });

  for (const size of [16, 48, 128]) {
    const svg = makeSVG(size);
    const outPath = path.join(iconsDir, `icon${size}.png`);
    await sharp(Buffer.from(svg))
      .resize(size, size)
      .png()
      .toFile(outPath);
    console.log(`  created ${outPath}`);
  }
  console.log('Icons generated.');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
