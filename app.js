import { startLogin, handleRedirectAndGetToken, getToken, clearToken } from "./spotify-auth.js";
import {
  getMe,
  getTopArtists,
  getTopTracks,
  createPlaylist,
  addTracksToPlaylist,
} from "./spotify-api.js";

const CLIENT_ID = "95a992ec0b484251be1e6dd3ada29d35";
const REDIRECT_URI = "https://tobiceqq.github.io/pulse/";

const SCOPES = [
  "user-top-read",
  "user-read-email",
  "user-read-private",
  "playlist-modify-private",
];

const THEME_KEY = "pulse_theme";
const TOP_LIMIT = 50;

const landing = document.getElementById("landing");
const dashboard = document.getElementById("dashboard");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const settingsBtn = document.getElementById("settingsBtn");

const avatar = document.getElementById("avatar");
const displayName = document.getElementById("displayName");
const email = document.getElementById("email");

const artistsBox = document.getElementById("artists");
const tracksBox = document.getElementById("tracks");
const genresBox = document.getElementById("genres");

const artistsStatus = document.getElementById("artistsStatus");
const tracksStatus = document.getElementById("tracksStatus");
const genresStatus = document.getElementById("genresStatus");

const createPlaylistBtn = document.getElementById("createPlaylistBtn");
const playlistStatus = document.getElementById("playlistStatus");

const errorBox = document.getElementById("errorBox");

let currentRange = "short_term";
let currentUser = null;
let currentTracks = [];

function applyTheme() {
  const theme = localStorage.getItem(THEME_KEY) || "dark";
  document.body.classList.toggle("light-theme", theme === "light");
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function itemCard(index, imgUrl, title, sub) {
  const el = document.createElement("div");
  el.className = "item";
  el.innerHTML = `
    <div class="rank">${index}.</div>
    <img alt="" src="${imgUrl || ""}" />
    <div class="meta">
      <div class="title">${escapeHtml(title)}</div>
      <div class="sub">${escapeHtml(sub)}</div>
    </div>
  `;
  return el;
}

function textCard(index, title, sub) {
  const el = document.createElement("div");
  el.className = "item item-text-only";
  el.innerHTML = `
    <div class="rank">${index}.</div>
    <div class="meta">
      <div class="title">${escapeHtml(title)}</div>
      <div class="sub">${escapeHtml(sub)}</div>
    </div>
  `;
  return el;
}

function setError(message) {
  if (!message) {
    errorBox.classList.add("hidden");
    errorBox.textContent = "";
    return;
  }
  errorBox.textContent = message;
  errorBox.classList.remove("hidden");
}

function setLoading(which, isLoading) {
  const value = isLoading ? "Loading…" : "";
  if (which === "artists") artistsStatus.textContent = value;
  if (which === "tracks") tracksStatus.textContent = value;
  if (which === "genres") genresStatus.textContent = value;
}

function setPlaylistStatus(message, type = "muted") {
  playlistStatus.textContent = message || "";
  playlistStatus.className = "muted tiny";
  if (type === "success") playlistStatus.classList.add("success");
  if (type === "error") playlistStatus.classList.add("error-text");
}

function showDashboard() {
  landing.classList.add("hidden");
  dashboard.classList.remove("hidden");
  logoutBtn.classList.remove("hidden");
  settingsBtn?.classList.remove("hidden");
}

function showLanding() {
  landing.classList.remove("hidden");
  dashboard.classList.add("hidden");
  logoutBtn.classList.add("hidden");
  settingsBtn?.classList.add("hidden");
}

function buildTopGenres(artists) {
  const genreCount = new Map();

  for (const artist of artists) {
    for (const genre of artist.genres || []) {
      genreCount.set(genre, (genreCount.get(genre) || 0) + 1);
    }
  }

  return [...genreCount.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, TOP_LIMIT)
    .map(([name, count]) => ({ name, count }));
}

function getRangeLabel(range) {
  if (range === "short_term") return "4 Weeks";
  if (range === "medium_term") return "6 Months";
  return "1 Year";
}

function renderArtists(items) {
  artistsBox.innerHTML = "";

  if (!items?.length) {
    artistsBox.innerHTML = `<div class="muted tiny">No top artists yet.</div>`;
    return;
  }

  items.forEach((a, i) => {
    const img = a.images?.[2]?.url || a.images?.[0]?.url || "";
    const genres = (a.genres || []).slice(0, 2).join(", ");
    const popularity = a.popularity != null ? `Popularity ${a.popularity}/100` : "Popularity —";
    const sub = genres ? `${genres} • ${popularity}` : popularity;

    const el = itemCard(i + 1, img, a.name, sub);
    el.classList.add("clickable");
    el.addEventListener("click", () => {
      window.location.href = `details.html?type=artist&id=${encodeURIComponent(a.id)}`;
    });

    artistsBox.appendChild(el);
  });
}

function renderTracks(items) {
  tracksBox.innerHTML = "";

  if (!items?.length) {
    tracksBox.innerHTML = `<div class="muted tiny">No top tracks yet.</div>`;
    return;
  }

  items.forEach((t, i) => {
    const img = t.album?.images?.[2]?.url || t.album?.images?.[0]?.url || "";
    const artists = (t.artists || []).map(x => x.name).join(", ");
    const el = itemCard(i + 1, img, t.name, artists || "—");

    el.classList.add("clickable");
    el.addEventListener("click", () => {
      window.location.href = `details.html?type=track&id=${encodeURIComponent(t.id)}`;
    });

    tracksBox.appendChild(el);
  });
}

function renderGenres(items) {
  genresBox.innerHTML = "";

  if (!items?.length) {
    genresBox.innerHTML = `<div class="muted tiny">No top genres yet.</div>`;
    return;
  }

  items.forEach((g, i) => {
    genresBox.appendChild(
      textCard(i + 1, g.name, `${g.count} artist${g.count === 1 ? "" : "s"}`)
    );
  });
}

async function loadProfile(token) {
  const me = await getMe(token);
  currentUser = me;

  displayName.textContent = me.display_name || "Unknown";
  email.textContent = me.email || "";
  avatar.src = me.images?.[0]?.url || "";
  avatar.style.visibility = avatar.src ? "visible" : "hidden";
}

async function loadStats(token) {
  setError(null);
  setPlaylistStatus("");
  createPlaylistBtn.disabled = true;

  setLoading("artists", true);
  setLoading("tracks", true);
  setLoading("genres", true);

  try {
    const [artistsRes, tracksRes] = await Promise.all([
      getTopArtists(token, currentRange, TOP_LIMIT),
      getTopTracks(token, currentRange, TOP_LIMIT),
    ]);

    const artistItems = artistsRes.items || [];
    const trackItems = tracksRes.items || [];
    const genreItems = buildTopGenres(artistItems);

    currentTracks = trackItems;

    renderArtists(artistItems);
    renderTracks(trackItems);
    renderGenres(genreItems);

    createPlaylistBtn.disabled = !currentTracks.length;
  } catch (e) {
    currentTracks = [];
    createPlaylistBtn.disabled = true;
    setError(e.message || String(e));
  } finally {
    setLoading("artists", false);
    setLoading("tracks", false);
    setLoading("genres", false);
  }
}

async function handleCreatePlaylist() {
  const token = getToken();
  if (!token) return;

  if (!currentUser?.id) {
    setPlaylistStatus("User profile not loaded.", "error");
    return;
  }

  if (!currentTracks.length) {
    setPlaylistStatus("No tracks found to create playlist.", "error");
    return;
  }

  createPlaylistBtn.disabled = true;
  setPlaylistStatus("Creating playlist...");

  try {
    const name = `Pulse • ${getRangeLabel(currentRange)}`;
    const description = `My top tracks from the last ${getRangeLabel(currentRange).toLowerCase()}, created via Pulse.`;
    
    // 1. Create playlist
    const playlist = await createPlaylist(token, currentUser.id, {
      name,
      description,
      isPublic: false
    });

    // 2. Add tracks
    const trackUris = currentTracks.map(t => t.uri);
    await addTracksToPlaylist(token, playlist.id, trackUris);

    setPlaylistStatus("Playlist created successfully!", "success");
    
    // Open in new tab
    if (playlist.external_urls?.spotify) {
      window.open(playlist.external_urls.spotify, "_blank");
    }
  } catch (e) {
    console.error(e);
    setPlaylistStatus("Failed to create playlist.", "error");
  } finally {
    createPlaylistBtn.disabled = false;
  }
}

loginBtn?.addEventListener("click", async () => {
  if (!CLIENT_ID || CLIENT_ID === "PASTE_YOUR_CLIENT_ID_HERE") {
    setError("Set your CLIENT_ID in app.js first.");
    return;
  }

  await startLogin({
    clientId: CLIENT_ID,
    redirectUri: REDIRECT_URI,
    scopes: SCOPES,
  });
});

logoutBtn?.addEventListener("click", () => {
  clearToken();
  currentUser = null;
  currentTracks = [];
  showLanding();
  setError(null);
  setPlaylistStatus("");
});

createPlaylistBtn?.addEventListener("click", handleCreatePlaylist);

document.querySelectorAll(".chip").forEach((btn) => {
  btn.addEventListener("click", async () => {
    document.querySelectorAll(".chip").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentRange = btn.dataset.range;

    const token = getToken();
    if (!token) {
      showLanding();
      return;
    }

    await loadStats(token);
  });
});

(async function boot() {
  try {
    applyTheme();
    
    if (CLIENT_ID && CLIENT_ID !== "PASTE_YOUR_CLIENT_ID_HERE") {
      await handleRedirectAndGetToken({
        clientId: CLIENT_ID,
        redirectUri: REDIRECT_URI,
      });
    }

    const token = getToken();
    if (!token) {
      showLanding();
      return;
    }

    showDashboard();
    await loadProfile(token);
    await loadStats(token);
  } catch (e) {
    clearToken();
    currentUser = null;
    currentTracks = [];
    showLanding();
    setError(e.message || String(e));
    setPlaylistStatus("");
  }
})();