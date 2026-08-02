"use strict";

const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const projectDirectory = path.join(__dirname, "..");
const outputDirectory = path.join(projectDirectory, "build");
const appxDirectory = path.join(outputDirectory, "appx");
const sourcePath = path.join(
  projectDirectory,
  "src",
  "renderer",
  "assets",
  "brand",
  "shenpulse-512.png"
);
const cachedBuilderIconPath = path.join(
  projectDirectory,
  "dist",
  ".icon-ico",
  "icon.ico"
);

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

function paethPredictor(left, up, upperLeft) {
  const estimate = left + up - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= upDistance && leftDistance <= upperLeftDistance) return left;
  if (upDistance <= upperLeftDistance) return up;
  return upperLeft;
}

function decodeRgbaPng(png) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!png.subarray(0, signature.length).equals(signature)) {
    throw new Error(`Le logo source n'est pas un PNG valide : ${sourcePath}`);
  }

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const imageDataChunks = [];

  for (let offset = signature.length; offset < png.length; ) {
    const length = png.readUInt32BE(offset);
    const type = png.toString("ascii", offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "IDAT") {
      imageDataChunks.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  if (
    !width ||
    !height ||
    bitDepth !== 8 ||
    colorType !== 6 ||
    interlace !== 0 ||
    !imageDataChunks.length
  ) {
    throw new Error(
      "Le logo source doit être un PNG RGBA 8 bits non entrelacé."
    );
  }

  const bytesPerPixel = 4;
  const rowLength = width * bytesPerPixel;
  const filtered = zlib.inflateSync(Buffer.concat(imageDataChunks));
  const expectedLength = (rowLength + 1) * height;
  if (filtered.length !== expectedLength) {
    throw new Error("Les données du logo source sont incomplètes.");
  }

  const pixels = Buffer.alloc(width * height * bytesPerPixel);
  for (let y = 0; y < height; y += 1) {
    const filteredRow = y * (rowLength + 1);
    const outputRow = y * rowLength;
    const filter = filtered[filteredRow];

    for (let x = 0; x < rowLength; x += 1) {
      const value = filtered[filteredRow + 1 + x];
      const left = x >= bytesPerPixel ? pixels[outputRow + x - bytesPerPixel] : 0;
      const up = y > 0 ? pixels[outputRow - rowLength + x] : 0;
      const upperLeft =
        y > 0 && x >= bytesPerPixel
          ? pixels[outputRow - rowLength + x - bytesPerPixel]
          : 0;

      switch (filter) {
        case 0:
          pixels[outputRow + x] = value;
          break;
        case 1:
          pixels[outputRow + x] = (value + left) & 0xff;
          break;
        case 2:
          pixels[outputRow + x] = (value + up) & 0xff;
          break;
        case 3:
          pixels[outputRow + x] =
            (value + Math.floor((left + up) / 2)) & 0xff;
          break;
        case 4:
          pixels[outputRow + x] =
            (value + paethPredictor(left, up, upperLeft)) & 0xff;
          break;
        default:
          throw new Error(`Filtre PNG non pris en charge : ${filter}`);
      }
    }
  }

  return { width, height, pixels };
}

function encodeRgbaPng(width, height, pixels) {
  const rowLength = width * 4;
  const filtered = Buffer.alloc((rowLength + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const filteredRow = y * (rowLength + 1);
    filtered[filteredRow] = 0;
    pixels.copy(filtered, filteredRow + 1, y * rowLength, (y + 1) * rowLength);
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;

  return Buffer.concat([
    signature,
    chunk("IHDR", header),
    chunk("sRGB", Buffer.from([0])),
    chunk("IDAT", zlib.deflateSync(filtered, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

function lanczos(value, radius = 3) {
  const distance = Math.abs(value);
  if (distance === 0) return 1;
  if (distance >= radius) return 0;
  const piDistance = Math.PI * distance;
  return (
    (Math.sin(piDistance) / piDistance) *
    (Math.sin(piDistance / radius) / (piDistance / radius))
  );
}

function createContributions(sourceSize, targetSize) {
  const scale = targetSize / sourceSize;
  const support = scale < 1 ? 3 / scale : 3;
  const kernelScale = scale < 1 ? scale : 1;
  const contributions = [];

  for (let target = 0; target < targetSize; target += 1) {
    const center = (target + 0.5) / scale - 0.5;
    const start = Math.ceil(center - support);
    const end = Math.floor(center + support);
    const weightsByIndex = new Map();
    let totalWeight = 0;

    for (let source = start; source <= end; source += 1) {
      const weight = lanczos((center - source) * kernelScale);
      if (weight === 0) continue;
      const clampedSource = Math.max(0, Math.min(sourceSize - 1, source));
      weightsByIndex.set(
        clampedSource,
        (weightsByIndex.get(clampedSource) || 0) + weight
      );
      totalWeight += weight;
    }

    contributions.push(
      [...weightsByIndex].map(([index, weight]) => [
        index,
        weight / totalWeight
      ])
    );
  }

  return contributions;
}

function resizeRgba(source, targetWidth, targetHeight) {
  if (source.width === targetWidth && source.height === targetHeight) {
    return Buffer.from(source.pixels);
  }

  const horizontalContributions = createContributions(
    source.width,
    targetWidth
  );
  const verticalContributions = createContributions(
    source.height,
    targetHeight
  );
  const horizontal = new Float64Array(targetWidth * source.height * 4);

  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < targetWidth; x += 1) {
      const outputOffset = (y * targetWidth + x) * 4;
      for (const [sourceX, weight] of horizontalContributions[x]) {
        const sourceOffset = (y * source.width + sourceX) * 4;
        const alpha = source.pixels[sourceOffset + 3];
        horizontal[outputOffset] +=
          (source.pixels[sourceOffset] * alpha * weight) / 255;
        horizontal[outputOffset + 1] +=
          (source.pixels[sourceOffset + 1] * alpha * weight) / 255;
        horizontal[outputOffset + 2] +=
          (source.pixels[sourceOffset + 2] * alpha * weight) / 255;
        horizontal[outputOffset + 3] += alpha * weight;
      }
    }
  }

  const pixels = Buffer.alloc(targetWidth * targetHeight * 4);
  for (let y = 0; y < targetHeight; y += 1) {
    for (let x = 0; x < targetWidth; x += 1) {
      const outputOffset = (y * targetWidth + x) * 4;
      let premultipliedRed = 0;
      let premultipliedGreen = 0;
      let premultipliedBlue = 0;
      let alpha = 0;

      for (const [sourceY, weight] of verticalContributions[y]) {
        const sourceOffset = (sourceY * targetWidth + x) * 4;
        premultipliedRed += horizontal[sourceOffset] * weight;
        premultipliedGreen += horizontal[sourceOffset + 1] * weight;
        premultipliedBlue += horizontal[sourceOffset + 2] * weight;
        alpha += horizontal[sourceOffset + 3] * weight;
      }

      const clampedAlpha = Math.max(0, Math.min(255, alpha));
      pixels[outputOffset + 3] = Math.round(clampedAlpha);
      if (clampedAlpha > 0) {
        pixels[outputOffset] = Math.round(
          Math.max(0, Math.min(255, (premultipliedRed * 255) / clampedAlpha))
        );
        pixels[outputOffset + 1] = Math.round(
          Math.max(0, Math.min(255, (premultipliedGreen * 255) / clampedAlpha))
        );
        pixels[outputOffset + 2] = Math.round(
          Math.max(0, Math.min(255, (premultipliedBlue * 255) / clampedAlpha))
        );
      }
    }
  }

  return pixels;
}

const sourceLogo = decodeRgbaPng(fs.readFileSync(sourcePath));
const resizedLogoCache = new Map();

function resizedLogo(size) {
  if (!resizedLogoCache.has(size)) {
    resizedLogoCache.set(size, resizeRgba(sourceLogo, size, size));
  }
  return resizedLogoCache.get(size);
}

function renderLogo(width, height, useSafeArea) {
  const safeAreaRatio = useSafeArea ? 0.86 : 1;
  const logoSize = Math.max(1, Math.round(Math.min(width, height) * safeAreaRatio));
  const logoPixels = resizedLogo(logoSize);
  const pixels = Buffer.alloc(width * height * 4);
  const left = Math.floor((width - logoSize) / 2);
  const top = Math.floor((height - logoSize) / 2);

  for (let y = 0; y < logoSize; y += 1) {
    const sourceOffset = y * logoSize * 4;
    const targetOffset = ((top + y) * width + left) * 4;
    logoPixels.copy(
      pixels,
      targetOffset,
      sourceOffset,
      sourceOffset + logoSize * 4
    );
  }

  return encodeRgbaPng(width, height, pixels);
}

function writeLogoPng(filePath, width, height, useSafeArea = true) {
  fs.writeFileSync(filePath, renderLogo(width, height, useSafeArea));
}

function createIco(sizes) {
  const images = sizes.map((size) => renderLogo(size, size, false));
  const headerSize = 6 + sizes.length * 16;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);

  let imageOffset = headerSize;
  for (let index = 0; index < sizes.length; index += 1) {
    const entryOffset = 6 + index * 16;
    const size = sizes[index];
    const image = images[index];
    header[entryOffset] = size === 256 ? 0 : size;
    header[entryOffset + 1] = size === 256 ? 0 : size;
    header[entryOffset + 2] = 0;
    header[entryOffset + 3] = 0;
    header.writeUInt16LE(1, entryOffset + 4);
    header.writeUInt16LE(32, entryOffset + 6);
    header.writeUInt32LE(image.length, entryOffset + 8);
    header.writeUInt32LE(imageOffset, entryOffset + 12);
    imageOffset += image.length;
  }

  return Buffer.concat([header, ...images]);
}

fs.copyFileSync(sourcePath, path.join(outputDirectory, "icon.png"));

const ico = createIco([16, 24, 32, 48, 64, 128, 256]);
fs.writeFileSync(path.join(outputDirectory, "shenpulse.ico"), ico);
if (fs.existsSync(path.dirname(cachedBuilderIconPath))) {
  fs.writeFileSync(cachedBuilderIconPath, ico);
}

const appxAssets = [
  ["StoreLogo", 50, 50],
  ["Square44x44Logo", 44, 44],
  ["Square150x150Logo", 150, 150],
  ["Wide310x150Logo", 310, 150],
  ["LargeTile", 310, 310],
  ["SmallTile", 71, 71],
  ["SplashScreen", 620, 300]
];
const legacyTopLevelAssets = new Set([
  "StoreLogo",
  "Square44x44Logo",
  "Square150x150Logo",
  "Wide310x150Logo"
]);
const scales = [
  [100, 1],
  [125, 1.25],
  [150, 1.5],
  [200, 2],
  [400, 4]
];

for (const [name, width, height] of appxAssets) {
  if (legacyTopLevelAssets.has(name)) {
    writeLogoPng(path.join(outputDirectory, `${name}.png`), width, height);
  }
  for (const [scale, multiplier] of scales) {
    const scaledWidth = Math.round(width * multiplier);
    const scaledHeight = Math.round(height * multiplier);
    const suffix = scale === 100 ? "" : `.scale-${scale}`;
    writeLogoPng(
      path.join(appxDirectory, `${name}${suffix}.png`),
      scaledWidth,
      scaledHeight
    );
  }
}

process.stdout.write(
  "Assets ShenPulse générés depuis src/renderer/assets/brand/shenpulse-512.png.\n"
);
