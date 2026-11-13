// frooters Team-App – Büro: Ordner je Rolle, Grafik- & Druckstudio im frooters-Design (window.FRB).
// Reine Bausteine ohne Zustand: Vorlagen, Rechte und das Zeichnen der Druckblätter. Speichern macht app.js.
(function (root, fabrik) {
  if (typeof module === "object" && module.exports) module.exports = fabrik(require("./logik.js"));
  else root.FRB = fabrik(root.FRL);
})(typeof self !== "undefined" ? self : this, function (L) {
  "use strict";
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // Ordner im Büro-Regal. rollen = wer sie standardmäßig sieht (der Inhaber sieht alle). Der Inhaber kann das unter „Freigaben“ ändern.
  const ORDNER = [
    { id: "studio", sym: "🎨", t: "Grafik & Druck", u: "Preislisten, Schilder, Aushänge", farbe: "#c10230", rollen: ["shopleitung", "stv", "qualitaet", "bezirk"] },
    { id: "shop", sym: "📁", t: "Shop-Ordner", u: "Anweisungen, Geräte, Center", farbe: "#4f8a12", rollen: ["shopleitung", "stv"] },
    { id: "hygiene", sym: "🧼", t: "Hygiene-Dokumentation", u: "Berichte für Kontrolle und Berater", farbe: "#3f7f8c", rollen: ["shopleitung", "stv", "qualitaet", "berater", "bezirk"] },
    { id: "adressen", sym: "📒", t: "Adressbuch", u: "Lieferanten, Techniker, Center", farbe: "#8a7a4e", rollen: ["shopleitung", "stv", "qualitaet", "bezirk"] },
    { id: "lohn", sym: "📤", t: "Stunden & Lohn", u: "Stundenliste für den Steuerberater", farbe: "#6b6f86", rollen: ["shopleitung", "bezirk"] },
    { id: "archiv", sym: "🗄️", t: "Archiv", u: "Alle gespeicherten Drucke", farbe: "#5f5a57", rollen: ["shopleitung", "stv", "qualitaet", "bezirk"] },
    { id: "personal", sym: "👥", t: "Personalakte", u: "Verträge, Belehrungen, Schulungen", farbe: "#7d4a63", rollen: [] },
    { id: "briefe", sym: "✉️", t: "Briefe", u: "Briefbogen im frooters-Design", farbe: "#a3a983", rollen: ["bezirk", "qualitaet"] },
    { id: "zentrale", sym: "🏢", t: "Zentrale-Ablage", u: "Unterlagen der Geschäftsführung", farbe: "#1d1d1b", rollen: [] },
    { id: "auswertung", sym: "📊", t: "Auswertungen", u: "Alle Filialen einzeln und gesamt", farbe: "#4a6a8a", rollen: [] },
    { id: "freigaben", sym: "🔐", t: "Freigaben", u: "Wer sieht welchen Ordner", farbe: "#55606b", rollen: [], fest: true },
    // Ordner, die direkt in einen Bereich der App führen (go). Sie stehen nur im Büro, wenn die Person den Bereich öffnen darf.
    { id: "mitarbeiter", sym: "👤", t: "Mitarbeiter", u: "Stammdaten, Stunden, Einsatz", farbe: "#6a7a74", rollen: ["shopleitung", "bezirk"], go: "ma" },
    { id: "einsatz", sym: "🗓️", t: "Urlaub & Einsatz", u: "Urlaubsübersicht der Filialen", farbe: "#8b6f5a", rollen: ["shopleitung", "stv", "bezirk"], go: "urlaubsuebersicht" },
    { id: "bestellung", sym: "📦", t: "Bestellung", u: "Bestand, Bestellliste, Lieferungen", farbe: "#7a5c3e", rollen: ["shopleitung", "stv", "bezirk"], go: "bestellung" },
    { id: "schulungen", sym: "🎓", t: "Schulungen & Belehrungen", u: "Wer braucht wann eine Auffrischung", farbe: "#5d6f82", rollen: ["qualitaet", "bezirk", "shopleitung"] },
    { id: "regeln", sym: "📋", t: "Hygieneregeln", u: "Regeln und Geräte für alle Filialen", farbe: "#2f6f7a", rollen: ["qualitaet"], go: "regeln" },
    { id: "rezepte", sym: "📝", t: "Rezepte & Allergene", u: "Zutaten, Allergene, Freigaben", farbe: "#a1866f", rollen: ["qualitaet", "shopleitung"], go: "rezeptpflege" },
    { id: "bezirk", sym: "🗺️", t: "Mein Bezirk", u: "Filialen im Vergleich", farbe: "#55703f", rollen: ["bezirk"] },
    { id: "lieferanten", sym: "🚚", t: "Artikel & Lieferanten", u: "Für Sortiment und Bestellung", farbe: "#6e6a5c", rollen: [], go: "artikel" },
    { id: "betreiber", sym: "🤝", t: "Betreiber & Franchise", u: "Eigene Datenbank je Betreiber", farbe: "#4a4f63", rollen: [], go: "admin" },
  ];
  const FREIGABE_ROLLEN = [["bezirk", "Bezirksleitung"], ["shopleitung", "Shopleitung"], ["stv", "Stellv. Shopleitung"], ["qualitaet", "Hygiene & Qualität"], ["berater", "Hygieneberater"]];
  // Jede Rolle hat ihr eigenes Büro: Name, was auf dem Schreibtisch steht. Die Ordner ergeben sich aus den Rechten (darfOrdner) und überschneiden sich.
  const BUEROS = {
    zentrale: { titel: "Büro Inhaber", schild: "Inhaber", dinge: ["lampe", "monitor", "kalender", "korb", "drucker", "handy", "kaffee", "fueller", "telefon", "tastatur", "rechner"] },
    bezirk: { titel: "Büro Bezirksleitung", schild: "Bezirksleitung", dinge: ["lampe", "monitor", "kalender", "korb", "drucker", "landkarte", "kaffee", "fueller", "telefon", "tastatur", "rechner"] },
    qualitaet: { titel: "Büro Hygiene & Qualität", schild: "Hygienebeauftragte", dinge: ["lampe", "monitor", "kalender", "korb", "drucker", "thermometer", "kaffee", "rezeptbuch", "klemmbrett", "tastatur", "rechner"] },
    shopleitung: { titel: "Büro Shopleitung", schild: "Shopleitung", dinge: ["lampe", "monitor", "kalender", "korb", "drucker", "handy", "kaffee", "fueller", "telefon", "tastatur", "rechner"] },
    stv: { titel: "Büro Stellvertretung", schild: "Stellv. Shopleitung", dinge: ["lampe", "monitor", "kalender", "korb", "drucker", "kaffee", "klemmbrett", "rechner"] },
    berater: { titel: "Büro Hygieneberatung", schild: "Hygieneberater", dinge: ["lampe", "monitor", "kalender", "drucker", "thermometer", "kaffee", "klemmbrett", "rechner"] },
  };

  function darfOrdner(state, rolle, ordnerId) {
    const o = ORDNER.find((x) => x.id === ordnerId);
    if (!o) return false;
    if (rolle === "zentrale") return true;
    if (o.fest) return false;
    const r = ((state.buero || {}).rechte || {})[o.id];
    return r && r[rolle] != null ? !!r[rolle] : o.rollen.includes(rolle);
  }

  // ---------- Etiketten mit Barcode (wie die Preisetiketten der Club-App, in verschiedenen Maßen) ----------
  // Code 128 (Strichcode): Zeichensatz B für Text, C für gerade Ziffernfolgen. Liefert die Breiten der Striche und Lücken (Module) mit Ruhezone.
  const C128 = ["212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213", "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132", "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211", "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313", "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331", "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111", "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214", "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111", "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141", "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141", "114131", "311141", "411131", "211412", "211214", "211232", "2331112"];
  function code128(text) {
    const t = String(text || "");
    if (!t || /[^\x20-\x7e]/.test(t)) return null;
    const werte = [];
    if (/^\d+$/.test(t) && t.length % 2 === 0 && t.length >= 4) { werte.push(105); for (let i = 0; i < t.length; i += 2) werte.push(Number(t.slice(i, i + 2))); }
    else { werte.push(104); for (const z of t) werte.push(z.charCodeAt(0) - 32); }
    let summe = werte[0]; for (let i = 1; i < werte.length; i++) summe += werte[i] * i;
    werte.push(summe % 103, 106);
    return werte.map((w) => C128[w]).join("").split("").map(Number);
  }
  function code128Svg(text, hoeheMm) {
    const b = code128(text); if (!b) return "";
    const ruhe = 10, gesamt = b.reduce((a, x) => a + x, 0) + 2 * ruhe;
    let x = ruhe, r = "";
    b.forEach((w, i) => { if (i % 2 === 0) r += `<rect x="${x}" y="0" width="${w}" height="40"/>`; x += w; });
    return `<svg class="et-strich" viewBox="0 0 ${gesamt} 40" preserveAspectRatio="none" style="height:${hoeheMm}mm" role="img" aria-label="Strichcode ${esc(text)}"><rect width="${gesamt}" height="40" fill="#fff"/><g fill="#000">${r}</g></svg>`;
  }
  // QR-Code als SVG über den QR-Baustein (lib/qrcode, wie in der Club-App); ohne Baustein leer
  function qrSvg(qr, text) {
    if (!qr || !text) return "";
    try { const q = qr(0, "M"); q.addData(String(text)); q.make(); return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); } catch (e) { return ""; }
  }
  // Maße in Millimetern (Breite × Höhe): quadratisch wie in der Club-App, dazu Regal- und Lageretiketten
  const ET_FORMATE = [{ id: "80x80", w: 80, h: 80, t: "8 × 8 cm" }, { id: "70x70", w: 70, h: 70, t: "7 × 7 cm" }, { id: "60x60", w: 60, h: 60, t: "6 × 6 cm" }, { id: "50x50", w: 50, h: 50, t: "5 × 5 cm" },
    { id: "70x40", w: 70, h: 40, t: "7 × 4 cm (Regal)" }, { id: "50x30", w: 50, h: 30, t: "5 × 3 cm (Lager)" }];
  // A4 (210 × 297 mm), rundum mindestens 6 mm Rand, Etiketten stoßen aneinander
  const etRaster = (f) => ({ sp: Math.floor(198 / f.w), ze: Math.floor(285 / f.h) });
  // Preise „3,5 / 4,9 / 5,9“ je Größe; leere oder fehlende Preise bleiben „… €“ (nie geraten)
  function etPreise(text, groessen) {
    const teile = String(text || "").split("/").map((x) => x.trim());
    return (groessen && groessen.length ? groessen : [""]).map((g, i) => ({ g, p: preisTxt(teile[i] || "") }));
  }

  // ---------- Büro einrichten (wie in der Club-App): Teile umstellen, Zusatzkatalog ----------
  // Katalog: weitere Teile mit Aufgabe (go = Bereich, ordner = Büro-Ordner, deko = nur zum Anschauen). Höchstens KATALOG_MAX Stück.
  const KATALOG_MAX = 4;
  const KATALOG = [
    { id: "uhr", t: "Tischuhr", u: "Zeigt die Uhrzeit. Antippen: wer heute da ist (Leitung) oder Stechuhr", go: "stempelzeiten", go2: "stechuhr" },
    { id: "register", t: "Dreh-Adressregister", u: "Antippen: Adressbuch", ordner: "adressen" },
    { id: "kopierer", t: "Kopierer", u: "Antippen: Archiv mit allen Drucken zum erneuten Drucken", ordner: "archiv" },
    { id: "becher", t: "frooters-Becher", u: "Antippen: Rezepte", go: "rezepte" },
    { id: "figur", t: "Frootie-Figur", u: "Antippen: Frag Frootie", go: "hilfe" },
    { id: "rahmen", t: "Teamfoto", u: "Antippen: dein Team", go: "team" },
    { id: "pflanze", t: "Pflanze", u: "Deko – will ab und zu gegossen werden", deko: true },
  ];
  // Reihenfolge der Teile: gespeicherte Folge zuerst, Unbekanntes und Neues hinten; Zusatzteile nur aus dem erlaubten Katalog
  function einrichtungAnwenden(basis, einr, erlaubt) {
    const e = einr || {}, extra = (e.extra || []).filter((id, i, a) => a.indexOf(id) === i && (erlaubt || KATALOG.map((k) => k.id)).includes(id) && !basis.includes(id)).slice(0, KATALOG_MAX);
    const alle = [...basis, ...extra], folge = (e.folge || []).filter((id) => alle.includes(id));
    return [...folge, ...alle.filter((id) => !folge.includes(id))];
  }
  function teileTauschen(liste, a, b) { const l = [...liste], i = l.indexOf(a), j = l.indexOf(b); if (i < 0 || j < 0) return l; [l[i], l[j]] = [l[j], l[i]]; return l; }
  function teilSchieben(liste, id, r) { const l = [...liste], i = l.indexOf(id), j = i + r; if (i < 0 || j < 0 || j >= l.length) return l; [l[i], l[j]] = [l[j], l[i]]; return l; }

  // Schreibtisch-Teile (selbst gezeichnet, aus der Club-App übernommen und an frooters angepasst)
  const BU_SVG = {
  lampe: (an) => `<svg viewBox="0 0 70 90" aria-hidden="true" style="overflow:visible">${an ? '<path d="M47 33 L58 21 L132 64 L92 94 Z" fill="rgba(255,231,150,.42)"/>' : ""}<g transform="rotate(-32 40 19)"><path d="M60 8 L30 4 L20 30 L50 34 Z" fill="${an ? "#f2c14e" : "#2f3b4a"}"/><circle cx="35" cy="33" r="${an ? 4 : 0}" fill="#fff6c8"/></g>
    <path d="M32 8 L16 46 L34 80" fill="none" stroke="#3a3f45" stroke-width="4" stroke-linecap="round"/><ellipse cx="34" cy="84" rx="18" ry="5" fill="#3a3f45"/></svg>`,
  korb: '<svg viewBox="0 0 100 70" aria-hidden="true"><rect x="10" y="18" width="80" height="10" fill="#fff" transform="rotate(-3 50 23)"/><rect x="12" y="12" width="76" height="10" fill="#f4f4f4" transform="rotate(2 50 17)"/><path d="M4 26 H96 L88 62 H12 Z" fill="#5b6770"/><path d="M4 26 H96" stroke="#3c454c" stroke-width="4"/><rect x="38" y="40" width="24" height="6" rx="3" fill="#3c454c"/></svg>',
  handy: '<svg viewBox="0 0 50 90" aria-hidden="true"><rect x="5" y="3" width="40" height="84" rx="8" fill="#1d1f22"/><rect x="9" y="11" width="32" height="64" rx="3" fill="#4f8a12"/><rect x="13" y="18" width="20" height="9" rx="4" fill="#e7f5ec"/><rect x="17" y="32" width="20" height="9" rx="4" fill="#fff"/><rect x="13" y="46" width="16" height="9" rx="4" fill="#e7f5ec"/><circle cx="25" cy="81" r="3" fill="#3a3d42"/></svg>',
  kaffee: '<svg viewBox="0 0 50 50" aria-hidden="true"><ellipse cx="22" cy="44" rx="20" ry="5" fill="#e6ddd3"/><path d="M8 18 H36 V34 A10 10 0 0 1 26 44 H18 A10 10 0 0 1 8 34 Z" fill="#fff"/><path d="M36 22 A6 6 0 0 1 36 34" fill="none" stroke="#fff" stroke-width="4"/><ellipse cx="22" cy="18" rx="14" ry="3" fill="#6b4226"/></svg>',
  karte: '<svg viewBox="0 0 60 50" aria-hidden="true"><path d="M6 46 L30 40 L54 46 L54 10 L30 4 L6 10 Z" fill="#fff6e8" stroke="#e3c9a3"/><path d="M30 4 V40" stroke="#e3c9a3"/><text x="18" y="30" font-size="16" text-anchor="middle">🎂</text><text x="42" y="22" font-size="6" fill="#c10230" text-anchor="middle">Alles</text><text x="42" y="30" font-size="6" fill="#c10230" text-anchor="middle">Gute!</text></svg>',
  fueller: '<svg viewBox="0 0 60 70" aria-hidden="true"><path d="M14 44 H46 L50 66 H10 Z" fill="#23304a"/><rect x="18" y="38" width="24" height="8" rx="2" fill="#3a4a6a"/><ellipse cx="30" cy="40" rx="10" ry="2.5" fill="#0b1630"/><path d="M33 40 L48 4 L53 6 L38 42 Z" fill="#c10230"/><path d="M33 40 L36 42 L34 46 Z" fill="#d4af37"/><rect x="44" y="6" width="7" height="3" fill="#d4af37" transform="rotate(22 47 7)"/></svg>',
  telefon: '<svg viewBox="0 0 110 80" aria-hidden="true"><path d="M10 70 L22 34 H88 L100 70 Z" fill="#2b2f34"/><rect x="34" y="40" width="42" height="24" rx="3" fill="#3d434a"/><g fill="#cfd6dc"><rect x="38" y="44" width="9" height="5" rx="1"/><rect x="51" y="44" width="9" height="5" rx="1"/><rect x="64" y="44" width="9" height="5" rx="1"/><rect x="38" y="52" width="9" height="5" rx="1"/><rect x="51" y="52" width="9" height="5" rx="1"/><rect x="64" y="52" width="9" height="5" rx="1"/></g><path d="M8 30 Q55 8 102 30 L96 40 Q55 22 14 40 Z" fill="#b3261e"/><rect x="82" y="44" width="12" height="16" rx="2" fill="#9fd8b3"/></svg>',
  scanner: '<svg viewBox="0 0 110 30" aria-hidden="true"><rect x="6" y="10" width="98" height="16" rx="4" fill="#cdd3d8"/><rect x="20" y="3" width="70" height="9" rx="2" fill="#fff"/><path d="M14 18 H96" stroke="#aeb6bd" stroke-width="2"/></svg>',
  drucker: '<svg viewBox="0 0 110 56" aria-hidden="true"><rect x="6" y="0" width="98" height="40" rx="6" fill="#e9ecef"/><rect x="22" y="22" width="66" height="8" rx="2" fill="#9aa4ad"/><rect x="28" y="28" width="54" height="26" fill="#fff" stroke="#d8dde1"/><circle cx="92" cy="12" r="3" fill="#4f8a12"/></svg>',
  rechner: '<svg viewBox="0 0 80 100" aria-hidden="true"><rect x="6" y="4" width="68" height="92" rx="8" fill="#3a3f45"/><rect x="14" y="12" width="52" height="18" rx="3" fill="#b9d3a8"/><text x="62" y="26" font-size="12" text-anchor="end" fill="#22301a" font-family="monospace">5×22</text><g fill="#e8ebee"><rect x="14" y="38" width="10" height="9" rx="2"/><rect x="28" y="38" width="10" height="9" rx="2"/><rect x="42" y="38" width="10" height="9" rx="2"/><rect x="56" y="38" width="10" height="9" rx="2" fill="#f2a23a"/><rect x="14" y="52" width="10" height="9" rx="2"/><rect x="28" y="52" width="10" height="9" rx="2"/><rect x="42" y="52" width="10" height="9" rx="2"/><rect x="56" y="52" width="10" height="9" rx="2" fill="#f2a23a"/><rect x="14" y="66" width="10" height="9" rx="2"/><rect x="28" y="66" width="10" height="9" rx="2"/><rect x="42" y="66" width="10" height="9" rx="2"/><rect x="56" y="66" width="10" height="23" rx="2" fill="#f2a23a"/><rect x="14" y="80" width="24" height="9" rx="2"/><rect x="42" y="80" width="10" height="9" rx="2"/></g></svg>',
  tastatur: '<svg viewBox="0 0 220 70" aria-hidden="true"><rect x="4" y="6" width="212" height="58" rx="8" fill="#f2f2f2" stroke="#c9c9c9"/><g fill="#fff" stroke="#d2d2d2">' + [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => `<rect x="${12 + i * 19}" y="14" width="16" height="12" rx="2"/>`).join("") + '<rect x="183" y="14" width="25" height="12" rx="2"/>' + [0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<rect x="${12 + i * 19}" y="30" width="16" height="12" rx="2"/>`).join("") + '<rect x="164" y="30" width="44" height="12" rx="2"/><rect x="12" y="46" width="30" height="12" rx="2"/><rect x="45" y="46" width="118" height="12" rx="2"/><rect x="166" y="46" width="42" height="12" rx="2"/></g></svg>',
  // frooters-Ergänzungen: Thermometer (Hygiene), Rezeptbuch, Landkarte (Bezirk), Klemmbrett
  thermometer: '<svg viewBox="0 0 40 90" aria-hidden="true"><rect x="13" y="4" width="14" height="62" rx="7" fill="#fff" stroke="#9aa4ad" stroke-width="2"/><rect x="17" y="24" width="6" height="44" rx="3" fill="#c10230"/><circle cx="20" cy="74" r="12" fill="#c10230" stroke="#9aa4ad" stroke-width="2"/><g stroke="#9aa4ad" stroke-width="2"><path d="M27 16 H32"/><path d="M27 28 H32"/><path d="M27 40 H32"/><path d="M27 52 H32"/></g></svg>',
  rezeptbuch: '<svg viewBox="0 0 80 64" aria-hidden="true"><path d="M40 10 C28 4 14 4 4 8 V58 C14 54 28 54 40 60 Z" fill="#fffdf6" stroke="#d8cfbf"/><path d="M40 10 C52 4 66 4 76 8 V58 C66 54 52 54 40 60 Z" fill="#fff" stroke="#d8cfbf"/><path d="M40 10 V60" stroke="#c9bfae"/><text x="22" y="34" font-size="14" text-anchor="middle">🍓</text><g stroke="#c9bfae" stroke-width="2"><path d="M48 20 H68"/><path d="M48 28 H68"/><path d="M48 36 H64"/><path d="M48 44 H68"/></g></svg>',
  landkarte: '<svg viewBox="0 0 100 70" aria-hidden="true"><path d="M4 12 L34 4 L66 12 L96 4 V58 L66 66 L34 58 L4 66 Z" fill="#eef6e2" stroke="#a3a983" stroke-width="2"/><path d="M34 4 V58 M66 12 V66" stroke="#a3a983" stroke-width="2"/><path d="M14 46 C30 30 48 50 60 30 S84 20 90 26" fill="none" stroke="#4f8a12" stroke-width="3" stroke-dasharray="5 4"/><circle cx="14" cy="46" r="5" fill="#c10230"/><circle cx="60" cy="30" r="5" fill="#c10230"/><circle cx="88" cy="26" r="5" fill="#c10230"/></svg>',
  klemmbrett: '<svg viewBox="0 0 64 84" aria-hidden="true"><rect x="4" y="8" width="56" height="74" rx="5" fill="#a07a4f"/><rect x="10" y="16" width="44" height="60" fill="#fff"/><rect x="22" y="3" width="20" height="10" rx="3" fill="#9aa4ad"/><g stroke="#4f8a12" stroke-width="3" fill="none"><path d="M15 28 l4 4 l7 -8"/><path d="M15 44 l4 4 l7 -8"/></g><g stroke="#c9bfae" stroke-width="2"><path d="M30 29 H49"/><path d="M30 45 H49"/><path d="M30 61 H49"/></g><rect x="15" y="56" width="10" height="10" fill="none" stroke="#9aa4ad" stroke-width="2"/></svg>',
  uhr: (d) => { const n = d || new Date(), h = (n.getHours() % 12) * 30 + n.getMinutes() * 0.5, m = n.getMinutes() * 6; return `<svg viewBox="0 0 70 80" aria-hidden="true"><rect x="12" y="62" width="46" height="12" rx="4" fill="#8b6440"/><circle cx="35" cy="36" r="30" fill="#c10230"/><circle cx="35" cy="36" r="24" fill="#fffdf8"/>${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => `<rect x="34" y="14" width="2" height="${i % 3 ? 3 : 5}" fill="#3b2f2a" transform="rotate(${i * 30} 35 36)"/>`).join("")}<rect x="33.5" y="22" width="3" height="15" rx="1.5" fill="#1d1d1b" transform="rotate(${h} 35 36)"/><rect x="34.2" y="15" width="1.6" height="22" rx=".8" fill="#4f8a12" transform="rotate(${m} 35 36)"/><circle cx="35" cy="36" r="2.5" fill="#1d1d1b"/></svg>`; },
  register: '<svg viewBox="0 0 90 70" aria-hidden="true"><path d="M14 66 L22 40 H68 L76 66 Z" fill="#3a3f45"/><circle cx="45" cy="34" r="6" fill="#9aa4ad"/><path d="M8 34 H82" stroke="#9aa4ad" stroke-width="4" stroke-linecap="round"/><g fill="#fffdf8" stroke="#c9bfae">' + [-36, -18, 0, 18, 36].map((a) => `<rect x="30" y="6" width="30" height="24" rx="2" transform="rotate(${a} 45 34)"/>`).join("") + '</g><rect x="30" y="8" width="30" height="24" rx="2" fill="#fff" stroke="#c10230"/><path d="M34 15 H56 M34 21 H50" stroke="#c9bfae" stroke-width="2"/></svg>',
  kopierer: '<svg viewBox="0 0 110 80" aria-hidden="true"><rect x="8" y="20" width="94" height="56" rx="6" fill="#e9ecef" stroke="#c9cfd4"/><rect x="14" y="8" width="82" height="14" rx="3" fill="#cdd3d8"/><rect x="24" y="2" width="60" height="9" fill="#fff" stroke="#d8dde1"/><rect x="18" y="32" width="40" height="10" rx="2" fill="#2c3e50"/><circle cx="82" cy="37" r="5" fill="#4f8a12"/><rect x="18" y="52" width="74" height="6" rx="2" fill="#b8c0c7"/><rect x="18" y="62" width="74" height="6" rx="2" fill="#b8c0c7"/></svg>',
  becher: '<svg viewBox="0 0 60 80" aria-hidden="true"><path d="M10 30 H50 L44 76 H16 Z" fill="#fff" stroke="#e0d6c8"/><path d="M12 44 H48" stroke="#c10230" stroke-width="7"/><path d="M8 30 C8 12 22 8 30 14 C38 4 54 12 52 30 Z" fill="#fbe5ea"/><path d="M20 22 C26 16 34 16 40 22" fill="none" stroke="#f4b6c2" stroke-width="3"/><circle cx="36" cy="12" r="5" fill="#c10230"/><path d="M36 7 Q40 2 44 4" stroke="#4f8a12" stroke-width="2" fill="none"/></svg>',
  figur: '<svg viewBox="30 30 165 190" aria-hidden="true"><path d="M100 74 C150 74 168 112 154 154 C141 192 116 212 100 212 C84 212 59 192 46 154 C32 112 50 74 100 74 Z" fill="#c10230"/><g fill="#ffd9a0"><ellipse cx="66" cy="130" rx="2.6" ry="3.6"/><ellipse cx="134" cy="130" rx="2.6" ry="3.6"/><ellipse cx="78" cy="182" rx="2.6" ry="3.6"/><ellipse cx="122" cy="182" rx="2.6" ry="3.6"/></g><g transform="rotate(16 100 98)"><path d="M47 102 Q46 50 100 46 Q154 50 153 102 Q100 116 47 102 Z" fill="#76bc21"/><path d="M130 99 Q160 90 180 102 Q179 114 162 116 Q144 117 127 110 Z" fill="#a3a983"/><circle cx="100" cy="76" r="9" fill="#fff"/><circle cx="100" cy="77.5" r="5.6" fill="#c10230"/></g><ellipse cx="80" cy="120" rx="11" ry="12" fill="#fff"/><circle cx="83" cy="121" r="5.5" fill="#1d1d1b"/><path d="M110 121 Q120 113 130 121" stroke="#1d1d1b" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M84 146 Q100 160 118 144" stroke="#1d1d1b" stroke-width="4" fill="none" stroke-linecap="round"/></svg>',
  rahmen: '<svg viewBox="0 0 80 70" aria-hidden="true"><path d="M30 64 L40 46 L50 64" stroke="#8b6440" stroke-width="4" fill="none"/><rect x="6" y="4" width="68" height="50" rx="3" fill="#a07a4f"/><rect x="12" y="10" width="56" height="38" fill="#eef6e2"/><circle cx="26" cy="26" r="6" fill="#f2c9a0"/><path d="M16 46 Q26 32 36 46 Z" fill="#c10230"/><circle cx="42" cy="24" r="6" fill="#e8b98e"/><path d="M32 46 Q42 30 52 46 Z" fill="#4f8a12"/><circle cx="56" cy="27" r="5" fill="#f2c9a0"/><path d="M47 46 Q56 34 65 46 Z" fill="#a3a983"/></svg>',
  pflanze: '<svg viewBox="0 0 60 80" aria-hidden="true"><path d="M16 52 H44 L40 78 H20 Z" fill="#c10230"/><path d="M14 50 H46 V56 H14 Z" fill="#9e0227"/><g fill="#4f8a12"><path d="M30 52 C20 40 12 30 14 16 C24 22 30 34 30 52 Z"/><path d="M30 52 C40 40 48 30 46 14 C36 22 30 34 30 52 Z"/><path d="M30 52 C28 34 30 18 30 4 C34 18 34 34 30 52 Z" fill="#76bc21"/></g></svg>',
};

  // ---------- Grafik- & Druckstudio ----------
  const FARBEN = { rot: { name: "frooters-Rot", haupt: "#c10230", hell: "#fbe5ea" }, gruen: { name: "Frucht-Grün", haupt: "#4f8a12", hell: "#eef6e2" },
    salbei: { name: "Salbei", haupt: "#7d8360", hell: "#eceee2" }, schwarz: { name: "Schwarz", haupt: "#1d1d1b", hell: "#f1f1ea" } };
  const SYMBOLE = ["", "🍓", "🍦", "🥤", "🍉", "🍊", "🥣", "☕", "🧇", "⚠️", "🚫", "✅", "🎉", "❄️", "☀️"];
  const VORLAGEN = [
    { id: "preisliste", sym: "💶", t: "Preisliste", u: "Artikel, Größe, Preis", felder: ["titel", "untertitel", "posten", "fuss"], std: { titel: "Unsere Preise", untertitel: "", fuss: "Alle Preise inkl. MwSt." } },
    { id: "schild", sym: "🪧", t: "Hinweisschild", u: "Kurzer Hinweis für Kunden oder Team", felder: ["titel", "text"], std: { titel: "Bitte beachten", text: "" } },
    { id: "oeffnung", sym: "🕒", t: "Öffnungszeiten", u: "Automatisch aus der Filiale", felder: ["titel", "text"], std: { titel: "Öffnungszeiten", text: "" } },
    { id: "aktion", sym: "🎉", t: "Aktion / Angebot", u: "Großer Preis, kurzer Text", felder: ["titel", "text", "preis", "fuss"], std: { titel: "Aktion der Woche", text: "", preis: "", fuss: "Solange der Vorrat reicht." } },
    { id: "allergene", sym: "⚠️", t: "Allergen-Aushang", u: "Automatisch aus den Rezepten", felder: ["titel", "fuss"], std: { titel: "Allergene in unseren Produkten", fuss: "Fragen Sie gern unser Team. Spuren können durch die Zubereitung nicht ausgeschlossen werden." } },
    { id: "personal", sym: "🙋", t: "Aushilfe gesucht", u: "Stellenaushang", felder: ["titel", "text", "fuss"], std: { titel: "Wir suchen dich!", text: "Aushilfen (m/w/d) für unser Team.\nFlexible Zeiten, gutes Team, frische Früchte.", fuss: "Sprich uns einfach an." } },
  ];
  // Preisliste vorbelegen: Artikel und Größen aus dem Sortiment der Filiale, Preise bleiben leer (nichts erfinden)
  function postenVorschlag(state, filiale) {
    const gruppen = (state.rezepte.warengruppen || []).filter((g) => !filiale.sortiment || filiale.sortiment.includes(g.id));
    const zeilen = [];
    for (const g of gruppen) for (const r of L.rezepteFreigegeben(state).filter((x) => x.gruppe === g.id)) zeilen.push(`${r.name} | ${r.groessen.length > 1 ? r.groessen.join(" / ") : ""} | `);
    return zeilen.join("\n");
  }
  function oeffnungText(filiale) {
    if (filiale.art === "mobil") return (filiale.einsaetze || []).slice().sort((a, b) => a.datum.localeCompare(b.datum)).slice(0, 8).map((e) => `${L.datumKurz(e.datum)} · ${e.von}–${e.bis} · ${e.ort}`).join("\n");
    const tage = ["mo", "di", "mi", "do", "fr", "sa", "so"];
    const zeilen = [];
    for (let i = 0; i < tage.length;) {
      const z = (filiale.oeffnung || {})[tage[i]], k = JSON.stringify(z);
      let j = i; while (j + 1 < tage.length && JSON.stringify((filiale.oeffnung || {})[tage[j + 1]]) === k) j++;
      const name = (t) => L.TAG_NAME[t].slice(0, 2);
      zeilen.push(`${i === j ? name(tage[i]) : name(tage[i]) + "–" + name(tage[j])}  ${z ? z[0] + "–" + z[1] + " Uhr" : "geschlossen"}`);
      i = j + 1;
    }
    return zeilen.join("\n");
  }
  function neuerDruck(state, vorlageId, filiale) {
    const v = VORLAGEN.find((x) => x.id === vorlageId);
    const d = { vorlage: v.id, format: v.id === "allergene" ? "quer" : "hoch", farbe: "rot", symbol: v.id === "aktion" ? "🎉" : v.id === "personal" ? "🍓" : "", ...v.std };
    if (v.id === "preisliste") d.posten = postenVorschlag(state, filiale);
    if (v.id === "oeffnung") d.text = oeffnungText(filiale);
    return d;
  }
  function preisTxt(p) {
    const t = String(p || "").trim();
    if (!t) return "… €";
    const n = Number(t.replace(",", ".").replace(/[^\d.]/g, ""));
    return isNaN(n) || !/\d/.test(t) ? esc(t) : n.toFixed(2).replace(".", ",") + " €";
  }
  // Ein Druckblatt (A4 hoch oder quer) als HTML. logo = Adresse des frooters-Logos, frootie = Adresse von Frootie.
  function blattHtml(state, d, filiale, bild) {
    const f = FARBEN[d.farbe] || FARBEN.rot;
    const zeilenText = (t) => esc(t || "").split("\n").map((z) => z || "&nbsp;").join("<br>");
    let inhalt = "";
    if (d.vorlage === "preisliste") {
      const posten = String(d.posten || "").split("\n").map((z) => z.split("|").map((x) => x.trim())).filter((z) => z[0]);
      const sk = Math.max(0.5, Math.min(1.15, 9 / Math.max(1, posten.length)));
      inhalt = `<table class="dp-preise" style="font-size:${(3.6 * sk).toFixed(2)}cqw">${posten.map(([a, g, p]) => `<tr><td class="a">${esc(a)}${g ? `<small>${esc(g)}</small>` : ""}</td><td class="p">${preisTxt(p)}</td></tr>`).join("")}</table>`;
    } else if (d.vorlage === "aktion") {
      inhalt = `<div class="dp-text">${zeilenText(d.text)}</div>${d.preis ? `<div class="dp-preis" style="background:${f.haupt}">${preisTxt(d.preis)}</div>` : ""}`;
    } else if (d.vorlage === "allergene") {
      const al = state.rezepte.allergene;
      const rz = L.rezepteFreigegeben(state).filter((r) => !filiale.sortiment || filiale.sortiment.includes(r.gruppe));
      const genutzt = al.filter((a) => rz.some((r) => L.allergeneVon(r).includes(a) || L.spurenVon(r).includes(a)));
      const ska = Math.max(0.45, Math.min(1, 9 / Math.max(1, rz.length)));
      inhalt = `<table class="dp-allergene" style="font-size:${((d.format === "quer" ? 2 : 2.6) * ska).toFixed(2)}cqw"><thead><tr><th>Produkt</th>${genutzt.map((a) => `<th><span>${esc(a)}</span></th>`).join("")}</tr></thead><tbody>
        ${rz.map((r) => { const x = L.allergeneVon(r), y = L.spurenVon(r); return `<tr><td>${esc(r.name)}</td>${genutzt.map((a) => `<td>${x.includes(a) ? "●" : y.includes(a) ? "○" : ""}</td>`).join("")}</tr>`; }).join("")}</tbody></table>
        <p class="dp-klein">● enthalten · ○ kann Spuren enthalten. Nicht aufgeführte Allergene der 14 Hauptallergene sind in keinem Produkt enthalten.</p>`;
    } else {
      inhalt = `<div class="dp-text ${d.vorlage === "oeffnung" ? "dp-zeiten" : ""}">${zeilenText(d.text)}</div>`;
    }
    return `<div class="druckblatt ${d.format === "quer" ? "quer" : "hoch"}" style="--dp:${f.haupt};--dp-hell:${f.hell}">
      <div class="dp-kopf"><img src="${bild.logo}" alt="frooters"><span>${esc(filiale.name)}</span></div>
      <div class="dp-rumpf">
        ${d.symbol ? `<div class="dp-symbol">${esc(d.symbol)}</div>` : ""}
        <h1>${esc(d.titel || "")}</h1>${d.untertitel ? `<h2>${esc(d.untertitel)}</h2>` : ""}
        ${inhalt}
      </div>
      <div class="dp-fuss"><span>${esc(d.fuss || "")}</span>${d.frootie !== false ? `<img src="${bild.frootie}" alt="">` : ""}</div>
    </div>`;
  }
  // Bestellung an einen Lieferanten (A4 hoch, frooters-Design)
  function bestellungHtml(state, b, filiale, bild, nameVon) {
    const W = L.waren(state), lf = W.lieferanten.find((x) => x.id === b.lieferant) || { name: "?" };
    const zeilen = b.posten.map((x) => { const a = W.artikel.find((y) => y.id === x.artikel) || { name: "?", einheit: "" }; const g = a.gebinde || { name: "Stück", menge: 1 };
      return `<tr><td>${esc(a.bestellNr || "–")}</td><td><b>${esc(a.name)}</b><small>${g.menge > 1 ? `${esc(g.name)} à ${g.menge} ${esc(a.einheit)}` : esc(a.einheit)}</small></td><td class="z"><b>${x.menge}</b> ${esc(x.menge === 1 ? g.name : (g.mehrzahl || g.name))}</td></tr>`; }).join("");
    return `<div class="druckblatt hoch bestellblatt" style="--dp:#c10230;--dp-hell:#fbe5ea">
      <div class="dp-kopf"><img src="${bild.logo}" alt="frooters"><span>${esc(filiale.name)}</span></div>
      <div class="dp-rumpf">
        <h1>Bestellung</h1>
        <div class="bs-kopf"><div><small>an</small><b>${esc(lf.name)}</b>${lf.kontakt ? `<br>${esc(lf.kontakt)}` : ""}${lf.telefon ? `<br>${esc(lf.telefon)}` : ""}${lf.email ? `<br>${esc(lf.email)}` : ""}</div>
          <div><small>von</small><b>frooters ${esc(filiale.kurz || filiale.name)}</b><br>${esc(nameVon ? nameVon(b.von) : "")}<br>${esc(L.datumKurz(b.erstellt.slice(0, 10)))}</div></div>
        <table class="dp-bestell"><thead><tr><th>Best.-Nr.</th><th>Artikel</th><th class="z">Menge</th></tr></thead><tbody>${zeilen}</tbody></table>
        <p class="dp-klein">Bitte Liefertermin bestätigen. Vielen Dank!</p>
      </div>
      <div class="dp-fuss"><span>frooters · Bestellung ${esc(b.id)}</span><img src="${bild.frootie}" alt=""></div>
    </div>`;
  }
  // Briefbogen im frooters-Design
  function briefHtml(d, absender, bild) {
    return `<div class="druckblatt hoch brief" style="--dp:#c10230;--dp-hell:#fbe5ea">
      <div class="dp-kopf"><img src="${bild.logo}" alt="frooters"><span>${esc(absender)}</span></div>
      <div class="dp-rumpf brief-rumpf">
        <div class="b-absz">${esc(absender)}</div>
        <div class="b-an">${esc(d.an || "").split("\n").join("<br>")}</div>
        <div class="b-datum">${esc(d.ort || "")}${d.ort ? ", " : ""}${esc(d.datum || "")}</div>
        <div class="b-betreff">${esc(d.betreff || "")}</div>
        <div class="b-text">${esc(d.text || "").split("\n").map((z) => z || "&nbsp;").join("<br>")}</div>
        <div class="b-gruss">Mit freundlichen Grüßen<br><br>${esc(d.unterschrift || "")}</div>
      </div>
      <div class="dp-fuss"><span>frooters · Du hast die Wahl. Du hast die Fantasie.</span></div>
    </div>`;
  }
  // Hygienebericht der letzten Tage für die Lebensmittelkontrolle bzw. den Berater
  function hygieneBerichtHtml(state, filiale, bisDatum, tage, jetzt, bild, name) {
    const st = { erledigt: "erledigt", abweichung: "Abweichung", nicht_moeglich: "nicht möglich", verpasst: "nicht erledigt", ueberfaellig: "überfällig", faellig: "offen", spaeter: "offen" };
    const bloecke = [];
    for (let i = tage - 1; i >= 0; i--) {
      const d = L.plusTage(bisDatum, -i), l = L.tagesliste(state, filiale.id, d, jetzt);
      if (!l.length) continue;
      bloecke.push(`<h3>${L.TAG_NAME[L.wochentag(d)]}, ${L.datumKurz(d).slice(3)}</h3><table class="dp-hyg"><thead><tr><th>Zeit</th><th>Aufgabe</th><th>Ergebnis</th><th>Wer / wann</th></tr></thead><tbody>
        ${l.map((a) => { const df = a.durchfuehrung; const werte = df ? a.regel.pruefpunkte.map((pp, k) => pp.art === "messwert" ? `${df.werte[k]} ${pp.einheit}` : pp.art === "auswahl" ? df.werte[k] : df.werte[k] === true ? "✓" : "").filter(Boolean).join(", ") : "";
          return `<tr class="${a.status === "erledigt" ? "" : "dp-auff"}"><td>${L.minZuZeit(a.ab)}</td><td>${esc(a.regel.titel)}${a.geraet ? " · " + esc(a.geraet.name) : ""}</td><td>${esc(st[a.status] || a.status)}${werte ? " · " + esc(werte) : ""}${df && df.schritte && df.schritte.length ? `<br><small>Maßnahme: ${esc(df.schritte.join("; "))}</small>` : ""}</td><td>${df ? esc(name(df.personId)) + " " + df.zeit.slice(11, 16) : ""}</td></tr>`; }).join("")}</tbody></table>`);
    }
    return `<div class="druckblatt hoch bericht" style="--dp:#3f7f8c;--dp-hell:#e4f0f2">
      <div class="dp-kopf"><img src="${bild.logo}" alt="frooters"><span>Hygiene-Dokumentation · ${esc(filiale.name)}</span></div>
      <div class="dp-rumpf"><h1>Hygienebericht</h1><h2>${L.datumKurz(L.plusTage(bisDatum, -(tage - 1))).slice(3)} bis ${L.datumKurz(bisDatum).slice(3)}</h2>${bloecke.join("") || "<p>Keine Aufgaben im Zeitraum.</p>"}</div>
      <div class="dp-fuss"><span>Erstellt mit der frooters Team-App (Testversion, Beispieldaten). Nicht erledigte Aufgaben sind markiert.</span></div></div>`;
  }

  return { code128, code128Svg, qrSvg, ET_FORMATE, etRaster, etPreise, ORDNER, FREIGABE_ROLLEN, BUEROS, BU_SVG, KATALOG, KATALOG_MAX, einrichtungAnwenden, teileTauschen, teilSchieben, darfOrdner, FARBEN, SYMBOLE, VORLAGEN, postenVorschlag, oeffnungText, neuerDruck, preisTxt, blattHtml, briefHtml, hygieneBerichtHtml, bestellungHtml };
});
