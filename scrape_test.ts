import fetch from 'node-fetch';
import fs from 'fs';

async function run() {
  const res = await fetch('https://music.apple.com/profile/JacobSzczepaniak');
  const text = await res.text();
  fs.writeFileSync('apple_music.html', text);
}
run();
