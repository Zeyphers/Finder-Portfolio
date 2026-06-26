export const handler = async (event: any) => {
  const id = event.queryStringParameters?.id;
  const storefront = event.queryStringParameters?.storefront || "us";
  
  const json = (obj: any, statusCode = 200) => ({
    statusCode,
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" },
    body: JSON.stringify(obj)
  });

  if (!id) return json({ error: "missing ?id=pl...." }, 400);

  const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

  try {
    const pageRes = await fetch('https://music.apple.com/us/playlist/' + id, {
      headers: { 'User-Agent': UA }
    });
    const html = await pageRes.text();

    const configMatch = html.match(/<meta name="desktop-music-app\/config\/environment" content="([^"]+)"/);
    if (!configMatch) throw new Error('Could not find config meta tag');
    
    const config = JSON.parse(decodeURIComponent(configMatch[1]));
    const token = config.MEDIA_API?.token;
    if (!token) throw new Error('Could not extract bearer token');

    const base = "https://amp-api.music.apple.com";
    const headers = {
      Authorization: `Bearer ${token}`,
      Origin: "https://music.apple.com",
      Referer: "https://music.apple.com/",
      "User-Agent": UA,
    };
    
    const apiUrl = `${base}/v1/catalog/${storefront}/playlists/${id}?include=tracks&extend=editorialArtwork`;
    const apiRes = await fetch(apiUrl, { headers });

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      return json({ error: errText }, apiRes.status);
    }

    const data = await apiRes.json();
    const pl = data.data?.[0];
    if (!pl) throw new Error("Playlist not found");

    const fmtArt = (a: any) =>
      a?.url
        ? a.url.replace(/\{w\}/, "300").replace(/\{h\}/, "300").replace(/\{c\}/, "bb").replace(/\{f\}/, "jpg")
        : "";

    let tracks = pl.relationships?.tracks?.data ?? [];
    let next = pl.relationships?.tracks?.next;
    
    // Fetch remaining tracks if paginated
    let iterations = 0;
    while (next && tracks.length < 300 && iterations < 5) {
      const r = await fetch(base + next + (next.includes("?") ? "&" : "?") + "l=en-US", { headers });
      if (!r.ok) break;
      const j = await r.json();
      tracks = tracks.concat(j.data ?? []);
      next = j.next;
      iterations++;
    }

    return json({
      name: pl.attributes?.name ?? "Playlist",
      artwork: fmtArt(pl.attributes?.artwork),
      tracks: tracks
        .filter((t: any) => t.type === "songs")
        .map((t: any) => ({
          id: t.id,
          name: t.attributes?.name,
          artist: t.attributes?.artistName,
          album: t.attributes?.albumName,
          artwork: fmtArt(t.attributes?.artwork),
          previewUrl: t.attributes?.previews?.[0]?.url ?? "",
          durationInMillis: t.attributes?.durationInMillis ?? 0,
        }))
        .filter((t: any) => t.previewUrl),
    });
  } catch (err: any) {
    return json({ error: String(err?.message || err) }, 502);
  }
};
