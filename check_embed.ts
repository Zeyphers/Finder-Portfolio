import fetch from 'node-fetch';

async function check() {
  const res = await fetch('https://embed.music.apple.com/us/profile/JacobSzczepaniak');
  console.log(res.status, await res.text());
}
check();
