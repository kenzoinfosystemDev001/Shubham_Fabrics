const fs = require('fs');
const path = require('path');

const publicDir = path.join(process.cwd(), 'apps', 'web', 'public');
const appDir = path.join(process.cwd(), 'apps', 'web', 'src', 'app');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Minimal valid 16x16 32-bit ICO header + BMP
const buf = Buffer.alloc(70);
buf.writeUInt16LE(0, 0); // reserved
buf.writeUInt16LE(1, 2); // type: icon
buf.writeUInt16LE(1, 4); // count: 1
buf.writeUInt8(16, 6);  // width
buf.writeUInt8(16, 7);  // height
buf.writeUInt8(0, 8);   // color count
buf.writeUInt8(0, 9);   // reserved
buf.writeUInt16LE(1, 10); // planes
buf.writeUInt16LE(1, 12); // bit count
buf.writeUInt32LE(40 + 8, 14); // bytes in res
buf.writeUInt32LE(22, 18); // offset
buf.writeUInt32LE(40, 22); // biSize
buf.writeInt32LE(16, 26);  // biWidth
buf.writeInt32LE(32, 30);  // biHeight
buf.writeUInt16LE(1, 34);  // biPlanes
buf.writeUInt16LE(1, 36);  // biBitCount

fs.writeFileSync(path.join(publicDir, 'favicon.ico'), buf);
fs.writeFileSync(path.join(appDir, 'favicon.ico'), buf);
console.log('favicon.ico successfully created in public and app directories');
