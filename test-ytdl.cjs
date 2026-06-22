const youtubedl = require('youtube-dl-exec');
youtubedl('https://www.youtube.com/watch?v=aqz-KE-bpKQ', {
  dumpJson: true,
  noCheckCertificates: true,
  noWarnings: true,
  preferFreeFormats: true,
  addHeader: [
    'referer:youtube.com',
    'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36'
  ]
}).then(output => {
  console.log("Success:", output.title);
}).catch(err => {
  console.error("Error:", err.message);
});
