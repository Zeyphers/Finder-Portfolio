export const handler = async (event: any) => {
  const id = event.queryStringParameters?.id;
  const storefront = event.queryStringParameters?.storefront || "us";
  
  const json = (obj: any, statusCode = 200) => ({
    statusCode,
    headers: { 
      "Content-Type": "application/json", 
      "Cache-Control": statusCode === 200 ? "private, max-age=0" : "no-store" 
    },
    body: JSON.stringify(obj)
  });

  if (!id) return json({ error: "missing ?id=pl...." }, 400);

  const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

  try {
    // Step 1: Find the current JS bundle URL from music.apple.com homepage
    const pageRes = await fetch('https://music.apple.com/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    const html = await pageRes.text();

    const bundleMatch = html.match(/src="(\/assets\/index~[^"]+\.js)"/);
    if (!bundleMatch) throw new Error('Could not find JS bundle URL in music.apple.com HTML');
    const bundleUrl = 'https://music.apple.com' + bundleMatch[1];

    // Step 2: Fetch the bundle and extract the bearer token
    const bundleRes = await fetch(bundleUrl, {
      headers: { 'User-Agent': UA },
    });
    const bundleText = await bundleRes.text();

    // Token is embedded as: someVar="eyJ..."
    const tokenMatch = bundleText.match(
      /[a-zA-Z_$]{1,4}="(eyJ[A-Za-z0-9_-]{50,}\.[A-Za-z0-9_-]{50,}\.[A-Za-z0-9_-]{20,})"/
    );
    if (!tokenMatch) throw new Error('Could not extract bearer token from JS bundle');
    const token = tokenMatch[1];

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
