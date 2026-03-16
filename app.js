import {
  startLogin,
  handleRedirectAndGetToken,
  getToken,
  clearToken,
  getGrantedScopes,
} from "./spotify-auth.js";

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

const REQUIRED_PLAYLIST_SCOPE = "playlist-modify-private";
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
let isCreatingPlaylist = false;

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
  playlistStatus.classList.remove("success", "error-text");
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
  if (range === "short_term") return "Top Tracks - 4 Weeks";
  if (range === "medium_term") return "Top Tracks - 6 Months";
  return "Top Tracks - 1 Year";
}

function hasPlaylistPermission() {
  return getGrantedScopes().includes(REQUIRED_PLAYLIST_SCOPE);
}

function updatePlaylistButtonState() {
  const canCreate =
    !isCreatingPlaylist &&
    !!currentUser?.id &&
    currentTracks.length > 0 &&
    hasPlaylistPermission();

  createPlaylistBtn.disabled = !canCreate;
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
    artistsBox.appendChild(itemCard(i + 1, img, a.name, sub));
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
    const artists = (t.artists || []).map((x) => x.name).join(", ");
    tracksBox.appendChild(itemCard(i + 1, img, t.name, artists || "—"));
  });
}

function renderGenres(items) {
  genresBox.innerHTML = "";
  if (!items?.length) {
    genresBox.innerHTML = `<div class="muted tiny">No top genres yet.</div>`;
    return;
  }

  items.forEach((g, i) => {
    genresBox.appendChild(textCard(i + 1, g.name, `${g.count} artist${g.count === 1 ? "" : "s"}`));
  });
}

async function loadProfile(token) {
  const me = await getMe(token);
  currentUser = me;

  displayName.textContent = me.display_name || "Unknown";
  email.textContent = me.email || "";
  avatar.src = me.images?.[0]?.url || "";
  avatar.style.visibility = avatar.src ? "visible" : "hidden";

  updatePlaylistButtonState();
}

async function loadStats(token) {
  setError(null);
  setPlaylistStatus("");
  currentTracks = [];
  updatePlaylistButtonState();

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
    updatePlaylistButtonState();
  } catch (e) {
    currentTracks = [];
    updatePlaylistButtonState();
    setError(e.message || String(e));
  } finally {
    setLoading("artists", false);
    setLoading("tracks", false);
    setLoading("genres", false);
  }
}

async function handleCreatePlaylist() {
  if (isCreatingPlaylist) return;

  const token = getToken();
  if (!token) {
    setPlaylistStatus("Please log in again.", "error");
    showLanding();
    return;
  }

  if (!hasPlaylistPermission()) {
    setPlaylistStatus("Missing playlist permission. Log in once again and approve Spotify access.", "error");
    return;
  }

  if (!currentUser?.id) {
    setPlaylistStatus("User profile is not loaded yet.", "error");
    return;
  }

  if (!currentTracks.length) {
    setPlaylistStatus("There are no tracks to add.", "error");
    return;
  }

  const uris = currentTracks.map((track) => track.uri).filter(Boolean);
  if (!uris.length) {
    setPlaylistStatus("No valid Spotify tracks were found.", "error");
    return;
  }

  isCreatingPlaylist = true;
  updatePlaylistButtonState();
  setPlaylistStatus("Creating playlist...");

  try {
    const playlist = await createPlaylist(token, currentUser.id, {
      name: `Pulse • ${getRangeLabel(currentRange)}`,
      description: `Created with Pulse from your current top tracks (${currentRange}).`,
      isPublic: false,
    });

    await addTracksToPlaylist(token, playlist.id, uris);

    setPlaylistStatus("Playlist created successfully.", "success");

    if (playlist?.external_urls?.spotify) {
      window.open(playlist.external_urls.spotify, "_blank", "noopener");
    }
  } catch (e) {
    setPlaylistStatus(e.message || String(e), "error");
  } finally {
    isCreatingPlaylist = false;
    updatePlaylistButtonState();
  }
}

loginBtn?.addEventListener("click", async () => {
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
  setError(null);
  setPlaylistStatus("");
  showLanding();
  updatePlaylistButtonState();
});

createPlaylistBtn?.addEventListener("click", handleCreatePlaylist);

document.querySelectorAll(".range .chip").forEach((btn) => {
  btn.addEventListener("click", async () => {
    document.querySelectorAll(".range .chip").forEach((b) => b.classList.remove("active"));
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

    await handleRedirectAndGetToken({
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
    });

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
    updatePlaylistButtonState();
  }
})();