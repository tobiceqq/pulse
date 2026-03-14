const API_BASE = "https://api.spotify.com/v1";

async function spotifyGet(path, token) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 401) {
    throw new Error("Session expired. Please log in again.");
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Spotify API error (${res.status}): ${text}`);
  }

  return res.json();
}

export async function getMe(token) {
  return spotifyGet("/me", token);
}

export async function getTopArtists(token, range = "short_term", limit = 50) {
  const qs = new URLSearchParams({
    time_range: range,
    limit: String(limit),
  });
  return spotifyGet(`/me/top/artists?${qs.toString()}`, token);
}

export async function getTopTracks(token, range = "short_term", limit = 50) {
  const qs = new URLSearchParams({
    time_range: range,
    limit: String(limit),
  });
  return spotifyGet(`/me/top/tracks?${qs.toString()}`, token);
}

export async function getArtist(token, artistId) {
  return spotifyGet(`/artists/${encodeURIComponent(artistId)}`, token);
}

export async function getTrack(token, trackId) {
  return spotifyGet(`/tracks/${encodeURIComponent(trackId)}`, token);
}

export function msToMinSec(ms) {
  const total = Math.max(0, Math.floor((ms || 0) / 1000));
  const m = Math.floor(total / 60);
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}

export function formatNumber(value) {
  if (value == null || Number.isNaN(value)) return "—";
  try {
    return new Intl.NumberFormat().format(value);
  } catch {
    return String(value);
  }
}