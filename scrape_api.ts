import fetch from 'node-fetch';

async function run() {
  const res = await fetch('https://amp-api.music.apple.com/v1/social/us/social-profiles/sp.14b732ed-0374-4d73-8300-9f78b6adab93?l=en-US&art%5Burl%5D=f&format%5Bresources%5D=map&l=en-US&platform=web');
  const text = await res.text();
  console.log(text);
}
run();
