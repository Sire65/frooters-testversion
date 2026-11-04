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
  function abwesenheitAm(state, personId, datum) {
    return (state.abwesenheiten || []).find((a) => a.personId === personId && zwischen(datum, a.von, a.bis) &&
      (a.art === "krank" || a.status === "genehmigt"));
  }

  // ---------- Einsatzplanung ----------
  function schichtenAm(state, datum, filter) {
    return (state.plan || []).filter((s) => s.datum === datum && (!filter || filter(s)));
  }
  function stundenInWoche(state, personId, montagIso) {
    const tage = woche(montagIso);
    let min = 0;
    for (const s of state.plan || []) {
      if (s.personId !== personId || !tage.includes(s.datum)) continue;
      const f = (state.filialen || []).find((x) => x.id === s.filiale);
      const z = f && schichtZeit(f, s.datum, s.schicht);
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
        const z2 = f2 && schichtZeit(f2, datum, s.schicht);
        if (s.filiale === filialeId && s.schicht === schichtId) { moeglich = false; gruende.push("schon eingeteilt"); }
        else if (z && z2 && z2.start < z.ende && z.start < z2.ende) { moeglich = false; gruende.push(`schon ${f2.kurz || f2.name}`); }
        else if (s.filiale !== filialeId) gruende.push(`am Tag auch in ${f2.kurz || f2.name}`);
      }
      const w = wunschAm(state, p.id, datum);
      let punkte = 0;
      if (w) {
        if (w.art === "nicht") { moeglich = false; gruende.push("kann nicht (Wunsch)"); }
        else if (w.schicht && w.schicht !== "egal" && w.schicht !== schichtId) { punkte -= 2; gruende.push(`wünscht ${schicht(w.schicht).name}`); }
        else if (w.art === "moechte") { punkte += 3; gruende.push("möchte"); }
        else if (w.art === "kann") { punkte += 1; gruende.push("kann"); }
      }
      const std = stundenInWoche(state, p.id, mo);
      const soll = p.wochenstunden || 0;
      if (soll && std >= soll) { punkte -= 3; gruende.push(`schon ${std} von ${soll} Std.`); }
      if (p.stammfiliale !== filialeId) { punkte -= 1; gruende.push("Springer"); }
      return { person: p, moeglich, punkte, stunden: std, gruende };
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
          const k = kandidaten(arbeit, filialeId, datum, sch.id).find((x) => x.moeglich && x.punkte > -3 && (!nurStamm || x.person.stammfiliale === filialeId));
          if (!k) break;
          const s = { id: neueId(), filiale: filialeId, datum, schicht: sch.id, personId: k.person.id, quelle: "vorschlag" };
          arbeit.plan.push(s); neu.push(s); ist++;
        }
      }
    }
    return neu;
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
    schichtenAm, stundenInWoche, wunschAm, kandidaten, abdeckung, planVorschlag, betroffeneSchichten,
    stempelAm, stempelStatus, stempelSumme, arbeitszeitHinweise, stundenliste, csv,
    regelGilt, geraeteFuer, zustaendig, pruefeWert, bewerte, tagesliste, tagesSumme,
    allergeneVon, mengeFuer, quiz, zufall, mischen,
  };
});
