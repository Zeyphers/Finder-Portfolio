const fs = require('fs');
const { GifFrame, GifUtil, GifCodec } = require('gifwrap');
const Jimp = require('jimp');

async function test() {
  const gif = await GifUtil.read("test.gif").catch(() => null);
  if (!gif) { console.log("no test.gif, testing jimp instead"); return; }
  
  // resize all frames
  for (let frame of gif.frames) {
    const j = GifUtil.copyAsJimp(Jimp, frame);
    j.resize(256, 256);
    frame.bitmap = j.bitmap;
  }
  await GifUtil.write("out.gif", gif.frames, gif).then(() => console.log("written"));
}
test();
