import React, { useEffect, useRef, useState } from 'react';
import { motion, useDragControls } from 'motion/react';
import { X, ExternalLink, Minus } from 'lucide-react';

interface MusicAppProps {
  onClose: () => void;
  zIndex: number;
}

type Track = {
  id: string;
  name: string;
  artist: string;
  album: string;
  artwork: string;
  previewUrl: string;
  durationInMillis: number;
};

const FEATURED = [
  "Radiohead Weird Fishes",
  "Aphex Twin Avril 14th",
  "Boards of Canada Roygbiv",
  "Bonobo Kerala",
  "Tame Impala Let It Happen",
  "Frank Ocean Nights",
  "Kendrick Lamar Money Trees",
  "Daft Punk Touch",
  "LCD Soundsystem Dance Yrself Clean",
  "Gorillaz Feel Good Inc",
  "Kanye West Runaway",
  "The Strokes Reptilia",
  "MGMT Kids",
  "Arctic Monkeys Do I Wanna Know",
  "Outkast Hey Ya",
  "Tyler The Creator EARFQUAKE",
  "Mac Miller The Spins",
  "A Tribe Called Quest Electric Relaxation",
  "J Dilla Time The Donut Of The Heart",
  "MF DOOM All Caps",
];

const PROFILE_URL = "https://music.apple.com/us/profile/JacobSzczepaniak";
const hiRes = (u: string) => u.replace("100x100bb", "600x600bb");

async function lookup(term: string): Promise<Track | null> {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(
    term
  )}&entity=song&limit=1`;
  try {
    const data = await (await fetch(url)).json();
    const t = data.results?.[0];
    if (!t) return null;
    return {
      id: t.trackId,
      name: t.trackName,
      artist: t.artistName,
      album: t.collectionName,
      artwork: t.artworkUrl100,
      previewUrl: t.previewUrl,
      durationInMillis: t.trackTimeMillis,
    };
  } catch {
    return null;
  }
}

const fmt = (s: number) =>
  isNaN(s) ? "0:00" : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

const PlaylistCard: React.FC<{ name: string, url: string, defaultColor: string }> = ({ name, url, defaultColor }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    const match = url.match(/(pl\.[a-zA-Z0-9_-]+)/);
    const id = match ? match[1] : null;
    
    if (id) {
      fetch(`/.netlify/functions/apple-playlist?v=1&id=${encodeURIComponent(id)}`)
        .then(async res => {
          if (!res.ok) throw new Error("Network response was not ok");
          const data = await res.json();
          if (data && !data.error && data.artwork) {
            setImageUrl(data.artwork);
          }
        })
        .catch(err => console.warn("Playlist info fetch failed:", err));
    }
  }, [url]);

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="ma-playlist-card-small group">
      <div className={`ma-playlist-art-small bg-gradient-to-br ${defaultColor} group-hover:scale-105 transition-transform duration-300 relative overflow-hidden`}>
        {imageUrl && <img src={imageUrl} alt={name} className="absolute inset-0 w-full h-full object-cover" />}
      </div>
      <div className="ma-playlist-info mt-1.5">
        <h3 className="ma-playlist-title-small">{name}</h3>
        <p className="ma-playlist-subtitle-small">Apple Music</p>
      </div>
    </a>
  );
};

export function MusicApp({ onClose, zIndex }: MusicAppProps) {
  const dragControls = useDragControls();

  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState<number | null>(null); // index into tracks
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Fetch playlist data
        const plRes = await fetch('/.netlify/functions/apple-playlist?v=1&id=pl.u-jV89aPVCdMkdxbA');
        
        if (plRes.ok) {
          const data = await plRes.json();
          if (alive && data && !data.error && data.tracks && data.tracks.length > 0) {
            // Shuffle and pick 6 tracks
            const shuffledTracks = [...data.tracks].sort(() => 0.5 - Math.random()).slice(0, 6);
            setTracks(shuffledTracks);
            setLoading(false);
            return;
          }
        }
        
        // Fallback to featured if API fails or returns no tracks
        const shuffled = [...FEATURED].sort(() => 0.5 - Math.random()).slice(0, 5);
        const results = await Promise.all(shuffled.map(lookup));
        if (alive) {
          setTracks(results.filter((t): t is Track => !!t?.previewUrl));
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
        if (alive) {
          const shuffled = [...FEATURED].sort(() => 0.5 - Math.random()).slice(0, 5);
          const results = await Promise.all(shuffled.map(lookup));
          setTracks(results.filter((t): t is Track => !!t?.previewUrl));
          setLoading(false);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const play = (i: number) => {
    const a = audioRef.current;
    if (!a) return;
    if (current === i) {
      playing ? a.pause() : a.play().catch(() => {});
      return;
    }
    a.src = tracks[i].previewUrl;
    a.play().catch(() => {});
    setCurrent(i);
  };

  const step = (dir: 1 | -1) => {
    if (current === null || !tracks.length) return;
    play((current + dir + tracks.length) % tracks.length);
  };

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const a = audioRef.current;
    if (a) a.currentTime = Number(e.target.value);
  };

  const cur = current !== null ? tracks[current] : null;

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center p-4 bg-transparent select-none pointer-events-none"
      style={{ zIndex }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        drag
        dragListener={false}
        dragControls={dragControls}
        dragMomentum={false}
        className="flex flex-col bg-[#1c1c1e] border border-white/10 rounded-xl overflow-hidden shadow-2xl shadow-black/50 w-[90vw] max-w-[600px] h-[550px] pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <style>{css}</style>
        {/* Window Header */}
        <div 
          onPointerDown={(e) => dragControls.start(e)}
          className="drag-handle cursor-grab active:cursor-grabbing bg-[#333333] h-12 px-4 flex items-center justify-between border-b border-black/30 shrink-0 relative pointer-events-auto"
        >
          <div className="flex space-x-2 z-10" onPointerDown={(e) => e.stopPropagation()}>
            <button 
              onClick={onClose}
              className="group w-[14px] h-[14px] rounded-full bg-[#FF5F56] border border-[#E0443E] flex items-center justify-center cursor-pointer transition-colors active:bg-[#C23C37]"
              title="Close"
            >
              <X className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity text-[#4C0002]" strokeWidth={3.5} />
            </button>
            <button 
              onClick={onClose}
              className="group w-[14px] h-[14px] rounded-full bg-[#FFBD2E] border border-[#DEA123] flex items-center justify-center cursor-pointer transition-colors active:bg-[#A97510]"
              title="Minimize"
            >
              <Minus className="w-2.5 h-2.5 text-[#5C3E00] opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={3.5} />
            </button>
            <button 
              onClick={onClose}
              className="group w-[14px] h-[14px] rounded-full bg-[#27C93F] border border-[#1AAB29] flex items-center justify-center cursor-pointer transition-colors active:bg-[#168119]"
              title="Maximize"
            >
              <span className="text-[8px] text-[#024B0E] font-extrabold opacity-0 group-hover:opacity-100 transition-opacity">+</span>
            </button>
          </div>
          
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex items-center">
              <span className="text-[15px] font-[600] tracking-wide text-slate-300 drop-shadow-sm">Music</span>
            </div>
          </div>
          
          <div className="w-12 z-10" />
        </div>

        {/* Music App Content */}
        <div className="ma-root">
          <div className="ma-body [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            
            {/* Profile Header section */}
            <div className="ma-profile-header">
              <div className="w-28 h-28 rounded-full mb-4 shadow-xl mx-auto overflow-hidden border border-white/10">
                <img 
                  src="https://is1-ssl.mzstatic.com/image/thumb/1-7nns4-KqfbpoapJVynew/486x486cc.webp" 
                  alt="Jacob Szczepaniak" 
                  className="w-full h-full object-cover"
                />
              </div>
              <h1 className="text-2xl font-bold mb-1 tracking-tight text-center">Jacob Szczepaniak</h1>
              <p className="text-[#fa243c] font-medium mb-6 text-center text-sm">@JacobSzczepaniak</p>
              
              <div className="flex justify-center mb-6">
                <a 
                  href={PROFILE_URL} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-6 py-2.5 bg-[#fa243c] hover:bg-[#d61e31] text-white font-semibold rounded-full transition-colors flex items-center space-x-2 shadow-lg text-sm"
                >
                  <span>Listen on Apple Music</span>
                  <ExternalLink size={14} />
                </a>
              </div>
            </div>

            <div className="ma-content-section mt-4">
              <h2 className="ma-section-title">What I've been listening to...</h2>
              {loading ? (
                <div className="ma-loading">Loading tracks…</div>
              ) : tracks.length === 0 ? (
                <div className="ma-loading">Couldn’t load tracks.</div>
              ) : (
                <ul className="ma-list">
                  {tracks.map((t, i) => {
                    const active = current === i;
                    return (
                      <li
                        key={t.id}
                        className={`ma-track${active ? " active" : ""}`}
                        onClick={() => play(i)}
                      >
                        <div className="relative overflow-hidden rounded-md flex-none">
                          <img src={hiRes(t.artwork)} alt="" className="w-[36px] h-[36px] object-cover" loading="lazy" />
                          {active && playing && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                              <span className="text-white text-[10px] drop-shadow-md">❚❚</span>
                            </div>
                          )}
                        </div>
                        <div className="ma-meta">
                          <span className="ma-name text-sm">{t.name}</span>
                          <span className="ma-artist text-[11px]">
                            {t.artist}
                          </span>
                        </div>
                        <span className="ma-icon">
                          {active && playing ? "" : "▶"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="ma-content-section">
              <h2 className="ma-section-title">My Playlists</h2>
              <div className="ma-playlist-grid-small">
                {[
                  { name: "summer 26", url: "https://music.apple.com/us/playlist/summer-26/pl.u-pMyll2viGXlX0o", color: "from-blue-400 to-cyan-500" },
                  { name: "back to classics", url: "https://music.apple.com/us/playlist/back-to-classics/pl.u-oZylK4YtRdeRWPN", color: "from-amber-500 to-orange-600" },
                  { name: "tworking", url: "https://music.apple.com/us/playlist/tworking/pl.u-oZylKAWtRdeRWPN", color: "from-pink-500 to-rose-600" },
                  { name: "T-Rex County", url: "https://music.apple.com/us/playlist/t-rex-county/pl.u-8aAVzreToDGozNM", color: "from-green-500 to-emerald-600" }
                ].map((pl, i) => (
                  <PlaylistCard key={i} name={pl.name} url={pl.url} defaultColor={pl.color} />
                ))}
              </div>
            </div>
          </div>

          {cur && (
            <footer className="ma-now">
              <img src={hiRes(cur.artwork)} alt="" />
              <div className="ma-now-meta">
                <span className="ma-name">{cur.name}</span>
                <span className="ma-artist">{cur.artist}</span>
                <div className="ma-scrub">
                  <span>{fmt(time)}</span>
                  <input
                    type="range"
                    min={0}
                    max={dur || 0}
                    step={0.1}
                    value={time}
                    onChange={seek}
                  />
                  <span>{fmt(dur)}</span>
                </div>
              </div>
              <div className="ma-controls">
                <button onClick={() => step(-1)} aria-label="Previous">⏮</button>
                <button
                  className="ma-play"
                  onClick={() => current !== null && play(current)}
                  aria-label="Play/Pause"
                >
                  {playing ? "❚❚" : "▶"}
                </button>
                <button onClick={() => step(1)} aria-label="Next">⏭</button>
              </div>
            </footer>
          )}

          <audio
            ref={audioRef}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
            onEnded={() => step(1)}
          />
        </div>
      </motion.div>
    </div>
  );
}

const css = `
.ma-root { display:flex; flex-direction:column; height:100%; background:#1c1c1e; color:#fff;
  font:14px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; overflow:hidden; flex: 1; }
.ma-profile-header { padding: 40px 20px 20px; border-bottom: 1px solid #2c2c2e; background: linear-gradient(to bottom, #2a2a2c, #1c1c1e); }
.ma-content-section { padding: 20px; }
.ma-section-title { font-size: 18px; font-weight: 700; margin: 0 0 16px 0; color: rgba(255,255,255,0.9); }
.ma-playlist-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
.ma-playlist-card { cursor: pointer; }
.ma-playlist-art { width: 100%; aspect-ratio: 1; border-radius: 12px; margin-bottom: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
.ma-playlist-title { font-size: 14px; font-weight: 600; color: #fff; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ma-playlist-subtitle { font-size: 12px; color: #98989d; margin: 2px 0 0 0; }
.ma-playlist-grid-small { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.ma-playlist-card-small { cursor: pointer; display: block; text-decoration: none; }
.ma-playlist-art-small { width: 100%; aspect-ratio: 1; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); }
.ma-playlist-title-small { font-size: 12px; font-weight: 600; color: #fff; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2; }
.ma-playlist-subtitle-small { font-size: 10px; color: #98989d; margin: 2px 0 0 0; line-height: 1.2; }
.ma-body { flex:1; overflow:auto; padding-bottom: 20px; }
.ma-list { list-style:none; margin:0; padding:0; }
.ma-track { display:flex; align-items:center; gap:12px; padding:10px; border-radius:8px; cursor:pointer; transition: background 0.2s; margin-bottom: 4px; }
.ma-track:hover { background:rgba(255,255,255,0.05); }
.ma-track.active { background:rgba(250, 36, 60, 0.15); }
.ma-meta, .ma-now-meta { display:flex; flex-direction:column; flex:1; min-width:0; justify-content: center; }
.ma-name { font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size: 15px; }
.ma-artist { color:#98989d; font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top: 2px; }
.ma-icon { color:#fa243c; width:20px; text-align:center; flex:none; font-size: 12px; }
.ma-loading { padding:24px; color:#98989d; text-align: center; }
.ma-now { display:flex; align-items:center; gap:16px; padding:12px 20px; border-top:1px solid #2c2c2e;
  background:rgba(28, 28, 30, 0.95); backdrop-filter: blur(10px); flex:none; }
.ma-now img { width:52px; height:52px; border-radius:8px; object-fit:cover; flex:none; box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
.ma-scrub { display:flex; align-items:center; gap:8px; font-size:11px; color:#98989d; margin-top:6px; }
.ma-scrub input { flex:1; accent-color:#fa243c; height:4px; cursor: pointer; }
.ma-controls { display:flex; align-items:center; gap:12px; flex:none; }
.ma-controls button { background:none; border:none; color:#fff; font-size:18px; cursor:pointer; padding:8px;
  border-radius:50%; line-height:1; transition: background 0.2s; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; }
.ma-controls button:hover { background:rgba(255,255,255,0.1); }
.ma-play { color:#fa243c !important; font-size:20px !important; }
`;
