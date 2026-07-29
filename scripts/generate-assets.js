"use strict";

const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const outputDirectory = path.join(__dirname, "..", "build");
const appxDirectory = path.join(outputDirectory, "appx");
fs.mkdirSync(outputDirectory, { recursive: true });
fs.rmSync(appxDirectory, { recursive: true, force: true });
fs.mkdirSync(appxDirectory, { recursive: true });

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) {
    value ^= byte;
    for (let index = 0; index < 8; index += 1) {
      value = (value >>> 1) ^ (0xedb88320 & -(value & 1));
    }
  }
  return (value ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const result = Buffer.alloc(12 + data.length);
  result.writeUInt32BE(data.length, 0);
  typeBuffer.copy(result, 4);
  data.copy(result, 8);
  result.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return result;
}

function blend(pixel, color, alpha) {
  pixel[0] = Math.round(pixel[0] * (1 - alpha) + color[0] * alpha);
  pixel[1] = Math.round(pixel[1] * (1 - alpha) + color[1] * alpha);
  pixel[2] = Math.round(pixel[2] * (1 - alpha) + color[2] * alpha);
  pixel[3] = 255;
}

function createIcon(width, height, fileName, directory = outputDirectory) {
  const rowSize = width * 4 + 1;
  const pixels = Buffer.alloc(rowSize * height);
  const centerX = (width - 1) / 2;
  const centerY = (height - 1) / 2;
  const radius = Math.min(width, height) * 0.43;
  const cyan = [29, 232, 255];
  const violet = [141, 92, 246];
  const navy = [9, 11, 20];

  for (let y = 0; y < height; y += 1) {
    const row = y * rowSize;
    pixels[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const offset = row + 1 + x * 4;
      const distance = Math.hypot(x - centerX, y - centerY);
      const backgroundAlpha = distance <= radius ? 1 : 0;
      const gradient = (x + y) / (width + height);
      const base = [
        Math.round(navy[0] + gradient * 12),
        Math.round(navy[1] + gradient * 9),
        Math.round(navy[2] + gradient * 20),
        Math.round(255 * backgroundAlpha)
      ];
      pixels.set(base, offset);

      if (!backgroundAlpha) continue;
      const nx = (x - centerX) / radius;
      const ny = (y - centerY) / radius;
      const wave = -0.06 * Math.sin(nx * Math.PI * 3.5);
      const pulse =
        (nx > -0.72 && nx < -0.28 && Math.abs(ny - wave) < 0.055) ||
        (nx >= -0.28 && nx < -0.08 && Math.abs(ny - (-0.68 + (nx + 0.28) * 3.2)) < 0.07) ||
        (nx >= -0.08 && nx < 0.12 && Math.abs(ny - (0.68 - (nx + 0.08) * 6.8)) < 0.07) ||
        (nx >= 0.12 && nx < 0.32 && Math.abs(ny - (-0.68 + (nx - 0.12) * 3.4)) < 0.07) ||
        (nx >= 0.32 && nx < 0.75 && Math.abs(ny - wave) < 0.055);
      if (pulse) {
        const pixel = [pixels[offset], pixels[offset + 1], pixels[offset + 2], 255];
        blend(pixel, x < centerX ? cyan : violet, 0.95);
        pixels.set(pixel, offset);
      }
    }
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const png = Buffer.concat([
    signature,
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(pixels, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
  fs.writeFileSync(path.join(directory, fileName), png);
}

createIcon(512, 512, "icon.png");

const appxAssets = [
  ["StoreLogo", 50, 50],
  ["Square44x44Logo", 44, 44],
  ["Square150x150Logo", 150, 150],
  ["Wide310x150Logo", 310, 150],
  ["LargeTile", 310, 310],
  ["SmallTile", 71, 71],
  ["SplashScreen", 620, 300]
];
const scales = [
  [100, 1],
  [125, 1.25],
  [150, 1.5],
  [200, 2],
  [400, 4]
];

for (const [name, width, height] of appxAssets) {
  createIcon(width, height, `${name}.png`, appxDirectory);
  for (const [scale, multiplier] of scales.slice(1)) {
    createIcon(
      Math.round(width * multiplier),
      Math.round(height * multiplier),
      `${name}.scale-${scale}.png`,
      appxDirectory
    );
  }
}
process.stdout.write("Assets ShenPulse générés.\n");
