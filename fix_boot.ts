import fs from 'fs';
const text = fs.readFileSync('src/components/BootAnimation.tsx', 'utf-8');
const index = text.indexOf('export default function BootAnimation');
const head = text.substring(0, text.indexOf('const DEFAULT_BOOT_TEXT'));
const tail = text.substring(index);
fs.writeFileSync('src/components/BootAnimation.tsx', head + tail);
