const TOKEN_KEY = "pulse_token_v1";
const VERIFIER_KEY = "pulse_verifier_v1";

function base64UrlEncode(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function randomString(length = 64) {
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => charset[b % charset.length]).join("");
}

async function sha256(text) {
  const enc = new TextEncoder().encode(text);
  return crypto.subtle.digest("SHA-256", enc);
}

function readTokenData() {
  const raw = localStorage.getItem(TOKEN_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.access_token || !parsed?.expires_at) return null;
    if (Date.now() > parsed.expires_at) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function getToken() {
  const tokenData = readTokenData();
  return tokenData?.access_token || null;
}

export function getGrantedScopes() {
  const tokenData = readTokenData();
  const scopeString = tokenData?.scope || "";
  return scopeString.split(" ").map((s) => s.trim()).filter(Boolean);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(VERIFIER_KEY);
}

export async function startLogin({ clientId, redirectUri, scopes }) {
  const verifier = randomString(64);
  localStorage.setItem(VERIFIER_KEY, verifier);

  const challenge = base64UrlEncode(await sha256(verifier));

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: scopes.join(" "),
    code_challenge_method: "S256",
    code_challenge: challenge,
    show_dialog: "false",
  });

  window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export async function handleRedirectAndGetToken({ clientId, redirectUri }) {
  const url = new URL(window.location.href);

  const error = url.searchParams.get("error");
  if (error) {
    throw new Error(`Spotify auth error: ${error}`);
  }

  const code = url.searchParams.get("code");
  if (!code) return null;

  const verifier = localStorage.getItem(VERIFIER_KEY);
  if (!verifier) {
    throw new Error("Missing code verifier. Try logging in again.");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Token exchange failed (${res.status}). ${text}`);
  }

  const data = await res.json();
  const expires_at = Date.now() + (data.expires_in * 1000) - 5000;

  localStorage.setItem(
    TOKEN_KEY,
    JSON.stringify({
      access_token: data.access_token,
      expires_at,
      scope: data.scope || "",
      token_type: data.token_type || "Bearer",
    })
  );

  localStorage.removeItem(VERIFIER_KEY);

  url.searchParams.delete("code");
  url.searchParams.delete("state");
  url.searchParams.delete("error");
  window.history.replaceState({}, document.title, url.pathname + url.search);

  return data.access_token;
}