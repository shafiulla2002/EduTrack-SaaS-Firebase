const fs = require('fs');
const path = require('path');

// Base64 string for a valid minimal 16x16 blue EduTrack favicon.ico
const faviconBase64 = "AAABAAEAICAAAAEAIACoEAAAFgAAACAgAAABACAAqBAAAI4EAAA1AAAAAAABAAEAGAAAABAAAAAAAAAAAAAAAAAAAAAAAP///wD///8A///wADAA4AAwAOAAADAA4AAwAOAAADAA4AAwAOAAADAA4AAwAOAAADAA4AAwAOAAADAA4AAwAOAAAP///wD///8A///wAAAAAA==";

// Standard valid 32x32 ICO header + PNG icon buffer
// A tiny valid ICO file (318 bytes)
const icoBuffer = Buffer.from(
  "AAABAAEAICAAAAEAIACoEAAAFgAAACAgAAABACAAqBAAAI4EAAA1AAAAAAABAAEAGAAA" +
  "ABAAAAAAAAAAAAAAAAAAAAAAAP///wD///8A///wADAA4AAwAOAAADAA4AAwAOAAAD" +
  "AA4AAwAOAAADAA4AAwAOAAADAA4AAwAOAAADAA4AAwAOAAAP///wD///8A///wAAAAAA==",
  "base64"
);

// Minimal valid transparent 1x1 ICO
const minimalIco = Buffer.from(
  "AAABAAEAEBAAAAEAIABoBAAAFgAAACAgAAABACAAqBAAAI4EAAA1AAAAAAABAAEAEBAAAAEAIABoBAAA",
  "base64"
);

// We can construct a perfectly valid 16x16 ICO header & DIB image
function createIco() {
  const width = 16;
  const height = 16;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Type (1 = ICO)
  header.writeUInt16LE(1, 4); // Count (1 image)

  const dibHeader = Buffer.alloc(40);
  dibHeader.writeUInt32LE(40, 0); // Header size
  dibHeader.writeInt32LE(width, 4); // Width
  dibHeader.writeInt32LE(height * 2, 8); // Height (XOR + AND mask)
  dibHeader.writeUInt16LE(1, 12); // Planes
  dibHeader.writeUInt16LE(32, 14); // Bits per pixel (32 = RGBA)
  dibHeader.writeUInt32LE(0, 16); // Compression
  dibHeader.writeUInt32LE(width * height * 4, 20); // Image size

  const pixels = Buffer.alloc(width * height * 4);
  // Fill with a nice EduTrack blue #2E5BFF (RGBA: 46, 91, 255, 255)
  for (let i = 0; i < width * height; i++) {
    pixels[i * 4 + 0] = 255; // Blue (BGRA order in BMP)
    pixels[i * 4 + 1] = 91;  // Green
    pixels[i * 4 + 2] = 46;  // Red
    pixels[i * 4 + 3] = 255; // Alpha
  }

  const andMask = Buffer.alloc(width * height / 8, 0); // 0 = opaque

  const imageSize = dibHeader.length + pixels.length + andMask.length;

  const directory = Buffer.alloc(16);
  directory.writeUInt8(width, 0);
  directory.writeUInt8(height, 1);
  directory.writeUInt8(0, 2); // Colors
  directory.writeUInt8(0, 3); // Reserved
  directory.writeUInt16LE(1, 4); // Color planes
  directory.writeUInt16LE(32, 6); // Bits per pixel
  directory.writeUInt32LE(imageSize, 8); // Image byte size
  directory.writeUInt32LE(6 + 16, 12); // Offset of image data

  return Buffer.concat([header, directory, dibHeader, pixels, andMask]);
}

const ico = createIco();

const publicPath = path.join(__dirname, '../public/favicon.ico');
const appPath = path.join(__dirname, '../src/app/favicon.ico');

fs.writeFileSync(publicPath, ico);
fs.writeFileSync(appPath, ico);

console.log('Successfully generated favicon.ico at:', publicPath, 'and', appPath);
