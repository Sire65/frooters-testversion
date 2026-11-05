const APP_VERSION = "0.4.1"; // gleich halten mit sw.js, version.json und ?v= in index.html (Versionsvertrag wie Club-App)
// frooters Team-App – Oberfläche. Logik: logik.js (FRL), Daten: daten.js (FRD).
(function () {
  "use strict";
  const L = window.FRL, D = window.FRD;
  if (document.currentScript && document.currentScript.dataset.v !== APP_VERSION) {
    // Mischstand alter Seite und neuem Programm (KICC-Regel 16): einmal frisch laden
    try { if (sessionStorage.getItem("fr_mischstand") !== APP_VERSION) { sessionStorage.setItem("fr_mischstand", APP_VERSION); location.reload(); return; } } catch (e) { /* weiter */ }
  }
  const A = D.adapter("demo");
  let S = A.laden();
  if (!S || S.version !== 4) { S = D.demoDaten(L.iso(new Date())); A.speichern(S); }
  let sitzung = {};
  try { sitzung = JSON.parse(localStorage.getItem("frooters_sitzung") || "{}"); } catch (e) { sitzung = {}; }
  const merke = () => { try { localStorage.setItem("frooters_sitzung", JSON.stringify(sitzung)); } catch (e) { /* nur Komfort */ } };
  const speichern = () => { if (!A.speichern(S)) meldung("Speichern im Browser nicht möglich"); };
  const neueId = (p) => `${p}${S.naechsteId++}`;

  // ---------- Hilfen ----------
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = (sel) => document.querySelector(sel);
  const heute = () => L.iso(new Date());
  const jetztMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const jetztIso = () => { const d = new Date(); return `${L.iso(d)}T${L.minZuZeit(d.getHours() * 60 + d.getMinutes())}:${String(d.getSeconds()).padStart(2, "0")}`; };
  const person = (id) => S.personen.find((p) => p.id === id);
  const filiale = (id) => S.filialen.find((f) => f.id === id);
  const name = (p) => p ? `${p.vorname} ${p.nachname}`.trim() : "–";
  const ICH = () => person(sitzung.ich);
  const FIL = () => filiale(sitzung.filiale) || filiale(ICH() && ICH().stammfiliale) || S.filialen[0];
  const leitung = () => L.istLeitung(ICH(), FIL().id);
  const rolle = () => (ICH() || {}).rolle;
  const zentrale = () => rolle() === "zentrale";
  const qualitaet = () => rolle() === "qualitaet" || zentrale();
  const berater = () => rolle() === "berater";
  const uebergreifend = () => L.UEBERGREIFEND.includes(rolle());
  const meineFilialen = () => uebergreifend() ? S.filialen : L.filialenVon(ICH()).map(filiale).filter(Boolean);
  const sortiment = (f) => S.rezepte.warengruppen.filter((g) => !f.sortiment || f.sortiment.includes(g.id));
  const ortTxt = (f, d) => { const o = L.oeffnung(f, d); return o && o.ort ? ` · 📍 ${esc(o.ort)}` : ""; };
  let meldTimer;
  function meldung(t) { let m = $(".meldung"); if (!m) { m = document.createElement("div"); m.className = "meldung"; m.setAttribute("role", "status"); document.body.appendChild(m); } m.textContent = t; clearTimeout(meldTimer); meldTimer = setTimeout(() => m.remove(), 2600); }
  const zeitTxt = (s) => s ? `${L.minZuZeit(s.start)}–${L.minZuZeit(s.ende)}` : "";
  const schichtTxt = (fil, datum, sch) => `${L.schicht(sch).name} ${zeitTxt(L.schichtZeit(fil, datum, sch))}`;
  const planTxt = (s) => `${L.schicht(s.schicht).name} ${zeitTxt(L.planZeit(S, s))}${s.zeit ? " (Teil)" : ""}`;
  const tausche = () => (S.tausch = S.tausch || []);
  const angebotZeit = (a) => a.teil || L.planZeit(S, S.plan.find((x) => x.id === a.schichtId));
  // Offene Angebote, die eine Person übernehmen könnte (andere Person, Filiale passt, Tag noch nicht vorbei)
  const angeboteFuer = (p) => tausche().filter((a) => a.status === "offen" && a.vonId !== p.id && (() => { const s = S.plan.find((x) => x.id === a.schichtId); return s && s.datum >= heute() && L.darfInFiliale(p, s.filiale); })());
  const tauschAnfragen = (fid) => tausche().filter((a) => a.status === "angefragt" && (S.plan.find((x) => x.id === a.schichtId) || {}).filiale === fid);
  const datumLang = (s) => { const d = L.ausIso(s); return `${L.TAG_NAME[L.wochentag(s)]}, ${d.getDate()}.${d.getMonth() + 1}.`; };
  const offeneAntraege = (fid) => S.abwesenheiten.filter((a) => a.status === "beantragt" && (person(a.personId) || {}).stammfiliale === fid);
  const offeneSchichten = (fid, von, tage) => {
    const r = []; const f = filiale(fid);
    for (let i = 0; i < tage; i++) {
      const d = L.plusTage(von, i);
      if (!S.veroeffentlicht[`${fid}|${L.montag(d)}`]) continue; // nur veröffentlichte Wochen, Entwürfe plant die Leitung noch
      for (const sch of L.SCHICHTEN) { const a = L.abdeckung(S, fid, d, sch.id); if (a.soll > a.ist) r.push({ datum: d, schicht: sch.id, fehlen: a.soll - a.ist, f }); }
    }
    return r;
  };
  const leitungsMeldungen = (fid) => (S.meldungen || []).filter((m) => m.filiale === fid && !m.erledigt);

  // ---------- Frootie ----------
  const FROOTIE_TIPPS = {
    start: "Hallo! Ich bin Frootie. Tipp auf eine Kachel, ich helfe dir überall mit dem ❓ weiter.",
    dienst: "Hier siehst du deine Schichten, auch die in anderen Filialen, wenn du als Springer eingeteilt bist.",
    wuensche: "Tipp für jeden Tag an, ob du möchtest, kannst oder nicht kannst. Die Shopleitung sieht das beim Planen.",
    krank: "Gute Besserung! Melde dich hier krank, deine Shopleitung bekommt sofort Bescheid. Diagnosen gehören hier nicht hin.",
    urlaub: "Stell deinen Urlaubsantrag hier. Du siehst sofort, ob er genehmigt ist.",
    stechuhr: "Kommen, Pause, Gehen: einfach antippen. Am Stand geht es auch mit deinem Ausweis-QR.",
    hygiene: "Das ist die Hygiene-Liste für heute. Gelb ist jetzt fällig, rot ist überfällig. Tipp drauf und hak ab.",
    aufgabe: "Trag den Wert ein. Wenn etwas nicht stimmt, zeige ich dir sofort, was zu tun ist.",
    rezepte: "Alle Rezepte nach Warengruppen. Im Rezept kannst du die Größe wechseln, die Mengen rechnen mit.",
    quiz: "Kennst du unsere Rezepte? 10 Fragen, los geht's!",
    pinnwand: "Kurze Infos für den Shop. Wichtige Zettel stehen oben.",
    plan: "Tipp auf + um jemanden einzuteilen. Springer aus anderen Filialen siehst du mit grauem Rand.",
    antraege: "Urlaubsanträge und Schichttausch deines Teams. Genehmigter Urlaub wird im Plan frei, ein bestätigter Tausch ändert den Plan sofort.",
    offen: "Hier siehst du Krankmeldungen und Schichten, die noch besetzt werden müssen.",
    hygkontrolle: "So steht es heute um die Hygiene in deinem Shop.",
    hygregeln: "Hier legst du fest, welche Regeln in deinem Shop gelten und welche Geräte es gibt. Ohne Eismaschine gibt es auch keine Eismaschinen-Aufgabe.",
    ma: "Hier pflegst du die Mitarbeiter. Springer bekommen einen Haken bei jeder Filiale, in der sie aushelfen dürfen.",
    regeln: "Die Hygieneregeln für alle Filialen. Die Shopleitungen sehen sie sofort.",
    auswertung: "Jede Filiale einzeln und alle zusammen.",
    tausch: "Du kannst nicht? Biete deine Schicht oder ein paar Stunden an. Ein Kollege übernimmt oder tauscht, deine Shopleitung bestätigt. Erst dann ändert sich der Plan.",
    admin: "Hier legst du fest, welcher Betreiber welche Filialen hat und mit welcher eigenen Datenbank (Supabase und Neon in Frankfurt) er arbeitet. Trag nur öffentliche Daten ein. Geheime Schlüssel und Passwörter weist die App zurück.",
    export: "Die Stempelzeiten eines Monats als Liste für den Steuerberater. Offene Tage ohne Gehen sind markiert, die musst du vorher klären.",
    rezeptpflege: "Hier pflegst du die Rezepte für alle Filialen. Allergene trägst du bei der Zutat ein, die App rechnet sie für das Rezept zusammen.",
    filialen: "Öffnungszeiten, Besetzung und Sortiment je Filiale. Beim mobilen Stand legst du die Einsatztage mit Ort an.",
    berater: "Sie sehen die Hygiene-Dokumentation aller Filialen. Ändern oder abhaken können Sie nichts.",
  };
  function frootie(text) { return `<div class="frootie"><img src="frootie.svg" alt="Frootie"><div class="blase">${text}</div></div>`; }

  // ---------- Ansichten ----------
  const V = {};
  let ansicht = "start", arg = null, fenster = null, quizStand = null, hygFilter = "alle", rezeptGruppe = "alle", rezeptGroesse = {};

  function kopf() {
    const p = ICH();
    const fil = FIL();
    const mehr = p && meineFilialen().length > 1;
    return `<header class="kopf">
      <button class="marke" data-go="start" aria-label="Startseite"><span class="logo-plate"><img class="logo" src="logo.svg" alt="frooters"></span><span class="team">Team</span></button>
      <div class="rechts">${p ? `<button class="chip fil" ${mehr ? 'data-act="filiale-wahl"' : "disabled"} aria-label="Filiale wechseln">📍 ${esc(fil.kurz)}${mehr ? " ▾" : ""}</button>
      <button class="chip" data-go="login" aria-label="Person wechseln">👤 ${esc(p.vorname)} ▾</button>` : ""}</div></header>
      <div class="demo-band">Testversion ${APP_VERSION} · Beispieldaten nur in diesem Browser · Pilot: Ochtrup</div>`;
  }
  function titel(t, zurueck) {
    return `<div class="titel">${zurueck !== false ? `<button class="zurueck" data-go="${zurueck || "start"}" aria-label="Zurück">←</button>` : ""}<h1>${t}</h1>
      <button class="chip" data-act="hilfe" aria-label="Frootie fragen" style="margin-left:auto">❓</button></div>`;
  }
  function kachel(sym, t, u, go, zahl) { return `<button class="kachel" data-go="${go}"><span class="sym" aria-hidden="true">${sym}</span><b>${t}</b><span>${u}</span>${zahl ? `<span class="zahl">${zahl}</span>` : ""}</button>`; }

  V.login = () => {
    const gruppen = [{ id: null, name: "Zentrale & Beratung" }, ...S.filialen];
    return `${titel("Wer bist du?", ICH() ? "start" : false)}
      <div class="willkommen"><img src="frootie.svg" alt="Frootie, die Erdbeere mit der grünen Kappe"><div><span class="logo-plate"><img class="logo gross" src="logo.svg" alt="frooters"></span><p><b>Willkommen in der Team-App!</b> Ich bin Frootie und helfe dir überall weiter.</p></div></div>
      <p class="hinweis">Testversion: Wähle eine Person, um die App aus ihrer Sicht zu sehen. In der echten App meldest du dich mit deinem persönlichen Zugang an.</p>
      ${gruppen.map((g) => `<div class="abschnitt"><h2>${esc(g.name)}</h2><div class="liste">${S.personen.filter((p) => p.stammfiliale === g.id && p.aktiv !== false).map((p) =>
        `<button class="zeile" data-act="ich" data-id="${p.id}"><span class="punkt ${p.id === sitzung.ich ? "gruen" : ""}"></span><span>${esc(name(p))}<small>${L.ROLLEN[p.rolle].name}${p.springer ? " · Springer" : ""}</small></span><span>›</span></button>`).join("")}</div></div>`).join("")}
      <div class="karte"><p class="klein muted">Beispieldaten zurücksetzen: Alle Änderungen in dieser Testversion werden gelöscht.</p><button class="btn drei" data-act="reset">Beispieldaten neu laden</button></div>`;
  };

  V.start = () => {
    const p = ICH(), f = FIL(), d = heute();
    const meine = L.schichtenAm(S, d, (s) => s.personId === p.id);
    const st = L.stempelStatus(L.stempelAm(S, p.id, d));
    const hl = L.tagesliste(S, f.id, d, { datum: d, min: jetztMin() });
    const hs = L.tagesSumme(hl);
    const meineAufg = hl.filter((a) => (a.status === "faellig" || a.status === "ueberfaellig") && a.zustaendig.ids.includes(p.id)).length;
    const pin = S.pinnwand.filter((n) => n.filiale === f.id || n.filiale === null).sort((a, b) => (b.wichtig - a.wichtig) || b.zeit.localeCompare(a.zeit))[0];
    const krank = L.abwesenheitAm(S, p.id, d);
    let k = "";
    if (!uebergreifend()) {
      k += `<div class="abschnitt"><h2>Mein Bereich</h2><div class="kacheln">
        ${kachel("🗓️", "Mein Dienstplan", "Meine Schichten", "dienst")}
        ${kachel("📝", "Dienstwünsche", "Für die nächsten Wochen", "wuensche")}
        ${kachel("⏱️", "Stechuhr", st === "da" ? "Eingestempelt" : st === "pause" ? "In Pause" : "Kommen · Gehen", "stechuhr")}
        ${kachel("🤒", "Krank melden", "Shopleitung wird informiert", "krank")}
        ${kachel("🏖️", "Urlaub", "Antrag stellen", "urlaub")}
        ${kachel("🔁", "Tauschbörse", "Schichten und Stunden tauschen", "tausch", angeboteFuer(p).filter((a) => L.tauschPruefen(S, a, p.id).moeglich).length)}
      </div></div>`;
    }
    k += `<div class="abschnitt"><h2>${f.art === "mobil" ? "Mobiler Stand" : "Shop"} ${esc(f.kurz)}${f.pilot ? " · Pilot" : ""}</h2><div class="kacheln">
      ${kachel("🧼", "Hygiene heute", hs.gesamt ? `${hs.erledigt + hs.abweichung} von ${hs.gesamt} erledigt` : (f.art === "mobil" ? "Heute kein Einsatz" : "Heute geschlossen"), "hygiene", berater() ? 0 : hs.faellig + hs.ueberfaellig)}
      ${kachel("📖", "Rezepte", "Mit Allergenen", "rezepte")}
      ${berater() ? "" : kachel("🎯", "Rezept-Quiz", "Wie gut kennst du sie?", "quiz")}
      ${berater() ? "" : kachel("📌", "Pinnwand", "Infos für den Shop", "pinnwand")}
      ${(berater() || rolle() === "qualitaet") ? kachel("🔍", "Hygiene-Kontrolle", "Letzte 7 Tage", "hygkontrolle", hl.filter((a) => a.status === "abweichung").length) : ""}
    </div></div>`;
    if (leitung()) {
      const offen = offeneSchichten(f.id, d, 7).length;
      k += `<div class="abschnitt"><h2>Shopleitung ${esc(f.kurz)}</h2><div class="kacheln">
        ${kachel("📅", "Einsatzplan", "Woche planen", "plan")}
        ${kachel("✅", "Anträge", "Urlaub und Tausch", "antraege", offeneAntraege(f.id).length + tauschAnfragen(f.id).length)}
        ${kachel("🚨", "Krank & offen", "Schichten besetzen", "offen", offen + leitungsMeldungen(f.id).length)}
        ${kachel("🔍", "Hygiene-Kontrolle", `Heute ${hs.quote == null ? "–" : hs.quote + " %"}`, "hygkontrolle", hl.filter((a) => a.status === "abweichung").length)}
        ${kachel("⚙️", "Regeln & Geräte", "Was gilt in diesem Shop", "hygregeln")}
        ${kachel("🕒", "Stempelzeiten", "Wer ist heute da", "stempelzeiten")}
        ${kachel("📤", "Stundenliste", "Export für den Steuerberater", "export")}
        ${kachel("👥", "Team", "Inklusive Springer", "team")}
      </div></div>`;
    }
    if (zentrale()) {
      k += `<div class="abschnitt"><h2>Zentrale</h2><div class="kacheln">
        ${kachel("📊", "Auswertung", "Jede Filiale und gesamt", "auswertung")}
        ${kachel("👤", "Mitarbeiter", "Stammdaten, Springer", "ma")}
        ${kachel("🏪", "Filialen", "Öffnungszeiten, Bedarf", "filialen")}
        ${kachel("📋", "Hygieneregeln", "Für alle Filialen", "regeln")}
        ${kachel("📝", "Rezepte pflegen", "Für alle Filialen", "rezeptpflege")}
        ${kachel("🛠️", "Admin", "Betreiber & Datenbanken", "admin", (S.betreiber || []).filter((b) => !b.freigegeben).length)}
      </div></div>`;
    }
    if (rolle() === "qualitaet") {
      k += `<div class="abschnitt"><h2>Qualität & Pflege</h2><div class="kacheln">
        ${kachel("📋", "Hygieneregeln", "Für alle Filialen", "regeln")}
        ${kachel("📝", "Rezepte pflegen", "Für alle Filialen", "rezeptpflege")}
      </div></div>`;
    }
    k += `<div class="abschnitt"><h2>Hilfe</h2><div class="kacheln">${kachel("🍓", "Frag Frootie", "Hilfe zu allen Bereichen", "hilfe")}${kachel("🔄", "Version", "v" + APP_VERSION, "info")}</div></div>`;
    const heuteKarte = uebergreifend() ? (berater() ? frootie(FROOTIE_TIPPS.berater) : "") : `<div class="karte"><div class="reihe zw"><h2>Heute</h2><span class="muted klein">${datumLang(d)}</span></div>
      ${krank ? `<p class="hinweis">Du bist ${krank.art === "krank" ? "krank gemeldet" : "im Urlaub"} bis ${L.datumKurz(krank.bis)}.</p>` : ""}
      ${meine.length ? meine.map((s) => `<p>🗓️ <b>${planTxt(s)}</b> in ${esc(filiale(s.filiale).kurz)}${ortTxt(filiale(s.filiale), d)}</p>`).join("") : '<p class="muted">Heute hast du keinen Dienst.</p>'}
      ${meine.length ? `<button class="btn ${st === "aus" ? "" : "zwei"}" data-go="stechuhr">${st === "aus" ? "⏱️ Jetzt einstempeln" : st === "pause" ? "▶️ Pause beenden" : "⏱️ Eingestempelt · öffnen"}</button>` : ""}
      ${meineAufg ? `<p class="hinweis">🧼 ${meineAufg} Hygiene-Aufgabe${meineAufg > 1 ? "n" : ""} für dich jetzt fällig.</p>` : ""}
    </div>`;
    return `${frootie(`Hallo ${esc(p.vorname)}! ${pin ? `📌 ${esc(pin.text)}` : FROOTIE_TIPPS.start}`)}${heuteKarte}${k}`;
  };

  // ----- Mitarbeiter -----
  V.dienst = () => {
    const p = ICH(), mo = L.montag(heute());
    const tage = [...L.woche(mo), ...L.woche(L.plusTage(mo, 7))];
    const rows = tage.map((d) => {
      const sch = L.schichtenAm(S, d, (s) => s.personId === p.id);
      const abw = L.abwesenheitAm(S, p.id, d);
      const pub = sch.every((s) => S.veroeffentlicht[`${s.filiale}|${L.montag(d)}`]);
      return `<div class="zeile ${d === heute() ? "st-faellig" : ""}"><span class="punkt ${sch.length ? "gruen" : ""}"></span><span><b>${datumLang(d)}</b>
        <small>${abw ? (abw.art === "krank" ? "🤒 krank" : "🏖️ Urlaub") : sch.length ? sch.map((s) => `${planTxt(s)}${tausche().some((a) => a.schichtId === s.id && (a.status === "offen" || a.status === "angefragt")) ? " · 🔁 angeboten" : ""} · ${esc(filiale(s.filiale).kurz)}${ortTxt(filiale(s.filiale), d)}${s.filiale !== p.stammfiliale ? " (Springer)" : ""}`).join("<br>") : "frei"}</small></span>
        <span class="marke-s ${sch.length && !pub ? "gelb" : ""}">${sch.length ? (pub ? "fest" : "Entwurf") : ""}</span></div>`;
    }).join("");
    const std = L.stundenInWoche(S, p.id, mo);
    return `${titel("Mein Dienstplan")}${frootie(FROOTIE_TIPPS.dienst)}
      <div class="karte"><p>Diese Woche: <b>${std} Std.</b> geplant${p.wochenstunden ? ` von ${p.wochenstunden} Std. laut Vertrag` : ""}.</p></div>
      <div class="liste">${rows}</div>`;
  };

  V.wuensche = () => {
    const p = ICH(), start = L.plusTage(L.montag(heute()), 7);
    const tage = [...L.woche(start), ...L.woche(L.plusTage(start, 7))];
    const fil = filiale(p.stammfiliale);
    return `${titel("Dienstwünsche")}${frootie(FROOTIE_TIPPS.wuensche)}
      <div class="liste">${tage.map((d) => {
        const w = L.wunschAm(S, p.id, d) || {};
        const zu = fil && !L.oeffnung(fil, d);
        return `<div class="karte"><div class="reihe zw"><b>${datumLang(d)}</b>${zu ? '<span class="marke-s">Shop geschlossen</span>' : ""}</div>
          ${zu ? "" : `<div class="wahl">${[["moechte", "😀 möchte"], ["kann", "👍 kann"], ["nicht", "✋ kann nicht"]].map(([a, t]) =>
            `<button class="${w.art === a ? "an" : ""} ${a === "nicht" ? "nein" : ""}" data-act="wunsch" data-datum="${d}" data-art="${a}">${t}</button>`).join("")}</div>
          ${w.art && w.art !== "nicht" ? `<div class="wahl">${[["egal", "egal"], ["frueh", "Frühdienst"], ["spaet", "Spätdienst"]].map(([s, t]) =>
            `<button class="${(w.schicht || "egal") === s ? "an" : ""}" data-act="wunsch-schicht" data-datum="${d}" data-schicht="${s}">${t}</button>`).join("")}</div>` : ""}`}
        </div>`;
      }).join("")}</div>`;
  };

  V.krank = () => {
    const p = ICH();
    const meine = S.abwesenheiten.filter((a) => a.personId === p.id && a.art === "krank").sort((a, b) => b.von.localeCompare(a.von));
    return `${titel("Krank melden")}${frootie(FROOTIE_TIPPS.krank)}
      <div class="karte"><div class="gitter2"><div class="feld"><label for="k-von">Krank ab</label><input type="date" id="k-von" value="${heute()}"></div>
        <div class="feld"><label for="k-bis">Voraussichtlich bis</label><input type="date" id="k-bis" value="${heute()}"></div></div>
        <p class="klein muted">Ab wann du eine Arbeitsunfähigkeitsbescheinigung brauchst, steht in deinem Arbeitsvertrag. Die eAU ruft der Arbeitgeber bei der Krankenkasse ab.</p>
        <button class="btn gross" data-act="krank">🤒 Krankmeldung absenden</button></div>
      <div class="abschnitt"><h2>Meine Krankmeldungen</h2><div class="liste">${meine.length ? meine.map((a) => `<div class="zeile"><span class="punkt rot"></span><span>${L.datumKurz(a.von)} bis ${L.datumKurz(a.bis)}<small>gemeldet</small></span><span></span></div>`).join("") : '<p class="leer">Keine Krankmeldungen.</p>'}</div></div>`;
  };

  V.urlaub = () => {
    const p = ICH();
    const meine = S.abwesenheiten.filter((a) => a.personId === p.id && a.art === "urlaub").sort((a, b) => b.von.localeCompare(a.von));
    const farbe = { beantragt: "gelb", genehmigt: "gruen", abgelehnt: "rot" };
    return `${titel("Urlaub")}${frootie(FROOTIE_TIPPS.urlaub)}
      <div class="karte"><div class="gitter2"><div class="feld"><label for="u-von">Von</label><input type="date" id="u-von" value="${L.plusTage(heute(), 14)}"></div>
        <div class="feld"><label for="u-bis">Bis</label><input type="date" id="u-bis" value="${L.plusTage(heute(), 18)}"></div></div>
        <div class="feld"><label for="u-notiz">Bemerkung (freiwillig)</label><input type="text" id="u-notiz" maxlength="120"></div>
        <button class="btn gross" data-act="urlaub">🏖️ Urlaub beantragen</button></div>
      <div class="abschnitt"><h2>Meine Anträge</h2><div class="liste">${meine.length ? meine.map((a) => `<div class="zeile"><span class="punkt ${farbe[a.status]}"></span><span>${L.datumKurz(a.von)} bis ${L.datumKurz(a.bis)}<small>${esc(a.notiz || "")}</small></span><span class="marke-s ${farbe[a.status]}">${a.status}</span></div>`).join("") : '<p class="leer">Noch keine Anträge.</p>'}</div></div>`;
  };

  V.tausch = () => {
    const p = ICH(), d = heute();
    const fremd = angeboteFuer(p);
    const meine = tausche().filter((a) => a.vonId === p.id || a.nehmerId === p.id).sort((a, b) => b.zeit.localeCompare(a.zeit)).slice(0, 10);
    const eigene = S.plan.filter((s) => s.personId === p.id && s.datum >= d && s.datum <= L.plusTage(d, 21)).sort((a, b) => a.datum.localeCompare(b.datum));
    const statusTxt = { offen: ["wartet auf Kollegen", "gelb"], angefragt: ["wartet auf Shopleitung", "gelb"], genehmigt: ["bestätigt", "gruen"], abgelehnt: ["abgelehnt", "rot"], zurueck: ["zurückgezogen", ""] };
    const zeile = (a) => { const s = S.plan.find((x) => x.id === a.schichtId); const z = angebotZeit(a); return `${datumLang(s.datum)} · ${L.minZuZeit(z.start)}–${L.minZuZeit(z.ende)} · ${esc(filiale(s.filiale).kurz)}${a.teil ? " · nur Stunden" : ""}`; };
    return `${titel("Tauschbörse")}${frootie(FROOTIE_TIPPS.tausch)}
      <div class="abschnitt"><h2>Angebote von Kollegen</h2><div class="liste">${fremd.length ? fremd.map((a) => { const chk = L.tauschPruefen(S, a, p.id);
        return `<div class="karte"><p><b>${esc(name(person(a.vonId)))}</b> gibt ab: ${zeile(a)}</p>${a.notiz ? `<p class="muted">„${esc(a.notiz)}“</p>` : ""}
          ${chk.gruende.map((t) => `<p class="hinweis rot">Geht nicht: ${esc(t)}</p>`).join("")}${chk.hinweise.map((t) => `<p class="hinweis">${esc(t)}</p>`).join("")}
          <div class="reihe"><button class="btn" data-act="tausch-nehmen" data-id="${a.id}" ${chk.moeglich ? "" : "disabled"}>Übernehmen</button>${a.teil ? "" : `<button class="btn zwei" data-act="tausch-gegen" data-id="${a.id}">Tauschen gegen …</button>`}</div></div>`; }).join("") : '<p class="leer">Gerade keine Angebote.</p>'}</div></div>
      <div class="abschnitt"><h2>Schicht oder Stunden anbieten</h2><div class="liste">${eigene.length ? eigene.map((s) => { const lauf = tausche().find((a) => a.schichtId === s.id && (a.status === "offen" || a.status === "angefragt"));
        return `<div class="zeile"><span class="punkt ${lauf ? "gelb" : "gruen"}"></span><span><b>${datumLang(s.datum)}</b><small>${planTxt(s)} · ${esc(filiale(s.filiale).kurz)}</small></span>${lauf ? '<span class="marke-s gelb">angeboten</span>' : `<button class="chip" data-act="tausch-anbieten" data-id="${s.id}">Anbieten</button>`}</div>`; }).join("") : '<p class="leer">Keine Schichten in den nächsten 3 Wochen.</p>'}</div></div>
      ${meine.length ? `<div class="abschnitt"><h2>Meine Tausche</h2><div class="liste">${meine.map((a) => { const [t, f] = statusTxt[a.status] || ["", ""];
        return `<div class="zeile"><span class="punkt ${f}"></span><span>${a.vonId === p.id ? "Abgegeben" : "Übernommen"}: ${zeile(a)}<small>${a.nehmerId && a.vonId === p.id ? "an " + esc(name(person(a.nehmerId))) : a.vonId !== p.id ? "von " + esc(name(person(a.vonId))) : ""}</small></span>
          ${a.status === "offen" && a.vonId === p.id ? `<button class="chip" data-act="tausch-zurueck" data-id="${a.id}">zurückziehen</button>` : `<span class="marke-s ${f}">${t}</span>`}</div>`; }).join("")}</div></div>` : ""}`;
  };

  V.stechuhr = () => {
    const p = ICH(), d = heute(), f = FIL();
    const e = L.stempelAm(S, p.id, d), st = L.stempelStatus(e), sum = L.stempelSumme(e, jetztIso());
    const hinweise = L.arbeitszeitHinweise(sum, S.parameter);
    const art = { kommen: "Kommen", pause: "Pause", weiter: "Weiter", gehen: "Gehen" };
    const knopf = st === "aus" ? `<button class="btn gross" data-act="stempel" data-art="kommen">▶️ Kommen in ${esc(f.kurz)}</button>`
      : st === "pause" ? `<button class="btn gross zwei" data-act="stempel" data-art="weiter">▶️ Pause beenden</button>`
        : `<div class="gitter2"><button class="btn gross zwei" data-act="stempel" data-art="pause">☕ Pause</button><button class="btn gross" data-act="stempel" data-art="gehen">⏹️ Gehen</button></div>`;
    return `${titel("Stechuhr")}${frootie(FROOTIE_TIPPS.stechuhr)}
      <div class="karte"><div class="reihe zw"><b>${st === "da" ? "🟢 Eingestempelt" : st === "pause" ? "🟡 In Pause" : "⚪ Nicht eingestempelt"}</b><span class="muted klein">${datumLang(d)}</span></div>${knopf}
        <p class="muted">Arbeit heute: <b>${Math.floor(sum.arbeit / 60)} Std. ${sum.arbeit % 60} Min.</b> · Pause: ${sum.pause} Min.</p>
        ${hinweise.map((h) => `<p class="hinweis">${esc(h)}</p>`).join("")}</div>
      <div class="abschnitt"><h2>Heute gestempelt</h2><div class="liste">${e.length ? e.map((x) => `<div class="zeile"><span class="punkt gruen"></span><span>${art[x.art]}<small>${esc(filiale(x.filiale).kurz)}</small></span><span>${x.zeit.slice(11, 16)}</span></div>`).join("") : '<p class="leer">Noch nichts gestempelt.</p>'}</div></div>
      <p class="klein muted">Fehlt ein Stempel? Sag deiner Shopleitung Bescheid. Korrekturen gibt es nur mit Begründung und Freigabe.</p>`;
  };

  // ----- Hygiene -----
  const STATUS_TXT = { erledigt: "erledigt", abweichung: "Abweichung", nicht_moeglich: "nicht möglich", faellig: "jetzt fällig", ueberfaellig: "überfällig", verpasst: "verpasst", spaeter: "später" };
  const STATUS_FARBE = { erledigt: "gruen", abweichung: "rot", nicht_moeglich: "rot", faellig: "gelb", ueberfaellig: "rot", verpasst: "rot", spaeter: "" };
  function hygZeile(a) {
    const bereich = S.hygiene.bereiche.find((b) => b.id === a.regel.bereich);
    const wer = a.zustaendig.ids.map((id) => (person(id) || {}).vorname).filter(Boolean).join(", ");
    return `<button class="zeile st-${a.status}" data-go="aufgabe" data-arg="${esc(a.key)}"><span class="punkt"></span>
      <span><b>${a.nachkontrolle ? "🔁 Nachkontrolle: " : ""}${esc(a.regel.titel)}</b>${a.geraet ? ` · ${esc(a.geraet.name)}` : ""}
      <small>${L.minZuZeit(a.ab)} Uhr · ${esc(bereich ? bereich.name : "")} · ${a.durchfuehrung ? `von ${esc((person(a.durchfuehrung.personId) || {}).vorname || "")} um ${a.durchfuehrung.zeit.slice(11, 16)}` : `zuständig: ${esc(wer || "–")}${a.zustaendig.ersatz ? " (niemand eingeteilt)" : ""}`}</small></span>
      <span class="marke-s ${STATUS_FARBE[a.status]}">${STATUS_TXT[a.status]}</span></button>`;
  }
  V.hygiene = () => {
    const f = FIL(), d = arg || heute();
    const liste = L.tagesliste(S, f.id, d, { datum: heute(), min: jetztMin() });
    const s = L.tagesSumme(liste);
    const bereiche = S.hygiene.bereiche.filter((b) => liste.some((a) => a.regel.bereich === b.id));
    const sicht = liste.filter((a) => hygFilter === "alle" || (hygFilter === "meine" ? a.zustaendig.ids.includes(sitzung.ich) : a.regel.bereich === hygFilter));
    return `${titel("Hygiene " + esc(f.kurz))}${frootie(FROOTIE_TIPPS.hygiene)}
      <div class="karte"><div class="reihe zw"><button class="chip" data-go="hygiene" data-arg="${L.plusTage(d, -1)}">‹</button><b>${datumLang(d)}</b><button class="chip" data-go="hygiene" data-arg="${L.plusTage(d, 1)}" ${d >= heute() ? "disabled" : ""}>›</button></div>
        ${liste.length ? `<div class="balken" aria-hidden="true"><span style="width:${s.quote || 0}%"></span></div>
        <div class="summe"><span class="marke-s gruen">${s.erledigt} erledigt</span><span class="marke-s gelb">${s.faellig} fällig</span><span class="marke-s rot">${s.ueberfaellig} überfällig</span>${s.abweichung ? `<span class="marke-s rot">${s.abweichung} Abweichung</span>` : ""}<span class="marke-s">${s.spaeter} später</span></div>` : '<p class="muted">${f.art === "mobil" ? "An diesem Tag hat der mobile Stand keinen Einsatz." : "An diesem Tag ist der Shop geschlossen."}</p>'}</div>
      <div class="wahl"><button class="${hygFilter === "alle" ? "an" : ""}" data-act="hygfilter" data-f="alle">Alle</button><button class="${hygFilter === "meine" ? "an" : ""}" data-act="hygfilter" data-f="meine">Für mich</button>
        ${bereiche.map((b) => `<button class="${hygFilter === b.id ? "an" : ""}" data-act="hygfilter" data-f="${b.id}">${esc(b.name)}</button>`).join("")}</div>
      <div class="liste">${sicht.length ? sicht.map(hygZeile).join("") : '<p class="leer">Keine Aufgaben in dieser Auswahl.</p>'}</div>`;
  };
  function aufgabeFinden(key) {
    const d = key.split("|")[0], fid = key.split("|")[1];
    return L.tagesliste(S, fid, d, { datum: heute(), min: jetztMin() }).find((a) => a.key === key);
  }
  let entwurf = null;
  V.aufgabe = () => {
    const a = aufgabeFinden(arg);
    if (!a) return `${titel("Aufgabe", "hygiene")}<p class="leer">Aufgabe nicht gefunden.</p>`;
    const r = a.regel, m = S.hygiene.massnahmen.find((x) => x.id === r.massnahme);
    if (!entwurf || entwurf.key !== a.key) entwurf = { key: a.key, werte: {}, schritte: {} };
    const fertig = a.durchfuehrung;
    if (fertig) {
      const d = fertig;
      return `${titel(esc(r.titel), "hygiene")}
        <div class="karte"><p><b>${a.geraet ? esc(a.geraet.name) + " · " : ""}${L.minZuZeit(a.ab)} Uhr</b></p>
        <p class="hinweis ${d.bewertung === "ok" ? "gruen" : "rot"}">${d.ergebnis === "nicht_moeglich" ? "Nicht möglich: " + esc(d.grund) : d.bewertung === "ok" ? "✓ Erledigt" : d.bewertung === "warn" ? "⚠️ Erledigt mit Warnung" : "🔴 Erledigt mit Abweichung"} · ${esc(name(person(d.personId)))} um ${d.zeit.slice(11, 16)}${d.nachgetragen ? " (nachgetragen)" : ""}</p>
        ${r.pruefpunkte.map((pp, i) => `<p>${esc(pp.text)}: <b>${d.werte[i] === true ? "✓" : esc(d.werte[i] == null ? "–" : d.werte[i])}${pp.einheit ? " " + pp.einheit : ""}</b></p>`).join("")}
        ${d.schritte && d.schritte.length ? `<p class="muted klein">Maßnahme: ${d.schritte.map(esc).join(" · ")}</p>` : ""}
        <p class="klein muted">Einträge lassen sich nicht ändern. Eine Korrektur wäre ein neuer Eintrag.</p></div>`;
    }
    const bew = L.bewerte(r, entwurf.werte);
    const zeigeMassnahme = (bew === "warn" || bew === "kritisch") && m;
    const alleSchritte = !zeigeMassnahme || m.schritte.every((_, i) => entwurf.schritte[i]);
    const feld = (pp, i) => {
      const v = entwurf.werte[i];
      if (pp.art === "messwert") {
        const st = L.pruefeWert(pp, v);
        return `<div class="feld"><label for="pp${i}">${esc(pp.text)} (${pp.einheit}${pp.max != null ? `, höchstens ${pp.max}` : ""}${pp.min != null ? `, mindestens ${pp.min}` : ""})</label>
          <input type="number" inputmode="decimal" step="0.1" id="pp${i}" data-pp="${i}" value="${v == null ? "" : esc(v)}">
          ${st === "warn" ? '<span class="marke-s gelb">leicht außerhalb</span>' : st === "kritisch" ? '<span class="marke-s rot">deutlich außerhalb</span>' : st === "ok" ? '<span class="marke-s gruen">in Ordnung</span>' : ""}</div>`;
      }
      if (pp.art === "auswahl") return `<div class="feld"><span class="lbl">${esc(pp.text)}</span><div class="wahl">${pp.werte.map((w) => `<button class="${v === w ? "an" : ""} ${(pp.schlecht || []).includes(w) ? "nein" : ""}" data-act="ppwahl" data-i="${i}" data-w="${esc(w)}">${esc(w)}</button>`).join("")}</div></div>`;
      return `<label class="haken"><input type="checkbox" data-pp="${i}" ${v === true ? "checked" : ""}><span>${esc(pp.text)}</span></label>`;
    };
    return `${titel(esc(r.titel), "hygiene")}${frootie(FROOTIE_TIPPS.aufgabe)}
      <div class="karte"><p><b>${a.geraet ? esc(a.geraet.name) + " · " : ""}fällig ${L.minZuZeit(a.ab)} bis ${L.minZuZeit(a.bis)} Uhr</b> <span class="marke-s ${STATUS_FARBE[a.status]}">${STATUS_TXT[a.status]}</span></p>
        ${r.anleitung ? `<p class="muted">${esc(r.anleitung)}</p>` : ""}
        ${r.pruefpunkte.map(feld).join("")}</div>
      ${zeigeMassnahme ? `<div class="karte" style="border-color:var(--red)"><h2>${bew === "kritisch" ? "🔴" : "⚠️"} Was jetzt zu tun ist: ${esc(m.titel)}</h2>
        ${m.schritte.map((t, i) => `<label class="haken"><input type="checkbox" data-schritt="${i}" ${entwurf.schritte[i] ? "checked" : ""}><span>${esc(t)}</span></label>`).join("")}
        ${m.nachkontrolle ? `<p class="hinweis">🔁 In ${m.nachkontrolle} Minuten wird automatisch eine Nachkontrolle angelegt.</p>` : ""}
        ${bew === "kritisch" ? '<p class="hinweis rot">Die Shopleitung wird sofort informiert.</p>' : ""}</div>` : ""}
      ${berater() ? '<p class="hinweis">Nur Ansicht: Abhaken kann nur das Team im Shop.</p>' : `<button class="btn gross" data-act="abhaken" ${bew === "offen" || !alleSchritte ? "disabled" : ""}>${bew === "offen" ? "Bitte alles ausfüllen" : !alleSchritte ? "Bitte Maßnahme abhaken" : "✓ Abhaken"}</button>
      <button class="btn drei" data-act="nicht-moeglich">Nicht möglich …</button>`}`;
  };

  // ----- Rezepte und Quiz -----
  V.rezepte = () => {
    const R = S.rezepte, gruppen = sortiment(FIL());
    if (rezeptGruppe !== "alle" && !gruppen.some((g) => g.id === rezeptGruppe)) rezeptGruppe = "alle";
    const liste = R.rezepte.filter((r) => gruppen.some((g) => g.id === r.gruppe) && (rezeptGruppe === "alle" || r.gruppe === rezeptGruppe));
    return `${titel("Rezepte " + esc(FIL().kurz))}${frootie(FROOTIE_TIPPS.rezepte)}
      <div class="gruppen wahl"><button class="${rezeptGruppe === "alle" ? "an" : ""}" data-act="rgruppe" data-g="alle">Alle</button>${gruppen.map((g) => `<button class="${rezeptGruppe === g.id ? "an" : ""}" data-act="rgruppe" data-g="${g.id}">${g.sym} ${esc(g.name)}</button>`).join("")}</div>
      <button class="btn zwei" data-go="quiz">🎯 Rezept-Quiz starten</button>
      <div class="liste">${liste.map((r) => { const g = R.warengruppen.find((x) => x.id === r.gruppe); const al = L.allergeneVon(r);
        return `<button class="zeile" data-go="rezept" data-arg="${r.id}"><span style="font-size:1.6rem">${g.sym}</span><span><b>${esc(r.name)}</b><small>${esc(r.beschreibung)}${al.length ? ` · Allergene: ${al.map(esc).join(", ")}` : ""}</small></span><span>›</span></button>`; }).join("")}</div>
      <p class="klein muted">Beispielrezepte für die Testversion. Die echten Rezepte pflegt die Zentrale.</p>`;
  };
  V.rezept = () => {
    const r = S.rezepte.rezepte.find((x) => x.id === arg);
    if (!r) return `${titel("Rezept", "rezepte")}<p class="leer">Nicht gefunden.</p>`;
    const g = rezeptGroesse[r.id] || (r.groessen.includes("M") ? "M" : r.groessen[0]);
    const al = L.allergeneVon(r);
    return `${titel(esc(r.name), "rezepte")}
      <div class="karte"><p class="muted">${esc(r.beschreibung)}</p>
        ${r.groessen.length > 1 ? `<div class="wahl">${r.groessen.map((x) => `<button class="${x === g ? "an" : ""}" data-act="rgroesse" data-r="${r.id}" data-g="${x}">Größe ${x}</button>`).join("")}</div>` : ""}
        <table class="zutaten"><tbody>${r.zutaten.map((z) => `<tr><td>${esc(z.name)}${z.allergene.length ? ` <span class="marke-s rot">${z.allergene.map(esc).join(", ")}</span>` : ""}</td><td>${L.mengeFuer(z, g)} ${esc(z.einheit)}</td></tr>`).join("")}</tbody></table></div>
      <div class="karte"><h2>Allergene</h2>${al.length ? `<div class="allergene">${al.map((a) => `<span class="marke-s rot">${esc(a)}</span>`).join("")}</div>` : '<p class="muted">Keines der 14 Hauptallergene.</p>'}
        ${!al.includes("Gluten") ? '<span class="marke-s gruen">glutenfrei</span>' : ""}</div>
      <div class="karte"><h2>Zubereitung</h2><ol class="schritte">${r.schritte.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
        ${r.standzeit ? `<p class="hinweis">⏳ Standzeit: ${esc(r.standzeit)}</p>` : ""}
        <p class="klein muted">🎬 Arbeitsvideo folgt.</p></div>`;
  };
  V.quiz = () => {
    if (!quizStand) { const gr = sortiment(FIL()); quizStand = { fragen: L.quiz(S.rezepte.rezepte.filter((r) => gr.some((g) => g.id === r.gruppe)), gr, 10, Date.now() % 100000), nr: 0, punkte: 0, gewaehlt: null }; }
    const q = quizStand;
    if (q.nr >= q.fragen.length) {
      const lob = q.punkte >= 9 ? "Wow, Rezept-Profi! 🏆" : q.punkte >= 6 ? "Gut gemacht! 👍" : "Schau dir die Rezepte nochmal an, dann klappt es beim nächsten Mal. 💪";
      return `${titel("Rezept-Quiz", "rezepte")}${frootie(`<b>${q.punkte} von ${q.fragen.length} richtig.</b> ${lob}`)}<button class="btn gross" data-act="quiz-neu">Nochmal spielen</button><button class="btn drei" data-go="rezepte">Zu den Rezepten</button>`;
    }
    const f = q.fragen[q.nr];
    return `${titel("Rezept-Quiz", "rezepte")}${q.nr === 0 && q.gewaehlt == null ? frootie(FROOTIE_TIPPS.quiz) : ""}
      <div class="karte"><div class="reihe zw"><span class="muted klein">Frage ${q.nr + 1} von ${q.fragen.length}</span><span class="marke-s gruen">${q.punkte} Punkte</span></div>
        <div class="balken" aria-hidden="true"><span style="width:${(q.nr / q.fragen.length) * 100}%"></span></div>
        <h2>${esc(f.frage)}</h2>
        <div class="antworten">${f.antworten.map((x, i) => { let k = ""; if (q.gewaehlt != null) { if (x === f.richtig) k = "richtig"; else if (i === q.gewaehlt) k = "falsch"; }
          return `<button class="${k}" data-act="quiz-antwort" data-i="${i}" ${q.gewaehlt != null ? "disabled" : ""}>${esc(x)}</button>`; }).join("")}</div>
        ${q.gewaehlt != null ? `<p class="hinweis ${f.antworten[q.gewaehlt] === f.richtig ? "gruen" : "rot"}">${f.antworten[q.gewaehlt] === f.richtig ? "🍓 Richtig!" : `Leider falsch. Richtig ist: <b>${esc(f.richtig)}</b>`}</p>
          <button class="btn" data-act="quiz-weiter">Weiter</button>` : ""}</div>`;
  };

  V.pinnwand = () => {
    const f = FIL();
    const z = S.pinnwand.filter((n) => n.filiale === f.id || n.filiale === null).sort((a, b) => (b.wichtig - a.wichtig) || b.zeit.localeCompare(a.zeit));
    return `${titel("Pinnwand " + esc(f.kurz))}${frootie(FROOTIE_TIPPS.pinnwand)}
      <div class="karte"><div class="feld"><label for="pw-text">Neuer Zettel</label><textarea id="pw-text" rows="2" maxlength="300"></textarea></div>
        <div class="reihe">${leitung() ? '<label class="haken"><input type="checkbox" id="pw-wichtig"><span>wichtig</span></label>' : ""}<button class="btn" data-act="pinnwand">📌 Anheften</button></div></div>
      <div class="liste">${z.map((n) => `<div class="karte" ${n.wichtig ? 'style="border-color:var(--red)"' : ""}><p>${n.wichtig ? "❗ " : ""}${esc(n.text)}</p>
        <div class="reihe zw"><span class="klein muted">${esc(name(person(n.vonId)))} · ${n.filiale ? esc(f.kurz) : "alle Filialen"} · ${L.datumKurz(n.zeit.slice(0, 10))}</span>
        ${leitung() || n.vonId === sitzung.ich ? `<button class="chip" data-act="pin-weg" data-id="${n.id}">entfernen</button>` : ""}</div></div>`).join("") || '<p class="leer">Noch keine Zettel.</p>'}</div>`;
  };

  // ----- Shopleitung -----
  V.plan = () => {
    const f = FIL(), mo = arg || L.montag(heute());
    const pub = S.veroeffentlicht[`${f.id}|${mo}`];
    const tage = L.woche(mo).map((d) => {
      const o = L.oeffnung(f, d);
      if (!o) return `<div class="tag zu"><b>${datumLang(d)}</b><span class="muted klein">${f.art === "mobil" ? "kein Einsatz" : "geschlossen"}</span></div>`;
      return `<div class="tag"><div class="reihe zw"><b>${datumLang(d)}</b><span class="muted klein">${o.ort ? "📍 " + esc(o.ort) + " · " : ""}${L.minZuZeit(o.auf)}–${L.minZuZeit(o.zu)}</span></div>
        ${L.SCHICHTEN.filter((sch) => L.schichtZeit(f, d, sch.id)).map((sch) => { const ab = L.abdeckung(S, f.id, d, sch.id);
          const einzeln = !L.schichtZeit(f, d, "spaet");
          const leute = L.schichtenAm(S, d, (s) => s.filiale === f.id && s.schicht === sch.id);
          return `<div class="slot"><div class="kopfz"><span><span class="punkt ${ab.ampel}" style="display:inline-block;vertical-align:-2px"></span> ${einzeln ? "Einsatz" : sch.name}</span><span>${zeitTxt(L.schichtZeit(f, d, sch.id))} · ${ab.ist}/${ab.soll}</span></div>
            <div class="namen">${leute.map((s) => { const p = person(s.personId); const fehlt = L.abwesenheitAm(S, s.personId, d);
              return `<button class="name ${p.stammfiliale !== f.id ? "springer" : ""} ${fehlt ? "fehlt" : ""}" data-act="plan-weg" data-id="${s.id}" title="Antippen zum Entfernen">${esc(p.vorname)}${s.zeit ? ` ${L.minZuZeit(s.zeit.start)}–${L.minZuZeit(s.zeit.ende)}` : ""}${p.stammfiliale !== f.id ? " ↔" : ""}${fehlt ? (fehlt.art === "krank" ? " 🤒" : " 🏖️") : ""}</button>`; }).join("")}
              <button class="name plus" data-act="plan-plus" data-datum="${d}" data-schicht="${sch.id}">+ einteilen</button></div></div>`; }).join("")}</div>`;
    }).join("");
    return `${titel("Einsatzplan " + esc(f.kurz))}${frootie(FROOTIE_TIPPS.plan)}
      <div class="karte"><div class="reihe zw"><button class="chip" data-go="plan" data-arg="${L.plusTage(mo, -7)}">‹</button><b>Woche ab ${L.datumKurz(mo)}</b><button class="chip" data-go="plan" data-arg="${L.plusTage(mo, 7)}">›</button></div>
        <div class="reihe"><span class="marke-s ${pub ? "gruen" : "gelb"}">${pub ? "veröffentlicht" : "Entwurf"}</span>
        <button class="btn zwei" data-act="vorschlag" data-mo="${mo}">✨ Vorschlag erstellen</button>${pub ? "" : `<button class="btn" data-act="veroeffentlichen" data-mo="${mo}">📣 Veröffentlichen</button>`}</div>
        <p class="klein muted">Der Vorschlag füllt nur leere Plätze: erst mit dem eigenen Team, dann mit Springern. Wünsche und Urlaub werden beachtet.</p></div>
      <div class="plan">${tage}</div>`;
  };
  function kandidatenFenster(d, schId) {
    const f = FIL();
    const ks = L.kandidaten(S, f.id, d, schId);
    fenster = `<div class="reihe zw"><h2>${L.schicht(schId).name}, ${datumLang(d)}</h2><button class="chip" data-act="zu">✕</button></div>
      <p class="muted klein">${esc(f.kurz)} · ${zeitTxt(L.schichtZeit(f, d, schId))}. Grauer Rand = Springer aus einer anderen Filiale.</p>
      <div class="liste">${ks.map((k) => `<button class="zeile ${k.person.stammfiliale !== f.id ? "springer" : ""}" data-act="einteilen" data-id="${k.person.id}" data-datum="${d}" data-schicht="${schId}" ${k.moeglich ? "" : "disabled"} style="${k.moeglich ? "" : "opacity:.5"}">
        <span class="punkt ${k.moeglich ? (k.punkte > 0 ? "gruen" : "gelb") : "rot"}"></span><span><b>${esc(name(k.person))}</b> ${k.person.stammfiliale !== f.id ? `<span class="marke-s">Springer · ${esc(filiale(k.person.stammfiliale).kurz)}</span>` : ""}
        <small>${L.ROLLEN[k.person.rolle].name} · ${k.stunden} Std. diese Woche${k.gruende.length ? " · " + k.gruende.map(esc).join(", ") : ""}</small></span><span>${k.moeglich ? "+" : ""}</span></button>`).join("")}</div>`;
  }
  V.antraege = () => {
    const f = FIL(), a = offeneAntraege(f.id);
    const erledigt = S.abwesenheiten.filter((x) => x.art === "urlaub" && x.status !== "beantragt" && (person(x.personId) || {}).stammfiliale === f.id).slice(-5).reverse();
    const ta = tauschAnfragen(f.id);
    return `${titel("Anträge " + esc(f.kurz))}${frootie(FROOTIE_TIPPS.antraege)}
      ${ta.length ? `<div class="abschnitt"><h2>Schichttausch</h2><div class="liste">${ta.map((x) => { const sch = S.plan.find((y) => y.id === x.schichtId); const z = angebotZeit(x); const chk = L.tauschPruefen(S, x, x.nehmerId, x.gegenId); const g = x.gegenId && S.plan.find((y) => y.id === x.gegenId);
        return `<div class="karte"><p><b>${esc(name(person(x.vonId)))}</b> → <b>${esc(name(person(x.nehmerId)))}</b></p>
          <p>${datumLang(sch.datum)} · ${L.schicht(sch.schicht).name} ${L.minZuZeit(z.start)}–${L.minZuZeit(z.ende)}${x.teil ? " (nur diese Stunden)" : ""}</p>
          ${g ? `<p>Im Tausch gegen: ${datumLang(g.datum)} · ${planTxt(g)} in ${esc(filiale(g.filiale).kurz)}</p>` : ""}
          ${x.notiz ? `<p class="muted">${esc(x.notiz)}</p>` : ""}
          ${chk.gruende.map((t) => `<p class="hinweis rot">${esc(t)}</p>`).join("")}${chk.hinweise.map((t) => `<p class="hinweis">${esc(t)}</p>`).join("")}
          <div class="reihe"><button class="btn" data-act="tausch-ok" data-id="${x.id}" ${chk.moeglich ? "" : "disabled"}>✓ Bestätigen</button><button class="btn drei" data-act="tausch-nein" data-id="${x.id}">Ablehnen</button></div></div>`; }).join("")}</div></div>` : ""}
      <div class="abschnitt"><h2>Urlaub</h2>
      <div class="liste">${a.length ? a.map((x) => { const betr = L.betroffeneSchichten(S, x.personId, x.von, x.bis).length;
        return `<div class="karte"><p><b>${esc(name(person(x.personId)))}</b> möchte Urlaub vom ${L.datumKurz(x.von)} bis ${L.datumKurz(x.bis)}</p>${x.notiz ? `<p class="muted">${esc(x.notiz)}</p>` : ""}
        ${betr ? `<p class="hinweis">Im Plan stehen in dieser Zeit ${betr} Schicht${betr > 1 ? "en" : ""}. Sie werden beim Genehmigen frei.</p>` : ""}
        <div class="reihe"><button class="btn" data-act="genehmigen" data-id="${x.id}">✓ Genehmigen</button><button class="btn drei" data-act="ablehnen" data-id="${x.id}">Ablehnen</button></div></div>`; }).join("") : '<p class="leer">Keine offenen Urlaubsanträge. 🎉</p>'}</div></div>
      ${erledigt.length ? `<div class="abschnitt"><h2>Zuletzt entschieden</h2><div class="liste">${erledigt.map((x) => `<div class="zeile"><span class="punkt ${x.status === "genehmigt" ? "gruen" : "rot"}"></span><span>${esc(name(person(x.personId)))}<small>${L.datumKurz(x.von)} bis ${L.datumKurz(x.bis)}</small></span><span class="marke-s">${x.status}</span></div>`).join("")}</div></div>` : ""}`;
  };
  V.offen = () => {
    const f = FIL(), d = heute();
    const krank = S.abwesenheiten.filter((a) => a.art === "krank" && a.bis >= d && L.darfInFiliale(person(a.personId), f.id));
    const offen = offeneSchichten(f.id, d, 14);
    const mel = leitungsMeldungen(f.id);
    return `${titel("Krank & offen")}${frootie(FROOTIE_TIPPS.offen)}
      ${mel.length ? `<div class="abschnitt"><h2>Neue Meldungen</h2><div class="liste">${mel.map((m) => `<div class="zeile st-ueberfaellig"><span class="punkt"></span><span>${esc(m.text)}<small>${m.zeit.slice(0, 10) === d ? "heute" : L.datumKurz(m.zeit.slice(0, 10))} ${m.zeit.slice(11, 16)}</small></span><button class="chip" data-act="meldung-ok" data-id="${m.id}">gesehen</button></div>`).join("")}</div></div>` : ""}
      <div class="abschnitt"><h2>Krank gemeldet</h2><div class="liste">${krank.length ? krank.map((a) => `<div class="zeile"><span class="punkt rot"></span><span>${esc(name(person(a.personId)))}<small>${L.datumKurz(a.von)} bis ${L.datumKurz(a.bis)}</small></span><span></span></div>`).join("") : '<p class="leer">Niemand krank gemeldet.</p>'}</div></div>
      <div class="abschnitt"><h2>Offene Schichten (14 Tage)</h2><div class="liste">${offen.length ? offen.map((o) => `<button class="zeile st-${o.datum === d ? "ueberfaellig" : "faellig"}" data-act="plan-plus" data-datum="${o.datum}" data-schicht="${o.schicht}"><span class="punkt"></span><span><b>${datumLang(o.datum)}</b> · ${schichtTxt(f, o.datum, o.schicht)}<small>Es fehl${o.fehlen > 1 ? "en" : "t"} ${o.fehlen} Person${o.fehlen > 1 ? "en" : ""}</small></span><span>+</span></button>`).join("") : '<p class="leer">Alles besetzt. 🎉</p>'}</div></div>`;
  };
  V.hygkontrolle = () => {
    const f = FIL(), d = heute();
    const tage = Array.from({ length: 7 }, (_, i) => L.plusTage(d, -i));
    const heuteL = L.tagesliste(S, f.id, d, { datum: d, min: jetztMin() });
    const abw = heuteL.filter((a) => a.status === "abweichung" || a.status === "nicht_moeglich" || a.status === "ueberfaellig");
    return `${titel("Hygiene-Kontrolle " + esc(f.kurz))}${frootie(FROOTIE_TIPPS.hygkontrolle)}
      <div class="abschnitt"><h2>Heute: braucht Aufmerksamkeit</h2><div class="liste">${abw.length ? abw.map(hygZeile).join("") : '<p class="leer">Alles im grünen Bereich.</p>'}</div></div>
      <div class="abschnitt"><h2>Letzte 7 Tage</h2><div class="liste">${tage.map((t) => { const l = L.tagesliste(S, f.id, t, { datum: d, min: jetztMin() }); const s = L.tagesSumme(l);
        return `<button class="zeile" data-go="hygiene" data-arg="${t}"><span class="punkt ${!l.length ? "" : s.ueberfaellig || s.abweichung ? "rot" : s.erledigt === s.gesamt ? "gruen" : "gelb"}"></span><span><b>${datumLang(t)}</b><small>${l.length ? `${s.erledigt} erledigt · ${s.abweichung} Abweichung · ${s.ueberfaellig} ${t === d ? "überfällig" : "verpasst"} · ${s.faellig + s.spaeter} offen` : "geschlossen"}</small></span><span>${s.quote == null ? "" : s.quote + " %"}</span></button>`; }).join("")}</div></div>`;
  };
  V.hygregeln = () => {
    const f = FIL(), H = S.hygiene;
    const geraete = H.geraete.filter((g) => g.filiale === f.id);
    const typName = (id) => (H.geraetetypen.find((t) => t.id === id) || {}).name || "";
    return `${titel("Regeln & Geräte " + esc(f.kurz))}${frootie(FROOTIE_TIPPS.hygregeln)}
      <div class="abschnitt"><h2>Geräte in diesem Shop</h2><div class="liste">${geraete.map((g) => `<div class="zeile"><span class="punkt ${g.status === "aktiv" ? "gruen" : g.status === "gestoert" ? "rot" : ""}"></span><span><b>${esc(g.name)}</b><small>${esc(typName(g.typ))} · ${g.status === "aktiv" ? "in Betrieb" : g.status === "gestoert" ? "gestört, Aufgaben pausiert" : "stillgelegt"}</small></span>
        <select data-act="geraet-status" data-id="${g.id}" aria-label="Status ${esc(g.name)}">${[["aktiv", "in Betrieb"], ["gestoert", "gestört"], ["stillgelegt", "stillgelegt"]].map(([v, t]) => `<option value="${v}" ${g.status === v ? "selected" : ""}>${t}</option>`).join("")}</select></div>`).join("")}</div>
        <div class="karte"><div class="gitter2"><div class="feld"><label for="g-typ">Gerätetyp</label><select id="g-typ">${H.geraetetypen.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join("")}</select></div>
          <div class="feld"><label for="g-name">Bezeichnung</label><input type="text" id="g-name" placeholder="z. B. Kühlvitrine 3" maxlength="60"></div></div><button class="btn zwei" data-act="geraet-neu">+ Gerät anlegen</button></div></div>
      <div class="abschnitt"><h2>Regeln in diesem Shop</h2><div class="liste">${H.regeln.filter((r) => r.aktiv !== false).map((r) => {
        const z = H.zuteilung[`${r.id}|${f.id}`] || {};
        const gilt = L.regelGilt(S, r, f.id);
        const anz = r.geraetetyp ? geraete.filter((g) => g.typ === r.geraetetyp && g.status !== "stillgelegt").length : null;
        return `<div class="karte"><div class="reihe zw"><b>${esc(r.titel)}</b>${r.pflicht ? '<span class="marke-s">Pflicht</span>' : ""}</div>
          <p class="klein muted">${intervallTxt(r.intervall)} · ${zustTxt(r.zustaendig)}${r.geraetetyp ? ` · gilt je ${esc(typName(r.geraetetyp))}: <b>${anz} im Shop</b>${anz === 0 ? " → keine Aufgabe" : ""}` : ""}</p>
          <div class="wahl"><button class="${gilt ? "an" : ""}" data-act="zuteilung" data-r="${r.id}" data-s="aktiv">gilt hier</button>
            <button class="${!gilt ? "an nein" : ""}" data-act="zuteilung" data-r="${r.id}" data-s="nicht" ${r.pflicht ? "disabled title=\"Pflichtregel: nur die Zentrale kann sie abschalten\"" : ""}>trifft nicht zu</button></div>
          ${gilt && ["oeffnung", "schliessung", "wochentage", "monatlich"].includes(r.intervall.art) ? `<div class="feld"><label for="uz-${r.id}">Eigene Uhrzeit (leer = Standard)</label><input type="time" id="uz-${r.id}" data-act="uhrzeit" data-r="${r.id}" value="${esc(z.uhrzeit || "")}"></div>` : ""}</div>`;
      }).join("")}</div></div>`;
  };
  function intervallTxt(iv) {
    switch (iv.art) {
      case "oeffnung": return `bei Öffnung${iv.versatz ? ` + ${iv.versatz} Min.` : ""}`;
      case "schliessung": return "bei Ladenschluss";
      case "uhrzeiten": return `täglich ${iv.zeiten.join(", ")} Uhr`;
      case "alle_std": return `alle ${iv.std} Std.`;
      case "wochentage": return `${iv.tage.map((t) => L.TAG_NAME[t].slice(0, 2)).join(", ")} ${iv.zeit} Uhr`;
      case "monatlich": return `monatlich ab dem ${iv.tagAb}.`;
      default: return "";
    }
  }
  function zustTxt(z) { if (!z || z.art === "alle") return "alle im Dienst"; if (z.art === "schicht") return L.schicht(z.wert).name; return L.ROLLEN[z.wert] ? L.ROLLEN[z.wert].name : z.wert; }
  V.stempelzeiten = () => {
    const f = FIL(), d = heute();
    const leute = [...new Set([...L.schichtenAm(S, d, (s) => s.filiale === f.id).map((s) => s.personId), ...S.stempel.filter((s) => s.filiale === f.id && s.zeit.startsWith(d)).map((s) => s.personId)])].map(person).filter(Boolean);
    return `${titel("Stempelzeiten heute")}
      <div class="liste">${leute.length ? leute.map((p) => { const e = L.stempelAm(S, p.id, d); const st = L.stempelStatus(e); const sum = L.stempelSumme(e, jetztIso()); const geplant = L.schichtenAm(S, d, (s) => s.personId === p.id && s.filiale === f.id);
        return `<div class="zeile"><span class="punkt ${st === "da" ? "gruen" : st === "pause" ? "gelb" : ""}"></span><span><b>${esc(name(p))}</b><small>Plan: ${geplant.map((s) => planTxt(s)).join(", ") || "–"} · Ist: ${e.length ? e.map((x) => x.zeit.slice(11, 16)).join(" · ") : "noch nicht gestempelt"}</small></span><span class="klein">${Math.floor(sum.arbeit / 60)}:${String(sum.arbeit % 60).padStart(2, "0")} Std.</span></div>`; }).join("") : '<p class="leer">Heute ist niemand eingeteilt.</p>'}</div>`;
  };
  V.team = () => {
    const f = FIL();
    const leute = S.personen.filter((p) => L.darfInFiliale(p, f.id));
    return `${titel("Team " + esc(f.kurz))}<div class="liste">${leute.map((p) => `<div class="zeile"><span class="punkt ${L.abwesenheitAm(S, p.id, heute()) ? "rot" : "gruen"}"></span><span><b>${esc(name(p))}</b><small>${L.ROLLEN[p.rolle].name}${p.stammfiliale !== f.id ? ` · Springer aus ${esc(filiale(p.stammfiliale).kurz)}` : p.springer ? ` · Springer auch in ${p.einsatzfilialen.map((x) => esc(filiale(x).kurz)).join(", ")}` : ""} · ${p.wochenstunden} Std./Woche</small></span><span></span></div>`).join("")}</div>`;
  };

  // ----- Zentrale -----
  V.auswertung = () => {
    const d = heute(), mo = L.montag(d);
    let sum = { soll: 0, ist: 0, hyg: 0, hygG: 0, krank: 0, std: 0 };
    const zeilen = S.filialen.map((f) => {
      const l = L.tagesliste(S, f.id, d, { datum: d, min: jetztMin() }); const s = L.tagesSumme(l);
      let soll = 0, ist = 0; for (const t of L.woche(mo)) for (const sch of L.SCHICHTEN) { const a = L.abdeckung(S, f.id, t, sch.id); soll += a.soll; ist += Math.min(a.ist, a.soll); }
      const krank = S.abwesenheiten.filter((a) => a.art === "krank" && L.zwischen(d, a.von, a.bis) && (person(a.personId) || {}).stammfiliale === f.id).length;
      const std = S.personen.filter((p) => p.stammfiliale === f.id).reduce((x, p) => x + L.stundenInWoche(S, p.id, mo), 0);
      sum.soll += soll; sum.ist += ist; sum.hyg += s.erledigt + s.abweichung; sum.hygG += s.gesamt; sum.krank += krank; sum.std += std;
      return { f, s, soll, ist, krank, std };
    });
    const zeile = (t, soll, ist, hyg, hygG, krank, std, fett) => `<tr${fett ? ' style="font-weight:700"' : ""}><td>${t}</td><td>${soll ? Math.round((ist / soll) * 100) : "–"} %</td><td>${hygG ? Math.round((hyg / hygG) * 100) + " %" : "–"}</td><td>${krank}</td><td>${std}</td></tr>`;
    return `${titel("Auswertung")}${frootie(FROOTIE_TIPPS.auswertung)}
      <div class="karte"><div style="overflow-x:auto"><table class="zutaten"><thead><tr><td><b>Filiale</b></td><td><b>Besetzt</b></td><td><b>Hygiene</b></td><td><b>Krank</b></td><td><b>Std.</b></td></tr></thead><tbody>
        ${zeilen.map((z) => zeile(esc(z.f.kurz), z.soll, z.ist, z.s.erledigt + z.s.abweichung, z.s.gesamt, z.krank, z.std)).join("")}
        ${zeile("Alle Filialen", sum.soll, sum.ist, sum.hyg, sum.hygG, sum.krank, sum.std, true)}</tbody></table></div></div>
      <p class="klein muted">Besetzt = besetzte Plätze dieser Woche laut Einsatzplan. Hygiene = heute erledigte Aufgaben von allen Aufgaben des Tages (auch noch nicht fällige). Std. = geplante Stunden dieser Woche.</p>`;
  };
  V.ma = () => `${titel("Mitarbeiter")}${frootie(FROOTIE_TIPPS.ma)}
    <button class="btn zwei" data-act="ma-neu">+ Mitarbeiter anlegen</button>
    <div class="abschnitt"><h2>Zentrale & Beratung</h2><div class="liste">${S.personen.filter((p) => !p.stammfiliale).map((p) => `<div class="zeile"><span class="punkt gruen"></span><span><b>${esc(name(p))}</b><small>${L.ROLLEN[p.rolle].name} · sieht alle Filialen</small></span><span></span></div>`).join("")}</div></div>
    ${S.filialen.map((f) => `<div class="abschnitt"><h2>${esc(f.name)}</h2><div class="liste">${S.personen.filter((p) => p.stammfiliale === f.id).map((p) => `<button class="zeile" data-go="ma-edit" data-arg="${p.id}"><span class="punkt ${p.aktiv === false ? "" : "gruen"}"></span><span><b>${esc(name(p))}</b><small>${L.ROLLEN[p.rolle].name} · ${p.wochenstunden} Std.${p.springer ? ` · Springer: ${p.einsatzfilialen.map((x) => esc(filiale(x).kurz)).join(", ") || "keine Filiale gewählt"}` : ""}</small></span><span>›</span></button>`).join("")}</div></div>`).join("")}`;
  V["ma-edit"] = () => {
    const p = person(arg);
    if (!p) return `${titel("Mitarbeiter", "ma")}<p class="leer">Nicht gefunden.</p>`;
    return `${titel("Mitarbeiter bearbeiten", "ma")}
      <div class="karte"><div class="gitter2"><div class="feld"><label for="m-vor">Vorname</label><input type="text" id="m-vor" value="${esc(p.vorname)}"></div><div class="feld"><label for="m-nach">Nachname</label><input type="text" id="m-nach" value="${esc(p.nachname)}"></div></div>
        <div class="gitter2"><div class="feld"><label for="m-rolle">Rolle</label><select id="m-rolle">${Object.entries(L.ROLLEN).filter(([k]) => !L.UEBERGREIFEND.includes(k)).map(([k, r]) => `<option value="${k}" ${p.rolle === k ? "selected" : ""}>${r.name}</option>`).join("")}</select></div>
          <div class="feld"><label for="m-stamm">Stammfiliale</label><select id="m-stamm">${S.filialen.map((f) => `<option value="${f.id}" ${p.stammfiliale === f.id ? "selected" : ""}>${esc(f.name)}</option>`).join("")}</select></div></div>
        <div class="feld"><label for="m-std">Wochenstunden laut Vertrag</label><input type="number" id="m-std" min="0" max="48" value="${p.wochenstunden}"></div>
        <label class="haken"><input type="checkbox" id="m-springer" ${p.springer ? "checked" : ""}><span><b>Springer</b>: darf in anderen Filialen aushelfen</span></label>
        <div class="feld"><span class="lbl">Einsetzbar in (zusätzlich zur Stammfiliale)</span>${S.filialen.filter((f) => f.id !== p.stammfiliale).map((f) => `<label class="haken"><input type="checkbox" data-einsatz="${f.id}" ${p.einsatzfilialen.includes(f.id) ? "checked" : ""}><span>${esc(f.name)}</span></label>`).join("")}</div>
        <label class="haken"><input type="checkbox" id="m-aktiv" ${p.aktiv !== false ? "checked" : ""}><span>aktiv (ausgetretene Mitarbeiter abwählen)</span></label>
        <button class="btn gross" data-act="ma-speichern" data-id="${p.id}">Speichern</button></div>`;
  };
  V.filialen = () => `${titel("Filialen")}${frootie(FROOTIE_TIPPS.filialen)}${S.filialen.map((f) => `<div class="karte"><div class="reihe zw"><h2>${esc(f.name)}</h2><span>${f.pilot ? '<span class="marke-s gruen">Pilot</span> ' : ""}<span class="marke-s">${esc(f.marke || "")}</span></span></div>
    ${f.art === "mobil" ? `<p class="muted klein">Mobiler Stand: geöffnet nur an Einsatztagen.</p>
      <div class="liste">${(f.einsaetze || []).slice().sort((a, b) => a.datum.localeCompare(b.datum)).map((e, i) => `<div class="zeile"><span class="punkt ${e.datum >= heute() ? "gruen" : ""}"></span><span><b>${datumLang(e.datum)}</b> ${e.von}–${e.bis}<small>📍 ${esc(e.ort)}</small></span><button class="chip" data-act="einsatz-weg" data-f="${f.id}" data-datum="${e.datum}">entfernen</button></div>`).join("") || '<p class="leer">Noch keine Einsätze.</p>'}</div>
      <div class="gitter2"><div class="feld"><label for="e-${f.id}-d">Datum</label><input type="date" id="e-${f.id}-d" value="${L.plusTage(heute(), 7)}"></div><div class="feld"><label for="e-${f.id}-o">Ort</label><input type="text" id="e-${f.id}-o" maxlength="80" placeholder="z. B. Stadtfest Ochtrup"></div></div>
      <div class="gitter2"><div class="feld"><label for="e-${f.id}-v">Von</label><input type="time" id="e-${f.id}-v" value="11:00"></div><div class="feld"><label for="e-${f.id}-b">Bis</label><input type="time" id="e-${f.id}-b" value="20:00"></div></div>
      <button class="btn zwei" data-act="einsatz-neu" data-f="${f.id}">+ Einsatz anlegen</button>`
    : ["mo", "di", "mi", "do", "fr", "sa", "so"].map((t) => { const z = f.oeffnung[t]; return `<div class="oz-zeile"><span>${L.TAG_NAME[t].slice(0, 2)}${z ? "" : ' <span class="muted klein">zu</span>'}</span>
      <input type="time" data-oz="${f.id}|${t}|0" value="${z ? z[0] : ""}" aria-label="${L.TAG_NAME[t]} auf"><span>–</span><input type="time" data-oz="${f.id}|${t}|1" value="${z ? z[1] : ""}" aria-label="${L.TAG_NAME[t]} zu"></div>`; }).join("")}
    <div class="gitter2"><div class="feld"><label for="b-${f.id}-f">Besetzung Frühdienst</label><input type="number" min="0" max="9" id="b-${f.id}-f" data-bedarf="${f.id}|frueh" value="${f.bedarf.standard.frueh}"></div>
      <div class="feld"><label for="b-${f.id}-s">Besetzung Spätdienst</label><input type="number" min="0" max="9" id="b-${f.id}-s" data-bedarf="${f.id}|spaet" value="${f.bedarf.standard.spaet}"></div></div>
    <div class="feld"><span class="lbl">Sortiment (Warengruppen, die diese Filiale verkauft)</span><div class="wahl">${S.rezepte.warengruppen.map((g) => `<button class="${!f.sortiment || f.sortiment.includes(g.id) ? "an" : ""}" data-act="sortiment" data-f="${f.id}" data-g="${g.id}">${g.sym} ${esc(g.name)}</button>`).join("")}</div></div>
    ${f.art === "mobil" ? "" : `<p class="klein muted">Leere Zeiten = geschlossen.${f.bedarf.sa ? ` Samstags gilt eine eigene Besetzung (${f.bedarf.sa.frueh}/${f.bedarf.sa.spaet}).` : ""}</p>`}</div>`).join("")}`;
  const STAND_TXT = (b, st) => b.freigegeben ? ["freigegeben", "gruen"] : st.anzahl === 0 ? ["neu", ""] : ["in Einrichtung", "gelb"];
  V.admin = () => {
    const B = S.betreiber || [];
    return `${titel("Admin: Betreiber & Datenbanken")}${frootie(FROOTIE_TIPPS.admin)}
      <p class="hinweis">Jeder Franchisenehmer arbeitet mit seiner <b>eigenen Datenbank</b>. Hier stehen nur die öffentlichen Verbindungsdaten. Geheime Schlüssel trägt der Betreiber selbst in sein Supabase-Projekt ein.</p>
      <button class="btn zwei" data-act="betreiber-neu">+ Franchisenehmer anlegen</button>
      <div class="liste">${B.map((b) => { const st = L.betreiberStand(b), [t, f] = STAND_TXT(b, st), fil = S.filialen.filter((x) => x.betreiber === b.id);
        return `<button class="zeile" data-go="admin-edit" data-arg="${b.id}"><span class="punkt ${f}"></span><span><b>${esc(b.name)}</b> <span class="marke-s">${b.art === "eigen" ? "eigene Filialen" : "Franchise"}</span>
          <small>${fil.length ? fil.map((x) => esc(x.kurz)).join(", ") : "noch keine Filialen"} · ${st.anzahl} von ${st.gesamt} Schritten · ${st.verbindung.ref ? "Projekt " + esc(st.verbindung.ref) : "keine Datenbank eingetragen"}</small></span><span class="marke-s ${f}">${t}</span></button>`; }).join("")}</div>`;
  };
  V["admin-edit"] = () => {
    const b = (S.betreiber || []).find((x) => x.id === arg);
    if (!b) return `${titel("Betreiber", "admin")}<p class="leer">Nicht gefunden.</p>`;
    const st = L.betreiberStand(b), v = st.verbindung;
    const sel = (id, opts, wert) => `<select id="${id}">${opts.map(([w, t]) => `<option value="${w}" ${w === wert ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>`;
    return `${titel("Betreiber einrichten", "admin")}
      <div class="karte"><h2>1. Betreiber</h2>
        <div class="feld"><label for="be-name">Name</label><input type="text" id="be-name" value="${esc(b.name)}" maxlength="80"></div>
        <div class="gitter2"><div class="feld"><label for="be-art">Art</label>${sel("be-art", [["franchise", "Franchisenehmer"], ["eigen", "eigene Filialen"]], b.art)}</div>
          <div class="feld"><label for="be-avv">AV-Vertrag unterschrieben am</label><input type="date" id="be-avv" value="${esc(b.avvDatum || "")}"></div></div>
        <div class="gitter2"><div class="feld"><label for="be-kontakt">Ansprechpartner</label><input type="text" id="be-kontakt" value="${esc(b.kontakt || "")}" maxlength="80"></div>
          <div class="feld"><label for="be-mail">E-Mail</label><input type="text" id="be-mail" inputmode="email" value="${esc(b.email || "")}" maxlength="120"></div></div>
        <div class="feld"><span class="lbl">Filialen dieses Betreibers (jede Filiale gehört genau einem Betreiber)</span>${S.filialen.map((f) => `<label class="haken"><input type="checkbox" data-befil="${f.id}" ${f.betreiber === b.id ? "checked" : ""}><span>${esc(f.name)}${f.betreiber && f.betreiber !== b.id ? ` <span class="muted klein">(jetzt bei ${esc(((S.betreiber || []).find((x) => x.id === f.betreiber) || {}).name || "")})</span>` : ""}</span></label>`).join("")}</div></div>
      <div class="karte"><h2>2. Eigene Datenbank: Supabase</h2>
        <div class="feld"><label for="be-url">Projekt-Adresse</label><input type="text" id="be-url" value="${esc(b.supabase.url || "")}" placeholder="https://xxxxxxxxxxxxxxxxxxxx.supabase.co" autocomplete="off"></div>
        <div class="feld"><label for="be-key">Publishable Key (öffentlich)</label><input type="text" id="be-key" value="${esc(b.supabase.key || "")}" placeholder="sb_publishable_…" autocomplete="off"></div>
        <div class="feld"><label for="be-sreg">Region</label>${sel("be-sreg", [["eu-central-1", "Frankfurt (eu-central-1)"], ["andere", "andere Region"]], b.supabase.region)}</div>
        <p class="klein muted">Den geheimen Schlüssel (sb_secret_… oder service_role) und das Datenbank-Passwort hier <b>nicht</b> eintragen. Die trägt der Betreiber nur in seinem eigenen Supabase-Projekt ein.</p></div>
      <div class="karte"><h2>3. Spiegel und Datensicherung: Neon</h2>
        <div class="gitter2"><div class="feld"><label for="be-neon">Projekt-ID</label><input type="text" id="be-neon" value="${esc(b.neon.projekt || "")}" placeholder="z. B. ruhiger-see-12345678" autocomplete="off"></div>
          <div class="feld"><label for="be-nreg">Region</label>${sel("be-nreg", [["aws-eu-central-1", "Frankfurt (aws-eu-central-1)"], ["andere", "andere Region"]], b.neon.region)}</div></div></div>
      ${v.fehler.length || v.hinweise.length ? `<div class="karte" style="border-color:var(--red)">${v.fehler.map((t) => `<p class="hinweis rot">${esc(t)}</p>`).join("")}${v.hinweise.map((t) => `<p class="hinweis">${esc(t)}</p>`).join("")}</div>` : ""}
      <div class="karte"><h2>4. Schritte bis zur Freigabe</h2>
        ${L.SCHRITTE.map((x) => { const ok = st.erledigt[x.id];
          if (x.hand && x.id !== "avv") return `<label class="haken"><input type="checkbox" data-schrittb="${x.id}" ${ok ? "checked" : ""}><span>${esc(x.text)}</span></label>`;
          return `<div class="zeile"><span class="punkt ${ok ? "gruen" : ""}"></span><span>${esc(x.text)}<small>${ok ? "erledigt" : x.auto ? "⚪ noch nicht geprüft · wird automatisch geprüft, sobald der Server des Betreibers läuft" : x.id === "avv" ? "Datum oben eintragen" : "Felder oben ausfüllen"}</small></span><span></span></div>`; }).join("")}
        <div class="balken" aria-hidden="true"><span style="width:${Math.round((st.anzahl / st.gesamt) * 100)}%"></span></div>
        <p class="klein muted">${st.anzahl} von ${st.gesamt} Schritten erledigt.</p></div>
      <button class="btn gross" data-act="betreiber-speichern" data-id="${b.id}">Speichern</button>
      <button class="btn zwei" data-act="betreiber-pruefen" data-id="${b.id}">🔌 Verbindung prüfen</button>
      ${b.freigegeben ? `<button class="btn drei" data-act="betreiber-sperren" data-id="${b.id}">Freigabe zurücknehmen</button>` : `<button class="btn" data-act="betreiber-freigeben" data-id="${b.id}" ${st.freigabeMoeglich ? "" : "disabled"}>✓ Freigeben</button>
        ${st.freigabeMoeglich ? "" : '<p class="klein muted">Freigeben geht erst, wenn alle 7 Schritte erledigt sind.</p>'}`}`;
  };

  V.rezeptpflege = () => `${titel("Rezepte pflegen")}${frootie(FROOTIE_TIPPS.rezeptpflege)}
    <button class="btn zwei" data-act="rezept-neu">+ Neues Rezept</button>
    ${S.rezepte.warengruppen.map((g) => { const rs = S.rezepte.rezepte.filter((r) => r.gruppe === g.id); const fil = S.filialen.filter((f) => !f.sortiment || f.sortiment.includes(g.id)).map((f) => f.kurz);
      return `<div class="abschnitt"><h2>${g.sym} ${esc(g.name)}</h2><p class="klein muted">verkauft in: ${fil.map(esc).join(", ") || "keiner Filiale"}</p><div class="liste">${rs.map((r) => `<button class="zeile" data-go="rezept-edit" data-arg="${r.id}"><span class="punkt gruen"></span><span><b>${esc(r.name)}</b><small>${r.zutaten.length} Zutaten · Allergene: ${L.allergeneVon(r).map(esc).join(", ") || "keine"}</small></span><span>›</span></button>`).join("") || '<p class="leer">Noch keine Rezepte.</p>'}</div></div>`; }).join("")}`;
  V["rezept-edit"] = () => {
    const r = S.rezepte.rezepte.find((x) => x.id === arg);
    if (!r) return `${titel("Rezept", "rezeptpflege")}<p class="leer">Nicht gefunden.</p>`;
    const zl = r.zutaten.map((z) => `${z.name} | ${typeof z.menge === "object" ? r.groessen.map((g) => z.menge[g]).join("/") : z.menge} | ${z.einheit} | ${z.allergene.join(", ")}`).join("\n");
    return `${titel("Rezept bearbeiten", "rezeptpflege")}
      <div class="karte"><div class="feld"><label for="rz-name">Name</label><input type="text" id="rz-name" value="${esc(r.name)}" maxlength="80"></div>
        <div class="gitter2"><div class="feld"><label for="rz-gruppe">Warengruppe</label><select id="rz-gruppe">${S.rezepte.warengruppen.map((g) => `<option value="${g.id}" ${g.id === r.gruppe ? "selected" : ""}>${g.sym} ${esc(g.name)}</option>`).join("")}</select></div>
          <div class="feld"><label for="rz-gr">Größen (mit Komma)</label><input type="text" id="rz-gr" value="${esc(r.groessen.join(", "))}"></div></div>
        <div class="feld"><label for="rz-beschr">Beschreibung</label><input type="text" id="rz-beschr" value="${esc(r.beschreibung)}" maxlength="160"></div>
        <div class="feld"><label for="rz-stand">Standzeit (freiwillig)</label><input type="text" id="rz-stand" value="${esc(r.standzeit || "")}" placeholder="z. B. 4 Std. in der Vitrine"></div></div>
      <div class="karte"><h2>Zutaten</h2><p class="klein muted">Eine Zutat pro Zeile: <b>Name | Mengen je Größe mit / | Einheit | Allergene</b>. Beispiel: <i>Granola | 20/30/40 | g | Gluten, Schalenfrüchte</i></p>
        <textarea id="rz-zut" rows="7">${esc(zl)}</textarea>
        <p class="klein muted">Erlaubte Allergene: ${D.ALLERGENE.map(esc).join(", ")}</p></div>
      <div class="karte"><h2>Zubereitung</h2><p class="klein muted">Ein Schritt pro Zeile.</p><textarea id="rz-schritte" rows="5">${esc(r.schritte.join("\n"))}</textarea></div>
      <button class="btn gross" data-act="rezept-speichern" data-id="${r.id}">Speichern</button>`;
  };
  V.export = () => {
    const f = FIL(), monat = arg || heute().slice(0, 7);
    const vor = (() => { const [y, m] = monat.split("-").map(Number); const d = new Date(y, m - 2, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; })();
    const nach = (() => { const [y, m] = monat.split("-").map(Number); const d = new Date(y, m, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; })();
    const z = L.stundenliste(S, monat, f.id);
    const hm = (m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
    const proPerson = {};
    for (const x of z) proPerson[x.personId] = (proPerson[x.personId] || 0) + x.arbeit;
    const offen = z.filter((x) => x.offen).length;
    return `${titel("Stundenliste " + esc(f.kurz))}${frootie(FROOTIE_TIPPS.export)}
      <div class="karte"><div class="reihe zw"><button class="chip" data-go="export" data-arg="${vor}">‹</button><b>${monat.slice(5)}/${monat.slice(0, 4)}</b><button class="chip" data-go="export" data-arg="${nach}" ${nach > heute().slice(0, 7) ? "disabled" : ""}>›</button></div>
        ${offen ? `<p class="hinweis rot">${offen} Tag${offen > 1 ? "e" : ""} ohne „Gehen“. Bitte vor dem Export klären.</p>` : ""}
        <div class="liste">${Object.entries(proPerson).map(([pid, m]) => `<div class="zeile"><span class="punkt gruen"></span><span><b>${esc(name(person(pid)))}</b><small>${z.filter((x) => x.personId === pid).length} Tage</small></span><span><b>${hm(m)} Std.</b></span></div>`).join("") || '<p class="leer">Keine Stempelzeiten in diesem Monat.</p>'}</div>
        ${z.length ? `<div class="reihe"><button class="btn" data-act="export-csv" data-monat="${monat}">📤 CSV herunterladen</button><button class="btn drei" data-act="export-text" data-monat="${monat}">Als Text anzeigen</button></div>` : ""}
        <textarea id="export-text" rows="8" readonly hidden aria-label="Stundenliste als Text"></textarea>
        <p class="klein muted">Spalten: Name; Datum; Filiale; Kommen; Gehen; Pause (Min.); Arbeit (Std.); Hinweis. Trennzeichen Semikolon, passt für Excel und den Steuerberater.</p></div>`;
  };
  function exportCsv(monat) {
    const f = FIL();
    const z = L.stundenliste(S, monat, f.id);
    return L.csv(z.map((x) => [name(person(x.personId)), L.datumKurz(x.datum).slice(3) + monat.slice(0, 4), filiale(x.filiale).kurz, x.kommen, x.gehen, x.pause, (x.arbeit / 60).toFixed(2).replace(".", ","), x.offen ? "Gehen fehlt" : ""]),
      ["Name", "Datum", "Filiale", "Kommen", "Gehen", "Pause (Min.)", "Arbeit (Std.)", "Hinweis"]);
  }
  V.regeln = () => {
    const H = S.hygiene;
    return `${titel("Hygieneregeln (alle Filialen)")}${frootie(FROOTIE_TIPPS.regeln)}
      <button class="btn zwei" data-act="regel-neu">+ Neue Regel</button>
      <div class="liste">${H.regeln.map((r) => { const shops = S.filialen.filter((f) => L.regelGilt(S, r, f.id) && (!r.geraetetyp || L.geraeteFuer(S, r, f.id).length));
        return `<button class="zeile" data-go="regel-edit" data-arg="${r.id}"><span class="punkt ${r.aktiv === false ? "" : "gruen"}"></span><span><b>${esc(r.titel)}</b>
        <small>${esc((H.bereiche.find((b) => b.id === r.bereich) || {}).name || "")}${r.geraetetyp ? " · je " + esc((H.geraetetypen.find((t) => t.id === r.geraetetyp) || {}).name) : ""} · ${intervallTxt(r.intervall)} · ${zustTxt(r.zustaendig)} · gilt in ${shops.length} von ${S.filialen.length} Filialen</small></span><span>›</span></button>`; }).join("")}</div>`;
  };
  V["regel-edit"] = () => {
    const H = S.hygiene, r = H.regeln.find((x) => x.id === arg);
    if (!r) return `${titel("Regel", "regeln")}<p class="leer">Nicht gefunden.</p>`;
    const iv = r.intervall, pp = r.pruefpunkte[0] || {};
    const sel = (id, opts, wert) => `<select id="${id}">${opts.map(([v, t]) => `<option value="${v}" ${String(wert) === String(v) ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>`;
    return `${titel("Regel bearbeiten", "regeln")}
      <div class="karte"><h2>1. Was</h2><div class="feld"><label for="r-titel">Titel</label><input type="text" id="r-titel" value="${esc(r.titel)}"></div>
        <div class="gitter2"><div class="feld"><label for="r-bereich">Bereich</label>${sel("r-bereich", H.bereiche.map((b) => [b.id, b.name]), r.bereich)}</div>
          <div class="feld"><label for="r-typ">Gilt für Gerätetyp</label>${sel("r-typ", [["", "kein Gerät (gilt für den Shop)"], ...H.geraetetypen.map((t) => [t.id, t.name])], r.geraetetyp || "")}</div></div>
        <div class="feld"><label for="r-anl">Anleitung</label><textarea id="r-anl" rows="2">${esc(r.anleitung || "")}</textarea></div></div>
      <div class="karte"><h2>2. Wie oft</h2><div class="gitter2"><div class="feld"><label for="r-iv">Intervall</label>${sel("r-iv", [["oeffnung", "bei Öffnung"], ["schliessung", "bei Ladenschluss"], ["uhrzeiten", "feste Uhrzeiten"], ["alle_std", "alle x Stunden"], ["wochentage", "an Wochentagen"], ["monatlich", "monatlich"]], iv.art)}</div>
        <div class="feld"><label for="r-ivw">Uhrzeiten / Stunden / Zeit</label><input type="text" id="r-ivw" value="${esc(iv.art === "uhrzeiten" ? iv.zeiten.join(", ") : iv.art === "alle_std" ? iv.std : iv.zeit || "")}" placeholder="z. B. 10:15, 14:00"></div></div>
        ${iv.art === "wochentage" ? `<div class="wahl">${["mo", "di", "mi", "do", "fr", "sa"].map((t) => `<label class="haken"><input type="checkbox" data-wt="${t}" ${iv.tage.includes(t) ? "checked" : ""}><span>${L.TAG_NAME[t].slice(0, 2)}</span></label>`).join("")}</div>` : ""}</div>
      <div class="karte"><h2>3. Wer</h2>${sel("r-zust", [["alle|", "alle im Dienst"], ["schicht|frueh", "Frühdienst"], ["schicht|spaet", "Spätdienst"], ["rolle|shopleitung", "Shopleitung"], ["rolle|stv", "Stellv. Shopleitung"]], `${r.zustaendig.art}|${r.zustaendig.wert || ""}`)}</div>
      <div class="karte"><h2>4. Prüfpunkte</h2>${r.pruefpunkte.map((x) => `<p>• ${esc(x.text)} <span class="muted klein">(${x.art === "messwert" ? `Messwert ${x.einheit}, Grenze ${x.max != null ? "max. " + x.max : ""}${x.min != null ? " min. " + x.min : ""}, kritisch ab ${x.krit != null ? x.krit : x.kritMin}` : x.art === "auswahl" ? "Auswahl: " + x.werte.join(" / ") : "Haken"})</span></p>`).join("")}
        ${pp.art === "messwert" ? `<div class="gitter2"><div class="feld"><label for="r-max">Grenzwert (${pp.einheit})</label><input type="number" step="0.1" id="r-max" value="${pp.max}"></div><div class="feld"><label for="r-krit">Kritisch ab (${pp.einheit})</label><input type="number" step="0.1" id="r-krit" value="${pp.krit}"></div></div>` : ""}</div>
      <div class="karte"><h2>5. Wenn etwas nicht stimmt</h2>${sel("r-mn", H.massnahmen.map((m) => [m.id, m.titel]), r.massnahme)}</div>
      <div class="karte"><h2>6. Gültigkeit</h2><label class="haken"><input type="checkbox" id="r-pflicht" ${r.pflicht ? "checked" : ""}><span>Pflichtregel (Shop kann sie nicht abschalten)</span></label>
        <label class="haken"><input type="checkbox" id="r-aktiv" ${r.aktiv !== false ? "checked" : ""}><span>aktiv</span></label>
        <button class="btn gross" data-act="regel-speichern" data-id="${r.id}">Speichern</button></div>`;
  };

  V.hilfe = () => `${titel("Frag Frootie")}${frootie("Hier findest du zu jedem Bereich eine kurze Erklärung. Videoanleitungen zu allen Funktionen kommen mit der nächsten Version.")}
    <div class="liste">${[["dienst", "🗓️ Mein Dienstplan"], ["wuensche", "📝 Dienstwünsche"], ["krank", "🤒 Krank melden"], ["urlaub", "🏖️ Urlaub"], ["stechuhr", "⏱️ Stechuhr"], ["hygiene", "🧼 Hygiene"], ["rezepte", "📖 Rezepte"], ["quiz", "🎯 Quiz"], ["plan", "📅 Einsatzplan (Leitung)"], ["hygregeln", "⚙️ Regeln & Geräte (Leitung)"], ["ma", "👤 Mitarbeiter und Springer (Zentrale)"]]
      .map(([k, t]) => `<div class="karte"><b>${t}</b><p class="muted">${FROOTIE_TIPPS[k]}</p><p class="klein muted">🎬 Video folgt</p></div>`).join("")}</div>`;
  V.info = () => `${titel("Version")}<div class="karte"><p>frooters Team-App <b>${APP_VERSION}</b> (DEV, Testversion)</p><p class="muted">Daten: ${esc(A.name)}. Alles bleibt in diesem Browser.</p><button class="btn zwei" data-act="update-pruefen">🔄 Update prüfen</button></div>`;

  let updateBand = "", wartend = null;
  // ---------- Zeichnen ----------
  function zeichnen() {
    if (!ICH()) ansicht = "login";
    let rechte = ansicht;
    const nurLeitung = ["plan", "antraege", "offen", "hygregeln", "stempelzeiten", "team", "export"];
    const nurZentrale = ["auswertung", "ma", "ma-edit", "filialen", "admin", "admin-edit"];
    const nurQualitaet = ["regeln", "regel-edit", "rezeptpflege", "rezept-edit"];
    if (nurLeitung.includes(rechte) && !leitung()) rechte = "start";
    if (rechte === "hygkontrolle" && !(leitung() || uebergreifend())) rechte = "start";
    if (nurZentrale.includes(rechte) && !zentrale()) rechte = "start";
    if (nurQualitaet.includes(rechte) && !qualitaet()) rechte = "start";
    if (berater() && ["quiz", "pinnwand"].includes(rechte)) rechte = "start";
    if (uebergreifend() && ["dienst", "wuensche", "krank", "urlaub", "stechuhr"].includes(rechte)) rechte = "start";
    ansicht = rechte;
    const inhalt = (V[ansicht] || V.start)();
    $("#app").innerHTML = `${updateBand}${kopf()}<main>${inhalt}</main>${fenster ? `<div class="fenster-hg" data-act="zu-hg"><div class="fenster" role="dialog" aria-modal="true">${fenster}</div></div>` : ""}`;
  }
  function gehe(v, a) { ansicht = v; arg = a || null; fenster = null; if (v !== "quiz") quizStand = null; zeichnen(); window.scrollTo(0, 0); try { history.replaceState(null, "", "#" + v); } catch (e) { /* egal */ } }

  // ---------- Aktionen ----------
  const AKT = {
    ich: (el) => { sitzung.ich = el.dataset.id; const p = ICH(); sitzung.filiale = p.stammfiliale || S.filialen[0].id; merke(); gehe("start"); },
    reset: () => { A.zuruecksetzen(); S = D.demoDaten(heute()); A.speichern(S); meldung("Beispieldaten neu geladen"); gehe("login"); },
    "filiale-wahl": () => { fenster = `<h2>Filiale wählen</h2><div class="liste">${meineFilialen().map((f) => `<button class="zeile" data-act="filiale" data-id="${f.id}"><span class="punkt ${f.id === FIL().id ? "gruen" : ""}"></span><span>${esc(f.name)}${ICH().stammfiliale && f.id !== ICH().stammfiliale ? "<small>als Springer</small>" : ""}</span><span>›</span></button>`).join("")}</div>`; zeichnen(); },
    filiale: (el) => { sitzung.filiale = el.dataset.id; merke(); fenster = null; zeichnen(); },
    zu: () => { fenster = null; zeichnen(); },
    "zu-hg": (el, ev) => { if (ev.target === el) { fenster = null; zeichnen(); } },
    hilfe: () => { fenster = `${frootie(FROOTIE_TIPPS[ansicht] || FROOTIE_TIPPS.start)}<button class="btn" data-act="zu">Danke, Frootie!</button>`; zeichnen(); },
    wunsch: (el) => {
      const p = ICH(), d = el.dataset.datum; let w = L.wunschAm(S, p.id, d);
      if (w && w.art === el.dataset.art) S.wuensche = S.wuensche.filter((x) => x !== w);
      else if (w) w.art = el.dataset.art;
      else S.wuensche.push({ id: neueId("w"), personId: p.id, datum: d, art: el.dataset.art, schicht: "egal" });
      speichern(); zeichnen();
    },
    "wunsch-schicht": (el) => { const w = L.wunschAm(S, ICH().id, el.dataset.datum); if (w) { w.schicht = el.dataset.schicht; speichern(); zeichnen(); } },
    krank: () => {
      const von = $("#k-von").value, bis = $("#k-bis").value, p = ICH();
      if (!von || !bis || bis < von) return meldung("Bitte Zeitraum prüfen");
      S.abwesenheiten.push({ id: neueId("a"), personId: p.id, art: "krank", von, bis, status: "gemeldet" });
      const betr = L.betroffeneSchichten(S, p.id, von, bis);
      S.meldungen = S.meldungen || [];
      for (const fid of new Set([p.stammfiliale, ...betr.map((s) => s.filiale)]))
        S.meldungen.push({ id: neueId("m"), filiale: fid, text: `🤒 ${name(p)} ist krank (${L.datumKurz(von)}–${L.datumKurz(bis)}). ${betr.filter((s) => s.filiale === fid).length} Schicht(en) betroffen.`, zeit: jetztIso() });
      speichern(); meldung("Gute Besserung! Deine Shopleitung ist informiert."); gehe("start");
    },
    urlaub: () => {
      const von = $("#u-von").value, bis = $("#u-bis").value;
      if (!von || !bis || bis < von) return meldung("Bitte Zeitraum prüfen");
      S.abwesenheiten.push({ id: neueId("a"), personId: ICH().id, art: "urlaub", von, bis, status: "beantragt", notiz: $("#u-notiz").value.trim() });
      speichern(); meldung("Antrag gestellt"); zeichnen();
    },
    stempel: (el) => { S.stempel.push({ id: neueId("t"), personId: ICH().id, filiale: FIL().id, art: el.dataset.art, zeit: jetztIso() }); speichern(); meldung({ kommen: "Guten Start!", pause: "Gute Pause!", weiter: "Weiter geht's", gehen: "Schönen Feierabend!" }[el.dataset.art]); zeichnen(); },
    hygfilter: (el) => { hygFilter = el.dataset.f; zeichnen(); },
    ppwahl: (el) => { entwurf.werte[el.dataset.i] = el.dataset.w; zeichnen(); },
    abhaken: () => hygSpeichern(),
    "nicht-moeglich": () => { fenster = `<h2>Warum nicht möglich?</h2><div class="liste">${["Gerät defekt", "Ware oder Material fehlt", "Keine Zeit, wird nachgeholt", "Sonstiges"].map((g) => `<button class="zeile" data-act="nm-grund" data-g="${g}"><span class="punkt rot"></span><span>${g}</span><span>›</span></button>`).join("")}</div><button class="btn drei" data-act="zu">Abbrechen</button>`; zeichnen(); },
    "nm-grund": (el) => { fenster = null; hygSpeichern(el.dataset.g); },
    rgruppe: (el) => { rezeptGruppe = el.dataset.g; zeichnen(); },
    rgroesse: (el) => { rezeptGroesse[el.dataset.r] = el.dataset.g; zeichnen(); },
    "quiz-antwort": (el) => { const q = quizStand; q.gewaehlt = Number(el.dataset.i); if (q.fragen[q.nr].antworten[q.gewaehlt] === q.fragen[q.nr].richtig) q.punkte++; zeichnen(); },
    "quiz-weiter": () => { quizStand.nr++; quizStand.gewaehlt = null; zeichnen(); },
    "quiz-neu": () => { quizStand = null; zeichnen(); },
    pinnwand: () => { const t = $("#pw-text").value.trim(); if (!t) return; S.pinnwand.push({ id: neueId("n"), filiale: FIL().id, vonId: ICH().id, text: t, zeit: jetztIso(), wichtig: !!($("#pw-wichtig") || {}).checked }); speichern(); zeichnen(); },
    "pin-weg": (el) => { S.pinnwand = S.pinnwand.filter((n) => n.id !== el.dataset.id); speichern(); zeichnen(); },
    "plan-plus": (el) => { kandidatenFenster(el.dataset.datum, el.dataset.schicht); zeichnen(); },
    einteilen: (el) => {
      S.plan.push({ id: neueId("s"), filiale: FIL().id, datum: el.dataset.datum, schicht: el.dataset.schicht, personId: el.dataset.id, quelle: "hand" });
      if (S.veroeffentlicht[`${FIL().id}|${L.montag(el.dataset.datum)}`]) S.meldungen = S.meldungen || [];
      speichern(); fenster = null; meldung(`${person(el.dataset.id).vorname} eingeteilt`); zeichnen();
    },
    "plan-weg": (el) => { const s = S.plan.find((x) => x.id === el.dataset.id); S.plan = S.plan.filter((x) => x !== s); speichern(); meldung(`${person(s.personId).vorname} aus der Schicht genommen`); zeichnen(); },
    vorschlag: (el) => {
      const neu = [...L.planVorschlag(S, FIL().id, el.dataset.mo, () => neueId("s"), { nurStamm: true })];
      S.plan.push(...neu); const neu2 = L.planVorschlag(S, FIL().id, el.dataset.mo, () => neueId("s")); S.plan.push(...neu2);
      speichern(); meldung(neu.length + neu2.length ? `${neu.length + neu2.length} Schichten vorgeschlagen${neu2.length ? `, davon ${neu2.length} mit Springern` : ""}` : "Nichts mehr frei, was sich besetzen lässt"); zeichnen();
    },
    veroeffentlichen: (el) => { S.veroeffentlicht[`${FIL().id}|${el.dataset.mo}`] = true; speichern(); meldung("Plan veröffentlicht. Das Team sieht ihn jetzt."); zeichnen(); },
    genehmigen: (el) => {
      const a = S.abwesenheiten.find((x) => x.id === el.dataset.id); a.status = "genehmigt";
      const betr = L.betroffeneSchichten(S, a.personId, a.von, a.bis); S.plan = S.plan.filter((s) => !betr.includes(s));
      speichern(); meldung(`Genehmigt${betr.length ? `, ${betr.length} Schicht(en) sind jetzt offen` : ""}`); zeichnen();
    },
    ablehnen: (el) => { S.abwesenheiten.find((x) => x.id === el.dataset.id).status = "abgelehnt"; speichern(); zeichnen(); },
    "meldung-ok": (el) => { S.meldungen.find((m) => m.id === el.dataset.id).erledigt = true; speichern(); zeichnen(); },
    "geraet-neu": () => {
      const typ = $("#g-typ").value, n = $("#g-name").value.trim() || (S.hygiene.geraetetypen.find((t) => t.id === typ) || {}).name;
      S.hygiene.geraete.push({ id: neueId("g"), filiale: FIL().id, typ, name: n, status: "aktiv" }); speichern(); meldung("Gerät angelegt. Passende Aufgaben erscheinen in der Tagesliste."); zeichnen();
    },
    zuteilung: (el) => { S.hygiene.zuteilung[`${el.dataset.r}|${FIL().id}`] = { ...(S.hygiene.zuteilung[`${el.dataset.r}|${FIL().id}`] || {}), status: el.dataset.s, von: ICH().id, zeit: jetztIso() }; speichern(); zeichnen(); },
    "ma-neu": () => { const p = { id: neueId("p"), vorname: "Neu", nachname: "", rolle: "aushilfe", stammfiliale: S.filialen[0].id, springer: false, einsatzfilialen: [], wochenstunden: 10, aktiv: true }; S.personen.push(p); speichern(); gehe("ma-edit", p.id); },
    "ma-speichern": (el) => {
      const p = person(el.dataset.id);
      Object.assign(p, { vorname: $("#m-vor").value.trim() || p.vorname, nachname: $("#m-nach").value.trim(), rolle: $("#m-rolle").value, stammfiliale: $("#m-stamm").value,
        wochenstunden: Number($("#m-std").value) || 0, springer: $("#m-springer").checked, aktiv: $("#m-aktiv").checked,
        einsatzfilialen: [...document.querySelectorAll("[data-einsatz]")].filter((x) => x.checked).map((x) => x.dataset.einsatz).filter((x) => x !== $("#m-stamm").value) });
      speichern(); meldung("Gespeichert"); gehe("ma");
    },
    "regel-neu": () => { const r = { id: neueId("r"), titel: "Neue Regel", bereich: S.hygiene.bereiche[0].id, geraetetyp: null, intervall: { art: "oeffnung", versatz: 0 }, zustaendig: { art: "alle" }, pruefpunkte: [{ art: "haken", text: "Erledigt" }], massnahme: S.hygiene.massnahmen[0].id, standard: "alle", pflicht: false, toleranz: 60, aktiv: false, anleitung: "" }; S.hygiene.regeln.push(r); speichern(); gehe("regel-edit", r.id); },
    "regel-speichern": (el) => {
      const r = S.hygiene.regeln.find((x) => x.id === el.dataset.id);
      const art = $("#r-iv").value, w = $("#r-ivw").value.trim();
      const iv = { art };
      if (art === "uhrzeiten") iv.zeiten = w.split(/[,; ]+/).filter((x) => /^\d{1,2}:\d{2}$/.test(x));
      else if (art === "alle_std") iv.std = Math.max(1, Number(w) || 2);
      else if (art === "wochentage") { iv.tage = [...document.querySelectorAll("[data-wt]")].filter((x) => x.checked).map((x) => x.dataset.wt); iv.zeit = /^\d{1,2}:\d{2}$/.test(w) ? w : "11:00"; if (!iv.tage.length) iv.tage = ["mo"]; }
      else if (art === "monatlich") { iv.tagAb = 1; iv.zeit = /^\d{1,2}:\d{2}$/.test(w) ? w : "11:00"; }
      else iv.versatz = 0;
      if (art === "uhrzeiten" && !iv.zeiten.length) return meldung("Bitte Uhrzeiten wie 10:15, 14:00 eingeben");
      const [za, zw] = $("#r-zust").value.split("|");
      Object.assign(r, { titel: $("#r-titel").value.trim() || r.titel, bereich: $("#r-bereich").value, geraetetyp: $("#r-typ").value || null, anleitung: $("#r-anl").value.trim(), intervall: iv,
        zustaendig: za === "alle" ? { art: "alle" } : { art: za, wert: zw }, massnahme: $("#r-mn").value, pflicht: $("#r-pflicht").checked, aktiv: $("#r-aktiv").checked });
      const pp = r.pruefpunkte[0];
      if (pp && pp.art === "messwert") { pp.max = Number($("#r-max").value); pp.krit = Number($("#r-krit").value); }
      speichern(); meldung("Regel gespeichert. Gilt ab sofort in allen passenden Filialen."); gehe("regeln");
    },
    "tausch-anbieten": (el) => {
      const s = S.plan.find((x) => x.id === el.dataset.id), z = L.planZeit(S, s);
      fenster = `<div class="reihe zw"><h2>Anbieten: ${datumLang(s.datum)}</h2><button class="chip" data-act="zu">✕</button></div>
        <p class="muted">${planTxt(s)} · ${esc(filiale(s.filiale).kurz)}</p>
        <div class="wahl"><button class="an" data-act="tausch-art" data-art="ganz" id="ta-ganz">Ganze Schicht</button><button data-act="tausch-art" data-art="teil" id="ta-teil">Nur Stunden</button></div>
        <div id="ta-zeit" hidden><p class="klein muted">Stunden am Anfang oder am Ende der Schicht, mindestens 1 Stunde.</p>
          <div class="gitter2"><div class="feld"><label for="ta-von">Von</label><input type="time" id="ta-von" value="${L.minZuZeit(Math.max(z.start, z.ende - 120))}"></div><div class="feld"><label for="ta-bis">Bis</label><input type="time" id="ta-bis" value="${L.minZuZeit(z.ende)}"></div></div></div>
        <div class="feld"><label for="ta-notiz">Nachricht an Kollegen (freiwillig)</label><input type="text" id="ta-notiz" maxlength="120" placeholder="z. B. Arzttermin"></div>
        <button class="btn gross" data-act="tausch-senden" data-id="${s.id}">🔁 In die Tauschbörse stellen</button>`;
      zeichnen();
    },
    "tausch-art": (el) => { const teil = el.dataset.art === "teil"; $("#ta-zeit").hidden = !teil; $("#ta-ganz").classList.toggle("an", !teil); $("#ta-teil").classList.toggle("an", teil); },
    "tausch-senden": (el) => {
      const s = S.plan.find((x) => x.id === el.dataset.id), z = L.planZeit(S, s);
      let teil = null;
      if (!$("#ta-zeit").hidden) {
        teil = { start: L.zeitZuMin($("#ta-von").value || "00:00"), ende: L.zeitZuMin($("#ta-bis").value || "00:00") };
        const f = L.teilPruefen(z, teil); if (f) return meldung(f);
        if (teil.start === z.start && teil.ende === z.ende) teil = null;
      }
      tausche().push({ id: neueId("x"), schichtId: s.id, vonId: ICH().id, teil, notiz: $("#ta-notiz").value.trim(), status: "offen", zeit: jetztIso() });
      speichern(); fenster = null; meldung("In der Tauschbörse. Passende Kollegen sehen dein Angebot."); zeichnen();
    },
    "tausch-zurueck": (el) => { tausche().find((a) => a.id === el.dataset.id).status = "zurueck"; speichern(); zeichnen(); },
    "tausch-nehmen": (el) => {
      const a = tausche().find((x) => x.id === el.dataset.id), chk = L.tauschPruefen(S, a, ICH().id);
      if (!chk.moeglich) return meldung(chk.gruende[0]);
      Object.assign(a, { status: "angefragt", nehmerId: ICH().id, gegenId: null, anfrage: jetztIso() });
      const s = S.plan.find((x) => x.id === a.schichtId);
      S.meldungen = S.meldungen || []; S.meldungen.push({ id: neueId("m"), filiale: s.filiale, text: `🔁 ${name(ICH())} möchte von ${name(person(a.vonId))} übernehmen (${L.datumKurz(s.datum)}). Bitte unter Anträge bestätigen.`, zeit: jetztIso() });
      speichern(); meldung("Angefragt. Deine Shopleitung bestätigt den Tausch."); zeichnen();
    },
    "tausch-gegen": (el) => {
      const a = tausche().find((x) => x.id === el.dataset.id), p = ICH();
      const eigene = S.plan.filter((s) => s.personId === p.id && s.datum >= heute() && !s.zeit && !tausche().some((t) => t.schichtId === s.id && ["offen", "angefragt"].includes(t.status)));
      fenster = `<div class="reihe zw"><h2>Tauschen gegen …</h2><button class="chip" data-act="zu">✕</button></div><p class="muted">Welche deiner Schichten soll ${esc(person(a.vonId).vorname)} dafür übernehmen?</p>
        <div class="liste">${eigene.map((s) => { const chk = L.tauschPruefen(S, a, p.id, s.id);
          return `<button class="zeile" data-act="tausch-gegen-ok" data-id="${a.id}" data-gegen="${s.id}" ${chk.moeglich ? "" : 'disabled style="opacity:.5"'}><span class="punkt ${chk.moeglich ? "gruen" : "rot"}"></span><span><b>${datumLang(s.datum)}</b><small>${planTxt(s)} · ${esc(filiale(s.filiale).kurz)}${chk.gruende.length ? " · " + chk.gruende.map(esc).join(", ") : ""}${chk.hinweise.length ? " · " + chk.hinweise.map(esc).join(", ") : ""}</small></span><span>›</span></button>`; }).join("") || '<p class="leer">Du hast keine passende eigene Schicht.</p>'}</div>`;
      zeichnen();
    },
    "tausch-gegen-ok": (el) => {
      const a = tausche().find((x) => x.id === el.dataset.id), chk = L.tauschPruefen(S, a, ICH().id, el.dataset.gegen);
      if (!chk.moeglich) return meldung(chk.gruende[0]);
      Object.assign(a, { status: "angefragt", nehmerId: ICH().id, gegenId: el.dataset.gegen, anfrage: jetztIso() });
      const s = S.plan.find((x) => x.id === a.schichtId);
      S.meldungen = S.meldungen || []; S.meldungen.push({ id: neueId("m"), filiale: s.filiale, text: `🔁 ${name(ICH())} und ${name(person(a.vonId))} möchten Schichten tauschen (${L.datumKurz(s.datum)}). Bitte unter Anträge bestätigen.`, zeit: jetztIso() });
      speichern(); fenster = null; meldung("Tausch angefragt. Deine Shopleitung bestätigt."); zeichnen();
    },
    "tausch-ok": (el) => {
      const a = tausche().find((x) => x.id === el.dataset.id), chk = L.tauschPruefen(S, a, a.nehmerId, a.gegenId);
      if (!chk.moeglich) return meldung("Geht nicht mehr: " + chk.gruende[0]);
      L.tauschAusfuehren(S, a, () => neueId("s"));
      Object.assign(a, { status: "genehmigt", entschieden: jetztIso(), vonLeitung: ICH().id });
      speichern(); meldung("Bestätigt. Der Plan ist geändert."); zeichnen();
    },
    "tausch-nein": (el) => { const a = tausche().find((x) => x.id === el.dataset.id); Object.assign(a, { status: "offen", nehmerId: null, gegenId: null }); speichern(); meldung("Abgelehnt. Das Angebot ist wieder offen."); zeichnen(); },
    "betreiber-neu": () => { const b = { id: neueId("b"), name: "Neuer Franchisenehmer", art: "franchise", kontakt: "", email: "", avvDatum: "", supabase: { url: "", key: "", region: "eu-central-1" }, neon: { projekt: "", region: "aws-eu-central-1" }, schritte: {}, pruefung: {}, freigegeben: false }; (S.betreiber = S.betreiber || []).push(b); speichern(); gehe("admin-edit", b.id); },
    "betreiber-speichern": (el) => {
      const b = S.betreiber.find((x) => x.id === el.dataset.id);
      const neu = { supabase: { url: $("#be-url").value.trim(), key: $("#be-key").value.trim(), region: $("#be-sreg").value }, neon: { projekt: $("#be-neon").value.trim(), region: $("#be-nreg").value } };
      // Geheimnisse nie speichern, auch nicht kurz
      for (const [feld, wert] of [["be-url", neu.supabase.url], ["be-key", neu.supabase.key], ["be-neon", neu.neon.projekt]]) if (L.geheimErkannt(wert)) { $("#" + feld).value = ""; return meldung("Nicht gespeichert: " + L.geheimErkannt(wert)); }
      Object.assign(b, { name: $("#be-name").value.trim() || b.name, art: $("#be-art").value, avvDatum: $("#be-avv").value, kontakt: $("#be-kontakt").value.trim(), email: $("#be-mail").value.trim(), ...neu });
      b.schritte = b.schritte || {};
      document.querySelectorAll("[data-schrittb]").forEach((x) => { b.schritte[x.dataset.schrittb] = x.checked; });
      document.querySelectorAll("[data-befil]").forEach((x) => { const f = filiale(x.dataset.befil); if (x.checked) f.betreiber = b.id; else if (f.betreiber === b.id) f.betreiber = null; });
      b.pruefung = {}; // geänderte Verbindungsdaten müssen neu geprüft werden
      if (b.freigegeben && !L.betreiberStand(b).freigabeMoeglich) b.freigegeben = false;
      speichern(); const v = L.pruefeVerbindung(b); meldung(v.ok ? "Gespeichert" : "Gespeichert, bitte die roten Hinweise prüfen"); zeichnen();
    },
    "betreiber-pruefen": () => meldung("Die Prüfung braucht den Server des Betreibers. In dieser Testversion ist noch keiner angeschlossen."),
    "betreiber-freigeben": (el) => { const b = S.betreiber.find((x) => x.id === el.dataset.id); if (!L.betreiberStand(b).freigabeMoeglich) return; b.freigegeben = true; speichern(); zeichnen(); },
    "betreiber-sperren": (el) => { const b = S.betreiber.find((x) => x.id === el.dataset.id); b.freigegeben = false; speichern(); meldung("Freigabe zurückgenommen. Einladungslinks dieses Betreibers gelten nicht mehr."); zeichnen(); },
    "einsatz-neu": (el) => {
      const fid = el.dataset.f, f = filiale(fid), d = $(`#e-${fid}-d`).value, o = $(`#e-${fid}-o`).value.trim(), v = $(`#e-${fid}-v`).value, b = $(`#e-${fid}-b`).value;
      if (!d || !o || !v || !b || b <= v) return meldung("Bitte Datum, Ort und Zeiten prüfen");
      f.einsaetze = (f.einsaetze || []).filter((e) => e.datum !== d); f.einsaetze.push({ datum: d, ort: o, von: v, bis: b });
      speichern(); meldung("Einsatz angelegt. Er erscheint im Einsatzplan und in der Hygiene-Liste."); zeichnen();
    },
    "einsatz-weg": (el) => { const f = filiale(el.dataset.f); f.einsaetze = f.einsaetze.filter((e) => e.datum !== el.dataset.datum); speichern(); zeichnen(); },
    sortiment: (el) => {
      const f = filiale(el.dataset.f), g = el.dataset.g;
      const akt = f.sortiment ? [...f.sortiment] : S.rezepte.warengruppen.map((x) => x.id);
      f.sortiment = akt.includes(g) ? akt.filter((x) => x !== g) : [...akt, g];
      speichern(); zeichnen();
    },
    "rezept-neu": () => { const r = { id: neueId("z"), gruppe: S.rezepte.warengruppen[0].id, name: "Neues Rezept", beschreibung: "", groessen: ["S", "M", "L"], zutaten: [], schritte: [] }; S.rezepte.rezepte.push(r); speichern(); gehe("rezept-edit", r.id); },
    "rezept-speichern": (el) => {
      const r = S.rezepte.rezepte.find((x) => x.id === el.dataset.id);
      const groessen = $("#rz-gr").value.split(",").map((x) => x.trim()).filter(Boolean);
      if (!groessen.length) return meldung("Bitte mindestens eine Größe angeben");
      const fehler = [], zutaten = [];
      $("#rz-zut").value.split("\n").map((z) => z.trim()).filter(Boolean).forEach((zeile, i) => {
        const [n, m, e, a] = zeile.split("|").map((x) => (x || "").trim());
        const mengen = (m || "").split("/").map((x) => Number(x.replace(",", ".")));
        if (!n || mengen.some((x) => isNaN(x)) || (mengen.length !== 1 && mengen.length !== groessen.length)) { fehler.push(i + 1); return; }
        const allergene = (a || "").split(",").map((x) => x.trim()).filter(Boolean);
        const unbekannt = allergene.filter((x) => !D.ALLERGENE.includes(x));
        if (unbekannt.length) { fehler.push(`${i + 1} (${unbekannt.join(", ")})`); return; }
        zutaten.push({ name: n, menge: mengen.length === 1 ? mengen[0] : Object.fromEntries(groessen.map((g, k) => [g, mengen[k]])), einheit: e || "g", allergene });
      });
      if (fehler.length) return meldung("Zutat-Zeile prüfen: " + fehler.join(", "));
      Object.assign(r, { name: $("#rz-name").value.trim() || r.name, gruppe: $("#rz-gruppe").value, groessen, beschreibung: $("#rz-beschr").value.trim(), standzeit: $("#rz-stand").value.trim() || undefined,
        zutaten, schritte: $("#rz-schritte").value.split("\n").map((x) => x.trim()).filter(Boolean) });
      speichern(); meldung("Rezept gespeichert. Alle Filialen sehen es sofort."); gehe("rezeptpflege");
    },
    "export-csv": (el) => {
      const text = exportCsv(el.dataset.monat);
      try {
        const url = URL.createObjectURL(new Blob(["\ufeff" + text], { type: "text/csv;charset=utf-8" }));
        const a = document.createElement("a"); a.href = url; a.download = `stunden-${FIL().kurz.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${el.dataset.monat}.csv`;
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
        meldung("Datei wird gespeichert. Falls nicht: „Als Text anzeigen“.");
      } catch (e) { AKT["export-text"](el); }
    },
    "export-text": (el) => { const t = $("#export-text"); t.hidden = false; t.value = exportCsv(el.dataset.monat); t.focus(); t.select(); },
    "update-pruefen": () => updatePruefen(true),
    "update-jetzt": () => { if (wartend) wartend.postMessage("jetzt-aktivieren"); },
  };
  function hygSpeichern(grund) {
    const a = aufgabeFinden(arg); if (!a || a.durchfuehrung || berater()) return;
    const r = a.regel, m = S.hygiene.massnahmen.find((x) => x.id === r.massnahme);
    const werte = {}; r.pruefpunkte.forEach((pp, i) => { werte[i] = entwurf.werte[i] == null ? null : entwurf.werte[i]; });
    const bew = grund ? "kritisch" : L.bewerte(r, werte);
    const d = { id: neueId("h"), key: a.key, filiale: a.filiale, datum: a.datum, regelId: r.id, geraetId: a.geraet ? a.geraet.id : null, personId: ICH().id, zeit: jetztIso(), werte, bewertung: bew,
      ergebnis: grund ? "nicht_moeglich" : "erledigt", grund: grund || null, nachgetragen: a.datum < heute() || a.status === "ueberfaellig",
      schritte: !grund && bew !== "ok" && m ? m.schritte.filter((_, i) => entwurf.schritte[i]) : [] };
    S.hygiene.durchfuehrungen.push(d);
    let txt = "Abgehakt ✓";
    if (!grund && bew !== "ok" && m && m.nachkontrolle && a.datum === heute()) {
      S.hygiene.nachkontrollen.push({ key: `${a.key}|nk${S.naechsteId}`, filiale: a.filiale, datum: a.datum, regelId: r.id, geraetId: d.geraetId, ab: jetztMin() + m.nachkontrolle, quelle: a.key });
      txt = `Gespeichert. Nachkontrolle in ${m.nachkontrolle} Min. angelegt.`;
    }
    if (bew === "kritisch" || grund) {
      S.meldungen = S.meldungen || [];
      S.meldungen.push({ id: neueId("m"), filiale: a.filiale, text: `🧼 ${grund ? "Nicht möglich" : "Abweichung"}: ${r.titel}${a.geraet ? " · " + a.geraet.name : ""}${grund ? " (" + grund + ")" : ""}`, zeit: jetztIso() });
      if (!grund) txt += " Shopleitung informiert.";
    }
    entwurf = null; speichern(); meldung(txt); gehe("hygiene");
  }

  document.addEventListener("click", (ev) => {
    const el = ev.target.closest("[data-go],[data-act]");
    if (!el || el.disabled || el.tagName === "SELECT" || (el.tagName === "INPUT" && el.dataset.act)) return;
    if (el.dataset.go) { gehe(el.dataset.go, el.dataset.arg); return; }
    const f = AKT[el.dataset.act]; if (f) f(el, ev);
  });
  document.addEventListener("change", (ev) => {
    const el = ev.target;
    if (el.dataset.pp != null && el.type === "checkbox") { entwurf.werte[el.dataset.pp] = el.checked; zeichnen(); }
    else if (el.dataset.pp != null) { entwurf.werte[el.dataset.pp] = el.value; zeichnen(); const n = $(`#pp${el.dataset.pp}`); if (n) n.focus(); }
    else if (el.dataset.schritt != null) { entwurf.schritte[el.dataset.schritt] = el.checked; zeichnen(); }
    else if (el.dataset.act === "geraet-status") { S.hygiene.geraete.find((g) => g.id === el.dataset.id).status = el.value; speichern(); zeichnen(); }
    else if (el.dataset.act === "uhrzeit") { const k = `${el.dataset.r}|${FIL().id}`; S.hygiene.zuteilung[k] = { ...(S.hygiene.zuteilung[k] || { status: "aktiv" }), uhrzeit: el.value || null }; speichern(); meldung("Uhrzeit gespeichert"); }
    else if (el.dataset.oz) { const [fid, t, i] = el.dataset.oz.split("|"); const f = filiale(fid); const z = f.oeffnung[t] ? [...f.oeffnung[t]] : ["10:00", "19:00"]; z[i] = el.value; f.oeffnung[t] = z[0] && z[1] ? z : null; speichern(); zeichnen(); }
    else if (el.dataset.bedarf) { const [fid, sch] = el.dataset.bedarf.split("|"); filiale(fid).bedarf.standard[sch] = Number(el.value) || 0; speichern(); }
  });

  // Erst anzeigen, dann den Update-Dienst versuchen: in eingebetteten Ansichten (z. B. geteilter Link) ist er gesperrt
  // und darf die App nie am Starten hindern.
  const start = (location.hash || "").slice(1);
  if (start && V[start]) ansicht = start;
  window.addEventListener("hashchange", () => { const h = location.hash.slice(1); if (V[h] && h !== ansicht) { ansicht = h; arg = null; fenster = null; zeichnen(); } });
  zeichnen();

  // ---------- Update wie in der Club-App: komplett oder gar nicht ----------
  function swDa() { try { return "serviceWorker" in navigator && !!navigator.serviceWorker && location.protocol !== "file:"; } catch (e) { return false; } }
  function updatePruefen(laut) {
    if (!swDa()) { if (laut) meldung("Updates gibt es nur in der installierten App"); return; }
    try {
      navigator.serviceWorker.getRegistration().then((reg) => { if (!reg) { if (laut) meldung("Kein Update-Dienst aktiv"); return; } return reg.update().then(() => { if (laut && !reg.installing && !reg.waiting) meldung("Du hast die neueste Version"); }); }).catch(() => laut && meldung("Update-Prüfung nicht möglich"));
    } catch (e) { if (laut) meldung("Update-Prüfung nicht möglich"); }
  }
  if (swDa()) {
    try {
      navigator.serviceWorker.register("sw.js").then((reg) => {
        const zeigen = (w) => { wartend = w; updateBand = `<div class="update">Neue Version bereit <button data-act="update-jetzt">Jetzt aktualisieren</button></div>`; zeichnen(); };
        if (reg.waiting && navigator.serviceWorker.controller) zeigen(reg.waiting);
        reg.addEventListener("updatefound", () => { const n = reg.installing; n && n.addEventListener("statechange", () => { if (n.state === "installed" && navigator.serviceWorker.controller) zeigen(n); }); });
      }).catch(() => { /* ohne Service Worker läuft die App trotzdem */ });
      let neu = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => { if (neu) return; neu = true; location.reload(); });
    } catch (e) { /* gesperrt, die App läuft ohne Update-Dienst */ }
  }
  setInterval(() => { if (["hygiene", "start", "stechuhr", "hygkontrolle"].includes(ansicht) && !fenster && !document.activeElement.matches("input,textarea,select")) zeichnen(); }, 60000);
  window.FR_APP = { zustand: () => S, version: APP_VERSION };
})();
