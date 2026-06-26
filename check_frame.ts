import fetch from 'node-fetch';

async function check() {
  const res = await fetch('https://music.apple.com/profile/JacobSzczepaniak');
  console.log(res.headers.get('x-frame-options'));
}
check();
