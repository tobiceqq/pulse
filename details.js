import { getToken, clearToken } from "./spotify-auth.js";
import {
  getMe,
  getArtist,
  getTrack,
  msToMinSec,
  formatNumber,
} from "./spotify-api.js";

const THEME_KEY = "pulse_theme";

const logoutBtn = document.getElementById("logoutBtn");
const backBtn = document.getElementById("backBtn");

const detailsCard = document.getElementById("detailsCard");
const heroImg = document.getElementById("heroImg");
const heroType = document.getElementById("heroType");
const heroTitle = document.getElementById("heroTitle");
const heroSub = document.getElementById("heroSub");
const heroStats = document.getElementById("heroStats");
const openSpotify = document.getElementById("openSpotify");

const listCard = document.getElementById("listCard");
const listTitle = document.getElementById("listTitle");
const listStatus = document.getElementById("listStatus");
const listItems = document.getElementById("listItems");

const errorBox = document.getElementById("errorBox");

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

function setError(message) {
  if (!message) {
    errorBox.classList.add("hidden");
    errorBox.textContent = "";
    return;
  }
  errorBox.textContent = message;
  errorBox.classList.remove("hidden");
}

function statPill(label, value) {
  const el = document.createElement("div");
  el.className = "stat";
  el.innerHTML = `
    <div class="stat-k">${escapeHtml(label)}</div>
    <div class="stat-v">${escapeHtml(value)}</div>
  `;
  return el;
}

function itemRow(index, imgUrl, title, sub) {
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

function textRow(index, title, sub) {
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

logoutBtn?.addEventListener("click", () => {
  clearToken();
  window.location.href = "index.html";
});

backBtn?.addEventListener("click", () => {
  if (window.history.length > 1) {
    window.history.back();
    return;
  }
  window.location.href = "index.html";
});

function requireTokenOrBack() {
  const token = getToken();
  if (!token) {
    window.location.href = "index.html";
    return null;
  }
  logoutBtn?.classList.remove("hidden");
  return token;
}

function getParams() {
  const url = new URL(window.location.href);
  return {
    type: url.searchParams.get("type"),
    id: url.searchParams.get("id"),
  };
}

async function renderArtist(token, id) {
  listStatus.textContent = "Loading…";

  const artist = await getArtist(token, id);
  const img = artist.images?.[0]?.url || artist.images?.[1]?.url || "";
  const genres = artist.genres || [];

  heroType.textContent = "Artist";
  heroTitle.textContent = artist.name || "—";
  heroSub.textContent = genres.slice(0, 3).join(", ") || "No genres";

  heroImg.src = img;
  heroImg.style.visibility = img ? "visible" : "hidden";
  openSpotify.href = artist.external_urls?.spotify || "#";

  heroStats.innerHTML = "";
  heroStats.appendChild(statPill("Followers", formatNumber(artist.followers?.total)));
  heroStats.appendChild(statPill("Popularity", artist.popularity != null ? `${artist.popularity}/100` : "—"));
  heroStats.appendChild(statPill("Genres", String(genres.length)));

  listTitle.textContent = "Top genres";
  listItems.innerHTML = "";

  if (!genres.length) {
    listItems.innerHTML = `<div class="muted tiny">No genres found for this artist.</div>`;
  } else {
    genres.forEach((genre, i) => {
      listItems.appendChild(textRow(i + 1, genre, "Spotify genre tag"));
    });
  }

  listStatus.textContent = "";
  detailsCard.classList.remove("hidden");
  listCard.classList.remove("hidden");
}

async function renderTrack(token, id) {
  listStatus.textContent = "Loading…";

  const track = await getTrack(token, id);
  const img = track.album?.images?.[0]?.url || track.album?.images?.[1]?.url || "";
  const artistNames = (track.artists || []).map((x) => x.name).join(", ");

  heroType.textContent = "Track";
  heroTitle.textContent = track.name || "—";
  heroSub.textContent = artistNames || "—";

  heroImg.src = img;
  heroImg.style.visibility = img ? "visible" : "hidden";
  openSpotify.href = track.external_urls?.spotify || "#";

  heroStats.innerHTML = "";
  heroStats.appendChild(statPill("Length", msToMinSec(track.duration_ms)));
  heroStats.appendChild(statPill("Album", track.album?.name || "—"));
  heroStats.appendChild(statPill("Popularity", track.popularity != null ? `${track.popularity}/100` : "—"));

  listTitle.textContent = "More";
  listItems.innerHTML = "";

  const albumRow = itemRow(
    1,
    track.album?.images?.[2]?.url || track.album?.images?.[0]?.url || "",
    track.album?.name || "Album",
    `Release: ${track.album?.release_date || "—"}`
  );
  listItems.appendChild(albumRow);

  const artistDetails = await Promise.all(
    (track.artists || []).map(async (artist) => {
      try {
        return await getArtist(token, artist.id);
      } catch {
        return artist;
      }
    })
  );

  artistDetails.forEach((artist, i) => {
    const aImg = artist.images?.[2]?.url || artist.images?.[0]?.url || "";
    const genres = (artist.genres || []).slice(0, 2).join(", ");
    const popularity = artist.popularity != null ? `Popularity ${artist.popularity}/100` : "Popularity —";
    const sub = genres ? `${genres} • ${popularity}` : popularity;

    const row = itemRow(i + 2, aImg, artist.name || "Unknown artist", sub);
    row.classList.add("clickable");
    row.addEventListener("click", () => {
      window.location.href = `details.html?type=artist&id=${encodeURIComponent(artist.id)}`;
    });

    listItems.appendChild(row);
  });

  listStatus.textContent = "";
  detailsCard.classList.remove("hidden");
  listCard.classList.remove("hidden");
}

(async function boot() {
  try {
    applyTheme();
    setError(null);

    const token = requireTokenOrBack();
    if (!token) return;

    try {
      await getMe(token);
    } catch {
      clearToken();
      window.location.href = "index.html";
      return;
    }

    const { type, id } = getParams();
    if (!type || !id) {
      window.location.href = "index.html";
      return;
    }

    if (type === "artist") {
      await renderArtist(token, id);
      return;
    }

    if (type === "track") {
      await renderTrack(token, id);
      return;
    }

    window.location.href = "index.html";
  } catch (e) {
    setError(e.message || String(e));
  }
})();