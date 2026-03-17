const API_BASE = "https://api.spotify.com/v1";

async function spotifyRequest(path, token, options = {}) {
  if (!token) {
    throw new Error("No token provided.");
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    throw new Error("Session expired. Please log in again.");
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Spotify API error (${res.status}): ${text}`);
  }

  if (res.status === 204) return null;

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return res.json();
  }

  return null;
}

async function spotifyGet(path, token) {
  return spotifyRequest(path, token, { method: "GET" });
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

export async function createPlaylist(token, userId, { name, description = "", isPublic = false }) {
  return spotifyRequest(`/users/${encodeURIComponent(userId)}/playlists`, token, {
    method: "POST",
    body: JSON.stringify({
      name,
      description,
      public: isPublic,
    }),
  });
}

export async function addTracksToPlaylist(token, playlistId, uris = []) {
  if (!uris.length) return null;

  return spotifyRequest(`/playlists/${encodeURIComponent(playlistId)}/tracks`, token, {
    method: "POST",
    body: JSON.stringify({ uris }),
  });
}