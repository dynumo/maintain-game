const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [192, 512, 180, 32, 16];
const svgPath = path.join(__dirname, 'public', 'icon.svg');
const publicDir = path.join(__dirname, 'public');

async function generateIcons() {
  const svgBuffer = fs.readFileSync(svgPath);

  for (const size of sizes) {
    let filename;
    if (size === 180) {
      filename = 'apple-touch-icon.png';
    } else if (size === 32 || size === 16) {
      filename = `favicon-${size}x${size}.png`;
    } else {
      filename = `icon-${size}x${size}.png`;
    }

    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(path.join(publicDir, filename));

    console.log(`Generated ${filename}`);
  }

  // Create favicon.ico from 32x32 PNG
  console.log('Icon generation complete!');
}

generateIcons().catch(console.error);
