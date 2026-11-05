// frooters Team-App – Service Worker: Dateien dieser Version zusammen speichern (alles oder nichts, kein Mischstand).
// VERSION muss mit version.json, APP_VERSION in app.js und allen ?v= in index.html übereinstimmen.
const VERSION = "0.4.0";
const CACHE = "frooters-team-" + VERSION;
const DATEIEN = ["./", "index.html", "styles.css?v=" + VERSION, "logik.js?v=" + VERSION, "daten.js?v=" + VERSION, "app.js?v=" + VERSION,
  "manifest.webmanifest", "frootie.svg", "icon-192.png", "icon-512.png"];
self.addEventListener("install", (e) => {
  // Am Browser-Zwischenspeicher vorbei holen; die Seite muss genau zu dieser Version passen.
  e.waitUntil(Promise.all(DATEIEN.filter((u) => u !== "index.html").map((u) => fetch(new Request(u, { cache: "reload" })).then((r) => {
    if (!r.ok) throw new Error("Einrichten: " + u + " " + r.status);
    return u === "./" ? r.clone().text().then((t) => { if (!t.includes("app.js?v=" + VERSION)) throw new Error("Seite passt nicht zu " + VERSION); return [u, r]; }) : [u, r];
  }))).then((liste) => caches.open(CACHE).then((c) => Promise.all(liste.flatMap(([u, r]) => u === "./" ? [c.put(u, r.clone()), c.put("index.html", r)] : [c.put(u, r)])))));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x.startsWith("frooters-team-") && x !== CACHE).map((x) => caches.delete(x)))).then(() => self.clients.claim()));
});
self.addEventListener("message", (e) => { if (e.data === "jetzt-aktivieren") self.skipWaiting(); });
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.endsWith("/version.json")) return; // immer frisch vom Server
  // Seite: aus dem Speicher dieser Version (atomar); sonst Netz
  e.respondWith(caches.open(CACHE).then((c) => c.match(e.request, { ignoreSearch: false }).then((r) => r || (e.request.mode === "navigate" ? c.match("./") : null)).then((r) => r || fetch(e.request))));
});
