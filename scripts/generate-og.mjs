// Generates the brand social/share images from the source logo assets:
//   public/og.png        1200x630 Open Graph / Twitter card
//   app/apple-icon.png   180x180 Apple touch icon
//   public/icon-192.png  192x192 PWA manifest icon (maskable-safe)
//   public/icon-512.png  512x512 PWA manifest icon (maskable-safe)
//
// Run once and commit the output: `node scripts/generate-og.mjs`.
// sharp is resolved from the pnpm store because it is a transitive dependency
// (not a direct one), so a bare `import "sharp"` would not resolve.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const sharp = require(
  path.join(
    fileURLToPath(
      new URL(
        "../node_modules/.pnpm/sharp@0.34.5/node_modules/sharp/",
        import.meta.url,
      ),
    ),
  ),
);

const root = fileURLToPath(new URL("..", import.meta.url));
const LOGO = path.join(root, "public/logo.png");

// Brand palette.
const LIME = { r: 207, g: 255, b: 0 }; // #CFFF00
const INK = { r: 14, g: 11, b: 9 }; // #0E0B09

// Extract just the black wrench mark from logo.png (which ships on its own
// lime square) as an ink-on-transparent PNG at the requested size. The mark is
// near-black and the background near-white in luminance, so a stretched
// grayscale ramp gives a clean, anti-aliased alpha mask.
async function inkMark(size) {
  const alpha = await sharp(LOGO)
    .resize(size, size, { fit: "contain", background: LIME })
    .grayscale()
    .toColourspace("b-w")
    .negate() // mark -> bright (~245), lime -> dark (~35, with source noise)
    .linear(2.125, -234) // black point above the lime+noise floor -> clean transparent bg, smooth mark edges
    .raw()
    .toBuffer();

  const ink = await sharp({
    create: { width: size, height: size, channels: 3, background: INK },
  })
    .png()
    .toBuffer();

  return sharp(ink)
    .joinChannel(alpha, { raw: { width: size, height: size, channels: 1 } })
    .png()
    .toBuffer();
}

async function generateOg() {
  const W = 1200;
  const H = 630;
  const markSize = 300;
  const markLeft = 90;
  const markTop = Math.round((H - markSize) / 2);
  const textX = markLeft + markSize + 56;

  const inkHex = "#0E0B09";
  const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <g font-family="Helvetica Neue, Helvetica, Arial, sans-serif">
    <text x="${textX}" y="315" font-size="96" font-weight="700" letter-spacing="-3" fill="${inkHex}">robins<tspan fill="${inkHex}" fill-opacity="0.5">.tools</tspan></text>
    <text x="${textX + 2}" y="372" font-size="34" font-weight="500" letter-spacing="-0.5" fill="${inkHex}" fill-opacity="0.82">Open-source tools for Robinhood Chain</text>
  </g>
</svg>`;

  const mark = await inkMark(markSize);

  const out = path.join(root, "public/og.png");
  await sharp({
    create: { width: W, height: H, channels: 3, background: LIME },
  })
    .composite([
      { input: mark, left: markLeft, top: markTop },
      { input: Buffer.from(svg), left: 0, top: 0 },
    ])
    .png()
    .toFile(out);
  console.log("wrote", out);
}

async function generateFavicon() {
  // Served by Next as the favicon. The logo is already a full-bleed lime
  // square with the wrench mark centered, so a plain resize is enough.
  const out = path.join(root, "app/icon.png");
  await sharp(LOGO).resize(256, 256).png().toFile(out);
  console.log("wrote", out);
}

async function generateAppleIcon() {
  const out = path.join(root, "app/apple-icon.png");
  await sharp(LOGO).resize(180, 180).png().toFile(out);
  console.log("wrote", out);
}

async function generateManifestIcon(size) {
  // PWA manifest icons. Maskable icons can be cropped to a circle or squircle,
  // so the mark sits inside the inner ~66% safe zone on a full-bleed lime field:
  // whatever a launcher crops away is still brand lime, never a clipped mark.
  // The logo carries its own padding around the mark, so scaling the whole
  // tile to ~86% keeps the wrench inside the central safe zone.
  const markSize = Math.round(size * 0.86);
  const mark = await sharp(LOGO).resize(markSize, markSize).png().toBuffer();

  const offset = Math.round((size - markSize) / 2);
  const out = path.join(root, `public/icon-${size}.png`);
  await sharp({
    create: { width: size, height: size, channels: 3, background: LIME },
  })
    .composite([{ input: mark, left: offset, top: offset }])
    .flatten({ background: LIME })
    .png()
    .toFile(out);
  console.log("wrote", out);
}

await generateOg();
await generateFavicon();
await generateAppleIcon();
await generateManifestIcon(192);
await generateManifestIcon(512);
