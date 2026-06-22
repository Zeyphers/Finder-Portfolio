const { create } = require('youtube-dl-exec');
const fs = require('fs');

const ytdl = create('/app/applet/node_modules/youtube-dl-exec/bin/yt-dlp');

ytdl('https://www.youtube.com/watch?v=aqz-KE-bpKQ', {
  output: 'video.mp4',
  format: 'worst[ext=mp4]', // lowest quality for speed
}).then(() => {
  console.log("Success! File saved.");
}).catch(err => {
  console.error("Error:", err.message);
});
