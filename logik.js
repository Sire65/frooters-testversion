// frooters Team-App – Programmlogik ohne Oberfläche (im Browser als window.FRL, in Tests per require).
// Alles hier ist rein rechnend: Zustand rein, Ergebnis raus. Speichern macht daten.js, Anzeigen app.js.
(function (root, fabrik) {
  if (typeof module === "object" && module.exports) module.exports = fabrik();
  else root.FRL = fabrik();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ---------- Datum ----------
  const TAGE = ["so", "mo", "di", "mi", "do", "fr", "sa"];
  const TAG_NAME = { mo: "Montag", di: "Dienstag", mi: "Mittwoch", do: "Donnerstag", fr: "Freitag", sa: "Samstag", so: "Sonntag" };
  const pad = (n) => String(n).padStart(2, "0");
  function iso(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function ausIso(s) { const [y, m, t] = s.split("-").map(Number); return new Date(y, m - 1, t, 12); }
  function plusTage(s, n) { const d = ausIso(s); d.setDate(d.getDate() + n); return iso(d); }
  function wochentag(s) { return TAGE[ausIso(s).getDay()]; }
  function montag(s) { const d = ausIso(s); const w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); return iso(d); }
  function woche(montagIso) { return Array.from({ length: 7 }, (_, i) => plusTage(montagIso, i)); }
  function zwischen(s, von, bis) { return s >= von && s <= bis; }
  function minZuZeit(m) { return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; }
  function zeitZuMin(t) { const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); }
  function datumKurz(s) { const d = ausIso(s); return `${TAG_NAME[wochentag(s)].slice(0, 2)} ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.`; }

  // ---------- Filialen und Schichten ----------
  // Öffnungszeit eines Tages in Minuten { auf, zu } oder null (geschlossen). Sondertage gehen vor.
  function oeffnung(filiale, datum) {
    if (filiale.art === "mobil") { // mobiler Stand: nur an Einsatztagen, mit Ort
      const e = (filiale.einsaetze || []).find((x) => x.datum === datum);
      return e ? { auf: zeitZuMin(e.von), zu: zeitZuMin(e.bis), ort: e.ort } : null;
    }
    const s = filiale.sondertage && filiale.sondertage[datum];
    if (s === null) return null;
    const z = s || (filiale.oeffnung || {})[wochentag(datum)];
    if (!z) return null;
    return { auf: zeitZuMin(z[0]), zu: zeitZuMin(z[1]) };
  }
  // Schichten liegen relativ zur Öffnungszeit: Früh ab Öffnung, Spät bis Ladenschluss (inkl. Vor- und Nacharbeit).
  const SCHICHTEN = [
    { id: "frueh", name: "Frühdienst", start: (o) => o.auf - 30, ende: (o) => o.auf + 300 },
    { id: "spaet", name: "Spätdienst", start: (o) => o.zu - 300, ende: (o) => o.zu + 30 },
  ];
  function schicht(id) { return SCHICHTEN.find((s) => s.id === id); }
  function schichtZeit(filiale, datum, schichtId) {
    const o = oeffnung(filiale, datum);
    if (!o) return null;
    // Kurzer Einsatz des mobilen Stands (bis 7 Std.): eine durchgehende Schicht statt Früh und Spät
    if (filiale.art === "mobil" && o.zu - o.auf <= 420) return schichtId === "frueh" ? { start: o.auf - 30, ende: o.zu + 30 } : null;
    const s = schicht(schichtId);
    return { start: s.start(o), ende: s.ende(o) };
  }
  function bedarf(filiale, datum, schichtId) {
    if (!oeffnung(filiale, datum) || !schichtZeit(filiale, datum, schichtId)) return 0;
    const b = filiale.bedarf || {};
    const tag = b[wochentag(datum)];
    if (tag && tag[schichtId] != null) return tag[schichtId];
    return (b.standard && b.standard[schichtId]) || 0;
  }

  // ---------- Personen ----------
  const ROLLEN = {
    aushilfe: { name: "Aushilfe", stufe: 1 },
    mitarbeiter: { name: "Mitarbeiter", stufe: 2 },
    stv: { name: "Stellv. Shopleitung", stufe: 3 },
    shopleitung: { name: "Shopleitung", stufe: 4 },
    qualitaet: { name: "Qualität & Pflege", stufe: 8 },
    berater: { name: "Hygieneberater (nur lesen)", stufe: 0 },
    zentrale: { name: "Inhaber / Zentrale", stufe: 9 },
  };
  // Rollen ohne eigene Filiale, die alle Filialen sehen
  const UEBERGREIFEND = ["zentrale", "qualitaet", "berater"];
  function istLeitung(p, filialeId) {
    if (!p) return false;
    if (p.rolle === "zentrale") return true;
    return (p.rolle === "shopleitung" || p.rolle === "stv") && p.stammfiliale === filialeId;
  }
  // In welcher Filiale darf jemand eingesetzt werden? Stammfiliale immer, andere nur als Springer mit Haken.
  function darfInFiliale(p, filialeId) {
    if (!p || p.aktiv === false || UEBERGREIFEND.includes(p.rolle)) return false;
    if (p.stammfiliale === filialeId) return true;
    return !!p.springer && (p.einsatzfilialen || []).includes(filialeId);
  }
  function filialenVon(p) {
    if (!p) return [];
    const s = new Set([p.stammfiliale]);
    if (p.springer) (p.einsatzfilialen || []).forEach((f) => s.add(f));
    return [...s].filter(Boolean);
  }
  // Arten der Abwesenheit (Registry): Krank und Kind krank gelten sofort, alles andere nach Genehmigung durch die Leitung
  const ABW_ARTEN = {
    urlaub: { name: "Urlaub", sym: "🏖️", genehmigung: true, konto: "urlaub" },
    krank: { name: "Krankmeldung", sym: "🤒", genehmigung: false },
    kind_krank: { name: "Kind krank", sym: "🧸", genehmigung: false },
    bildungsurlaub: { name: "Bildungsurlaub", sym: "🎓", genehmigung: true, konto: "bildung" },
    sonderurlaub: { name: "Sonderurlaub", sym: "💐", genehmigung: true },
    freizeitausgleich: { name: "Freizeitausgleich", sym: "⏳", genehmigung: true },
    schule: { name: "Schule / Berufsschule", sym: "📚", genehmigung: true },
    unbezahlt: { name: "Unbezahlter Urlaub", sym: "💤", genehmigung: true },
  };
  const abwArt = (a) => ABW_ARTEN[a] || { name: a, sym: "•", genehmigung: true };
  function abwGilt(a) { return a.status !== "zurueckgezogen" && a.status !== "abgelehnt" && (abwArt(a.art).genehmigung ? a.status === "genehmigt" : true); }
  function abwesenheitAm(state, personId, datum) {
    return (state.abwesenheiten || []).find((a) => a.personId === personId && zwischen(datum, a.von, a.bis) && abwGilt(a));
  }
  // Urlaubstage eines Zeitraums: Arbeitstage nach Parameter (Standard Mo–Fr, also 5-Tage-Woche)
  function urlaubsTage(von, bis, zaehlen) {
    const tage = zaehlen === "mo-sa" ? ["mo", "di", "mi", "do", "fr", "sa"] : ["mo", "di", "mi", "do", "fr"];
    let n = 0;
    for (let d = von; d <= bis; d = plusTage(d, 1)) if (tage.includes(wochentag(d))) n++;
    return n;
  }
  // Konto je Person und Jahr: Anspruch + Übertrag, genommen (vor heute), geplant (ab heute), beantragt, Rest
  function urlaubskonto(state, p, jahr, heute, konto) {
    const k = konto || "urlaub";
    const zaehlen = ((state.parameter || {}).urlaubTage) || "mo-fr";
    const anspruch = k === "bildung" ? (p.bildungsurlaub != null ? p.bildungsurlaub : 5) : (p.urlaubsanspruch != null ? p.urlaubsanspruch : 30);
    const uebertrag = k === "bildung" ? 0 : (p.urlaubUebertrag || 0);
    let genommen = 0, geplant = 0, beantragt = 0;
    for (const a of state.abwesenheiten || []) {
      if (a.personId !== p.id || abwArt(a.art).konto !== k) continue;
      const von = a.von < `${jahr}-01-01` ? `${jahr}-01-01` : a.von, bis = a.bis > `${jahr}-12-31` ? `${jahr}-12-31` : a.bis;
      if (von > bis) continue;
      if (a.status === "genehmigt") {
        if (bis < heute) genommen += urlaubsTage(von, bis, zaehlen);
        else if (von >= heute) geplant += urlaubsTage(von, bis, zaehlen);
        else { genommen += urlaubsTage(von, plusTage(heute, -1), zaehlen); geplant += urlaubsTage(heute, bis, zaehlen); }
      } else if (a.status === "beantragt") beantragt += urlaubsTage(von, bis, zaehlen);
    }
    return { anspruch, uebertrag, genommen, geplant, beantragt, rest: anspruch + uebertrag - genommen - geplant };
  }
  // Stundenumfang: geplante Stunden in der Woche oder im Monat (je nach Vertrag) mit einer zusätzlichen Schicht
  function stundenImMonat(state, personId, datum) {
    const monat = datum.slice(0, 7);
    let min = 0;
    for (const s of state.plan || []) if (s.personId === personId && s.datum.slice(0, 7) === monat) { const z = planZeit(state, s); if (z) min += z.ende - z.start; }
    return min / 60;
  }
  function stundenStand(state, p, datum, zusatzMin) {
    const einheit = p.stundenEinheit === "monat" ? "monat" : "woche";
    const ist = einheit === "monat" ? stundenImMonat(state, p.id, datum) : stundenInWoche(state, p.id, montag(datum));
    const neu = Math.round((ist + (zusatzMin || 0) / 60) * 10) / 10;
    const soll = p.wochenstunden || 0;
    const ueber = soll > 0 && neu > soll;
    // „darf Stunden überschreiten“: bis zur Grenze ohne Rückfrage. Gilt nie für Minijob und unter 18.
    const erl = darfUeberschreiten(p);
    const grenze = erl ? soll + erl : soll;
    return { einheit, soll, ist: Math.round(ist * 10) / 10, neu, ueber, erlaubt: erl, grenze, ueberGrenze: soll > 0 && neu > grenze };
  }

  // ---------- Beschäftigungsart und Einsatzprofil ----------
  const BESCHAEFTIGUNG = [
    { id: "vollzeit", name: "Vollzeit", einheit: "woche" },
    { id: "teilzeit", name: "Teilzeit", einheit: "woche" },
    { id: "minijob", name: "Minijob (geringfügig)", einheit: "monat", hinweis: "Verdienstgrenze beachten" },
    { id: "kurzfristig", name: "Kurzfristig beschäftigt", einheit: "monat", hinweis: "höchstens 70 Arbeitstage im Jahr" },
    { id: "werkstudent", name: "Werkstudent/in", einheit: "woche", hinweis: "in der Vorlesungszeit höchstens 20 Std./Woche" },
    { id: "azubi", name: "Auszubildende/r", einheit: "woche", hinweis: "Berufsschultage nicht verplanen" },
    { id: "schueler", name: "Schüler/in, Ferienjob", einheit: "monat" },
    { id: "praktikum", name: "Praktikum", einheit: "woche" },
  ];
  function beschaeftigung(id) { return BESCHAEFTIGUNG.find((b) => b.id === id) || null; }
  const EINSATZ_ZEIT = [
    { id: "flexibel", name: "total flexibel" }, { id: "frueh", name: "nur Frühdienst" }, { id: "spaet", name: "nur Spätdienst" },
    { id: "morgens", name: "nur morgens (bis … Uhr)" }, { id: "abends", name: "nur abends (ab … Uhr)" },
  ];
  const QUALI = [
    { id: "ifsg", name: "Belehrung § 43 IfSG" }, { id: "hygiene", name: "Hygieneschulung" }, { id: "allergene", name: "Allergenschulung" },
    { id: "kasse", name: "Kasse" }, { id: "schluessel", name: "Schlüssel / Tresor" }, { id: "fuehrerschein", name: "Führerschein (Road Runner)" },
  ];
  // Grenzen aus den Einstellungen; die Werte sind vorläufig und werden vom Steuerberater bestätigt (bis dahin nur Warnung).
  const GRENZEN_STANDARD = { minijobEuro: 603, kurzfristigTage: 70, jugendTagMin: 480, jugendWocheStd: 40, jugendBis: "20:00", jugendBis16: "22:00", werkstudentStd: 20 };
  function grenzen(state) { return { ...GRENZEN_STANDARD, ...((state.parameter || {}).grenzen || {}) }; }
  function istJugendlich(p) { return !!p.unter18; }
  function darfUeberschreiten(p) {
    const u = p.ueberschreiten;
    if (!u || !u.erlaubt || p.beschaeftigung === "minijob" || istJugendlich(p)) return 0;
    return Math.max(0, Number(u.bisStd) || 0);
  }
  // Passt eine Zeit zum festen Einsatzprofil? Liefert die Gründe, warum nicht (leer = passt).
  function profilPruefen(p, datum, zeit, schichtId) {
    const pr = p.profil || {}, r = [];
    const tag = wochentag(datum);
    if (pr.tage && pr.tage.length && !pr.tage.includes(tag)) r.push(`nur ${pr.tage.map((t) => TAG_NAME[t].slice(0, 2)).join(", ")}`);
    if ((pr.nichtTage || []).includes(tag)) r.push(`nicht ${TAG_NAME[tag]}s${pr.nichtGrund ? " (" + pr.nichtGrund + ")" : ""}`);
    const art = pr.zeit || "flexibel";
    const sch = schichtId || (zeit && zeit.start < 13 * 60 ? "frueh" : "spaet");
    if (art === "frueh" && sch !== "frueh") r.push("nur Frühdienst");
    if (art === "spaet" && sch !== "spaet") r.push("nur Spätdienst");
    if (art === "morgens" && zeit && pr.bis && zeit.ende > zeitZuMin(pr.bis)) r.push(`nur bis ${pr.bis} Uhr`);
    if (art === "abends" && zeit && pr.ab && zeit.start < zeitZuMin(pr.ab)) r.push(`erst ab ${pr.ab} Uhr`);
    return r;
  }
  function inBereitschaft(p, datum, zeit) {
    const tag = wochentag(datum);
    return ((p.profil || {}).bereitschaft || []).some((b) => b.tag === tag && (!zeit || (zeitZuMin(b.von) < zeit.ende && zeit.start < zeitZuMin(b.bis))));
  }
  function arbeitstageImJahr(state, personId, jahr) {
    return new Set((state.plan || []).filter((s) => s.personId === personId && s.datum.slice(0, 4) === jahr).map((s) => s.datum)).size;
  }
  // Gesetzliche Hinweise (Jugendschutz, kurzfristige Beschäftigung, Werkstudent). Nur Warnungen, sie sperren nichts.
  function gesetzHinweise(state, p, datum, zeit, ohneIds) {
    const g = grenzen(state), h = [];
    const ohne = ohneIds || [];
    const amTag = schichtenAm(state, datum, (x) => x.personId === p.id && !ohne.includes(x.id));
    if (istJugendlich(p) && zeit) {
      const tagMin = amTag.reduce((n, x) => { const z = planZeit(state, x); return n + (z ? z.ende - z.start : 0); }, 0) + (zeit.ende - zeit.start);
      if (tagMin > g.jugendTagMin) h.push(`Jugendschutz: über ${g.jugendTagMin / 60} Std. am Tag`);
      const bis = p.ab16 ? g.jugendBis16 : g.jugendBis;
      if (zeit.ende > zeitZuMin(bis)) h.push(`Jugendschutz: Arbeit nach ${bis} Uhr`);
      const woche_ = stundenInWoche(state, p.id, montag(datum)) + (zeit.ende - zeit.start) / 60;
      if (woche_ > g.jugendWocheStd) h.push(`Jugendschutz: über ${g.jugendWocheStd} Std. in der Woche`);
      const tage = new Set(woche(montag(datum)).filter((t) => schichtenAm(state, t, (x) => x.personId === p.id).length)); tage.add(datum);
      if (tage.size > 5) h.push("Jugendschutz: mehr als 5 Tage in der Woche");
    }
    if (p.beschaeftigung === "kurzfristig" && !amTag.length) {
      const n = arbeitstageImJahr(state, p.id, datum.slice(0, 4)) + 1;
      if (n > g.kurzfristigTage) h.push(`kurzfristig: ${n}. Arbeitstag im Jahr (Grenze ${g.kurzfristigTage})`);
    }
    if (p.beschaeftigung === "werkstudent" && zeit) {
      const w = stundenInWoche(state, p.id, montag(datum)) + (zeit.ende - zeit.start) / 60;
      if (w > g.werkstudentStd) h.push(`Werkstudent: ${Math.round(w * 10) / 10} Std. in der Woche (in der Vorlesungszeit höchstens ${g.werkstudentStd})`);
    }
    return h;
  }
  // Qualifikationen, die bis zum Stichtag (heute + tage) ablaufen oder schon abgelaufen sind
  function qualiAblauf(state, datum, tage) {
    const bis = plusTage(datum, tage == null ? 30 : tage), r = [];
    for (const p of state.personen || []) {
      if (p.aktiv === false) continue;
      for (const q of p.quali || []) if (q.bis && q.bis <= bis) r.push({ person: p, art: q.art, name: (QUALI.find((x) => x.id === q.art) || { name: q.art }).name, bis: q.bis, abgelaufen: q.bis < datum });
    }
    return r.sort((a, b) => a.bis.localeCompare(b.bis));
  }
  // Mitarbeiter aus Excel (als CSV gespeichert, Trennzeichen ; oder , oder Tab) einlesen. Liefert je Zeile Person oder Fehler.
  const IMPORT_SPALTEN = ["vorname", "nachname", "filiale", "rolle", "beschaeftigung", "stunden", "einheit", "urlaub"];
  function csvZeilen(text) {
    const t = String(text || "").replace(/^\uFEFF/, "");
    const erste = t.split(/\r?\n/)[0] || "";
    const trenn = (erste.match(/;/g) || []).length >= (erste.match(/,/g) || []).length ? (erste.includes("\t") && !erste.includes(";") ? "\t" : ";") : ",";
    const zeilen = []; let feld = "", zeile = [], inQ = false;
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if (inQ) { if (c === '"' && t[i + 1] === '"') { feld += '"'; i++; } else if (c === '"') inQ = false; else feld += c; continue; }
      if (c === '"') inQ = true;
      else if (c === trenn) { zeile.push(feld.trim()); feld = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && t[i + 1] === "\n") i++; zeile.push(feld.trim()); zeilen.push(zeile); zeile = []; feld = ""; }
      else feld += c;
    }
    if (feld || zeile.length) { zeile.push(feld.trim()); zeilen.push(zeile); }
    return zeilen.filter((z) => z.some((x) => x));
  }
  function mitarbeiterImport(state, text) {
    const zeilen = csvZeilen(text);
    if (!zeilen.length) return { zeilen: [], fehlerGesamt: "Keine Daten gefunden." };
    const norm = (x) => String(x || "").toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
    const kopf = zeilen[0].map(norm);
    const hatKopf = kopf.includes("vorname");
    const idx = {};
    IMPORT_SPALTEN.forEach((k, i) => { idx[k] = hatKopf ? kopf.findIndex((x) => x === k || x.startsWith(k)) : i; });
    if (hatKopf && idx.stunden < 0) idx.stunden = kopf.findIndex((x) => x.includes("stunden") || x === "std");
    const daten = hatKopf ? zeilen.slice(1) : zeilen;
    const filFinden = (w) => { const n = norm(w); return (state.filialen || []).find((f) => [f.id, f.kurz, f.name].some((x) => norm(x) === n) || (n && norm(f.name).startsWith(n))); };
    const rolleFinden = (w) => { const n = norm(w); if (!n) return "mitarbeiter"; if (n.startsWith("stell") || n === "stv") return "stv"; if (n.startsWith("mitarbeiter")) return "mitarbeiter"; if (n.startsWith("shopleit") || n === "sl") return "shopleitung"; return Object.keys(ROLLEN).filter((k) => !UEBERGREIFEND.includes(k)).find((k) => norm(k) === n || norm(ROLLEN[k].name) === n || norm(ROLLEN[k].name).startsWith(n)) || null; };
    const beschFinden = (w) => { const n = norm(w); if (!n) return null; return (BESCHAEFTIGUNG.find((b) => norm(b.id) === n || norm(b.name).startsWith(n) || (n.startsWith("geringf") && b.id === "minijob") || (n === "aushilfe" && b.id === "minijob")) || { id: undefined }).id; };
    const vorhanden = new Set((state.personen || []).map((p) => norm(p.vorname + p.nachname)));
    const r = daten.map((z, i) => {
      const w = (k) => (idx[k] >= 0 ? z[idx[k]] || "" : "");
      const fehler = [];
      const vorname = w("vorname").trim(), nachname = w("nachname").trim();
      if (!vorname) fehler.push("Vorname fehlt");
      const f = filFinden(w("filiale")); if (!f) fehler.push(`Filiale „${w("filiale")}“ unbekannt`);
      const rolle = rolleFinden(w("rolle")); if (!rolle) fehler.push(`Rolle „${w("rolle")}“ unbekannt`);
      const bw = w("beschaeftigung"), besch = beschFinden(bw); if (bw && !besch) fehler.push(`Beschäftigung „${bw}“ unbekannt`);
      const stdTxt = w("stunden").replace(",", "."), std = stdTxt === "" ? null : Number(stdTxt);
      if (std != null && (isNaN(std) || std < 0 || std > 200)) fehler.push(`Stunden „${w("stunden")}“ ungültig`);
      const ein = norm(w("einheit")), einheit = ein.startsWith("mon") ? "monat" : ein.startsWith("wo") ? "woche" : ((beschaeftigung(besch) || {}).einheit || "woche");
      const urlTxt = w("urlaub"), url = urlTxt === "" ? null : Number(urlTxt.replace(",", "."));
      if (url != null && (isNaN(url) || url < 0 || url > 40)) fehler.push(`Urlaub „${urlTxt}“ ungültig`);
      const doppelt = vorname && vorhanden.has(norm(vorname + nachname));
      return { nr: i + (hatKopf ? 2 : 1), fehler, doppelt, person: fehler.length ? null : { vorname, nachname, rolle, stammfiliale: f.id, beschaeftigung: besch || null, wochenstunden: std == null ? 0 : std, stundenEinheit: einheit, urlaubsanspruch: url == null ? 30 : url, springer: false, einsatzfilialen: [], aktiv: true } };
    });
    return { zeilen: r, hatKopf };
  }

  // ---------- Einsatzplanung ----------
  // Zeit eines Plan-Eintrags: eigene Zeit (z. B. nach Stundentausch) oder die Zeit der Schicht
  function planZeit(state, s) {
    if (s.zeit) return s.zeit;
    const f = (state.filialen || []).find((x) => x.id === s.filiale);
    return f ? schichtZeit(f, s.datum, s.schicht) : null;
  }
  function schichtenAm(state, datum, filter) {
    return (state.plan || []).filter((s) => s.datum === datum && (!filter || filter(s)));
  }
  function stundenInWoche(state, personId, montagIso) {
    const tage = woche(montagIso);
    let min = 0;
    for (const s of state.plan || []) {
      if (s.personId !== personId || !tage.includes(s.datum)) continue;
      const z = planZeit(state, s);
      if (z) min += z.ende - z.start;
    }
    return min / 60;
  }
  function wunschAm(state, personId, datum) {
    return (state.wuensche || []).find((w) => w.personId === personId && w.datum === datum);
  }
  // Wer kommt für eine Schicht in Frage? Mit Gründen, damit die Shopleitung sieht, warum jemand fehlt.
  function kandidaten(state, filialeId, datum, schichtId) {
    const f = state.filialen.find((x) => x.id === filialeId);
    const z = f && schichtZeit(f, datum, schichtId);
    const mo = montag(datum);
    return (state.personen || []).filter((p) => darfInFiliale(p, filialeId)).map((p) => {
      const gruende = [];
      let moeglich = true;
      const abw = abwesenheitAm(state, p.id, datum);
      if (abw) { moeglich = false; gruende.push(abw.art === "krank" ? "krank" : "Urlaub"); }
      const schon = schichtenAm(state, datum, (s) => s.personId === p.id);
      for (const s of schon) {
        const f2 = state.filialen.find((x) => x.id === s.filiale);
        const z2 = planZeit(state, s);
        if (s.filiale === filialeId && s.schicht === schichtId) { moeglich = false; gruende.push("schon eingeteilt"); }
        else if (z && z2 && z2.start < z.ende && z.start < z2.ende) { moeglich = false; gruende.push(`schon ${f2.kurz || f2.name}`); }
        else if (s.filiale !== filialeId) gruende.push(`am Tag auch in ${f2.kurz || f2.name}`);
      }
      // Arbeitszeitgesetz: höchstens 10 Std. am Tag (Wert aus den Parametern)
      const maxTag = ((state.parameter || {}).max) || 600;
      const tagMin = schon.reduce((n, x) => { const zz = planZeit(state, x); return n + (zz ? zz.ende - zz.start : 0); }, 0) + (z ? z.ende - z.start : 0);
      if (z && tagMin > maxTag) { moeglich = false; gruende.push(`über ${maxTag / 60} Std. am Tag`); }
      const w = wunschAm(state, p.id, datum);
      let punkte = 0;
      if (w) {
        if (w.art === "nicht") { moeglich = false; gruende.push("kann nicht (Wunsch)"); }
        else if (w.schicht && w.schicht !== "egal" && w.schicht !== schichtId) { punkte -= 2; gruende.push(`wünscht ${schicht(w.schicht).name}`); }
        else if (w.art === "moechte") { punkte += 3; gruende.push("möchte"); }
        else if (w.art === "kann") { punkte += 1; gruende.push("kann"); }
      }
      const stand = stundenStand(state, p, datum, z ? z.ende - z.start : 0);
      const std = stundenInWoche(state, p.id, mo);
      const je = stand.einheit === "monat" ? "im Monat" : "in der Woche";
      if (stand.ueber && !stand.ueberGrenze) gruende.push(`über Umfang, erlaubt bis +${stand.erlaubt} Std. (${stand.neu} von ${stand.soll})`);
      else if (stand.soll && stand.ist >= stand.grenze) { punkte -= 3; gruende.push(`Stunden voll: ${stand.ist} von ${stand.soll} Std. ${je}`); }
      else if (stand.ueberGrenze) { punkte -= 2; gruende.push(`käme auf ${stand.neu} von ${stand.soll} Std. ${je}`); }
      // Festes Einsatzprofil: Abweichungen nur mit Rückfrage, der Planvorschlag hält sich daran
      const profil = profilPruefen(p, datum, z, schichtId);
      if (profil.length) { punkte -= 5; gruende.push("Profil: " + profil.join(", ")); }
      const gesetz = gesetzHinweise(state, p, datum, z);
      if (gesetz.length) { punkte -= 3; gruende.push(...gesetz); }
      if (inBereitschaft(p, datum, z)) { punkte += 2; gruende.push("in Bereitschaft"); }
      if (p.stammfiliale !== filialeId) { punkte -= 1; gruende.push("Springer"); }
      return { person: p, moeglich, punkte, stunden: std, stand, gruende, profil, gesetz };
    }).sort((a, b) => (b.moeglich - a.moeglich) || (b.punkte - a.punkte) || (a.stunden - b.stunden) || a.person.vorname.localeCompare(b.person.vorname));
  }
  function abdeckung(state, filialeId, datum, schichtId) {
    const f = state.filialen.find((x) => x.id === filialeId);
    const soll = bedarf(f, datum, schichtId);
    const ist = schichtenAm(state, datum, (s) => s.filiale === filialeId && s.schicht === schichtId && s.personId &&
      !abwesenheitAm(state, s.personId, datum)).length;
    const ampel = soll === 0 ? "zu" : ist >= soll ? "gruen" : ist === soll - 1 ? "gelb" : "rot";
    return { soll, ist, ampel };
  }
  // Planvorschlag: füllt leere Plätze nach festen Regeln (Verfügbarkeit, Wünsche, Wochenstunden, Stammfiliale vor Springer).
  function planVorschlag(state, filialeId, montagIso, neueId, opt) {
    const nurStamm = opt && opt.nurStamm;
    const neu = [];
    const arbeit = { ...state, plan: [...(state.plan || [])] };
    const f = state.filialen.find((x) => x.id === filialeId);
    for (const datum of woche(montagIso)) {
      for (const sch of SCHICHTEN) {
        let { soll, ist } = abdeckung(arbeit, filialeId, datum, sch.id);
        if (!oeffnung(f, datum)) continue;
        while (ist < soll) {
          // Vorgaben der Besetzungsmatrix beachten: fehlt in dieser Schicht eine Leitung, zuerst Leitung; zu viele Aushilfen, keine weiteren Aushilfen
          const z = schichtZeit(f, datum, sch.id);
          const gr = besetzungTag(arbeit, filialeId, datum).slots.filter((x) => z && x.m >= z.start && x.m < z.ende).flatMap((x) => x.gruende).join(" ");
          const brauchtLeitung = /Shopleitung|Leitung/.test(gr), brauchtFest = /feste Mitarbeiter/.test(gr) || /zu viele Aushilfen/.test(gr);
          const ks = kandidaten(arbeit, filialeId, datum, sch.id).filter((x) => x.moeglich && x.punkte > -3 && !x.stand.ueberGrenze && !x.profil.length && !x.gesetz.length && (!nurStamm || x.person.stammfiliale === filialeId));
          const k = (brauchtLeitung && ks.find((x) => x.person.rolle === "shopleitung" || x.person.rolle === "stv")) || (brauchtFest && ks.find((x) => x.person.rolle !== "aushilfe")) || ks[0];
          if (!k) break;
          const s = { id: neueId(), filiale: filialeId, datum, schicht: sch.id, personId: k.person.id, quelle: "vorschlag" };
          arbeit.plan.push(s); neu.push(s); ist++;
        }
      }
    }
    return neu;
  }
  // ---------- Besetzungsmatrix ----------
  // Je Filiale und Tagesart (Werktag, Samstag, Sonntag, Einsatz) Zeitblöcke mit Vorgabe:
  // gesamt = Personen, sl = mind. Shopleitung, stv = mind. weitere Leitung (Stv. oder höher), ma = mind. feste Mitarbeiter (oder höher), maxAus = höchstens Aushilfen.
  const ROLLEN_GRUPPE = { shopleitung: "sl", stv: "stv", mitarbeiter: "ma", aushilfe: "aus" };
  function matrixTyp(filiale, datum) {
    if (filiale.art === "mobil") return "einsatz";
    const t = wochentag(datum);
    return t === "sa" ? "sa" : t === "so" ? "so" : "werktag";
  }
  function bedarfBloecke(filiale, datum) {
    const o = oeffnung(filiale, datum);
    if (!o) return [];
    const m = filiale.matrix && filiale.matrix[matrixTyp(filiale, datum)];
    if (!m) return [];
    return m.map((b) => ({ ...b, von: Math.max(zeitZuMin(b.von), o.auf), bis: Math.min(zeitZuMin(b.bis), o.zu) })).filter((b) => b.bis > b.von);
  }
  function slotPruefen(b, leute) {
    const z = { gesamt: leute.length, sl: 0, lead: 0, fest: 0, aus: 0 };
    for (const p of leute) {
      const g = ROLLEN_GRUPPE[p.rolle] || "ma";
      if (g === "sl") z.sl++;
      if (g === "sl" || g === "stv") z.lead++;
      if (g !== "aus") z.fest++; else z.aus++;
    }
    if (!b) return { zahl: z, status: leute.length ? "ohne" : "leer", gruende: [] };
    const gruende = [];
    const sl = b.sl || 0, stv = b.stv || 0, ma = b.ma || 0;
    if (z.gesamt < b.gesamt) gruende.push(`${b.gesamt - z.gesamt} Person${b.gesamt - z.gesamt > 1 ? "en" : ""} fehl${b.gesamt - z.gesamt > 1 ? "en" : "t"}`);
    if (z.sl < sl) gruende.push("keine Shopleitung");
    else if (z.lead < sl + stv) gruende.push("keine Leitung (Shopleitung oder Stellvertretung)");
    if (z.fest < sl + stv + ma && z.gesamt >= b.gesamt) gruende.push("zu wenig feste Mitarbeiter (zu viele Aushilfen)");
    if (b.maxAus != null && z.aus > b.maxAus) gruende.push(`zu viele Aushilfen (${z.aus} statt höchstens ${b.maxAus})`);
    const status = z.gesamt < b.gesamt ? "rot" : gruende.length ? "gelb" : z.gesamt > b.gesamt ? "ueber" : "gruen";
    return { zahl: z, status, gruende };
  }
  // Besetzung eines Tages in halben Stunden: wer ist laut Plan da (ohne Abwesende), was ist gefordert, Ampel und Gründe.
  function besetzungTag(state, filialeId, datum) {
    const f = state.filialen.find((x) => x.id === filialeId);
    const o = f && oeffnung(f, datum);
    if (!o) return { offen: false, slots: [], personen: [] };
    const bloecke = bedarfBloecke(f, datum);
    const eintraege = schichtenAm(state, datum, (s) => s.filiale === filialeId && s.personId).map((s) => ({ s, z: planZeit(state, s), p: state.personen.find((x) => x.id === s.personId) }))
      .filter((x) => x.z && x.p);
    const personen = eintraege.map((x) => ({ id: x.p.id, rolle: x.p.rolle, von: x.z.start, bis: x.z.ende, schicht: x.s.schicht, abwesend: !!abwesenheitAm(state, x.p.id, datum), springer: x.p.stammfiliale !== filialeId }));
    const slots = [];
    for (let m = o.auf; m < o.zu; m += 30) {
      const b = bloecke.find((x) => m >= x.von && m < x.bis) || null;
      const leute = eintraege.filter((x) => x.z.start <= m && x.z.ende >= m + 30 && !abwesenheitAm(state, x.p.id, datum)).map((x) => x.p);
      slots.push({ m, bedarf: b, leute: leute.map((p) => p.id), ...slotPruefen(b, leute) });
    }
    return { offen: true, auf: o.auf, zu: o.zu, ort: o.ort, slots, personen };
  }
  // Nicht richtig besetzte Zeiten eines Tages, zusammengefasst zu Zeiträumen mit gleichem Grund.
  function besetzungsLuecken(state, filialeId, datum) {
    const t = besetzungTag(state, filialeId, datum);
    const r = [];
    for (const sl of t.slots) {
      if (sl.status !== "rot" && sl.status !== "gelb") continue;
      const schluessel = sl.status + "|" + sl.gruende.join("|");
      const letzt = r[r.length - 1];
      if (letzt && letzt.bis === sl.m && letzt.schluessel === schluessel) { letzt.bis = sl.m + 30; continue; }
      r.push({ datum, filiale: filialeId, von: sl.m, bis: sl.m + 30, status: sl.status, gruende: sl.gruende, soll: sl.bedarf.gesamt, ist: sl.zahl.gesamt, schluessel });
    }
    return r;
  }
  // Welche Schicht deckt einen Zeitraum am besten ab (für „+ einteilen“ aus der Lückenliste)?
  function passendeSchicht(filiale, datum, von, bis) {
    let best = null, bestMin = -1;
    for (const sch of SCHICHTEN) {
      const z = schichtZeit(filiale, datum, sch.id); if (!z) continue;
      const ueber = Math.min(z.ende, bis) - Math.max(z.start, von);
      if (ueber > bestMin) { bestMin = ueber; best = sch.id; }
    }
    return best;
  }

  // ---------- Tauschbörse ----------
  // Ein Angebot gibt eine ganze Schicht oder einen Teil davon (Stunden am Anfang oder Ende) ab.
  // Ein Kollege übernimmt sie, oder tauscht sie gegen eine eigene ganze Schicht. Die Shopleitung bestätigt.
  function teilPruefen(z, teil) {
    if (!teil) return null;
    if (!(teil.ende > teil.start) || teil.start < z.start || teil.ende > z.ende) return "Die Stunden liegen nicht in der Schicht.";
    if (teil.start === z.start && teil.ende === z.ende) return null;
    if (teil.start !== z.start && teil.ende !== z.ende) return "Abgeben geht nur am Anfang oder Ende der Schicht.";
    if (teil.ende - teil.start < 60) return "Mindestens 1 Stunde abgeben.";
    return null;
  }
  function personPasst(state, p, filialeId, datum, zeit, ohneIds) {
    const gruende = [], hinweise = [];
    if (!darfInFiliale(p, filialeId)) gruende.push("darf in dieser Filiale nicht eingesetzt werden");
    const abw = abwesenheitAm(state, p.id, datum);
    if (abw) gruende.push(abw.art === "krank" ? "krank gemeldet" : "im Urlaub");
    for (const s of schichtenAm(state, datum, (x) => x.personId === p.id && !ohneIds.includes(x.id))) {
      const z2 = planZeit(state, s);
      if (z2 && zeit && z2.start < zeit.ende && zeit.start < z2.ende) gruende.push("hat zu der Zeit schon Dienst");
    }
    const maxTag = ((state.parameter || {}).max) || 600;
    const tagMin = schichtenAm(state, datum, (x) => x.personId === p.id && !ohneIds.includes(x.id)).reduce((n, x) => { const zz = planZeit(state, x); return n + (zz ? zz.ende - zz.start : 0); }, 0) + (zeit ? zeit.ende - zeit.start : 0);
    if (tagMin > maxTag) gruende.push(`käme über ${maxTag / 60} Std. am Tag`);
    const w = wunschAm(state, p.id, datum);
    if (w && w.art === "nicht") hinweise.push("hat für den Tag „kann nicht“ angegeben");
    const st = stundenStand(state, p, datum, zeit.ende - zeit.start);
    if (st.ueberGrenze) hinweise.push(`käme auf ${st.neu} von ${st.soll} Std. ${st.einheit === "monat" ? "im Monat" : "in der Woche"}`);
    const pr = profilPruefen(p, datum, zeit);
    if (pr.length) hinweise.push("Einsatzprofil: " + pr.join(", "));
    hinweise.push(...gesetzHinweise(state, p, datum, zeit, ohneIds));
    return { gruende, hinweise };
  }
  function tauschPruefen(state, angebot, nehmerId, gegenId) {
    const s = (state.plan || []).find((x) => x.id === angebot.schichtId);
    const nehmer = (state.personen || []).find((p) => p.id === nehmerId);
    if (!s || !nehmer) return { moeglich: false, gruende: ["Schicht oder Person nicht gefunden"], hinweise: [] };
    if (nehmerId === angebot.vonId) return { moeglich: false, gruende: ["eigene Schicht"], hinweise: [] };
    const ganz = planZeit(state, s);
    const fehler = teilPruefen(ganz, angebot.teil);
    if (fehler) return { moeglich: false, gruende: [fehler], hinweise: [] };
    const zeit = angebot.teil || ganz;
    const ohne = [];
    let gegen = null;
    if (gegenId) {
      gegen = state.plan.find((x) => x.id === gegenId);
      if (!gegen || gegen.personId !== nehmerId) return { moeglich: false, gruende: ["Gegen-Schicht gehört nicht dir"], hinweise: [] };
      if (angebot.teil) return { moeglich: false, gruende: ["Tauschen geht nur mit ganzen Schichten"], hinweise: [] };
      ohne.push(gegen.id);
    }
    const a = personPasst(state, nehmer, s.filiale, s.datum, zeit, ohne);
    if (gegen) {
      const geber = state.personen.find((p) => p.id === angebot.vonId);
      const b = personPasst(state, geber, gegen.filiale, gegen.datum, planZeit(state, gegen), [s.id]);
      a.gruende.push(...b.gruende.map((g) => `${geber.vorname}: ${g}`));
      a.hinweise.push(...b.hinweise.map((g) => `${geber.vorname}: ${g}`));
    }
    return { moeglich: !a.gruende.length, gruende: a.gruende, hinweise: a.hinweise };
  }
  // Führt einen bestätigten Tausch im Plan aus (verändert state.plan) und gibt die geänderten Einträge zurück.
  function tauschAusfuehren(state, angebot, neueId) {
    const s = state.plan.find((x) => x.id === angebot.schichtId);
    const ganz = planZeit(state, s);
    if (angebot.gegenId) {
      const g = state.plan.find((x) => x.id === angebot.gegenId);
      const p1 = s.personId; s.personId = g.personId; g.personId = p1; s.quelle = g.quelle = "tausch";
      return [s, g];
    }
    const t = angebot.teil;
    if (!t || (t.start === ganz.start && t.ende === ganz.ende)) { s.personId = angebot.nehmerId; s.quelle = "tausch"; return [s]; }
    const rest = t.start === ganz.start ? { start: t.ende, ende: ganz.ende } : { start: ganz.start, ende: t.start };
    s.zeit = rest;
    const neu = { id: neueId(), filiale: s.filiale, datum: s.datum, schicht: s.schicht, personId: angebot.nehmerId, zeit: { start: t.start, ende: t.ende }, quelle: "tausch" };
    state.plan.push(neu);
    return [s, neu];
  }

  // Krankmeldung: welche geplanten Schichten werden dadurch offen?
  function betroffeneSchichten(state, personId, von, bis) {
    return (state.plan || []).filter((s) => s.personId === personId && zwischen(s.datum, von, bis));
  }

  // ---------- Stechuhr ----------
  function stempelAm(state, personId, datum) {
    return (state.stempel || []).filter((s) => s.personId === personId && s.zeit.slice(0, 10) === datum).sort((a, b) => a.zeit.localeCompare(b.zeit));
  }
  function stempelStatus(eintraege) {
    const letzt = eintraege[eintraege.length - 1];
    if (!letzt || letzt.art === "gehen") return "aus";
    if (letzt.art === "pause") return "pause";
    return "da";
  }
  // Arbeits- und Pausenminuten eines Tages; offene Zeiten bis "jetzt" gerechnet.
  function stempelSumme(eintraege, jetztIso) {
    let arbeit = 0, pause = 0, seit = null, modus = "aus";
    const t = (z) => new Date(z).getTime() / 60000;
    for (const e of eintraege) {
      if (seit !== null) { if (modus === "da") arbeit += t(e.zeit) - seit; if (modus === "pause") pause += t(e.zeit) - seit; }
      modus = e.art === "kommen" || e.art === "weiter" ? "da" : e.art === "pause" ? "pause" : "aus";
      seit = modus === "aus" ? null : t(e.zeit);
    }
    if (seit !== null && jetztIso) { if (modus === "da") arbeit += t(jetztIso) - seit; else pause += t(jetztIso) - seit; }
    return { arbeit: Math.round(arbeit), pause: Math.round(pause) };
  }
  // Hinweise nach Arbeitszeitgesetz (Werte aus Parametern, nicht fest im Programm verdrahtet).
  function arbeitszeitHinweise(summe, par) {
    const p = par || { pause6: 30, pause9: 45, max: 600 };
    const h = [];
    if (summe.arbeit > 540 && summe.pause < p.pause9) h.push(`Über 9 Std. Arbeit: mindestens ${p.pause9} Min. Pause nötig.`);
    else if (summe.arbeit > 360 && summe.pause < p.pause6) h.push(`Über 6 Std. Arbeit: mindestens ${p.pause6} Min. Pause nötig.`);
    if (summe.arbeit > p.max) h.push(`Mehr als ${p.max / 60} Std. Arbeit an einem Tag.`);
    return h;
  }

  // Stundenliste für den Steuerberater: je Person und Tag Kommen, Gehen, Pause, Arbeit (Minuten). Offene Tage werden markiert.
  function stundenliste(state, monat, filialeId) {
    const zeilen = [];
    const tage = [...new Set((state.stempel || []).filter((x) => x.zeit.slice(0, 7) === monat && (!filialeId || x.filiale === filialeId)).map((x) => `${x.personId}|${x.zeit.slice(0, 10)}`))].sort();
    for (const k of tage) {
      const [pid, datum] = k.split("|");
      const e = stempelAm(state, pid, datum).filter((x) => !filialeId || x.filiale === filialeId);
      const sum = stempelSumme(e);
      const kommen = e.find((x) => x.art === "kommen"), gehen = [...e].reverse().find((x) => x.art === "gehen");
      zeilen.push({ personId: pid, datum, filiale: e[0].filiale, kommen: kommen ? kommen.zeit.slice(11, 16) : "", gehen: gehen ? gehen.zeit.slice(11, 16) : "", pause: sum.pause, arbeit: sum.arbeit, offen: stempelStatus(e) !== "aus" });
    }
    return zeilen;
  }
  function csv(zeilen, kopf) {
    const f = (v) => { const t = String(v == null ? "" : v); return /[;"\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
    return [kopf.join(";"), ...zeilen.map((z) => z.map(f).join(";"))].join("\r\n");
  }

  // ---------- Pinnwand (wie Club-App: Zettel, Empfänger, wichtig, gelesen, abnehmen) ----------
  const PIN_STANDARD = { maxZettel: 4, zeichen: 200, erinnernTage: 3, pauseTage: 7 };
  function pinEinstellungen(state) { return { ...PIN_STANDARD, ...((state.parameter || {}).pinnwand || {}) }; }
  function pinEmpfaenger(state, z) {
    const aktiv = (state.personen || []).filter((p) => p.aktiv !== false && p.rolle !== "berater");
    if (z.fuer === "ich") return [z.vonId];
    if (z.fuer === "personen") return (z.empfaenger || []).filter((id) => id !== z.vonId);
    const inFiliale = (p) => z.filiale == null || darfInFiliale(p, z.filiale);
    if (z.fuer === "leitung") return aktiv.filter((p) => (p.rolle === "shopleitung" || p.rolle === "stv") && (z.filiale == null || p.stammfiliale === z.filiale) && p.id !== z.vonId).map((p) => p.id);
    return aktiv.filter((p) => p.id !== z.vonId && !UEBERGREIFEND.includes(p.rolle) && inFiliale(p)).map((p) => p.id);
  }
  function pinAktiv(z, heute) { return !z.entfernt && (!z.bis || z.bis >= heute); }
  // Sichtbar für: Empfänger (solange nicht bei ihm abgenommen), Verfasser, Leitung der Filiale, Zentrale
  function pinSichtbar(state, z, p, heute) {
    if (!p || !pinAktiv(z, heute)) return false;
    if (z.vonId === p.id || p.rolle === "zentrale") return true;
    if (z.filiale && istLeitung(p, z.filiale)) return true;
    return pinEmpfaenger(state, z).includes(p.id) && !(z.abgenommen || {})[p.id];
  }
  function pinStand(state, z) {
    const empf = pinEmpfaenger(state, z).filter((id) => id !== z.vonId);
    const gelesen = empf.filter((id) => (z.gelesen || {})[id]);
    return { empf, gelesen, offen: empf.filter((id) => !(z.gelesen || {})[id]) };
  }
  function pinUngelesen(state, p, heute) {
    return (state.pinnwand || []).filter((z) => z.vonId !== p.id && pinAktiv(z, heute) && pinEmpfaenger(state, z).includes(p.id) && !(z.gelesen || {})[p.id] && !(z.abgenommen || {})[p.id]);
  }
  function pinEigeneAktiv(state, p, heute) { return (state.pinnwand || []).filter((z) => z.vonId === p.id && pinAktiv(z, heute) && z.fuer !== "ich"); }
  // Eigene Zettel, die schon lange hängen (Erinnerung an den Verfasser, mit Pause)
  function pinErinnern(state, p, heute) {
    const e = pinEinstellungen(state);
    return pinEigeneAktiv(state, p, heute).filter((z) => plusTage(z.zeit.slice(0, 10), e.erinnernTage) <= heute && (!z.pauseBis || z.pauseBis <= heute));
  }

  // ---------- Admin: Betreiber und Datenbanken ----------
  // Prüft öffentliche Verbindungsdaten. Geheime Schlüssel und Passwörter werden erkannt und abgewiesen (KICC-Regel 15).
  const SCHRITTE = [
    { id: "antrag", text: "Antrag erfasst (Betreiber, Ansprechpartner, Filialen)", hand: true },
    { id: "avv", text: "AV-Vertrag unterschrieben", hand: true },
    { id: "supabase", text: "Supabase-Projekt in Frankfurt angelegt", hand: false },
    { id: "neon", text: "Neon-Projekt in Frankfurt angelegt", hand: false },
    { id: "einrichtung", text: "Einrichtung ausgeführt (Tabellen, Server, Geheimnisse im eigenen Vault)", hand: true },
    { id: "verbindung", text: "Verbindung geprüft (automatisch)", auto: true },
    { id: "sicherung", text: "Erste Datensicherung geprüft (automatisch)", auto: true },
  ];
  function geheimErkannt(t) {
    const x = String(t || "").trim();
    if (!x) return null;
    if (/^sb_secret_/i.test(x)) return "Das ist der geheime Supabase-Schlüssel. Er gehört nur in den Vault des Betreibers, nie in die App.";
    if (/postgres(ql)?:\/\/[^\s:@]+:[^\s@]+@/i.test(x)) return "Das ist eine Datenbank-Adresse mit Passwort. Sie gehört nur in den Vault des Betreibers.";
    if (/^napi_/i.test(x)) return "Das ist ein Neon-API-Schlüssel. Er darf hier nicht gespeichert werden.";
    const teile = x.split(".");
    if (teile.length === 3 && /^eyJ/.test(teile[0])) {
      try {
        const b = teile[1].replace(/-/g, "+").replace(/_/g, "/");
        const json = JSON.parse(typeof atob === "function" ? atob(b + "===".slice((b.length + 3) % 4)) : Buffer.from(b, "base64").toString("utf8"));
        if (json.role === "service_role") return "Das ist der geheime service_role-Schlüssel. Er darf nie in die App.";
      } catch (e) { return "Dieser Schlüssel lässt sich nicht lesen."; }
    }
    return null;
  }
  function pruefeVerbindung(b) {
    const fehler = [], hinweise = [];
    const sb = b.supabase || {}, ne = b.neon || {};
    for (const [feld, wert] of [["Supabase-Adresse", sb.url], ["Publishable Key", sb.key], ["Neon Projekt-ID", ne.projekt]]) {
      const g = geheimErkannt(wert); if (g) fehler.push(`${feld}: ${g}`);
    }
    let ref = null;
    if (sb.url) {
      const m = /^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/.exec(sb.url.trim());
      if (!m) fehler.push("Supabase-Adresse: erwartet https://<20 Zeichen>.supabase.co");
      else ref = m[1];
    }
    if (sb.key && !geheimErkannt(sb.key)) {
      if (!/^sb_publishable_[A-Za-z0-9_-]{10,}$/.test(sb.key.trim()) && !/^eyJ/.test(sb.key.trim())) hinweise.push("Publishable Key: unbekanntes Format, bitte prüfen (erwartet sb_publishable_…)");
    }
    if (sb.region && sb.region !== "eu-central-1") fehler.push("Supabase-Region muss Frankfurt (eu-central-1) sein.");
    if (ne.region && ne.region !== "aws-eu-central-1") fehler.push("Neon-Region muss Frankfurt (aws-eu-central-1) sein.");
    if (ne.projekt && !geheimErkannt(ne.projekt) && !/^[a-z0-9]+(-[a-z0-9]+)+$/.test(ne.projekt.trim())) fehler.push("Neon Projekt-ID: erwartet z. B. ruhiger-see-12345678");
    const supabaseFertig = !!(ref && sb.key && sb.region === "eu-central-1" && !fehler.some((f) => /^Supabase|Publishable/.test(f)));
    const neonFertig = !!(ne.projekt && ne.region === "aws-eu-central-1" && !fehler.some((f) => /^Neon/.test(f)));
    return { ok: !fehler.length, fehler, hinweise, ref, supabaseFertig, neonFertig };
  }
  // Stand eines Betreibers: welche Schritte sind erledigt, darf er freigegeben werden?
  function betreiberStand(b) {
    const v = pruefeVerbindung(b);
    const erledigt = {
      antrag: !!(b.schritte && b.schritte.antrag), avv: !!b.avvDatum, supabase: v.supabaseFertig, neon: v.neonFertig,
      einrichtung: !!(b.schritte && b.schritte.einrichtung), verbindung: !!(b.pruefung && b.pruefung.verbindung === "ok"), sicherung: !!(b.pruefung && b.pruefung.sicherung === "ok"),
    };
    const anzahl = SCHRITTE.filter((x) => erledigt[x.id]).length;
    return { erledigt, anzahl, gesamt: SCHRITTE.length, freigabeMoeglich: anzahl === SCHRITTE.length && v.ok, verbindung: v };
  }

  // ---------- Hygiene ----------
  // Gilt eine Regel in der Filiale? Zuteilung der Shopleitung/Zentrale geht vor dem Standard der Regel.
  function regelGilt(state, regel, filialeId) {
    const z = (state.hygiene.zuteilung || {})[`${regel.id}|${filialeId}`];
    if (z && z.status === "nicht") return false;
    if (z && z.status === "aktiv") return true;
    return regel.standard !== "keine";
  }
  function geraeteFuer(state, regel, filialeId) {
    if (!regel.geraetetyp) return [null];
    return (state.hygiene.geraete || []).filter((g) => g.filiale === filialeId && g.typ === regel.geraetetyp && g.status !== "stillgelegt");
  }
  // Fälligkeiten eines Tages in Minuten nach Intervall.
  function zeitpunkte(regel, o, datum, z) {
    const iv = regel.intervall;
    const anpass = z && z.uhrzeit ? [zeitZuMin(z.uhrzeit)] : null;
    switch (iv.art) {
      case "oeffnung": return anpass || [o.auf + (iv.versatz || 0)];
      case "schliessung": return anpass || [o.zu + (iv.versatz || 0)];
      case "uhrzeiten": return (anpass || iv.zeiten.map(zeitZuMin)).filter((m) => m >= o.auf - 30 && m <= o.zu + 30);
      case "alle_std": { const r = []; for (let m = o.auf + iv.std * 60; m <= o.zu; m += iv.std * 60) r.push(m); return r; }
      case "wochentage": return iv.tage.includes(wochentag(datum)) ? (anpass || [zeitZuMin(iv.zeit)]) : [];
      case "monatlich": { // erster Öffnungstag ab dem Tag x des Monats
        const d = ausIso(datum).getDate();
        return d === iv.tagAb || (d > iv.tagAb && iv._ersterOffen === datum) ? (anpass || [zeitZuMin(iv.zeit)]) : [];
      }
      default: return [];
    }
  }
  function ersterOffenerTagAb(filiale, datum, tagAb) {
    let s = datum.slice(0, 8) + pad(tagAb);
    for (let i = 0; i < 10; i++) { if (oeffnung(filiale, s)) return s; s = plusTage(s, 1); }
    return null;
  }
  // Wer ist zuständig? Aus dem veröffentlichten Einsatzplan; ist niemand eingeteilt, die Shopleitung.
  function zustaendig(state, regel, filialeId, datum) {
    const zs = regel.zustaendig || { art: "alle" };
    let ids = [];
    if (zs.art === "schicht") ids = schichtenAm(state, datum, (s) => s.filiale === filialeId && s.schicht === zs.wert && s.personId && !abwesenheitAm(state, s.personId, datum)).map((s) => s.personId);
    else if (zs.art === "rolle") ids = state.personen.filter((p) => p.stammfiliale === filialeId && p.rolle === zs.wert && !abwesenheitAm(state, p.id, datum)).map((p) => p.id);
    else ids = schichtenAm(state, datum, (s) => s.filiale === filialeId && s.personId).map((s) => s.personId);
    ids = [...new Set(ids)];
    if (!ids.length) {
      const sl = state.personen.find((p) => p.stammfiliale === filialeId && p.rolle === "shopleitung");
      return { ids: sl ? [sl.id] : [], ersatz: true };
    }
    return { ids, ersatz: false };
  }
  function pruefeWert(pp, wert) {
    if (pp.art === "haken") return wert === true ? "ok" : "offen";
    if (pp.art === "auswahl") return wert == null || wert === "" ? "offen" : (pp.schlecht || []).includes(wert) ? "kritisch" : "ok";
    if (pp.art === "messwert") {
      if (wert === "" || wert == null || isNaN(Number(wert))) return "offen";
      const v = Number(wert);
      if (pp.max != null && v > (pp.krit != null ? pp.krit : pp.max)) return "kritisch";
      if (pp.min != null && v < (pp.kritMin != null ? pp.kritMin : pp.min)) return "kritisch";
      if ((pp.max != null && v > pp.max) || (pp.min != null && v < pp.min)) return "warn";
      return "ok";
    }
    return wert ? "ok" : "offen";
  }
  function bewerte(regel, werte) {
    const st = regel.pruefpunkte.map((pp, i) => pruefeWert(pp, werte[i]));
    if (st.includes("offen")) return "offen";
    if (st.includes("kritisch")) return "kritisch";
    if (st.includes("warn")) return "warn";
    return "ok";
  }
  // Tagesliste einer Filiale: aus Regeln, Zuteilung, Geräten, Öffnungszeit und Einsatzplan.
  // Status wird nie "erledigt", wenn es keine Durchführung gibt (UNKNOWN ≠ OK).
  function tagesliste(state, filialeId, datum, jetzt) {
    const f = state.filialen.find((x) => x.id === filialeId);
    const o = f && oeffnung(f, datum);
    if (!o) return [];
    const h = state.hygiene;
    const liste = [];
    for (const r of h.regeln || []) {
      if (r.aktiv === false || !regelGilt(state, r, filialeId)) continue;
      const z = (h.zuteilung || {})[`${r.id}|${filialeId}`];
      const iv = r.intervall.art === "monatlich" ? { ...r.intervall, _ersterOffen: ersterOffenerTagAb(f, datum, r.intervall.tagAb) } : r.intervall;
      const zp = zeitpunkte({ ...r, intervall: iv }, o, datum, z);
      for (const g of geraeteFuer(state, r, filialeId)) {
        if (g && g.status === "gestoert") continue;
        zp.forEach((m, slot) => {
          const key = `${datum}|${filialeId}|${r.id}|${g ? g.id : "-"}|${slot}`;
          liste.push({ key, datum, filiale: filialeId, regel: r, geraet: g, ab: m, bis: m + (r.toleranz || 60), slot });
        });
      }
    }
    for (const n of h.nachkontrollen || []) {
      if (n.filiale !== filialeId || n.datum !== datum) continue;
      const r = h.regeln.find((x) => x.id === n.regelId);
      if (!r) continue;
      const g = n.geraetId ? h.geraete.find((x) => x.id === n.geraetId) : null;
      liste.push({ key: n.key, datum, filiale: filialeId, regel: r, geraet: g, ab: n.ab, bis: n.ab + 30, nachkontrolle: true, quelle: n.quelle });
    }
    const jetztMin = jetzt && jetzt.datum === datum ? jetzt.min : jetzt && jetzt.datum > datum ? 99999 : -1;
    for (const a of liste) {
      const d = (h.durchfuehrungen || []).filter((x) => x.key === a.key).sort((x, y) => x.zeit.localeCompare(y.zeit)).pop();
      a.durchfuehrung = d || null;
      a.zustaendig = zustaendig(state, a.regel, filialeId, datum);
      if (d) a.status = d.ergebnis === "nicht_moeglich" ? "nicht_moeglich" : d.bewertung === "ok" ? "erledigt" : "abweichung";
      else if (jetztMin < 0 || jetztMin < a.ab - 30) a.status = "spaeter";
      else if (jetztMin <= a.bis) a.status = "faellig";
      else a.status = jetzt && jetzt.datum > datum ? "verpasst" : "ueberfaellig";
    }
    return liste.sort((x, y) => x.ab - y.ab || x.regel.titel.localeCompare(y.regel.titel));
  }
  function tagesSumme(liste) {
    const s = { gesamt: liste.length, erledigt: 0, faellig: 0, ueberfaellig: 0, abweichung: 0, spaeter: 0 };
    for (const a of liste) {
      if (a.status === "erledigt") s.erledigt++;
      else if (a.status === "abweichung" || a.status === "nicht_moeglich") s.abweichung++;
      else if (a.status === "faellig") s.faellig++;
      else if (a.status === "ueberfaellig" || a.status === "verpasst") s.ueberfaellig++;
      else s.spaeter++;
    }
    s.quote = s.gesamt ? Math.round(((s.erledigt + s.abweichung) / s.gesamt) * 100) : null;
    return s;
  }

  // ---------- Rezepte und Quiz ----------
  function allergeneVon(rezept) {
    const s = new Set();
    for (const z of rezept.zutaten) (z.allergene || []).forEach((a) => s.add(a));
    return [...s].sort();
  }
  function mengeFuer(zutat, groesse) {
    const m = zutat.menge;
    return typeof m === "object" ? m[groesse] : m;
  }
  // Kleiner, wiederholbarer Zufall (für Tests mit festem Startwert).
  function zufall(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  function mischen(arr, rnd) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function quiz(rezepte, gruppen, anzahl, seed) {
    const rnd = zufall(seed);
    const fragen = [];
    const alleZutaten = [...new Set(rezepte.flatMap((r) => r.zutaten.map((z) => z.name)))];
    const vorlagen = [
      (r) => { // Menge je Größe
        const z = r.zutaten.find((x) => typeof x.menge === "object" && x.menge.M); if (!z) return null;
        const g = mischen(Object.keys(z.menge), rnd)[0];
        const richtig = `${mengeFuer(z, g)} ${z.einheit}`;
        const falsch = [...new Set([0.5, 1.5, 2].map((f) => `${Math.round(mengeFuer(z, g) * f)} ${z.einheit}`))].filter((x) => x !== richtig);
        return { frage: `Wie viel ${z.name} kommt in „${r.name}“, Größe ${g}?`, richtig, falsch, rezeptId: r.id };
      },
      (r) => { // Zutat, die nicht dazugehört
        const fremd = alleZutaten.filter((n) => !r.zutaten.some((z) => z.name === n));
        if (r.zutaten.length < 3 || !fremd.length) return null;
        const richtig = mischen(fremd, rnd)[0];
        return { frage: `Welche Zutat gehört NICHT in „${r.name}“?`, richtig, falsch: mischen(r.zutaten.map((z) => z.name), rnd).slice(0, 3), rezeptId: r.id };
      },
      (r) => { // Warengruppe
        const g = gruppen.find((x) => x.id === r.gruppe); if (!g) return null;
        return { frage: `Zu welcher Warengruppe gehört „${r.name}“?`, richtig: g.name, falsch: mischen(gruppen.filter((x) => x.id !== g.id).map((x) => x.name), rnd).slice(0, 3), rezeptId: r.id };
      },
      (r) => { // Allergen
        const al = allergeneVon(r);
        if (al.length) return { frage: `Welches Allergen steckt in „${r.name}“?`, richtig: al[0], falsch: mischen(["Gluten", "Milch", "Ei", "Schalenfrüchte", "Soja", "Sellerie", "Erdnüsse"].filter((x) => !al.includes(x)), rnd).slice(0, 3), rezeptId: r.id };
        return { frage: `Enthält „${r.name}“ eines der 14 Hauptallergene?`, richtig: "Nein", falsch: ["Ja, Milch", "Ja, Gluten", "Ja, Ei"], rezeptId: r.id };
      },
    ];
    let schutz = 0;
    while (fragen.length < anzahl && schutz++ < anzahl * 20) {
      const r = rezepte[Math.floor(rnd() * rezepte.length)];
      const v = vorlagen[Math.floor(rnd() * vorlagen.length)];
      const q = v(r);
      if (!q || q.falsch.length < 2 || fragen.some((x) => x.frage === q.frage)) continue;
      q.antworten = mischen([q.richtig, ...q.falsch.slice(0, 3)], rnd);
      fragen.push(q);
    }
    return fragen;
  }

  return {
    TAGE, TAG_NAME, SCHICHTEN, ROLLEN, UEBERGREIFEND, iso, ausIso, plusTage, wochentag, montag, woche, minZuZeit, zeitZuMin, datumKurz, zwischen,
    oeffnung, schicht, schichtZeit, bedarf, istLeitung, darfInFiliale, filialenVon, abwesenheitAm,
    ABW_ARTEN, abwArt, abwGilt, urlaubsTage, urlaubskonto, stundenImMonat, stundenStand,
    BESCHAEFTIGUNG, beschaeftigung, EINSATZ_ZEIT, QUALI, GRENZEN_STANDARD, grenzen, darfUeberschreiten, profilPruefen, inBereitschaft, arbeitstageImJahr, gesetzHinweise, qualiAblauf, IMPORT_SPALTEN, csvZeilen, mitarbeiterImport,
    planZeit, teilPruefen, tauschPruefen, tauschAusfuehren,
    matrixTyp, bedarfBloecke, slotPruefen, besetzungTag, besetzungsLuecken, passendeSchicht,
    PIN_STANDARD, pinEinstellungen, pinEmpfaenger, pinAktiv, pinSichtbar, pinStand, pinUngelesen, pinEigeneAktiv, pinErinnern,
    SCHRITTE, geheimErkannt, pruefeVerbindung, betreiberStand,
    schichtenAm, stundenInWoche, wunschAm, kandidaten, abdeckung, planVorschlag, betroffeneSchichten,
    stempelAm, stempelStatus, stempelSumme, arbeitszeitHinweise, stundenliste, csv,
    regelGilt, geraeteFuer, zustaendig, pruefeWert, bewerte, tagesliste, tagesSumme,
    allergeneVon, mengeFuer, quiz, zufall, mischen,
  };
});
