import { getToken, clearToken } from "./spotify-auth.js";
import { getMe } from "./spotify-api.js";

const THEME_KEY = "pulse_theme";

const logoutBtn = document.getElementById("logoutBtn");
const backBtn = document.getElementById("backBtn");

const avatar = document.getElementById("avatar");
const displayName = document.getElementById("displayName");
const email = document.getElementById("email");
const country = document.getElementById("country");
const plan = document.getElementById("plan");

const themeDarkBtn = document.getElementById("themeDarkBtn");
const themeLightBtn = document.getElementById("themeLightBtn");

const errorBox = document.getElementById("errorBox");

function applyTheme() {
  const theme = localStorage.getItem(THEME_KEY) || "dark";
  document.body.classList.toggle("light-theme", theme === "light");

  themeDarkBtn.classList.toggle("active", theme === "dark");
  themeLightBtn.classList.toggle("active", theme === "light");
}

function setTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme();
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

function requireTokenOrBack() {
  const token = getToken();
  if (!token) {
    window.location.href = "index.html";
    return null;
  }
  logoutBtn.classList.remove("hidden");
  return token;
}

logoutBtn.addEventListener("click", () => {
  clearToken();
  window.location.href = "index.html";
});

backBtn.addEventListener("click", () => {
  if (window.history.length > 1) {
    window.history.back();
    return;
  }
  window.location.href = "index.html";
});

themeDarkBtn.addEventListener("click", () => setTheme("dark"));
themeLightBtn.addEventListener("click", () => setTheme("light"));

async function loadProfile(token) {
  const me = await getMe(token);

  displayName.textContent = me.display_name || "Unknown";
  email.textContent = me.email || "No email";
  country.textContent = `Country: ${me.country || "—"}`;
  plan.textContent = `Spotify plan: ${me.product || "—"}`;

  avatar.src = me.images?.[0]?.url || "";
  avatar.style.visibility = avatar.src ? "visible" : "hidden";
}

(async function boot() {
  try {
    applyTheme();
    setError(null);

    const token = requireTokenOrBack();
    if (!token) return;

    await loadProfile(token);
  } catch (e) {
    setError(e.message || String(e));
  }
})();