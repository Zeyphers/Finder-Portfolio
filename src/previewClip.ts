// Cuts a video tile's preview clip from the original video file, entirely in
// the browser: the first 10 seconds, muted, 480px wide, 24fps H.264 MP4 with
// the index up front so it starts playing before it has fully downloaded.
// These are the same settings make_previews.py uses with ffmpeg; here
// Mediabunny drives the browser's own WebCodecs encoder, so nothing needs
// installing. Loaded on demand so it stays out of the main admin bundle.
export const PREVIEW_SECONDS = 10;
const PREVIEW_WIDTH = 480;

export const makePreviewClip = async (file: File, onProgress?: (fraction: number) => void): Promise<File> => {
  const { Input, Output, Conversion, BlobSource, BufferTarget, Mp4OutputFormat, ALL_FORMATS, QUALITY_MEDIUM } = await import("mediabunny");

  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  const target = new BufferTarget();
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target });

  const duration = await input.computeDuration();
  const conversion = await Conversion.init({
    input,
    output,
    trim: { start: 0, end: Math.min(PREVIEW_SECONDS, duration) },
    audio: { discard: true },
    // Never upscale; H.264 needs even dimensions.
    video: track => ({
      width: Math.min(PREVIEW_WIDTH, track.displayWidth) & ~1,
      frameRate: 24,
      codec: "avc",
      quality: QUALITY_MEDIUM,
    }),
    copy: false,
    showWarnings: false,
  });
  if (!conversion.isValid || !conversion.utilizedTracks.some(t => t.isVideoTrack())) {
    const reasons = conversion.discardedTracks.map(d => d.reason).join(", ");
    throw new Error(`This browser can't convert ${file.name}${reasons ? ` (${reasons})` : ""}. Try an MP4 or MOV, or use Chrome.`);
  }
  if (onProgress) conversion.onProgress = onProgress;
  await conversion.execute();

  const base = file.name.replace(/\.[^.]+$/, "") || "preview";
  return new File([target.buffer!], `${base}-preview.mp4`, { type: "video/mp4" });
};
