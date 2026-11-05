const APP_VERSION = "0.8.0"; // gleich halten mit sw.js, version.json und ?v= in index.html (Versionsvertrag wie Club-App)
// frooters Team-App – Oberfläche. Logik: logik.js (FRL), Daten: daten.js (FRD).
(function () {
  "use strict";
  const L = window.FRL, D = window.FRD, B = window.FRB;
  if (document.currentScript && document.currentScript.dataset.v !== APP_VERSION) {
    // Mischstand alter Seite und neuem Programm (KICC-Regel 16): einmal frisch laden
    try { if (sessionStorage.getItem("fr_mischstand") !== APP_VERSION) { sessionStorage.setItem("fr_mischstand", APP_VERSION); location.reload(); return; } } catch (e) { /* weiter */ }
  }
  const A = D.adapter("demo");
  let S = A.laden();
  if (!S || S.version !== 8) { S = D.demoDaten(L.iso(new Date())); A.speichern(S); }
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
    buero: "Das Büro: Jeder Ordner hat seine Aufgabe. Was du siehst, hängt von deiner Rolle ab. Der Inhaber legt unter „Freigaben“ fest, wer welchen Ordner sieht.",
    studio: "Wähle eine Vorlage, trag deinen Text ein und drucke das Blatt im frooters-Design. Preise denkst du dir nicht aus: leere Preise stehen als „… €“ auf dem Blatt.",
    abwesenheit: "Hier meldest du dich krank oder beantragst Urlaub, Bildungsurlaub und mehr. Oben siehst du dein Urlaubskonto: Anspruch, genommen, geplant und Rest.",
    urlaubsuebersicht: "Wähle oben die Filialen: deine, alle oder nur bestimmte. Im Kalender siehst du, wer wann fehlt. Unter „Urlaubskonten“ steht der Rest jeder Person.",
    urlaub: "Stell deinen Urlaubsantrag hier. Du siehst sofort, ob er genehmigt ist.",
    stechuhr: "Kommen, Pause, Gehen: einfach antippen. Am Stand geht es auch mit deinem Ausweis-QR.",
    hygiene: "Das ist die Hygiene-Liste für heute. Gelb ist jetzt fällig, rot ist überfällig. Tipp drauf und hak ab.",
    aufgabe: "Trag den Wert ein. Wenn etwas nicht stimmt, zeige ich dir sofort, was zu tun ist.",
    rezepte: "Alle Rezepte nach Warengruppen. Im Rezept kannst du die Größe wechseln, die Mengen rechnen mit.",
    quiz: "Kennst du unsere Rezepte? 10 Fragen, los geht's!",
    pinnwand: "Zettel für den Shop: für alle, für die Leitung oder für bestimmte Kollegen. Tipp auf „✓ Gelesen“, dann weiß der Verfasser Bescheid. Bei ❗ wichtigen Zetteln bestätigst du „gelesen und verstanden“.",
    besetzung: "Grün: richtig besetzt. Gelb: genug Leute, aber eine Vorgabe fehlt, zum Beispiel keine Leitung oder zu viele Aushilfen. Rot: es fehlen Personen. Unten stehen alle Lücken, mit + teilst du direkt jemanden ein.",
    matrix: "Lege je Zeitblock fest, wie viele Personen da sein müssen und welche Rollen dabei sein sollen. Die Übersicht und der Planvorschlag richten sich danach.",
    plan: "Tipp auf + um jemanden einzuteilen. Springer aus anderen Filialen siehst du mit grauem Rand.",
    antraege: "Urlaubsanträge und Schichttausch deines Teams. Genehmigter Urlaub wird im Plan frei, ein bestätigter Tausch ändert den Plan sofort.",
    offen: "Hier siehst du Krankmeldungen und Schichten, die noch besetzt werden müssen.",
    hygkontrolle: "So steht es heute um die Hygiene in deinem Shop.",
    hygregeln: "Hier legst du fest, welche Regeln in deinem Shop gelten und welche Geräte es gibt. Ohne Eismaschine gibt es auch keine Eismaschinen-Aufgabe.",
    ma: "Hier pflegst du die Mitarbeiter: Beschäftigungsart, Stundenumfang (mit „darf überschreiten“), Einsatzprofil, Bereitschaft, Springer und Qualifikationen. Am PC siehst du alles als Tabelle.",
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
  // PC-Ansicht: ab 1100 Pixel Breite für Leitung, Zentrale und Qualität mit Seitenleiste
  const breit = () => window.innerWidth >= 1100 && !!ICH() && ansicht !== "login" && (leitung() || zentrale() || qualitaet());
  function pcNav() {
    const tmp = document.createElement("div"); tmp.innerHTML = V.start();
    const aktiv = { "ma-edit": "ma", "ma-import": "ma", "regel-edit": "regeln", "rezept-edit": "rezeptpflege", "besetzung-tag": "besetzung", "admin-edit": "admin", "admin-pinnwand": "admin", ordner: "buero", studio: "buero", "druck-edit": "buero" }[ansicht] || ansicht;
    const gesehen = new Set();
    return `<nav class="pc-nav" aria-label="Bereiche"><button class="${aktiv === "start" ? "an" : ""}" data-go="start"><span aria-hidden="true">🏠</span><span>Übersicht</span></button>
      ${[...tmp.querySelectorAll(".abschnitt")].map((ab) => { const ks = [...ab.querySelectorAll(".kachel")].filter((k) => !gesehen.has(k.dataset.go) && gesehen.add(k.dataset.go)); if (!ks.length) return "";
        return `<h3>${esc(ab.querySelector("h2").textContent)}</h3>${ks.map((k) => `<button class="${aktiv === k.dataset.go ? "an" : ""}" data-go="${k.dataset.go}"><span aria-hidden="true">${esc(k.querySelector(".sym").textContent)}</span><span>${esc(k.querySelector("b").textContent)}</span>${k.querySelector(".zahl") ? `<span class="zahl">${esc(k.querySelector(".zahl").textContent)}</span>` : ""}</button>`).join("")}`; }).join("")}</nav>`;
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
    const pin = L.pinUngelesen(S, p, d).sort((a, b) => (b.wichtig - a.wichtig) || b.zeit.localeCompare(a.zeit))[0];
    const pinErinnern = L.pinErinnern(S, p, d);
    const krank = L.abwesenheitAm(S, p.id, d);
    let k = "";
    if (!uebergreifend()) {
      k += `<div class="abschnitt"><h2>Mein Bereich</h2><div class="kacheln">
        ${kachel("🗓️", "Mein Dienstplan", "Meine Schichten", "dienst")}
        ${kachel("📝", "Dienstwünsche", "Für die nächsten Wochen", "wuensche")}
        ${kachel("⏱️", "Stechuhr", st === "da" ? "Eingestempelt" : st === "pause" ? "In Pause" : "Kommen · Gehen", "stechuhr")}
        ${kachel("🏖️", "Abwesenheit", (() => { const k = L.urlaubskonto(S, p, d.slice(0, 4), d); return `Urlaub, krank, Bildungsurlaub · Rest ${k.rest} Tage`; })(), "abwesenheit")}
        ${kachel("🔁", "Tauschbörse", "Schichten und Stunden tauschen", "tausch", angeboteFuer(p).filter((a) => L.tauschPruefen(S, a, p.id).moeglich).length)}
      </div></div>`;
    }
    k += `<div class="abschnitt"><h2>${f.art === "mobil" ? "Mobiler Stand" : "Shop"} ${esc(f.kurz)}${f.pilot ? " · Pilot" : ""}</h2><div class="kacheln">
      ${kachel("🧼", "Hygiene heute", hs.gesamt ? `${hs.erledigt + hs.abweichung} von ${hs.gesamt} erledigt` : (f.art === "mobil" ? "Heute kein Einsatz" : "Heute geschlossen"), "hygiene", berater() ? 0 : hs.faellig + hs.ueberfaellig)}
      ${kachel("📖", "Rezepte", "Mit Allergenen", "rezepte")}
      ${berater() ? "" : kachel("🎯", "Rezept-Quiz", "Wie gut kennst du sie?", "quiz")}
      ${berater() ? "" : kachel("📌", "Pinnwand", (() => { const u = L.pinUngelesen(S, p, d).length; return u ? `${u} ungelesen` : "Zettel für den Shop"; })(), "pinnwand", L.pinUngelesen(S, p, d).length)}
      ${(berater() || rolle() === "qualitaet") ? kachel("🔍", "Hygiene-Kontrolle", "Letzte 7 Tage", "hygkontrolle", hl.filter((a) => a.status === "abweichung").length) : ""}
    </div></div>`;
    if (leitung()) {
      const offen = offeneSchichten(f.id, d, 7).length;
      k += `<div class="abschnitt"><h2>Shopleitung ${esc(f.kurz)}</h2><div class="kacheln">
        ${kachel("📅", "Einsatzplan", "Woche planen", "plan")}
        ${kachel("📊", "Besetzung", "Übersicht und Lücken", "besetzung", L.woche(L.montag(d)).filter((t) => t >= d).flatMap((t) => L.besetzungsLuecken(S, f.id, t)).length)}
        ${kachel("🗓️", "Urlaubsübersicht", "Filialen, Konten, Kalender", "urlaubsuebersicht")}
        ${kachel("✅", "Anträge", "Urlaub und Tausch", "antraege", offeneAntraege(f.id).length + tauschAnfragen(f.id).length)}
        ${kachel("🚨", "Krank & offen", "Schichten besetzen", "offen", offen + leitungsMeldungen(f.id).length)}
        ${kachel("🔍", "Hygiene-Kontrolle", `Heute ${hs.quote == null ? "–" : hs.quote + " %"}`, "hygkontrolle", hl.filter((a) => a.status === "abweichung").length)}
        ${kachel("⚙️", "Regeln & Geräte", "Was gilt in diesem Shop", "hygregeln")}
        ${kachel("🕒", "Stempelzeiten", "Wer ist heute da", "stempelzeiten")}
        ${kachel("📤", "Stundenliste", "Export für den Steuerberater", "export")}
        ${kachel("🗂️", "Büro", `${bueroOrdner().length} Ordner · Grafik & Druck`, "buero")}
        ${zentrale() ? "" : kachel("👤", "Mitarbeiter", "Stunden, Einsatz, Qualifikationen", "ma", L.qualiAblauf({ personen: maSichtbar() }, d, 30).length)}
        ${kachel("👥", "Team", "Inklusive Springer", "team")}
      </div></div>`;
    }
    if (zentrale()) {
      k += `<div class="abschnitt"><h2>Zentrale</h2><div class="kacheln">
        ${kachel("📊", "Auswertung", "Jede Filiale und gesamt", "auswertung")}
        ${kachel("👤", "Mitarbeiter", "Beschäftigung, Einsatz, Springer", "ma", L.qualiAblauf({ personen: maSichtbar() }, d, 30).length)}
        ${kachel("🏪", "Filialen", "Öffnungszeiten, Bedarf", "filialen")}
        ${kachel("📋", "Hygieneregeln", "Für alle Filialen", "regeln")}
        ${kachel("📝", "Rezepte pflegen", "Für alle Filialen", "rezeptpflege")}
        ${kachel("🗂️", "Büro", `${bueroOrdner().length} Ordner · alles für die Zentrale`, "buero")}
        ${kachel("🛠️", "Admin", "Betreiber & Datenbanken", "admin", (S.betreiber || []).filter((b) => !b.freigegeben).length)}
      </div></div>`;
    }
    if (rolle() === "qualitaet") {
      k += `<div class="abschnitt"><h2>Qualität & Pflege</h2><div class="kacheln">
        ${kachel("📋", "Hygieneregeln", "Für alle Filialen", "regeln")}
        ${kachel("📝", "Rezepte pflegen", "Für alle Filialen", "rezeptpflege")}
        ${kachel("🗂️", "Büro", `${bueroOrdner().length} Ordner`, "buero")}
      </div></div>`;
    }
    if (berater()) k += `<div class="abschnitt"><h2>Büro</h2><div class="kacheln">${kachel("🗂️", "Büro", "Hygiene-Dokumentation", "buero")}</div></div>`;
    k += `<div class="abschnitt"><h2>Hilfe</h2><div class="kacheln">${kachel("🍓", "Frag Frootie", "Hilfe zu allen Bereichen", "hilfe")}${kachel("🔄", "Version", "v" + APP_VERSION, "info")}</div></div>`;
    const heuteKarte = uebergreifend() ? (berater() ? frootie(FROOTIE_TIPPS.berater) : "") : `<div class="karte"><div class="reihe zw"><h2>Heute</h2><span class="muted klein">${datumLang(d)}</span></div>
      ${krank ? `<p class="hinweis">${L.abwArt(krank.art).sym} Du bist bis ${L.datumKurz(krank.bis)} abwesend: ${esc(L.abwArt(krank.art).name)}.</p>` : ""}
      ${meine.length ? meine.map((s) => `<p>🗓️ <b>${planTxt(s)}</b> in ${esc(filiale(s.filiale).kurz)}${ortTxt(filiale(s.filiale), d)}</p>`).join("") : '<p class="muted">Heute hast du keinen Dienst.</p>'}
      ${meine.length ? `<button class="btn ${st === "aus" ? "" : "zwei"}" data-go="stechuhr">${st === "aus" ? "⏱️ Jetzt einstempeln" : st === "pause" ? "▶️ Pause beenden" : "⏱️ Eingestempelt · öffnen"}</button>` : ""}
      ${meineAufg ? `<p class="hinweis">🧼 ${meineAufg} Hygiene-Aufgabe${meineAufg > 1 ? "n" : ""} für dich jetzt fällig.</p>` : ""}
    </div>`;
    const erinnernKarte = pinErinnern.length ? `<div class="hinweis">📌 Dein Zettel „${esc(pinErinnern[0].text.slice(0, 50))}${pinErinnern[0].text.length > 50 ? "…" : ""}“ hängt seit ${Math.round((L.ausIso(d) - L.ausIso(pinErinnern[0].zeit.slice(0, 10))) / 864e5)} Tagen. <button class="chip" data-act="pin-abnehmen" data-id="${pinErinnern[0].id}">abnehmen</button> <button class="chip" data-act="pin-haengen" data-id="${pinErinnern[0].id}">hängen lassen</button></div>` : "";
    const qa = (leitung() || zentrale()) ? L.qualiAblauf({ personen: maSichtbar() }, d, 30) : [];
    const qualiHinweis = qa.length ? `<button class="hinweis zeile-hinweis" data-go="ma">🎓 ${qa.length} Qualifikation${qa.length > 1 ? "en" : ""} ${qa.some((x) => x.abgelaufen) ? "abgelaufen oder bald fällig" : "bald fällig"}: ${qa.slice(0, 3).map((x) => `${esc(x.person.vorname)} (${esc(x.name)})`).join(", ")}${qa.length > 3 ? " …" : ""} ›</button>` : "";
    return `${frootie(`Hallo ${esc(p.vorname)}! ${pin ? `📌 ${pin.wichtig ? "❗ " : ""}${esc(pin.text)}` : FROOTIE_TIPPS.start}`)}${erinnernKarte}${qualiHinweis}${heuteKarte}${k}`;
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
        <small>${abw ? `${L.abwArt(abw.art).sym} ${esc(L.abwArt(abw.art).name)}` : sch.length ? sch.map((s) => `${planTxt(s)}${tausche().some((a) => a.schichtId === s.id && (a.status === "offen" || a.status === "angefragt")) ? " · 🔁 angeboten" : ""} · ${esc(filiale(s.filiale).kurz)}${ortTxt(filiale(s.filiale), d)}${s.filiale !== p.stammfiliale ? " (Springer)" : ""}`).join("<br>") : "frei"}</small></span>
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

  // ---------- Abwesenheit: Urlaub, Krankmeldung, Bildungsurlaub usw. mit Urlaubskonto ----------
  let abwArtWahl = "urlaub";
  const ABW_FARBE = { beantragt: "gelb", genehmigt: "gruen", gemeldet: "rot", abgelehnt: "rot", zurueckgezogen: "" };
  const ABW_STATUS = { beantragt: "beantragt", genehmigt: "genehmigt", gemeldet: "gemeldet", abgelehnt: "abgelehnt", zurueckgezogen: "zurückgezogen" };
  function kontoKarte(p, jahr) {
    const k = L.urlaubskonto(S, p, jahr, heute()), b = L.urlaubskonto(S, p, jahr, heute(), "bildung");
    return `<div class="karte"><div class="reihe zw"><h2>Mein Urlaubskonto ${jahr}</h2><span class="marke-s ${k.rest < 0 ? "rot" : "gruen"}">Rest ${k.rest} Tage</span></div>
      <div class="konto">
        <div><small>Anspruch</small><b>${k.anspruch}</b></div>${k.uebertrag ? `<div><small>Übertrag</small><b>+${k.uebertrag}</b></div>` : ""}
        <div><small>genommen</small><b>${k.genommen}</b></div><div><small>geplant</small><b>${k.geplant}</b></div>
        <div class="${k.rest < 0 ? "rot" : ""}"><small>Rest</small><b>${k.rest}</b></div>${k.beantragt ? `<div class="gelb"><small>beantragt</small><b>${k.beantragt}</b></div>` : ""}</div>
      <div class="balken" aria-hidden="true"><span style="width:${Math.min(100, Math.round(((k.genommen + k.geplant) / Math.max(1, k.anspruch + k.uebertrag)) * 100))}%"></span></div>
      <p class="klein muted">Bildungsurlaub: ${b.genommen + b.geplant} von ${b.anspruch} Tagen${b.beantragt ? ` · ${b.beantragt} beantragt` : ""}. Gezählt werden Arbeitstage (${(S.parameter.urlaubTage || "mo-fr") === "mo-sa" ? "Mo–Sa" : "Mo–Fr"}).</p></div>`;
  }
  V.abwesenheit = () => {
    const p = ICH(), d = heute(), jahr = d.slice(0, 4), art = L.abwArt(abwArtWahl);
    const meine = S.abwesenheiten.filter((a) => a.personId === p.id).sort((a, b) => b.von.localeCompare(a.von)).slice(0, 12);
    const vonStd = art.genehmigung ? L.plusTage(d, 14) : d, bisStd = art.genehmigung ? L.plusTage(d, 18) : d;
    return `${titel("Abwesenheit")}${frootie(FROOTIE_TIPPS.abwesenheit)}
      ${kontoKarte(p, jahr)}
      <div class="karte"><h2>Neue Abwesenheit</h2>
        <div class="wahl">${Object.entries(L.ABW_ARTEN).map(([k, a]) => `<button class="${k === abwArtWahl ? "an" : ""}" data-act="abw-art" data-a="${k}">${a.sym} ${esc(a.name)}</button>`).join("")}</div>
        <div class="gitter2"><div class="feld"><label for="ab-von">${abwArtWahl === "krank" || abwArtWahl === "kind_krank" ? "Ab" : "Von"}</label><input type="date" id="ab-von" value="${vonStd}"></div>
          <div class="feld"><label for="ab-bis">${abwArtWahl === "krank" || abwArtWahl === "kind_krank" ? "Voraussichtlich bis" : "Bis"}</label><input type="date" id="ab-bis" value="${bisStd}"></div></div>
        <p class="klein muted" id="ab-tage"></p>
        <div class="feld"><label for="ab-notiz">Bemerkung (freiwillig)</label><input type="text" id="ab-notiz" maxlength="120" placeholder="${art.genehmigung ? "z. B. Familienfeier" : "keine Diagnose eintragen"}"></div>
        ${art.genehmigung ? "" : '<p class="klein muted">Deine Shopleitung bekommt sofort Bescheid. Ab wann du eine Bescheinigung brauchst, steht in deinem Arbeitsvertrag. Die eAU ruft der Arbeitgeber bei der Krankenkasse ab.</p>'}
        <button class="btn gross" data-act="abw-senden">${art.sym} ${art.genehmigung ? `${esc(art.name)} beantragen` : `${esc(art.name)} absenden`}</button></div>
      <div class="abschnitt"><h2>Meine Abwesenheiten</h2><div class="liste">${meine.length ? meine.map((a) => { const t = L.abwArt(a.art), tage = t.konto ? L.urlaubsTage(a.von, a.bis, S.parameter.urlaubTage) : null;
        return `<div class="zeile"><span class="punkt ${ABW_FARBE[a.status] || ""}"></span><span>${t.sym} <b>${esc(t.name)}</b> · ${L.datumKurz(a.von)}${a.bis !== a.von ? " bis " + L.datumKurz(a.bis) : ""}<small>${tage != null ? tage + " Arbeitstage · " : ""}${esc(a.notiz || "")}</small></span>
          ${a.status === "beantragt" ? `<button class="chip" data-act="abw-zurueck" data-id="${a.id}">zurückziehen</button>` : `<span class="marke-s ${ABW_FARBE[a.status] || ""}">${ABW_STATUS[a.status] || a.status}</span>`}</div>`; }).join("") : '<p class="leer">Noch keine Abwesenheiten.</p>'}</div></div>`;
  };
  V.krank = () => { abwArtWahl = "krank"; return V.abwesenheit(); };
  V.urlaub = () => { abwArtWahl = "urlaub"; return V.abwesenheit(); };

  // Urlaubsübersicht für die Leitung: Filialen wählbar (eigene, alle, bestimmte), Art und Monat
  let uebFilialen = null, uebArt = "alle", uebAnsicht = "kalender";
  V.urlaubsuebersicht = () => {
    const ich = ICH(), d = heute(), monat = arg && /^\d{4}-\d{2}$/.test(arg) ? arg : d.slice(0, 7), jahr = monat.slice(0, 4);
    const erlaubt = zentrale() ? S.filialen : S.filialen.filter((f) => f.betreiber === FIL().betreiber || !f.betreiber);
    if (!uebFilialen) uebFilialen = [FIL().id];
    uebFilialen = uebFilialen.filter((id) => erlaubt.some((f) => f.id === id));
    if (!uebFilialen.length) uebFilialen = [FIL().id];
    const leute = S.personen.filter((p) => p.aktiv !== false && !L.UEBERGREIFEND.includes(p.rolle) && uebFilialen.includes(p.stammfiliale)).sort((a, b) => (a.stammfiliale || "").localeCompare(b.stammfiliale || "") || a.vorname.localeCompare(b.vorname));
    const [y, m] = monat.split("-").map(Number), letzter = new Date(y, m, 0).getDate();
    const tage = Array.from({ length: letzter }, (_, i) => `${monat}-${String(i + 1).padStart(2, "0")}`);
    const vor = (() => { const x = new Date(y, m - 2, 1); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`; })(), nach = (() => { const x = new Date(y, m, 1); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`; })();
    // Datenschutz: Krankmeldungen aus fremden Filialen nur als „abwesend“, außer für den Inhaber
    const sichtArt = (a, p) => (!L.abwArt(a.art).genehmigung && !zentrale() && p.stammfiliale !== FIL().id) ? { name: "abwesend", sym: "•" } : L.abwArt(a.art);
    const passt = (a) => uebArt === "alle" || a.art === uebArt || (uebArt === "krank" && a.art === "kind_krank");
    const abw = S.abwesenheiten.filter((a) => a.status !== "zurueckgezogen" && a.status !== "abgelehnt" && passt(a) && a.bis >= tage[0] && a.von <= tage[tage.length - 1] && leute.some((p) => p.id === a.personId));
    const zelle = (p, t) => { const a = abw.find((x) => x.personId === p.id && L.zwischen(t, x.von, x.bis)); const so = L.wochentag(t) === "so";
      if (!a) return `<td class="${so ? "u-so" : ""}"></td>`; const art = sichtArt(a, p);
      return `<td class="u-${a.status === "beantragt" ? "antrag" : art.name === "abwesend" ? "abw" : a.art}" title="${esc(p.vorname)}: ${esc(art.name)} ${a.status === "beantragt" ? "(beantragt)" : ""}">${art.sym}</td>`; };
    const filText = uebFilialen.length === erlaubt.length ? "alle Filialen" : uebFilialen.map((id) => filiale(id).kurz).join(", ");
    return `${titel("Urlaubsübersicht")}${frootie(FROOTIE_TIPPS.urlaubsuebersicht)}
      <div class="karte"><div class="feld"><span class="lbl">Filialen</span><div class="wahl"><button class="${uebFilialen.length === erlaubt.length ? "an" : ""}" data-act="ueb-alle">Alle</button>${erlaubt.map((f) => `<button class="${uebFilialen.includes(f.id) ? "an" : ""}" data-act="ueb-fil" data-id="${f.id}">${esc(f.kurz)}</button>`).join("")}</div></div>
        <div class="feld"><span class="lbl">Art</span><div class="wahl">${[["alle", "Alle"], ["urlaub", "🏖️ Urlaub"], ["krank", "🤒 Krank"], ["bildungsurlaub", "🎓 Bildungsurlaub"], ["sonderurlaub", "💐 Sonderurlaub"], ["freizeitausgleich", "⏳ Freizeitausgleich"]].map(([k, t]) => `<button class="${uebArt === k ? "an" : ""}" data-act="ueb-art" data-a="${k}">${t}</button>`).join("")}</div></div>
        <div class="wahl"><button class="${uebAnsicht === "kalender" ? "an" : ""}" data-act="ueb-ansicht" data-a="kalender">📅 Kalender</button><button class="${uebAnsicht === "konten" ? "an" : ""}" data-act="ueb-ansicht" data-a="konten">🧮 Urlaubskonten</button><button class="${uebAnsicht === "liste" ? "an" : ""}" data-act="ueb-ansicht" data-a="liste">📋 Liste</button></div></div>
      ${uebAnsicht === "kalender" ? `<div class="karte"><div class="reihe zw"><button class="chip" data-go="urlaubsuebersicht" data-arg="${vor}">‹</button><b>${["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"][m - 1]} ${y} · ${esc(filText)}</b><button class="chip" data-go="urlaubsuebersicht" data-arg="${nach}">›</button></div>
        <div class="matrix-scroll"><table class="ukal"><thead><tr><th></th>${tage.map((t) => `<th class="${L.wochentag(t) === "so" ? "u-so" : ""}">${Number(t.slice(8))}<small>${L.TAG_NAME[L.wochentag(t)].slice(0, 2)}</small></th>`).join("")}</tr></thead>
          <tbody>${leute.map((p) => `<tr><th>${esc(p.vorname)} ${esc(p.nachname.slice(0, 1))}.<small>${esc(filiale(p.stammfiliale).kurz)}</small></th>${tage.map((t) => zelle(p, t)).join("")}</tr>`).join("")}
          <tr class="u-summe"><th>abwesend</th>${tage.map((t) => { const n = leute.filter((p) => abw.some((a) => a.personId === p.id && L.zwischen(t, a.von, a.bis) && a.status !== "beantragt")).length; return `<td class="${n >= 3 ? "u-viel" : ""}">${n || ""}</td>`; }).join("")}</tr></tbody></table></div>
        <div class="legende"><span class="u-urlaub">🏖️ Urlaub</span><span class="u-krank">🤒 krank</span><span class="u-bildungsurlaub">🎓 Bildung</span><span class="u-antrag">beantragt</span><span class="u-abw">• abwesend</span></div></div>`
      : uebAnsicht === "konten" ? `<div class="karte"><h2>Urlaubskonten ${jahr} · ${esc(filText)}</h2><div class="matrix-scroll"><table class="zutaten"><thead><tr><td><b>Name</b></td><td><b>Anspruch</b></td><td><b>genommen</b></td><td><b>geplant</b></td><td><b>beantragt</b></td><td><b>Rest</b></td></tr></thead><tbody>
          ${leute.map((p) => { const k = L.urlaubskonto(S, p, jahr, d); return `<tr><td>${esc(name(p))}<br><span class="klein muted">${esc(filiale(p.stammfiliale).kurz)}</span></td><td>${k.anspruch}${k.uebertrag ? ` +${k.uebertrag}` : ""}</td><td>${k.genommen}</td><td>${k.geplant}</td><td>${k.beantragt || ""}</td><td><b class="${k.rest < 0 ? "rot-txt" : ""}">${k.rest}</b></td></tr>`; }).join("")}</tbody></table></div></div>`
      : `<div class="liste">${abw.sort((a, b) => a.von.localeCompare(b.von)).map((a) => { const p = person(a.personId), art = sichtArt(a, p); return `<div class="zeile"><span class="punkt ${ABW_FARBE[a.status] || ""}"></span><span><b>${esc(name(p))}</b> · ${art.sym} ${esc(art.name)}<small>${L.datumKurz(a.von)} bis ${L.datumKurz(a.bis)} · ${esc(filiale(p.stammfiliale).kurz)}</small></span><span class="marke-s ${ABW_FARBE[a.status] || ""}">${ABW_STATUS[a.status] || a.status}</span></div>`; }).join("") || '<p class="leer">Keine Abwesenheiten in diesem Monat.</p>'}</div>`}`;
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

  // ---------- Pinnwand wie in der Club-App: Zettel in 4 Farben, Empfänger, wichtig, gelesen bestätigen, antworten, abnehmen ----------
  const PIN_FARBEN = { 1: "gelb", 2: "rose", 3: "gruen", 4: "blau" };
  const pinDreh = (id) => { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) | 0; return ((Math.abs(h) % 7) - 3) * 0.6; };
  const pinFuerTxt = (z) => z.fuer === "ich" ? "nur für mich" : z.fuer === "leitung" ? "für die Leitung" : z.fuer === "personen" ? "für " + (z.empfaenger || []).map((id) => (person(id) || {}).vorname).filter(Boolean).join(", ") : z.filiale ? "für alle im Shop" : "für alle Filialen";
  const darfVerwalten = (z) => z.vonId === sitzung.ich || zentrale() || (z.filiale && leitung() && FIL().id === z.filiale);
  let pinFilter = "alle", pinForm = { offen: false, farbe: 1, fuer: "alle", wichtig: false, personen: [], antwortAuf: null };
  function pinZettel(z) {
    const ich = ICH(), stand = L.pinStand(S, z), binEmpf = stand.empf.includes(ich.id), gelesen = (z.gelesen || {})[ich.id];
    const wann = L.datumKurz(z.zeit.slice(0, 10)) + " " + z.zeit.slice(11, 16);
    return `<div class="zettel f-${PIN_FARBEN[z.farbe] || "gelb"}${z.wichtig ? " wichtig" : ""}" style="--dreh:${pinDreh(z.id)}deg">
      ${z.wichtig ? '<span class="zwichtig">❗ WICHTIG</span>' : ""}
      <div class="zkopf">von <b>${esc(name(person(z.vonId)))}</b> · ${wann}${z.filiale ? "" : " · 🌍"}</div>
      <div class="ztext">${esc(z.text)}</div>
      <div class="zfuss">${esc(pinFuerTxt(z))}${z.bis ? ` · hängt bis ${L.datumKurz(z.bis)}` : ""}</div>
      <div class="zknoepfe">
        ${binEmpf && !gelesen ? `<button class="btn klein-btn" data-act="pin-gelesen" data-id="${z.id}">✓ ${z.wichtig ? "Gelesen und verstanden" : "Gelesen"}</button>` : ""}
        ${binEmpf && gelesen ? `<span class="marke-s gruen">✓ gelesen ${gelesen.slice(11, 16)}</span>` : ""}
        ${binEmpf && z.vonId !== ich.id ? `<button class="chip" data-act="pin-antworten" data-id="${z.id}">↩︎ Antworten</button>` : ""}
        ${darfVerwalten(z) && z.fuer !== "ich" ? `<button class="chip" data-act="pin-stand" data-id="${z.id}">👁️ ${stand.gelesen.length}/${stand.empf.length} gelesen</button>` : ""}
        ${darfVerwalten(z) ? `<button class="chip" data-act="pin-mehr" data-id="${z.id}">⋯</button>` : ""}
      </div></div>`;
  }
  V.pinnwand = () => {
    const f = FIL(), p = ICH(), d = heute(), e = L.pinEinstellungen(S);
    let z = S.pinnwand.filter((n) => (n.filiale === f.id || n.filiale === null) && L.pinSichtbar(S, n, p, d));
    const ungelesen = L.pinUngelesen(S, p, d);
    if (pinFilter === "fuermich") z = z.filter((n) => L.pinEmpfaenger(S, n).includes(p.id));
    if (pinFilter === "ungelesen") z = z.filter((n) => ungelesen.includes(n));
    if (pinFilter === "wichtig") z = z.filter((n) => n.wichtig);
    if (pinFilter === "meine") z = z.filter((n) => n.vonId === p.id);
    z.sort((a, b) => (b.wichtig - a.wichtig) || b.zeit.localeCompare(a.zeit));
    const eigene = L.pinEigeneAktiv(S, p, d).length, grenze = !leitung() && eigene >= e.maxZettel;
    const kollegen = S.personen.filter((x) => x.id !== p.id && L.darfInFiliale(x, f.id));
    const F = pinForm;
    return `${titel("Pinnwand " + esc(f.kurz))}${frootie(FROOTIE_TIPPS.pinnwand)}
      ${F.offen ? `<div class="karte">
        <div class="reihe zw"><h2>${F.antwortAuf ? "Antwort-Zettel" : "Neuer Zettel"}</h2><button class="chip" data-act="pin-form-zu">✕</button></div>
        <div class="feld"><label for="pw-text">Text (höchstens ${e.zeichen} Zeichen)</label><textarea id="pw-text" rows="3" maxlength="${e.zeichen}" data-zaehler="pw-zahl">${esc(F.text || "")}</textarea><span class="klein muted" id="pw-zahl">${(F.text || "").length} / ${e.zeichen}</span></div>
        <div class="feld"><span class="lbl">Farbe</span><div class="wahl">${[1, 2, 3, 4].map((n) => `<button class="farbwahl f-${PIN_FARBEN[n]} ${F.farbe === n ? "an" : ""}" data-act="pin-farbe" data-f="${n}" aria-label="Farbe ${PIN_FARBEN[n]}">${F.farbe === n ? "✓" : ""}</button>`).join("")}</div></div>
        <div class="feld"><span class="lbl">Für wen</span><div class="wahl">${[["alle", "alle im Shop"], ["leitung", "Leitung"], ["personen", "bestimmte Personen"], ["ich", "nur für mich"]].concat(zentrale() ? [["global", "alle Filialen"]] : []).map(([w, t]) => `<button class="${F.fuer === w ? "an" : ""}" data-act="pin-fuer" data-w="${w}">${t}</button>`).join("")}</div>
          ${F.fuer === "personen" ? `<div class="wahl">${kollegen.map((x) => `<button class="${F.personen.includes(x.id) ? "an" : ""}" data-act="pin-person" data-id="${x.id}">${esc(x.vorname)}</button>`).join("")}</div>` : ""}</div>
        <div class="gitter2"><label class="haken"><input type="checkbox" id="pw-wichtig" ${F.wichtig ? "checked" : ""}><span>❗ wichtig (mit Lesebestätigung)</span></label>
          <div class="feld"><label for="pw-bis">Hängt bis (freiwillig)</label><input type="date" id="pw-bis" value="${esc(F.bis || "")}"></div></div>
        <button class="btn gross" data-act="pin-anheften">📌 Anheften</button></div>`
      : `<button class="btn" data-act="pin-form" ${grenze ? "disabled" : ""}>＋ Neuer Zettel</button>${grenze ? `<p class="klein muted">Du hast schon ${eigene} Zettel hängen (höchstens ${e.maxZettel}). Nimm erst einen ab.</p>` : ""}`}
      <div class="wahl">${[["alle", "Alle"], ["ungelesen", `Ungelesen${ungelesen.length ? " (" + ungelesen.length + ")" : ""}`], ["fuermich", "Für mich"], ["wichtig", "❗ Wichtig"], ["meine", "Von mir"]].map(([w, t]) => `<button class="${pinFilter === w ? "an" : ""}" data-act="pin-filter" data-w="${w}">${t}</button>`).join("")}</div>
      <div class="wand">${z.map(pinZettel).join("") || '<p class="leer">Keine Zettel in dieser Auswahl.</p>'}</div>`;
  };
  function pinNeuFenster() {
    const p = ICH(); if (!p || fenster) return;
    sitzung.pinGezeigt = sitzung.pinGezeigt || [];
    const neu = L.pinUngelesen(S, p, heute()).filter((z) => !sitzung.pinGezeigt.includes(z.id)).sort((a, b) => (b.wichtig - a.wichtig) || b.zeit.localeCompare(a.zeit));
    if (!neu.length) return;
    sitzung.pinGezeigt.push(...neu.map((z) => z.id)); merke();
    const liste = neu.slice(0, 4);
    fenster = `<h2>📌 ${neu.length === 1 ? "Neuer Zettel für dich" : `${neu.length} neue Zettel für dich`}</h2>
      <div class="wand">${liste.map((z) => `<div class="zettel f-${PIN_FARBEN[z.farbe] || "gelb"}${z.wichtig ? " wichtig" : ""}" style="--dreh:${pinDreh(z.id)}deg">${z.wichtig ? '<span class="zwichtig">❗ WICHTIG</span>' : ""}<div class="zkopf">von <b>${esc(name(person(z.vonId)))}</b></div><div class="ztext">${esc(z.text)}</div></div>`).join("")}</div>
      ${neu.length > liste.length ? `<p class="hinweis">… und ${neu.length - liste.length} weitere an der Pinnwand</p>` : ""}
      <button class="btn gross" data-act="pin-alle-gelesen" data-ids="${liste.map((z) => z.id).join(",")}">✓ ${liste.some((z) => z.wichtig) ? "Gelesen und verstanden" : "Gelesen"}</button>
      <button class="btn drei" data-act="pin-zur-wand">📌 Zur Pinnwand</button>`;
  }


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
        <p class="klein muted">Der Vorschlag füllt nur leere Plätze: erst mit dem eigenen Team, dann mit Springern. Wünsche, Urlaub und die Besetzungsmatrix (Leitung, Aushilfen) werden beachtet.</p>
        <div class="reihe"><button class="chip" data-go="besetzung" data-arg="${mo}">📊 Grafische Übersicht</button><button class="chip" data-go="matrix">⚙️ Besetzungsmatrix</button></div></div>
      <div class="plan">${tage}</div>`;
  };
  function kandidatenFenster(d, schId) {
    const f = FIL();
    const ks = L.kandidaten(S, f.id, d, schId);
    fenster = `<div class="reihe zw"><h2>${L.schicht(schId).name}, ${datumLang(d)}</h2><button class="chip" data-act="zu">✕</button></div>
      <p class="muted klein">${esc(f.kurz)} · ${zeitTxt(L.schichtZeit(f, d, schId))}. Grauer Rand = Springer aus einer anderen Filiale.</p>
      <div class="liste">${ks.map((k) => `<button class="zeile ${k.person.stammfiliale !== f.id ? "springer" : ""}" data-act="einteilen" data-id="${k.person.id}" data-datum="${d}" data-schicht="${schId}" ${k.moeglich ? "" : "disabled"} style="${k.moeglich ? "" : "opacity:.5"}">
        <span class="punkt ${k.moeglich ? (k.punkte > 0 ? "gruen" : "gelb") : "rot"}"></span><span><b>${esc(name(k.person))}</b> ${k.person.stammfiliale !== f.id ? `<span class="marke-s">Springer · ${esc(filiale(k.person.stammfiliale).kurz)}</span>` : ""}
        <small>${L.ROLLEN[k.person.rolle].name} · ${k.stand.ist} von ${k.stand.soll || "–"} Std. ${k.stand.einheit === "monat" ? "im Monat" : "in der Woche"}${k.gruende.length ? " · " + k.gruende.map(esc).join(", ") : ""}</small></span><span>${k.moeglich ? (k.stand.ueberGrenze || k.profil.length || k.gesetz.length ? "⚠️" : "+") : ""}</span></button>`).join("")}</div>`;
  }

  // ---------- Besetzung: grafische Übersicht, Lückenliste, Tagesansicht, Matrix ----------
  const BES_FARBE = { gruen: "b-gruen", gelb: "b-gelb", rot: "b-rot", ueber: "b-ueber", ohne: "b-ohne", leer: "b-leer" };
  const RANG = { rot: 5, gelb: 4, ueber: 2, gruen: 1, ohne: 0, leer: 0 };
  const blockTxt = (b) => `${b.gesamt} Person${b.gesamt > 1 ? "en" : ""}${b.sl ? `, davon ${b.sl} Shopleitung` : ""}${b.stv ? `${b.sl ? " und" : ", davon"} ${b.stv} ${b.sl ? "weitere " : ""}Leitung` : ""}${b.ma ? `, ${b.ma} feste Mitarbeiter` : ""}${b.maxAus != null ? `, höchstens ${b.maxAus} Aushilfe${b.maxAus === 1 ? "" : "n"}` : ""}`;
  V.besetzung = () => {
    const f = FIL(), mo = arg && arg.length === 10 ? L.montag(arg) : L.montag(heute());
    const tage = L.woche(mo).map((d) => ({ d, t: L.besetzungTag(S, f.id, d) }));
    const offen = tage.filter((x) => x.t.offen);
    if (!f.matrix) return `${titel("Besetzung " + esc(f.kurz), "plan")}<p class="hinweis">Für diese Filiale ist noch keine Besetzungsmatrix angelegt.</p><button class="btn" data-go="matrix">⚙️ Besetzungsmatrix anlegen</button>`;
    const von = offen.length ? Math.floor(Math.min(...offen.map((x) => x.t.auf)) / 60) : 10, bis = offen.length ? Math.ceil(Math.max(...offen.map((x) => x.t.zu)) / 60) : 20;
    const stunden = Array.from({ length: Math.max(0, bis - von) }, (_, i) => von + i);
    const zelle = (t, h) => {
      const sl = t.slots.filter((x) => x.m >= h * 60 && x.m < h * 60 + 60);
      if (!sl.length) return '<td class="b-zu"></td>';
      const w = sl.reduce((a, b) => (RANG[b.status] > RANG[a.status] ? b : a));
      return `<td class="${BES_FARBE[w.status]}" title="${esc(w.gruende.join(", ") || (w.bedarf ? "passt" : "keine Vorgabe"))}">${w.bedarf ? `${w.zahl.gesamt}/${w.bedarf.gesamt}` : w.zahl.gesamt || ""}${w.status === "gelb" ? "<i>!</i>" : ""}</td>`;
    };
    const luecken = tage.flatMap((x) => L.besetzungsLuecken(S, f.id, x.d));
    return `${titel("Besetzung " + esc(f.kurz), "plan")}${frootie(FROOTIE_TIPPS.besetzung)}
      <div class="karte"><div class="reihe zw"><button class="chip" data-go="besetzung" data-arg="${L.plusTage(mo, -7)}">‹</button><b>Woche ab ${L.datumKurz(mo)}</b><button class="chip" data-go="besetzung" data-arg="${L.plusTage(mo, 7)}">›</button></div>
        <div class="matrix-scroll"><table class="bes"><thead><tr><th></th>${stunden.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>
        ${tage.map((x) => `<tr><th><button class="tagknopf" data-go="besetzung-tag" data-arg="${x.d}">${L.datumKurz(x.d)}</button></th>${x.t.offen ? stunden.map((h) => zelle(x.t, h)).join("") : `<td class="b-zu" colspan="${stunden.length}">${f.art === "mobil" ? "kein Einsatz" : "geschlossen"}</td>`}</tr>`).join("")}
        </tbody></table></div>
        <div class="legende"><span class="b-gruen">richtig</span><span class="b-gelb">Vorgabe fehlt</span><span class="b-rot">zu wenig</span><span class="b-ueber">mehr als nötig</span><span class="klein muted">Zahl = da / nötig · Tag antippen für Einzelheiten</span></div></div>
      <div class="abschnitt"><h2>Nicht richtig besetzt (${luecken.length})</h2><div class="liste">${luecken.length ? luecken.map((l) => { const sch = L.passendeSchicht(f, l.datum, l.von, l.bis);
        return `<div class="zeile st-${l.status === "rot" ? "ueberfaellig" : "faellig"}"><span class="punkt"></span><span><b>${datumLang(l.datum)} · ${L.minZuZeit(l.von)}–${L.minZuZeit(l.bis)}</b><small>${l.ist} von ${l.soll} Personen · ${l.gruende.map(esc).join(" · ")}</small></span>
          ${sch && l.datum >= heute() ? `<button class="chip" data-act="plan-plus" data-datum="${l.datum}" data-schicht="${sch}">+ einteilen</button>` : '<span class="marke-s">vorbei</span>'}</div>`; }).join("") : '<p class="leer">Alles richtig besetzt. 🎉</p>'}</div></div>`;
  };
  V["besetzung-tag"] = () => {
    const f = FIL(), d = arg || heute(), t = L.besetzungTag(S, f.id, d);
    if (!t.offen) return `${titel(datumLang(d), "besetzung")}<p class="leer">${f.art === "mobil" ? "An diesem Tag kein Einsatz." : "An diesem Tag geschlossen."}</p>`;
    const dauer = t.zu - t.auf, pos = (m) => ((m - t.auf) / dauer) * 100;
    const stunden = []; for (let h = Math.ceil(t.auf / 60); h * 60 <= t.zu; h++) stunden.push(h);
    const bl = L.bedarfBloecke(f, d);
    const personen = t.personen.slice().sort((a, b) => a.von - b.von);
    return `${titel(datumLang(d) + " · " + esc(f.kurz), "besetzung")}
      <div class="karte"><div class="reihe zw"><button class="chip" data-go="besetzung-tag" data-arg="${L.plusTage(d, -1)}">‹</button><b>${L.minZuZeit(t.auf)}–${L.minZuZeit(t.zu)}${t.ort ? " · 📍 " + esc(t.ort) : ""}</b><button class="chip" data-go="besetzung-tag" data-arg="${L.plusTage(d, 1)}">›</button></div>
        <div class="gantt">
          <div class="g-zeile g-kopf"><span></span><div class="g-bahn">${stunden.map((h) => `<i style="left:${pos(h * 60)}%">${h}</i>`).join("")}</div></div>
          ${personen.map((x) => { const p = person(x.id); return `<div class="g-zeile"><span><b>${esc(p.vorname)}</b><small>${L.ROLLEN[p.rolle].name}${x.springer ? " · Springer" : ""}</small></span><div class="g-bahn"><span class="g-balken r-${p.rolle}${x.abwesend ? " fehlt" : ""}" style="left:${pos(x.von)}%;width:${pos(x.bis) - pos(x.von)}%">${L.minZuZeit(x.von)}–${L.minZuZeit(x.bis)}${x.abwesend ? " 🤒" : ""}</span></div></div>`; }).join("") || '<p class="leer">Niemand eingeteilt.</p>'}
          <div class="g-zeile g-summe"><span><b>Da / nötig</b></span><div class="g-bahn g-slots">${t.slots.map((x) => `<span class="${BES_FARBE[x.status]}" style="left:${pos(x.m)}%;width:${pos(x.m + 30) - pos(x.m)}%" title="${esc(x.gruende.join(", ") || (x.bedarf ? `${x.zahl.gesamt} von ${x.bedarf.gesamt}` : ""))}">${x.bedarf && x.status !== "gruen" && x.m % 60 === 0 ? `${x.zahl.gesamt}/${x.bedarf.gesamt}` : ""}</span>`).join("")}</div></div>
        </div>
        <div class="legende"><span class="r-shopleitung">Shopleitung</span><span class="r-stv">Stellvertretung</span><span class="r-mitarbeiter">Mitarbeiter</span><span class="r-aushilfe">Aushilfe</span></div></div>
      <div class="karte"><h2>Vorgabe an diesem Tag</h2>${bl.map((b) => `<p><b>${L.minZuZeit(b.von)}–${L.minZuZeit(b.bis)}</b>: ${blockTxt(b)}</p>`).join("") || '<p class="muted">Keine Vorgabe.</p>'}</div>
      <div class="abschnitt"><h2>Lücken</h2><div class="liste">${L.besetzungsLuecken(S, f.id, d).map((l) => { const sch = L.passendeSchicht(f, d, l.von, l.bis); return `<div class="zeile st-${l.status === "rot" ? "ueberfaellig" : "faellig"}"><span class="punkt"></span><span><b>${L.minZuZeit(l.von)}–${L.minZuZeit(l.bis)}</b><small>${l.gruende.map(esc).join(" · ")}</small></span>${sch && d >= heute() ? `<button class="chip" data-act="plan-plus" data-datum="${d}" data-schicht="${sch}">+ einteilen</button>` : ""}</div>`; }).join("") || '<p class="leer">Keine Lücken.</p>'}</div></div>`;
  };
  let matrixTyp = null;
  V.matrix = () => {
    const f = FIL();
    const typen = f.art === "mobil" ? [["einsatz", "Einsatz"]] : [["werktag", "Mo–Fr"], ["sa", "Samstag"], ["so", "Sonntag"]];
    if (!matrixTyp || !typen.some(([k]) => k === matrixTyp)) matrixTyp = typen[0][0];
    const bloecke = (f.matrix && f.matrix[matrixTyp]) || [];
    const feld = (i, k, w, typ) => `<input type="${typ || "number"}" min="0" max="9" data-mx="${i}|${k}" value="${w == null ? "" : esc(w)}" aria-label="${k}">`;
    return `${titel("Besetzungsmatrix " + esc(f.kurz), "plan")}${frootie(FROOTIE_TIPPS.matrix)}
      <div class="wahl">${typen.map(([k, t]) => `<button class="${k === matrixTyp ? "an" : ""}" data-act="mx-typ" data-t="${k}">${t}</button>`).join("")}</div>
      <div class="karte"><div class="matrix-scroll"><table class="mx"><thead><tr><th>von</th><th>bis</th><th>Personen</th><th>Shop­leitung</th><th>Leitung (Stv.)</th><th>feste Mitarb.</th><th>max. Aushilfen</th><th></th></tr></thead><tbody>
        ${bloecke.map((b, i) => `<tr><td>${feld(i, "von", b.von, "time")}</td><td>${feld(i, "bis", b.bis, "time")}</td><td>${feld(i, "gesamt", b.gesamt)}</td><td>${feld(i, "sl", b.sl)}</td><td>${feld(i, "stv", b.stv)}</td><td>${feld(i, "ma", b.ma)}</td><td>${feld(i, "maxAus", b.maxAus)}</td><td><button class="chip" data-act="mx-weg" data-i="${i}" aria-label="Block entfernen">✕</button></td></tr>`).join("")}
      </tbody></table></div>
      ${bloecke.length ? bloecke.map((b) => `<p class="klein muted">${esc(b.von)}–${esc(b.bis)}: ${blockTxt(b)}</p>`).join("") : '<p class="leer">Noch keine Zeitblöcke.</p>'}
      <div class="reihe"><button class="btn zwei" data-act="mx-neu">+ Zeitblock</button>${typen.length > 1 ? `<button class="btn drei" data-act="mx-kopie">Mo–Fr auf alle Tage übernehmen</button>` : ""}</div>
      <p class="klein muted">„Leitung (Stv.)“ zählt Shopleitung oder Stellvertretung. „feste Mitarb.“ zählt alle außer Aushilfen. Leeres Feld bei Aushilfen = keine Grenze.</p></div>`;
  };
  V.antraege = () => {
    const f = FIL(), a = offeneAntraege(f.id);
    const erledigt = S.abwesenheiten.filter((x) => L.abwArt(x.art).genehmigung && (x.status === "genehmigt" || x.status === "abgelehnt") && x.entschieden && (person(x.personId) || {}).stammfiliale === f.id).sort((x, y) => y.entschieden.localeCompare(x.entschieden)).slice(0, 5);
    const ta = tauschAnfragen(f.id);
    return `${titel("Anträge " + esc(f.kurz))}${frootie(FROOTIE_TIPPS.antraege)}
      ${ta.length ? `<div class="abschnitt"><h2>Schichttausch</h2><div class="liste">${ta.map((x) => { const sch = S.plan.find((y) => y.id === x.schichtId); const z = angebotZeit(x); const chk = L.tauschPruefen(S, x, x.nehmerId, x.gegenId); const g = x.gegenId && S.plan.find((y) => y.id === x.gegenId);
        return `<div class="karte"><p><b>${esc(name(person(x.vonId)))}</b> → <b>${esc(name(person(x.nehmerId)))}</b></p>
          <p>${datumLang(sch.datum)} · ${L.schicht(sch.schicht).name} ${L.minZuZeit(z.start)}–${L.minZuZeit(z.ende)}${x.teil ? " (nur diese Stunden)" : ""}</p>
          ${g ? `<p>Im Tausch gegen: ${datumLang(g.datum)} · ${planTxt(g)} in ${esc(filiale(g.filiale).kurz)}</p>` : ""}
          ${x.notiz ? `<p class="muted">${esc(x.notiz)}</p>` : ""}
          ${chk.gruende.map((t) => `<p class="hinweis rot">${esc(t)}</p>`).join("")}${chk.hinweise.map((t) => `<p class="hinweis">${esc(t)}</p>`).join("")}
          <div class="reihe"><button class="btn" data-act="tausch-ok" data-id="${x.id}" ${chk.moeglich ? "" : "disabled"}>✓ Bestätigen</button><button class="btn drei" data-act="tausch-nein" data-id="${x.id}">Ablehnen</button></div></div>`; }).join("")}</div></div>` : ""}
      <div class="abschnitt"><h2>Urlaub und andere Abwesenheiten</h2>
      <div class="liste">${a.length ? a.map((x) => { const betr = L.betroffeneSchichten(S, x.personId, x.von, x.bis).length, art = L.abwArt(x.art), p = person(x.personId);
        const tage = art.konto ? L.urlaubsTage(x.von, x.bis, S.parameter.urlaubTage) : null, k = art.konto ? L.urlaubskonto(S, p, x.von.slice(0, 4), heute(), art.konto) : null;
        const gleich = S.abwesenheiten.filter((y) => y !== x && y.status === "genehmigt" && y.bis >= x.von && y.von <= x.bis && (person(y.personId) || {}).stammfiliale === p.stammfiliale).map((y) => person(y.personId).vorname);
        return `<div class="karte"><p>${art.sym} <b>${esc(name(p))}</b>: ${esc(art.name)} vom ${L.datumKurz(x.von)} bis ${L.datumKurz(x.bis)}${tage != null ? ` · <b>${tage} Tage</b>` : ""}</p>${x.notiz ? `<p class="muted">${esc(x.notiz)}</p>` : ""}
        ${k ? `<p class="${k.rest - tage < 0 ? "hinweis rot" : "klein muted"}">Konto: Rest ${k.rest} Tage, nach Genehmigung ${k.rest - tage} Tage${k.rest - tage < 0 ? " (überzogen)" : ""}</p>` : ""}
        ${gleich.length ? `<p class="hinweis">In der Zeit auch abwesend: ${gleich.map(esc).join(", ")}</p>` : ""}
        ${betr ? `<p class="hinweis">Im Plan stehen in dieser Zeit ${betr} Schicht${betr > 1 ? "en" : ""}. Sie werden beim Genehmigen frei.</p>` : ""}
        <div class="reihe"><button class="btn" data-act="genehmigen" data-id="${x.id}">✓ Genehmigen</button><button class="btn drei" data-act="ablehnen" data-id="${x.id}">Ablehnen</button></div></div>`; }).join("") : '<p class="leer">Keine offenen Anträge. 🎉</p>'}</div></div>
      ${erledigt.length ? `<div class="abschnitt"><h2>Zuletzt entschieden</h2><div class="liste">${erledigt.map((x) => `<div class="zeile"><span class="punkt ${x.status === "genehmigt" ? "gruen" : "rot"}"></span><span>${esc(name(person(x.personId)))}<small>${L.datumKurz(x.von)} bis ${L.datumKurz(x.bis)}</small></span><span class="marke-s">${x.status}</span></div>`).join("")}</div></div>` : ""}`;
  };
  V.offen = () => {
    const f = FIL(), d = heute();
    const krank = S.abwesenheiten.filter((a) => !L.abwArt(a.art).genehmigung && a.status !== "zurueckgezogen" && a.bis >= d && L.darfInFiliale(person(a.personId), f.id));
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
    return `${titel("Team " + esc(f.kurz))}<div class="liste">${leute.map((p) => `<div class="zeile"><span class="punkt ${L.abwesenheitAm(S, p.id, heute()) ? "rot" : "gruen"}"></span><span><b>${esc(name(p))}</b><small>${L.ROLLEN[p.rolle].name}${p.stammfiliale !== f.id ? ` · Springer aus ${esc(filiale(p.stammfiliale).kurz)}` : p.springer ? ` · Springer auch in ${p.einsatzfilialen.map((x) => esc(filiale(x).kurz)).join(", ")}` : ""} · ${p.wochenstunden} Std./${p.stundenEinheit === "monat" ? "Monat" : "Woche"}</small></span><span></span></div>`).join("")}</div>`;
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
  // ----- Mitarbeiter (Handy: Liste und Formular · PC: Tabelle mit Filtern und Details rechts) -----
  const TAGE_KURZ = ["mo", "di", "mi", "do", "fr", "sa", "so"];
  const ANREISE = { auto: "Auto", oepnv: "Bus/Bahn", fahrt: "braucht Fahrt" };
  let maFilter = { fil: "alle", besch: "alle", einsatz: "alle", q: "" }, importText = "", importErgebnis = null;
  const maSichtbar = () => S.personen.filter((p) => p.stammfiliale && (zentrale() || p.stammfiliale === FIL().id));
  const beschName = (p) => (L.beschaeftigung(p.beschaeftigung) || { name: "–" }).name;
  const umfangTxt = (p) => `${p.wochenstunden || 0} Std./${p.stundenEinheit === "monat" ? "Monat" : "Woche"}`;
  function einsatzTxt(p) {
    const pr = p.profil || {}, t = [];
    const z = L.EINSATZ_ZEIT.find((x) => x.id === (pr.zeit || "flexibel"));
    t.push(pr.zeit === "morgens" ? `nur bis ${pr.bis || "?"} Uhr` : pr.zeit === "abends" ? `erst ab ${pr.ab || "?"} Uhr` : z.name);
    if (pr.tage && pr.tage.length) t.push("nur " + pr.tage.map((x) => L.TAG_NAME[x].slice(0, 2)).join(", "));
    if ((pr.nichtTage || []).length) t.push("nicht " + pr.nichtTage.map((x) => L.TAG_NAME[x].slice(0, 2)).join(", ") + (pr.nichtGrund ? ` (${pr.nichtGrund})` : ""));
    if ((pr.bereitschaft || []).length) t.push("🛎 Bereitschaft " + pr.bereitschaft.map((b) => `${L.TAG_NAME[b.tag].slice(0, 2)} ${b.von}–${b.bis}`).join(", "));
    return t.join(" · ");
  }
  function qualiStand(p) {
    const r = L.qualiAblauf({ personen: [p] }, heute(), 30);
    return r.length ? `<span class="marke-s ${r.some((x) => x.abgelaufen) ? "rot" : "gelb"}" title="${esc(r.map((x) => `${x.name} bis ${L.datumKurz(x.bis)}`).join(", "))}">${r.some((x) => x.abgelaufen) ? "abgelaufen" : "läuft ab"}</span>` : "";
  }
  function maFiltern(liste) {
    const q = maFilter.q.trim().toLowerCase();
    return liste.filter((p) => (maFilter.fil === "alle" || p.stammfiliale === maFilter.fil || (maFilter.fil === "springer" && p.springer))
      && (maFilter.besch === "alle" || (p.beschaeftigung || "") === (maFilter.besch === "ohne" ? "" : maFilter.besch))
      && (maFilter.einsatz === "alle" || (maFilter.einsatz === "bereitschaft" ? ((p.profil || {}).bereitschaft || []).length : ((p.profil || {}).zeit || "flexibel") === maFilter.einsatz))
      && (!q || name(p).toLowerCase().includes(q)));
  }
  function rollenWahl(p) {
    const eigen = L.ROLLEN[rolle()].stufe;
    const r = Object.entries(L.ROLLEN).filter(([k, x]) => !L.UEBERGREIFEND.includes(k) && (zentrale() || x.stufe < eigen || k === p.rolle));
    const fest = !zentrale() && L.ROLLEN[p.rolle].stufe >= eigen;
    return `<select id="m-rolle" ${fest ? "disabled" : ""}>${r.map(([k, x]) => `<option value="${k}" ${p.rolle === k ? "selected" : ""}>${x.name}</option>`).join("")}</select>`;
  }
  function maForm(p) {
    const pr = p.profil || {}, ue = p.ueberschreiten || {}, si = p.springerInfo || {};
    const ber = [...(pr.bereitschaft || [])]; while (ber.length < 3) ber.push({ tag: "", von: "", bis: "" });
    const tagChips = (attr, wahl) => `<div class="wahl">${TAGE_KURZ.map((t) => `<label class="tagwahl"><input type="checkbox" ${attr}="${t}" ${(wahl || []).includes(t) ? "checked" : ""}><span>${L.TAG_NAME[t].slice(0, 2)}</span></label>`).join("")}</div>`;
    const q = (id) => (p.quali || []).find((x) => x.art === id);
    const sperreUe = p.beschaeftigung === "minijob" || p.unter18;
    return `<div class="karte ma-form">
      <div class="gitter2"><div class="feld"><label for="m-vor">Vorname</label><input type="text" id="m-vor" value="${esc(p.vorname)}"></div><div class="feld"><label for="m-nach">Nachname</label><input type="text" id="m-nach" value="${esc(p.nachname)}"></div></div>
      <div class="gitter2"><div class="feld"><label for="m-rolle">Rolle in der App</label>${rollenWahl(p)}</div>
        <div class="feld"><label for="m-stamm">Stammfiliale</label><select id="m-stamm" ${zentrale() ? "" : "disabled"}>${S.filialen.map((f) => `<option value="${f.id}" ${p.stammfiliale === f.id ? "selected" : ""}>${esc(f.name)}</option>`).join("")}</select></div></div>
      <h3>Beschäftigung</h3>
      <div class="feld"><label for="m-besch">Beschäftigungsart</label><select id="m-besch"><option value="">noch nicht angegeben</option>${L.BESCHAEFTIGUNG.map((b) => `<option value="${b.id}" ${p.beschaeftigung === b.id ? "selected" : ""}>${b.name}</option>`).join("")}</select>
        ${L.beschaeftigung(p.beschaeftigung) && L.beschaeftigung(p.beschaeftigung).hinweis ? `<span class="klein muted">${esc(L.beschaeftigung(p.beschaeftigung).hinweis)}</span>` : ""}</div>
      <div class="gitter2"><div class="feld"><label for="m-eintritt">Eintritt</label><input type="date" id="m-eintritt" value="${esc(p.eintritt || "")}"></div><div class="feld"><label for="m-befristet">befristet bis</label><input type="date" id="m-befristet" value="${esc(p.befristetBis || "")}"></div></div>
      <label class="haken"><input type="checkbox" id="m-u18" ${p.unter18 ? "checked" : ""}><span><b>unter 18 Jahre</b> (Jugendschutz: höchstens 8 Std. am Tag, 40 in der Woche, 5 Tage, abends Grenze)</span></label>
      <label class="haken" style="margin-left:28px"><input type="checkbox" id="m-ab16" ${p.ab16 ? "checked" : ""}><span>schon 16 (abends bis 22 Uhr statt 20 Uhr)</span></label>
      <h3>Stunden</h3>
      <div class="gitter2"><div class="feld"><label for="m-std">Stundenumfang laut Vertrag</label><input type="number" id="m-std" min="0" max="200" step="0.5" value="${p.wochenstunden || 0}"></div>
        <div class="feld"><label for="m-einheit">je</label><select id="m-einheit"><option value="woche" ${p.stundenEinheit !== "monat" ? "selected" : ""}>Woche</option><option value="monat" ${p.stundenEinheit === "monat" ? "selected" : ""}>Monat</option></select></div></div>
      <div class="ueber-box"><label class="haken"><input type="checkbox" id="m-ueber" ${ue.erlaubt ? "checked" : ""}><span><b>Darf Stunden überschreiten</b></span></label>
        <div class="reihe"><span>bis</span><input type="number" id="m-ueberstd" min="0" max="40" step="0.5" value="${ue.bisStd || 0}" style="width:90px" aria-label="Stunden über dem Umfang"><span>Std. ohne Rückfrage</span></div>
        <p class="klein muted">${sperreUe ? "⚠️ Bei Minijob und unter 18 gilt das nicht: Die App fragt trotzdem. " : ""}Die 10 Std. am Tag gelten immer.</p></div>
      <h3>Einsatz: wann?</h3>
      <div class="gitter2"><div class="feld"><label for="m-pzeit">Zeit</label><select id="m-pzeit">${L.EINSATZ_ZEIT.map((z) => `<option value="${z.id}" ${(pr.zeit || "flexibel") === z.id ? "selected" : ""}>${z.name}</option>`).join("")}</select></div>
        <div class="gitter2"><div class="feld"><label for="m-pbis">bis Uhr</label><input type="time" id="m-pbis" value="${esc(pr.bis || "")}"></div><div class="feld"><label for="m-pab">ab Uhr</label><input type="time" id="m-pab" value="${esc(pr.ab || "")}"></div></div></div>
      <div class="feld"><span class="lbl">Nur an diesen Tagen (nichts gewählt = alle Tage)</span>${tagChips("data-ptag", pr.tage)}</div>
      <div class="feld"><span class="lbl">Nicht an diesen Tagen</span>${tagChips("data-pnicht", pr.nichtTage)}<input type="text" id="m-pgrund" maxlength="40" placeholder="Grund, z. B. Berufsschule" value="${esc(pr.nichtGrund || "")}"></div>
      <div class="feld"><span class="lbl">🛎 Bereitschaftsdienst (kann kurzfristig einspringen)</span>
        ${ber.map((b, i) => `<div class="ber-zeile"><select data-ber="${i}|tag" aria-label="Tag"><option value="">–</option>${TAGE_KURZ.map((t) => `<option value="${t}" ${b.tag === t ? "selected" : ""}>${L.TAG_NAME[t]}</option>`).join("")}</select><input type="time" data-ber="${i}|von" value="${esc(b.von)}" aria-label="von"><span>–</span><input type="time" data-ber="${i}|bis" value="${esc(b.bis)}" aria-label="bis"></div>`).join("")}</div>
      <p class="klein muted">Das Profil ist die feste Regel: Der Planvorschlag hält sich daran, beim Einteilen von Hand fragt die App nach. Dienstwünsche gelten nur für eine Woche.</p>
      <h3>Springer</h3>
      <label class="haken"><input type="checkbox" id="m-springer" ${p.springer ? "checked" : ""}><span><b>Springer</b>: darf in anderen Filialen aushelfen</span></label>
      ${S.filialen.filter((f) => f.id !== p.stammfiliale).map((f) => { const x = si[f.id] || {}; return `<div class="spr-zeile"><label class="haken"><input type="checkbox" data-einsatz="${f.id}" ${p.einsatzfilialen.includes(f.id) ? "checked" : ""}><span>${esc(f.kurz)}</span></label>
        <select data-anreise="${f.id}" aria-label="Anreise ${esc(f.kurz)}"><option value="">Anreise</option>${Object.entries(ANREISE).map(([k, n]) => `<option value="${k}" ${x.anreise === k ? "selected" : ""}>${n}</option>`).join("")}</select>
        <input type="number" data-minuten="${f.id}" min="0" max="300" value="${x.minuten != null ? x.minuten : ""}" placeholder="Min." aria-label="Fahrzeit in Minuten ${esc(f.kurz)}"></div>`; }).join("")}
      <h3>Urlaub</h3>
      <div class="gitter3"><div class="feld"><label for="m-urlaub">Anspruch (Tage)</label><input type="number" id="m-urlaub" min="0" max="40" value="${p.urlaubsanspruch != null ? p.urlaubsanspruch : 30}"></div>
        <div class="feld"><label for="m-uebertrag">Übertrag</label><input type="number" id="m-uebertrag" min="0" max="40" value="${p.urlaubUebertrag || 0}"></div>
        <div class="feld"><label for="m-bildung">Bildungsurlaub</label><input type="number" id="m-bildung" min="0" max="10" value="${p.bildungsurlaub != null ? p.bildungsurlaub : 5}"></div></div>
      <h3>Qualifikationen</h3>
      ${L.QUALI.map((x) => { const v = q(x.id); return `<div class="spr-zeile"><label class="haken"><input type="checkbox" data-quali="${x.id}" ${v ? "checked" : ""}><span>${x.name}</span></label><input type="date" data-qbis="${x.id}" value="${esc((v && v.bis) || "")}" aria-label="${x.name} gültig bis"><span class="klein muted">${v && v.bis ? (v.bis < heute() ? "⚠️ abgelaufen" : v.bis <= L.plusTage(heute(), 30) ? "läuft bald ab" : "gültig") : "ohne Ablauf"}</span></div>`; }).join("")}
      <label class="haken"><input type="checkbox" id="m-aktiv" ${p.aktiv !== false ? "checked" : ""}><span>aktiv (ausgetretene Mitarbeiter abwählen)</span></label>
      <p class="klein muted">Steuer-ID, Sozialversicherungsnummer, IBAN und Gehalt gehören nicht in die App. Diese Daten bleiben beim Steuerberater.</p>
      <button class="btn gross" data-act="ma-speichern" data-id="${p.id}">Speichern</button></div>`;
  }
  function maTabelle(liste, wahl) {
    return `<div class="karte tab-karte"><table class="pc-tab"><thead><tr><th>Name · Filiale · Rolle</th><th>Beschäftigung</th><th>Umfang</th><th>Einsatz</th><th>Urlaub</th></tr></thead><tbody>
      ${liste.map((p) => { const k = L.urlaubskonto(S, p, heute().slice(0, 4), heute()); return `<tr class="${wahl && wahl.id === p.id ? "gewaehlt" : ""} ${p.aktiv === false ? "inaktiv" : ""}" data-go="ma" data-arg="${p.id}" tabindex="0">
        <td><b>${esc(name(p))}</b> ${qualiStand(p)}<small>${esc((filiale(p.stammfiliale) || {}).kurz || "")} · ${L.ROLLEN[p.rolle].name}</small></td>
        <td>${esc(beschName(p))}${p.unter18 ? ' <span class="marke-s gelb">u18</span>' : ""}</td>
        <td class="z">${umfangTxt(p)}${L.darfUeberschreiten(p) ? ` <span class="marke-s gruen" title="darf überschreiten">+${L.darfUeberschreiten(p)}</span>` : ""}</td>
        <td>${esc(einsatzTxt(p))}${p.springer ? `<small>🔁 Springer: ${p.einsatzfilialen.map((x) => esc((filiale(x) || {}).kurz || x)).join(", ")}</small>` : ""}</td>
        <td class="z">${p.urlaubsanspruch ? `${k.rest} Tage` : "–"}</td></tr>`; }).join("") || '<tr><td colspan="5" class="leer">Niemand passt zum Filter.</td></tr>'}</tbody></table></div>`;
  }
  function maFilterLeiste() {
    const sel = (k, opts, lbl) => `<label class="filter"><span>${lbl}</span><select data-mafilter="${k}">${opts.map(([v, t]) => `<option value="${v}" ${maFilter[k] === v ? "selected" : ""}>${t}</option>`).join("")}</select></label>`;
    return `<div class="reihe filterleiste">
      ${zentrale() ? sel("fil", [["alle", "alle Filialen"], ...S.filialen.map((f) => [f.id, f.kurz]), ["springer", "nur Springer"]], "Filiale") : ""}
      ${sel("besch", [["alle", "alle"], ...L.BESCHAEFTIGUNG.map((b) => [b.id, b.name]), ["ohne", "nicht angegeben"]], "Beschäftigung")}
      ${sel("einsatz", [["alle", "alle"], ...L.EINSATZ_ZEIT.map((z) => [z.id, z.name]), ["bereitschaft", "mit Bereitschaft"]], "Einsatz")}
      <label class="filter"><span>Suche</span><input type="search" data-mafilter="q" value="${esc(maFilter.q)}" placeholder="Name"></label></div>`;
  }
  function qualiKarte(liste) {
    const r = L.qualiAblauf({ personen: liste }, heute(), 30);
    if (!r.length) return "";
    return `<div class="hinweis">🎓 <b>Qualifikationen:</b> ${r.slice(0, 6).map((x) => `${esc(x.person.vorname)} – ${esc(x.name)} ${x.abgelaufen ? "<b>abgelaufen</b> seit" : "bis"} ${L.datumKurz(x.bis)}`).join(" · ")}${r.length > 6 ? ` · und ${r.length - 6} weitere` : ""}</div>`;
  }
  V.ma = () => {
    const alle = maSichtbar(), liste = maFiltern(alle);
    const kopfZeile = `${titel(zentrale() ? "Mitarbeiter" : "Mitarbeiter " + esc(FIL().kurz))}${breit() ? "" : frootie(FROOTIE_TIPPS.ma)}
      <div class="reihe"><button class="btn zwei" data-act="ma-neu">+ Mitarbeiter anlegen</button><button class="btn drei" data-go="ma-import">⬆️ Aus Excel einlesen</button><span class="klein muted">${liste.length} von ${alle.length}</span></div>
      ${qualiKarte(alle)}${maFilterLeiste()}`;
    if (breit()) {
      const wahl = person(arg) && alle.includes(person(arg)) ? person(arg) : null;
      return `${kopfZeile}<div class="ma-pc">${maTabelle(liste, wahl)}<div class="ma-detail">${wahl ? `<h2>${esc(name(wahl))}</h2>${maForm(wahl)}` : `<div class="karte"><p class="muted">Klicke links auf eine Person, um sie hier zu bearbeiten.</p></div>`}</div></div>`;
    }
    const gruppen = zentrale() ? S.filialen : [FIL()];
    return `${kopfZeile}${gruppen.map((f) => { const l = liste.filter((p) => p.stammfiliale === f.id); return l.length ? `<div class="abschnitt"><h2>${esc(f.name)}</h2><div class="liste">${l.map((p) => `<button class="zeile" data-go="ma-edit" data-arg="${p.id}"><span class="punkt ${p.aktiv === false ? "" : "gruen"}"></span><span><b>${esc(name(p))}</b> ${qualiStand(p)}<small>${L.ROLLEN[p.rolle].name} · ${esc(beschName(p))} · ${umfangTxt(p)}${L.darfUeberschreiten(p) ? ` (+${L.darfUeberschreiten(p)})` : ""} · ${esc(einsatzTxt(p))}${p.springer ? ` · 🔁 ${p.einsatzfilialen.map((x) => esc(filiale(x).kurz)).join(", ") || "keine Filiale gewählt"}` : ""}</small></span><span>›</span></button>`).join("")}</div></div>` : ""; }).join("") || '<p class="leer">Niemand passt zum Filter.</p>'}`;
  };
  V["ma-edit"] = () => {
    const p = person(arg);
    if (!p || !maSichtbar().includes(p)) return `${titel("Mitarbeiter", "ma")}<p class="leer">Nicht gefunden.</p>`;
    if (breit()) return V.ma();
    return `${titel(esc(name(p)), "ma")}${maForm(p)}`;
  };
  const IMPORT_VORLAGE = "Vorname;Nachname;Filiale;Rolle;Beschäftigung;Stunden;Einheit;Urlaub\nMax;Beispiel;Ochtrup;Aushilfe;Minijob;40;Monat;20\nErika;Muster;Oberhausen;Mitarbeiter;Teilzeit;25;Woche;30\n";
  V["ma-import"] = () => {
    const r = importErgebnis;
    const ok = r ? r.zeilen.filter((z) => z.person && !z.doppelt && (zentrale() || z.person.stammfiliale === FIL().id)) : [];
    return `${titel("Mitarbeiter aus Excel einlesen", "ma")}
      <div class="karte"><p>So geht es: In Excel <b>Datei → Speichern unter → CSV (Trennzeichen-getrennt)</b> wählen und die Datei hier auswählen. Oder die Zeilen in Excel markieren, kopieren und unten einfügen.</p>
        <p class="klein muted">Spalten in dieser Reihenfolge oder mit dieser Kopfzeile: ${L.IMPORT_SPALTEN.map((x) => `<code>${x}</code>`).join(" ")}. Excel-Dateien (.xlsx) direkt gehen noch nicht, nur CSV oder Kopieren und Einfügen.</p>
        <div class="reihe"><label class="btn drei datei">📄 CSV-Datei wählen<input type="file" id="imp-datei" accept=".csv,.txt,text/csv" hidden></label><button class="btn drei" data-act="imp-vorlage">⬇️ Vorlage herunterladen</button></div>
        <div class="feld"><label for="imp-text">Daten</label><textarea id="imp-text" rows="7" placeholder="${esc(IMPORT_VORLAGE)}">${esc(importText)}</textarea></div>
        <button class="btn zwei" data-act="imp-pruefen">Prüfen</button></div>
      ${r ? `<div class="karte"><h2>Vorschau</h2>${r.fehlerGesamt ? `<p class="hinweis">${esc(r.fehlerGesamt)}</p>` : `<div class="tab-karte"><table class="pc-tab"><thead><tr><th>Zeile</th><th>Name</th><th>Filiale · Rolle</th><th>Beschäftigung · Umfang</th><th>Ergebnis</th></tr></thead><tbody>
        ${r.zeilen.map((z) => { const fremd = z.person && !zentrale() && z.person.stammfiliale !== FIL().id; return `<tr><td>${z.nr}</td><td>${z.person ? esc(z.person.vorname + " " + z.person.nachname) : "–"}</td><td>${z.person ? `${esc(filiale(z.person.stammfiliale).kurz)} · ${L.ROLLEN[z.person.rolle].name}` : ""}</td><td>${z.person ? `${esc((L.beschaeftigung(z.person.beschaeftigung) || { name: "–" }).name)} · ${z.person.wochenstunden} Std./${z.person.stundenEinheit === "monat" ? "Monat" : "Woche"}` : ""}</td>
          <td>${z.fehler.length ? `<span class="marke-s rot">${esc(z.fehler.join(", "))}</span>` : z.doppelt ? '<span class="marke-s gelb">gibt es schon, wird übersprungen</span>' : fremd ? '<span class="marke-s gelb">andere Filiale, wird übersprungen</span>' : '<span class="marke-s gruen">wird angelegt</span>'}</td></tr>`; }).join("")}</tbody></table></div>
        <button class="btn gross" data-act="imp-ok" ${ok.length ? "" : "disabled"}>${ok.length} Mitarbeiter anlegen</button><p class="klein muted">Einsatzprofil, Springer und Qualifikationen danach je Person ergänzen.</p>`}</div>` : ""}`;
  };
  const LAENDER = { BW: "Baden-Württemberg", BY: "Bayern", BE: "Berlin", BB: "Brandenburg", HB: "Bremen", HH: "Hamburg", HE: "Hessen", MV: "Mecklenburg-Vorpommern", NI: "Niedersachsen", NW: "Nordrhein-Westfalen", RP: "Rheinland-Pfalz", SL: "Saarland", SN: "Sachsen", ST: "Sachsen-Anhalt", SH: "Schleswig-Holstein", TH: "Thüringen" };
  const oeffnungKurz = (f) => { if (f.art === "mobil") return "nach Einsätzen"; const z = f.oeffnung || {}; const mo = z.mo; return mo ? `Mo ${mo[0]}–${mo[1]}${z.sa && JSON.stringify(z.sa) !== JSON.stringify(mo) ? ` · Sa ${z.sa[0]}–${z.sa[1]}` : ""}${z.so ? ` · So ${z.so[0]}–${z.so[1]}` : " · So zu"}` : "?"; };
  V.filialen = () => `${titel("Filialen")}${breit() ? "" : frootie(FROOTIE_TIPPS.filialen)}
    ${breit() ? `<div class="karte tab-karte"><table class="pc-tab"><thead><tr><th>Filiale</th><th>Art</th><th>Bundesland</th><th>Öffnung</th><th>Sortiment</th><th>Matrix</th><th>Team</th></tr></thead><tbody>${S.filialen.map((f) => `<tr><td><b>${esc(f.kurz)}</b>${f.pilot ? ' <span class="marke-s gruen">Pilot</span>' : ""}<small>${esc(f.name)}</small></td><td>${f.art === "mobil" ? "mobiler Stand" : "Shop"}</td><td>${f.bundesland ? esc(LAENDER[f.bundesland]) : f.art === "mobil" ? "je Einsatzort" : '<span class="marke-s gelb">fehlt</span>'}</td><td>${esc(oeffnungKurz(f))}</td><td>${sortiment(f).length} Warengruppen</td><td>${f.matrix && Object.keys(f.matrix).length ? '<span class="marke-s gruen">✓</span>' : '<span class="marke-s gelb">fehlt</span>'}</td><td class="z">${S.personen.filter((p) => p.stammfiliale === f.id && p.aktiv !== false).length}</td></tr>`).join("")}</tbody></table></div>` : ""}
    ${S.filialen.map((f) => `<div class="karte"><div class="reihe zw"><h2>${esc(f.name)}</h2><span>${f.pilot ? '<span class="marke-s gruen">Pilot</span> ' : ""}<span class="marke-s">${esc(f.marke || "")}</span></span></div>
    <div class="feld"><label for="land-${f.id}">Bundesland (für Feiertage)</label><select id="land-${f.id}" data-land="${f.id}"><option value="">${f.art === "mobil" ? "je Einsatzort" : "bitte wählen"}</option>${Object.entries(LAENDER).map(([k, n]) => `<option value="${k}" ${f.bundesland === k ? "selected" : ""}>${n}</option>`).join("")}</select></div>
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
      <button class="zeile" data-go="admin-pinnwand"><span style="font-size:1.4rem">📌</span><span><b>Pinnwand-Einstellungen</b><small>Zettel je Person, Zeichen, Erinnerungen</small></span><span>›</span></button>
      <p class="hinweis">Jeder Franchisenehmer arbeitet mit seiner <b>eigenen Datenbank</b>. Hier stehen nur die öffentlichen Verbindungsdaten. Geheime Schlüssel trägt der Betreiber selbst in sein Supabase-Projekt ein.</p>
      <button class="btn zwei" data-act="betreiber-neu">+ Franchisenehmer anlegen</button>
      <div class="liste">${B.map((b) => { const st = L.betreiberStand(b), [t, f] = STAND_TXT(b, st), fil = S.filialen.filter((x) => x.betreiber === b.id);
        return `<button class="zeile" data-go="admin-edit" data-arg="${b.id}"><span class="punkt ${f}"></span><span><b>${esc(b.name)}</b> <span class="marke-s">${b.art === "eigen" ? "eigene Filialen" : "Franchise"}</span>
          <small>${fil.length ? fil.map((x) => esc(x.kurz)).join(", ") : "noch keine Filialen"} · ${st.anzahl} von ${st.gesamt} Schritten · ${st.verbindung.ref ? "Projekt " + esc(st.verbindung.ref) : "keine Datenbank eingetragen"}</small></span><span class="marke-s ${f}">${t}</span></button>`; }).join("")}</div>`;
  };
  V["admin-pinnwand"] = () => { const e = L.pinEinstellungen(S);
    return `${titel("Pinnwand-Einstellungen", "admin")}<div class="karte">
      <div class="gitter2"><div class="feld"><label for="pe-max">Zettel je Person gleichzeitig</label><input type="number" id="pe-max" min="1" max="20" value="${e.maxZettel}"></div>
        <div class="feld"><label for="pe-zeichen">Zeichen je Zettel</label><input type="number" id="pe-zeichen" min="50" max="500" value="${e.zeichen}"></div></div>
      <div class="gitter2"><div class="feld"><label for="pe-erinnern">Verfasser erinnern nach (Tagen)</label><input type="number" id="pe-erinnern" min="1" max="60" value="${e.erinnernTage}"></div>
        <div class="feld"><label for="pe-pause">„Hängen lassen“ fragt wieder nach (Tagen)</label><input type="number" id="pe-pause" min="1" max="60" value="${e.pauseTage}"></div></div>
      <p class="klein muted">Shopleitung und Stellvertretung haben keine Grenze bei der Zahl der Zettel. Sie und der Inhaber dürfen jeden Zettel ihrer Filiale verwalten.</p>
      <button class="btn gross" data-act="pin-einst">Speichern</button></div>`; };
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


  // ---------- Büro: Regal mit Ordnern je Rolle, Grafik- & Druckstudio, Ablage ----------
  const BILD = { logo: "logo.svg", frootie: "frootie.svg" };
  const bueroOrdner = () => B.ORDNER.filter((o) => B.darfOrdner(S, rolle(), o.id));
  const darfO = (id) => B.darfOrdner(S, rolle(), id);
  const ablage = () => (S.buero = S.buero || { ablage: [], adressen: [], personal: {}, rechte: {} }).ablage;
  let druckEntwurf = null, briefEntwurf = null;
  // Verkleinert die Schrift von Tabellen und Texten, bis alles aufs Blatt passt (nichts wird abgeschnitten).
  function einpassen(wurzel) {
    for (const blatt of (wurzel || document).querySelectorAll(".druckblatt:not(.bericht)")) {
      const rumpf = blatt.querySelector(".dp-rumpf"); if (!rumpf) continue;
      const ziel = rumpf.querySelector("table") || rumpf.querySelector(".dp-text"); if (!ziel) continue;
      const breite = blatt.getBoundingClientRect().width || 1;
      let px = parseFloat(getComputedStyle(ziel).fontSize), n = 0;
      while (rumpf.scrollHeight > rumpf.clientHeight + 1 && px > breite * 0.008 && n++ < 40) { px *= 0.92; ziel.style.fontSize = (px / breite * 100).toFixed(3) + "cqw"; }
    }
  }
  function drucken(html, quer) {
    let bereich = $("#druckbereich");
    if (!bereich) { bereich = document.createElement("div"); bereich.id = "druckbereich"; document.body.appendChild(bereich); }
    // Erst unsichtbar in A4-Breite messen und einpassen, dann in den Druckbereich legen.
    const mess = document.createElement("div");
    mess.style.cssText = "position:fixed;left:-99999px;top:0;width:794px;container-type:inline-size;";
    mess.innerHTML = html; document.body.appendChild(mess); einpassen(mess);
    html = mess.innerHTML; mess.remove();
    bereich.innerHTML = html;
    let st = $("#druckseite"); if (!st) { st = document.createElement("style"); st.id = "druckseite"; document.head.appendChild(st); }
    st.textContent = `@page { size: A4 ${quer ? "landscape" : "portrait"}; margin: 0; }`;
    setTimeout(() => { try { window.print(); } catch (e) { meldung("Drucken ist hier nicht möglich"); } }, 80);
  }
  V.buero = () => {
    const ord = bueroOrdner();
    return `${titel("Büro")}${frootie(FROOTIE_TIPPS.buero)}
      <div class="regal">${ord.map((o) => `<button class="ordner" data-go="${o.id === "studio" ? "studio" : "ordner"}" data-arg="${o.id}" style="--o:${o.farbe}"><span class="ruecken"><span class="loch"></span><span class="schild">${o.sym}<b>${esc(o.t)}</b></span></span><span class="o-text">${esc(o.u)}</span></button>`).join("")}</div>
      <p class="klein muted">${zentrale() ? `Du siehst alle ${B.ORDNER.length} Ordner. Shopleitungen sehen ${B.ORDNER.filter((o) => B.darfOrdner(S, "shopleitung", o.id)).length}.` : `${ord.length} Ordner für dich freigegeben.`}</p>`;
  };
  V.studio = () => {
    if (!darfO("studio")) return V.buero();
    const f = FIL(), gesp = ablage().filter((x) => x.ordner === "studio" && !x.entfernt && (zentrale() || x.filiale === f.id || x.filiale === null)).sort((a, b) => b.zeit.localeCompare(a.zeit));
    return `${titel("Grafik & Druck", "buero")}${frootie(FROOTIE_TIPPS.studio)}
      <div class="abschnitt"><h2>Neues Blatt</h2><div class="kacheln">${B.VORLAGEN.map((v) => `<button class="kachel" data-act="druck-neu" data-v="${v.id}"><span class="sym">${v.sym}</span><b>${esc(v.t)}</b><span>${esc(v.u)}</span></button>`).join("")}</div></div>
      <div class="abschnitt"><h2>Gespeicherte Blätter (${gesp.length})</h2><div class="liste">${gesp.map((x) => { const v = B.VORLAGEN.find((y) => y.id === x.daten.vorlage) || {};
        return `<div class="zeile"><span style="font-size:1.4rem">${v.sym || "📄"}</span><span><b>${esc(x.titel)}</b><small>${esc(v.t || "")} · ${x.filiale ? esc(filiale(x.filiale).kurz) : "alle Filialen"} · ${L.datumKurz(x.zeit.slice(0, 10))} · ${esc(name(person(x.vonId)))}</small></span>
          <span class="reihe"><button class="chip" data-act="druck-oeffnen" data-id="${x.id}">öffnen</button><button class="chip" data-act="druck-direkt" data-id="${x.id}">🖨️</button></span></div>`; }).join("") || '<p class="leer">Noch nichts gespeichert.</p>'}</div></div>`;
  };
  V["druck-edit"] = () => {
    const d = druckEntwurf; if (!d) return V.studio();
    const f = FIL(), v = B.VORLAGEN.find((x) => x.id === d.vorlage);
    const feld = (k, t, art) => !v.felder.includes(k) ? "" : art === "area" ? `<div class="feld"><label for="dk-${k}">${t}</label><textarea id="dk-${k}" data-druck="${k}" rows="${k === "posten" ? 8 : 4}">${esc(d[k] || "")}</textarea></div>` : `<div class="feld"><label for="dk-${k}">${t}</label><input type="text" id="dk-${k}" data-druck="${k}" value="${esc(d[k] || "")}" maxlength="${k === "titel" ? 60 : 160}"></div>`;
    return `${titel(v.sym + " " + esc(v.t), "studio")}
      <div class="studio">
        <div class="studio-form karte">
          ${feld("titel", "Überschrift")}${feld("untertitel", "Unterzeile")}
          ${feld("posten", "Artikel · eine Zeile je Artikel: Name | Größe | Preis (Preis leer = „… €“)", "area")}
          ${feld("text", d.vorlage === "oeffnung" ? (f.art === "mobil" ? "Einsätze (aus der Filiale übernommen, änderbar)" : "Zeiten (aus der Filiale übernommen, änderbar)") : "Text", "area")}
          ${feld("preis", "Preis (z. B. 3,90)")}${feld("fuss", "Fußzeile")}
          <div class="feld"><span class="lbl">Format</span><div class="wahl"><button class="${d.format === "hoch" ? "an" : ""}" data-act="druck-opt" data-k="format" data-w="hoch">▯ Hochformat</button><button class="${d.format === "quer" ? "an" : ""}" data-act="druck-opt" data-k="format" data-w="quer">▭ Querformat</button></div></div>
          <div class="feld"><span class="lbl">Farbe</span><div class="wahl">${Object.entries(B.FARBEN).map(([k, x]) => `<button class="${d.farbe === k ? "an" : ""}" data-act="druck-opt" data-k="farbe" data-w="${k}"><span class="farbpunkt" style="background:${x.haupt}"></span> ${esc(x.name)}</button>`).join("")}</div></div>
          <div class="feld"><span class="lbl">Symbol</span><div class="wahl">${B.SYMBOLE.map((x) => `<button class="${d.symbol === x ? "an" : ""}" data-act="druck-opt" data-k="symbol" data-w="${x}">${x || "ohne"}</button>`).join("")}</div></div>
          <label class="haken"><input type="checkbox" id="dk-frootie" ${d.frootie !== false ? "checked" : ""}><span>Frootie unten rechts</span></label>
          <div class="reihe"><button class="btn" data-act="druck-drucken">🖨️ Drucken</button><button class="btn zwei" data-act="druck-speichern">💾 Speichern</button>${d.id ? `<button class="btn drei" data-act="druck-loeschen">Löschen</button>` : ""}</div>
          <p class="klein muted">Drucken öffnet den Druckdialog. Dort kannst du auch „Als PDF speichern“ wählen und das Blatt per E-Mail schicken.</p>
        </div>
        <div class="studio-vorschau"><div class="vorschau-rahmen ${d.format}">${B.blattHtml(S, d, f, BILD)}</div></div>
      </div>`;
  };
  V.ordner = () => {
    const id = arg, o = B.ORDNER.find((x) => x.id === id);
    if (!o || !darfO(id)) return V.buero();
    const f = FIL(), kopf = `${titel(o.sym + " " + esc(o.t), "buero")}`;
    if (id === "shop" || id === "zentrale") {
      const docs = ablage().filter((x) => x.ordner === id && !x.entfernt && (id === "zentrale" || x.filiale === f.id)).sort((a, b) => b.zeit.localeCompare(a.zeit));
      return `${kopf}<p class="muted">${id === "shop" ? `Unterlagen für ${esc(f.kurz)}: Arbeitsanweisungen, Geräte, Center, Sonstiges.` : "Unterlagen der Geschäftsführung. Nur der Inhaber sieht diesen Ordner."}</p>
        <div class="karte"><div class="gitter2"><div class="feld"><label for="bd-titel">Titel</label><input type="text" id="bd-titel" maxlength="80"></div>
          <div class="feld"><label for="bd-kat">Art</label><select id="bd-kat">${["Anweisung", "Gerät", "Center", "Lieferant", "Notiz", "Sonstiges"].map((k) => `<option>${k}</option>`).join("")}</select></div></div>
          <div class="feld"><label for="bd-text">Inhalt</label><textarea id="bd-text" rows="3"></textarea></div>
          <button class="btn zwei" data-act="bd-neu" data-o="${id}">+ Ablegen</button><p class="klein muted">Dateien und Fotos anhängen geht mit dem Server.</p></div>
        <div class="liste">${docs.map((x) => `<div class="karte"><div class="reihe zw"><b>${esc(x.titel)}</b><span class="marke-s">${esc(x.kategorie || "")}</span></div><p>${esc(x.text || "").split("\n").join("<br>")}</p>
          <div class="reihe zw"><span class="klein muted">${esc(name(person(x.vonId)))} · ${L.datumKurz(x.zeit.slice(0, 10))}</span><button class="chip" data-act="bd-weg" data-id="${x.id}">entfernen</button></div></div>`).join("") || '<p class="leer">Noch nichts abgelegt.</p>'}</div>`;
    }
    if (id === "adressen") {
      const ad = S.buero.adressen.filter((a) => !a.entfernt && (!a.filiale || zentrale() || a.filiale === f.id)).sort((a, b) => a.kategorie.localeCompare(b.kategorie) || a.firma.localeCompare(b.firma));
      return `${kopf}<p class="muted">Wichtige Kontakte. Nummern antippen zum Markieren und Kopieren.</p>
        ${zentrale() || leitung() ? `<div class="karte"><div class="gitter2"><div class="feld"><label for="ad-firma">Firma</label><input type="text" id="ad-firma" maxlength="80"></div><div class="feld"><label for="ad-kat">Art</label><select id="ad-kat">${["Techniker", "Lieferant", "Center", "Hygiene", "Steuerberater", "Sonstige"].map((k) => `<option>${k}</option>`).join("")}</select></div></div>
          <div class="gitter2"><div class="feld"><label for="ad-tel">Telefon</label><input type="text" id="ad-tel" maxlength="40"></div><div class="feld"><label for="ad-mail">E-Mail</label><input type="text" id="ad-mail" maxlength="80"></div></div>
          <div class="feld"><label for="ad-notiz">Notiz</label><input type="text" id="ad-notiz" maxlength="120"></div>
          <label class="haken"><input type="checkbox" id="ad-alle" ${zentrale() ? "checked" : ""} ${zentrale() ? "" : "disabled"}><span>für alle Filialen${zentrale() ? "" : " (nur Inhaber)"}</span></label><button class="btn zwei" data-act="ad-neu">+ Kontakt anlegen</button></div>` : ""}
        <div class="liste">${ad.map((a) => `<div class="zeile"><span class="marke-s">${esc(a.kategorie)}</span><span><b>${esc(a.firma)}</b><small>${a.telefon ? `📞 <span class="markierbar">${esc(a.telefon)}</span>` : ""}${a.email ? ` · ✉️ <span class="markierbar">${esc(a.email)}</span>` : ""}${a.notiz ? " · " + esc(a.notiz) : ""}${a.filiale ? " · " + esc(filiale(a.filiale).kurz) : ""}</small></span>${zentrale() || (leitung() && a.filiale === f.id) ? `<button class="chip" data-act="ad-weg" data-id="${a.id}">✕</button>` : "<span></span>"}</div>`).join("")}</div>`;
    }
    if (id === "hygiene") return `${kopf}<p class="muted">Berichte für die Lebensmittelkontrolle und den Hygieneberater. Nicht erledigte Aufgaben sind markiert.</p>
      <div class="karte"><div class="feld"><span class="lbl">Filiale</span><div class="wahl">${meineFilialen().map((x) => `<button class="${x.id === f.id ? "an" : ""}" data-act="filiale" data-id="${x.id}">${esc(x.kurz)}</button>`).join("")}</div></div>
        <div class="reihe"><button class="btn" data-act="hyg-bericht" data-tage="7">🖨️ Bericht 7 Tage</button><button class="btn zwei" data-act="hyg-bericht" data-tage="30">🖨️ Bericht 30 Tage</button>${leitung() || rolle() === "qualitaet" || berater() ? '<button class="btn drei" data-go="hygkontrolle">🔍 Kontrolle ansehen</button>' : ""}</div></div>`;
    if (id === "lohn") return V.export();
    if (id === "auswertung") return V.auswertung();
    if (id === "archiv") {
      const alle = ablage().filter((x) => !x.entfernt && (zentrale() || x.ordner === "studio" || x.ordner === "shop") && (zentrale() || x.filiale === f.id || x.filiale === null)).sort((a, b) => b.zeit.localeCompare(a.zeit));
      const jahre = [...new Set(alle.map((x) => x.zeit.slice(0, 4)))];
      return `${kopf}${jahre.map((j) => `<div class="abschnitt"><h2>${j}</h2><div class="liste">${alle.filter((x) => x.zeit.startsWith(j)).map((x) => `<div class="zeile"><span style="font-size:1.3rem">${(B.ORDNER.find((o) => o.id === x.ordner) || {}).sym || "📄"}</span><span><b>${esc(x.titel)}</b><small>${esc((B.ORDNER.find((o) => o.id === x.ordner) || {}).t || "")} · ${L.datumKurz(x.zeit.slice(0, 10))} · ${x.filiale ? esc(filiale(x.filiale).kurz) : "alle"}</small></span>${x.ordner === "studio" || x.ordner === "briefe" ? `<button class="chip" data-act="druck-direkt" data-id="${x.id}">🖨️</button>` : "<span></span>"}</div>`).join("")}</div></div>`).join("") || '<p class="leer">Das Archiv ist leer.</p>'}`;
    }
    if (id === "personal") {
      const heute2 = heute(), ampel = (datum, jahre) => !datum ? ["rot", "fehlt"] : L.plusTage(datum, 365 * jahre) < heute2 ? ["rot", "fällig"] : L.plusTage(datum, 365 * jahre - 60) < heute2 ? ["gelb", "bald fällig"] : ["gruen", "ok"];
      const leute = S.personen.filter((p) => !L.UEBERGREIFEND.includes(p.rolle) && p.aktiv !== false).sort((a, b) => (a.stammfiliale || "").localeCompare(b.stammfiliale || "") || a.vorname.localeCompare(b.vorname));
      const sp = [["vertrag", "Arbeitsvertrag", 0], ["belehrung", "Belehrung § 43 IfSG", 2], ["datenschutz", "Datenschutz-Info", 0], ["schulung", "Hygieneschulung", 1]];
      return `${kopf}<p class="muted">Nur der Inhaber. Belehrung nach § 43 IfSG mindestens alle 2 Jahre, Hygieneschulung jährlich (Vorschlag).</p>
        <div class="karte"><div class="matrix-scroll"><table class="zutaten pakte"><thead><tr><td><b>Name</b></td>${sp.map(([, t]) => `<td><b>${t}</b></td>`).join("")}</tr></thead><tbody>
        ${leute.map((p) => { const a = S.buero.personal[p.id] || {}; return `<tr><td>${esc(name(p))}<br><span class="klein muted">${esc(filiale(p.stammfiliale).kurz)} · ${L.ROLLEN[p.rolle].name}</span></td>${sp.map(([k, , j]) => { const [farbe, txt] = j ? ampel(a[k], j) : (a[k] ? ["gruen", "ok"] : ["rot", "fehlt"]); return `<td><input type="date" data-pakte="${p.id}|${k}" value="${esc(a[k] || "")}" aria-label="${k} ${esc(p.vorname)}"><span class="marke-s ${farbe}">${txt}</span></td>`; }).join("")}</tr>`; }).join("")}</tbody></table></div></div>`;
    }
    if (id === "briefe") {
      if (!briefEntwurf) briefEntwurf = { an: "", betreff: "", text: "", ort: f.kurz, datum: L.datumKurz(heute()).slice(3) + heute().slice(0, 4), unterschrift: name(ICH()) };
      const b = briefEntwurf, gesp = ablage().filter((x) => x.ordner === "briefe" && !x.entfernt).sort((x, y) => y.zeit.localeCompare(x.zeit));
      return `${kopf}<div class="studio"><div class="studio-form karte">
        <div class="feld"><label for="br-an">Empfänger (Anschrift)</label><textarea id="br-an" data-brief="an" rows="4">${esc(b.an)}</textarea></div>
        <div class="gitter2"><div class="feld"><label for="br-ort">Ort</label><input type="text" id="br-ort" data-brief="ort" value="${esc(b.ort)}"></div><div class="feld"><label for="br-datum">Datum</label><input type="text" id="br-datum" data-brief="datum" value="${esc(b.datum)}"></div></div>
        <div class="feld"><label for="br-betreff">Betreff</label><input type="text" id="br-betreff" data-brief="betreff" value="${esc(b.betreff)}"></div>
        <div class="feld"><label for="br-text">Text</label><textarea id="br-text" data-brief="text" rows="8">${esc(b.text)}</textarea></div>
        <div class="feld"><label for="br-unt">Unterschrift</label><input type="text" id="br-unt" data-brief="unterschrift" value="${esc(b.unterschrift)}"></div>
        <div class="reihe"><button class="btn" data-act="brief-drucken">🖨️ Drucken</button><button class="btn zwei" data-act="brief-speichern">💾 Speichern</button><button class="btn drei" data-act="brief-neu">Neuer Brief</button></div>
        ${gesp.length ? `<div class="liste">${gesp.map((x) => `<div class="zeile"><span>✉️</span><span><b>${esc(x.titel)}</b><small>${L.datumKurz(x.zeit.slice(0, 10))}</small></span><button class="chip" data-act="brief-oeffnen" data-id="${x.id}">öffnen</button></div>`).join("")}</div>` : ""}</div>
        <div class="studio-vorschau"><div class="vorschau-rahmen hoch">${B.briefHtml(b, "frooters · " + (f.name || ""), BILD)}</div></div></div>`;
    }
    if (id === "freigaben") return `${kopf}<p class="muted">Welche Rolle sieht welchen Ordner? Der Inhaber sieht immer alle.</p>
      <div class="karte"><div class="matrix-scroll"><table class="zutaten"><thead><tr><td><b>Ordner</b></td>${B.FREIGABE_ROLLEN.map(([, t]) => `<td><b>${t}</b></td>`).join("")}</tr></thead><tbody>
      ${B.ORDNER.filter((o) => !o.fest).map((o) => `<tr><td>${o.sym} ${esc(o.t)}</td>${B.FREIGABE_ROLLEN.map(([rk]) => `<td><input type="checkbox" data-freigabe="${o.id}|${rk}" ${B.darfOrdner(S, rk, o.id) ? "checked" : ""} aria-label="${esc(o.t)} für ${rk}"></td>`).join("")}</tr>`).join("")}</tbody></table></div>
      <p class="klein muted">Personalakte, Briefe und Zentrale-Ablage enthalten vertrauliche Daten. Gib sie nur frei, wenn es wirklich nötig ist.</p></div>`;
    return V.buero();
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
    <div class="liste">${[["dienst", "🗓️ Mein Dienstplan"], ["wuensche", "📝 Dienstwünsche"], ["abwesenheit", "🏖️ Abwesenheit und Urlaubskonto"], ["stechuhr", "⏱️ Stechuhr"], ["hygiene", "🧼 Hygiene"], ["rezepte", "📖 Rezepte"], ["quiz", "🎯 Quiz"], ["plan", "📅 Einsatzplan (Leitung)"], ["hygregeln", "⚙️ Regeln & Geräte (Leitung)"], ["ma", "👤 Mitarbeiter und Springer (Zentrale)"]]
      .map(([k, t]) => `<div class="karte"><b>${t}</b><p class="muted">${FROOTIE_TIPPS[k]}</p><p class="klein muted">🎬 Video folgt</p></div>`).join("")}</div>`;
  V.info = () => `${titel("Version")}<div class="karte"><p>frooters Team-App <b>${APP_VERSION}</b> (DEV, Testversion)</p><p class="muted">Daten: ${esc(A.name)}. Alles bleibt in diesem Browser.</p><button class="btn zwei" data-act="update-pruefen">🔄 Update prüfen</button></div>`;

  let updateBand = "", wartend = null, letzteBreit = null, resizeTimer = null;
  window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (breit() !== letzteBreit) zeichnen(); }, 150); });
  // ---------- Zeichnen ----------
  function zeichnen() {
    if (!ICH()) ansicht = "login";
    let rechte = ansicht;
    const nurLeitung = ["plan", "antraege", "offen", "hygregeln", "stempelzeiten", "team", "export", "besetzung", "besetzung-tag", "matrix", "urlaubsuebersicht"];
    const nurZentrale = ["auswertung", "filialen", "admin", "admin-edit", "admin-pinnwand"];
    const nurQualitaet = ["regeln", "regel-edit", "rezeptpflege", "rezept-edit"];
    if (["buero", "ordner", "studio", "druck-edit"].includes(rechte) && !bueroOrdner().length) rechte = "start";
    if (nurLeitung.includes(rechte) && !leitung()) rechte = "start";
    if (rechte === "hygkontrolle" && !(leitung() || uebergreifend())) rechte = "start";
    if (nurZentrale.includes(rechte) && !zentrale()) rechte = "start";
    if (["ma", "ma-edit", "ma-import"].includes(rechte) && !(zentrale() || leitung())) rechte = "start";
    if (nurQualitaet.includes(rechte) && !qualitaet()) rechte = "start";
    if (berater() && ["quiz", "pinnwand"].includes(rechte)) rechte = "start";
    if (uebergreifend() && ["dienst", "wuensche", "krank", "urlaub", "abwesenheit", "stechuhr", "tausch"].includes(rechte)) rechte = "start";
    ansicht = rechte;
    const inhalt = (V[ansicht] || V.start)();
    const pc = breit(); letzteBreit = pc;
    document.body.classList.toggle("pc", pc);
    $("#app").innerHTML = `${updateBand}${kopf()}${pc ? `<div class="pc-rahmen">${pcNav()}<main>${inhalt}</main></div>` : `<main>${inhalt}</main>`}${fenster ? `<div class="fenster-hg" data-act="zu-hg"><div class="fenster" role="dialog" aria-modal="true">${fenster}</div></div>` : ""}`;
    einpassen($("#app"));
  }
  function gehe(v, a) { ansicht = v; arg = a || null; fenster = null; if (v !== "quiz") quizStand = null; zeichnen(); window.scrollTo(0, 0); try { history.replaceState(null, "", "#" + v); } catch (e) { /* egal */ } }

  // ---------- Aktionen ----------
  const AKT = {
    ich: (el) => { sitzung.ich = el.dataset.id; const p = ICH(); sitzung.filiale = p.stammfiliale || S.filialen[0].id; merke(); gehe("start"); pinNeuFenster(); if (fenster) zeichnen(); },
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
    "abw-art": (el) => { abwArtWahl = el.dataset.a; zeichnen(); },
    "abw-senden": () => {
      const von = $("#ab-von").value, bis = $("#ab-bis").value, p = ICH(), art = L.abwArt(abwArtWahl);
      if (!von || !bis || bis < von) return meldung("Bitte Zeitraum prüfen");
      if (art.genehmigung && von < heute()) return meldung("Anträge gehen nur für heute oder später");
      if (art.konto) { const k = L.urlaubskonto(S, p, von.slice(0, 4), heute(), art.konto), t = L.urlaubsTage(von, bis, S.parameter.urlaubTage); if (t === 0) return meldung("In diesem Zeitraum liegt kein Arbeitstag"); if (k.rest - k.beantragt - t < 0) meldung(`Hinweis: Konto reicht nicht (Rest ${k.rest - k.beantragt}, beantragt ${t})`); }
      const a = { id: neueId("a"), personId: p.id, art: abwArtWahl, von, bis, status: art.genehmigung ? "beantragt" : "gemeldet", notiz: $("#ab-notiz").value.trim(), zeit: jetztIso() };
      S.abwesenheiten.push(a);
      S.meldungen = S.meldungen || [];
      if (!art.genehmigung) {
        const betr = L.betroffeneSchichten(S, p.id, von, bis);
        for (const fid of new Set([p.stammfiliale, ...betr.map((x) => x.filiale)])) S.meldungen.push({ id: neueId("m"), filiale: fid, text: `${art.sym} ${name(p)}: ${art.name} (${L.datumKurz(von)}–${L.datumKurz(bis)}). ${betr.filter((x) => x.filiale === fid).length} Schicht(en) betroffen.`, zeit: jetztIso() });
        speichern(); meldung(abwArtWahl === "krank" ? "Gute Besserung! Deine Shopleitung ist informiert." : "Gemeldet. Deine Shopleitung ist informiert."); return gehe("start");
      }
      speichern(); meldung(`${art.name} beantragt. Deine Shopleitung entscheidet.`); zeichnen();
    },
    "abw-zurueck": (el) => { const a = S.abwesenheiten.find((x) => x.id === el.dataset.id); a.status = "zurueckgezogen"; speichern(); zeichnen(); },
    "ueb-alle": () => { uebFilialen = (zentrale() ? S.filialen : S.filialen.filter((f) => f.betreiber === FIL().betreiber || !f.betreiber)).map((f) => f.id); zeichnen(); },
    "ueb-fil": (el) => { const id = el.dataset.id; uebFilialen = uebFilialen.includes(id) ? uebFilialen.filter((x) => x !== id) : [...uebFilialen, id]; if (!uebFilialen.length) uebFilialen = [id]; zeichnen(); },
    "ueb-art": (el) => { uebArt = el.dataset.a; zeichnen(); },
    "ueb-ansicht": (el) => { uebAnsicht = el.dataset.a; zeichnen(); },
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
    "pin-form": () => { pinForm = { offen: true, farbe: 1, fuer: "alle", wichtig: false, personen: [], antwortAuf: null }; zeichnen(); },
    "pin-form-zu": () => { pinForm.offen = false; zeichnen(); },
    "pin-farbe": (el) => { pinFormMerken(); pinForm.farbe = Number(el.dataset.f); zeichnen(); },
    "pin-fuer": (el) => { pinFormMerken(); pinForm.fuer = el.dataset.w; zeichnen(); },
    "pin-person": (el) => { pinFormMerken(); const id = el.dataset.id; pinForm.personen = pinForm.personen.includes(id) ? pinForm.personen.filter((x) => x !== id) : [...pinForm.personen, id]; zeichnen(); },
    "pin-filter": (el) => { pinFilter = el.dataset.w; zeichnen(); },
    "pin-anheften": () => {
      pinFormMerken();
      const F = pinForm, e = L.pinEinstellungen(S), t = (F.text || "").trim();
      if (!t) return meldung("Bitte einen Text schreiben");
      if (F.fuer === "personen" && !F.personen.length) return meldung("Bitte mindestens eine Person wählen");
      if (!leitung() && L.pinEigeneAktiv(S, ICH(), heute()).length >= e.maxZettel && F.fuer !== "ich") return meldung(`Höchstens ${e.maxZettel} Zettel gleichzeitig`);
      const z = { id: neueId("n"), filiale: F.fuer === "global" ? null : FIL().id, vonId: ICH().id, text: t.slice(0, e.zeichen), zeit: jetztIso(), wichtig: !!F.wichtig, farbe: F.farbe,
        fuer: F.fuer === "global" ? "alle" : F.fuer, empfaenger: F.fuer === "personen" ? F.personen : [], gelesen: {}, abgenommen: {}, bis: F.bis || null, antwortAuf: F.antwortAuf };
      S.pinnwand.push(z);
      if (z.wichtig && z.fuer !== "ich") { S.meldungen = S.meldungen || []; S.meldungen.push({ id: neueId("m"), filiale: z.filiale || FIL().id, text: `📌❗ Wichtiger Zettel von ${name(ICH())}: ${t.slice(0, 60)}`, zeit: jetztIso(), erledigt: true }); }
      pinForm = { offen: false, farbe: 1, fuer: "alle", wichtig: false, personen: [], antwortAuf: null };
      speichern(); meldung(`Angeheftet · ${L.pinEmpfaenger(S, z).length} Empfänger`); zeichnen();
    },
    "pin-gelesen": (el) => { const z = S.pinnwand.find((x) => x.id === el.dataset.id); (z.gelesen = z.gelesen || {})[ICH().id] = jetztIso(); speichern(); meldung(z.wichtig ? "Bestätigt: gelesen und verstanden" : "Als gelesen markiert"); zeichnen(); },
    "pin-alle-gelesen": (el) => { const t = jetztIso(); el.dataset.ids.split(",").forEach((id) => { const z = S.pinnwand.find((x) => x.id === id); if (z) (z.gelesen = z.gelesen || {})[ICH().id] = t; }); speichern(); fenster = null; meldung("Bestätigt"); zeichnen(); },
    "pin-zur-wand": () => { fenster = null; gehe("pinnwand"); },
    "pin-antworten": (el) => { const z = S.pinnwand.find((x) => x.id === el.dataset.id); (z.gelesen = z.gelesen || {})[ICH().id] = z.gelesen[ICH().id] || jetztIso(); speichern();
      pinForm = { offen: true, farbe: z.farbe === 1 ? 2 : 1, fuer: "personen", personen: [z.vonId], wichtig: false, antwortAuf: z.id, text: `@${(person(z.vonId) || {}).vorname}: ` }; gehe("pinnwand"); },
    "pin-stand": (el) => {
      const z = S.pinnwand.find((x) => x.id === el.dataset.id), st = L.pinStand(S, z);
      fenster = `<div class="reihe zw"><h2>👁️ Wer hat gelesen?</h2><button class="chip" data-act="zu">✕</button></div><p class="muted">„${esc(z.text.slice(0, 80))}“</p>
        <div class="abschnitt"><h2>Gelesen (${st.gelesen.length})</h2><div class="liste">${st.gelesen.map((id) => `<div class="zeile"><span class="punkt gruen"></span><span>${esc(name(person(id)))}</span><span class="klein">${L.datumKurz(z.gelesen[id].slice(0, 10))} ${z.gelesen[id].slice(11, 16)}</span></div>`).join("") || '<p class="leer">Noch niemand.</p>'}</div></div>
        <div class="abschnitt"><h2>Noch nicht gelesen (${st.offen.length})</h2><div class="liste">${st.offen.map((id) => `<div class="zeile"><span class="punkt rot"></span><span>${esc(name(person(id)))}</span><span></span></div>`).join("") || '<p class="leer">Alle haben gelesen. 🎉</p>'}</div></div>
        ${st.offen.length ? `<button class="btn zwei" data-act="pin-erinnern" data-id="${z.id}">🔔 Noch nicht Gelesene erinnern${z.erinnert ? ` (zuletzt ${z.erinnert.slice(11, 16)})` : ""}</button>` : ""}`;
      zeichnen();
    },
    "pin-erinnern": (el) => { const z = S.pinnwand.find((x) => x.id === el.dataset.id); const n = L.pinStand(S, z).offen.length; z.erinnert = jetztIso(); speichern(); fenster = null; meldung(`${n} ${n === 1 ? "Person wird" : "Personen werden"} erinnert (in der echten App per Push)`); zeichnen(); },
    "pin-mehr": (el) => {
      const z = S.pinnwand.find((x) => x.id === el.dataset.id), st = L.pinStand(S, z);
      fenster = `<div class="reihe zw"><h2>Zettel verwalten</h2><button class="chip" data-act="zu">✕</button></div><p class="muted">„${esc(z.text.slice(0, 80))}“</p>
        <button class="btn zwei" data-act="pin-wichtig" data-id="${z.id}">${z.wichtig ? "Nicht mehr wichtig" : "❗ Als wichtig markieren"}</button>
        ${st.gelesen.length && st.offen.length ? `<button class="btn drei" data-act="pin-teil-ab" data-id="${z.id}">🧹 Nur bei denen abnehmen, die gelesen haben (${st.gelesen.length})</button><p class="klein muted">Bei ${st.offen.length} hängt er weiter, bis sie ihn gelesen haben.</p>` : ""}
        <button class="btn" data-act="pin-abnehmen" data-id="${z.id}">Ganz abnehmen</button>`;
      zeichnen();
    },
    "pin-wichtig": (el) => { const z = S.pinnwand.find((x) => x.id === el.dataset.id); z.wichtig = !z.wichtig; if (z.wichtig) { z.gelesen = {}; } speichern(); fenster = null; meldung(z.wichtig ? "❗ Wichtig: alle müssen neu bestätigen" : "Nicht mehr wichtig"); zeichnen(); },
    "pin-teil-ab": (el) => { const z = S.pinnwand.find((x) => x.id === el.dataset.id); z.abgenommen = z.abgenommen || {}; for (const id of L.pinStand(S, z).gelesen) z.abgenommen[id] = jetztIso(); speichern(); fenster = null; meldung("Bei den Lesern abgenommen"); zeichnen(); },
    "pin-abnehmen": (el) => { const z = S.pinnwand.find((x) => x.id === el.dataset.id); z.entfernt = jetztIso(); z.entferntVon = ICH().id; speichern(); fenster = null; meldung("Zettel abgenommen"); zeichnen(); },
    "pin-haengen": (el) => { const z = S.pinnwand.find((x) => x.id === el.dataset.id); z.pauseBis = L.plusTage(heute(), L.pinEinstellungen(S).pauseTage); speichern(); meldung("Bleibt hängen. Ich erinnere dich später wieder."); zeichnen(); },
    "pin-einst": () => {
      const n = (id, min, max) => Math.max(min, Math.min(max, Number($(id).value) || min));
      S.parameter.pinnwand = { maxZettel: n("#pe-max", 1, 20), zeichen: n("#pe-zeichen", 50, 500), erinnernTage: n("#pe-erinnern", 1, 60), pauseTage: n("#pe-pause", 1, 60) };
      speichern(); meldung("Pinnwand-Einstellungen gespeichert"); zeichnen();
    },
    "plan-plus": (el) => { kandidatenFenster(el.dataset.datum, el.dataset.schicht); zeichnen(); },
    einteilen: (el) => {
      const p = person(el.dataset.id), f = FIL(), z = L.schichtZeit(f, el.dataset.datum, el.dataset.schicht), st = L.stundenStand(S, p, el.dataset.datum, z ? z.ende - z.start : 0);
      const profil = L.profilPruefen(p, el.dataset.datum, z, el.dataset.schicht), gesetz = L.gesetzHinweise(S, p, el.dataset.datum, z);
      if ((st.ueberGrenze || profil.length || gesetz.length) && !el.dataset.trotzdem) {
        fenster = `<h2>⚠️ ${st.ueberGrenze ? "Stundenumfang überschritten" : profil.length ? "Passt nicht zum Einsatzprofil" : "Bitte prüfen"}</h2>
          ${st.ueberGrenze ? `<p><b>${esc(name(p))}</b> hat einen Stundenumfang von <b>${st.soll} Std. ${st.einheit === "monat" ? "im Monat" : "in der Woche"}</b>${st.erlaubt ? ` (darf bis +${st.erlaubt} Std.)` : ""}.</p>
          <p>Mit dieser Schicht käme ${esc(p.vorname)} auf <b>${st.neu} Std.</b> (bisher ${st.ist} Std.).</p>${p.beschaeftigung === "minijob" || (!p.beschaeftigung && p.rolle === "aushilfe") ? '<p class="hinweis">Minijob: auf die Verdienstgrenze achten.</p>' : ""}` : ""}
          ${profil.length ? `<p>Einsatzprofil von <b>${esc(name(p))}</b>: ${profil.map(esc).join(", ")}.</p>` : ""}
          ${gesetz.length ? `<p class="hinweis">${gesetz.map(esc).join("<br>")}</p>` : ""}
          <p><b>Trotzdem einplanen?</b></p>
          <button class="btn gross" data-act="einteilen" data-trotzdem="1" data-id="${p.id}" data-datum="${el.dataset.datum}" data-schicht="${el.dataset.schicht}">Ja, trotzdem einplanen</button>
          <button class="btn drei" data-act="plan-plus" data-datum="${el.dataset.datum}" data-schicht="${el.dataset.schicht}">Nein, andere Person wählen</button>`;
        return zeichnen();
      }
      S.plan.push({ id: neueId("s"), filiale: FIL().id, datum: el.dataset.datum, schicht: el.dataset.schicht, personId: el.dataset.id, quelle: "hand", ueberStunden: !!el.dataset.trotzdem });
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
      const a = S.abwesenheiten.find((x) => x.id === el.dataset.id); a.status = "genehmigt"; a.entschieden = jetztIso(); a.vonLeitung = ICH().id;
      const betr = L.betroffeneSchichten(S, a.personId, a.von, a.bis); S.plan = S.plan.filter((s) => !betr.includes(s));
      speichern(); meldung(`Genehmigt${betr.length ? `, ${betr.length} Schicht(en) sind jetzt offen` : ""}`); zeichnen();
    },
    ablehnen: (el) => { const a = S.abwesenheiten.find((x) => x.id === el.dataset.id); a.status = "abgelehnt"; a.entschieden = jetztIso(); a.vonLeitung = ICH().id; speichern(); zeichnen(); },
    "meldung-ok": (el) => { S.meldungen.find((m) => m.id === el.dataset.id).erledigt = true; speichern(); zeichnen(); },
    "geraet-neu": () => {
      const typ = $("#g-typ").value, n = $("#g-name").value.trim() || (S.hygiene.geraetetypen.find((t) => t.id === typ) || {}).name;
      S.hygiene.geraete.push({ id: neueId("g"), filiale: FIL().id, typ, name: n, status: "aktiv" }); speichern(); meldung("Gerät angelegt. Passende Aufgaben erscheinen in der Tagesliste."); zeichnen();
    },
    zuteilung: (el) => { S.hygiene.zuteilung[`${el.dataset.r}|${FIL().id}`] = { ...(S.hygiene.zuteilung[`${el.dataset.r}|${FIL().id}`] || {}), status: el.dataset.s, von: ICH().id, zeit: jetztIso() }; speichern(); zeichnen(); },
    "ma-neu": () => { const p = { id: neueId("p"), vorname: "Neu", nachname: "", rolle: "aushilfe", stammfiliale: zentrale() && maFilter.fil !== "alle" && filiale(maFilter.fil) ? maFilter.fil : FIL().id, beschaeftigung: null, springer: false, einsatzfilialen: [], springerInfo: {}, wochenstunden: 10, stundenEinheit: "woche", urlaubsanspruch: 30, urlaubUebertrag: 0, bildungsurlaub: 5, profil: { zeit: "flexibel" }, quali: [], ueberschreiten: { erlaubt: false, bisStd: 0 }, pin: "1234", aktiv: true }; S.personen.push(p); speichern(); maFilter = { ...maFilter, besch: "alle", einsatz: "alle", q: "" }; gehe(breit() ? "ma" : "ma-edit", p.id); },
    "ma-speichern": (el) => {
      const p = person(el.dataset.id);
      const wert = (sel) => { const x = $(sel); return x ? x.value.trim() : ""; };
      const zahl = (sel, std) => { const n = Number(String(wert(sel)).replace(",", ".")); return isNaN(n) ? std : n; };
      const tage = (attr) => [...document.querySelectorAll(`[${attr}]`)].filter((x) => x.checked).map((x) => x.getAttribute(attr));
      const ber = [0, 1, 2].map((i) => ({ tag: $(`[data-ber="${i}|tag"]`).value, von: $(`[data-ber="${i}|von"]`).value, bis: $(`[data-ber="${i}|bis"]`).value })).filter((b) => b.tag && b.von && b.bis && b.bis > b.von);
      const stamm = zentrale() ? wert("#m-stamm") : p.stammfiliale;
      const einsatz = [...document.querySelectorAll("[data-einsatz]")].filter((x) => x.checked).map((x) => x.dataset.einsatz).filter((x) => x !== stamm);
      const springerInfo = {};
      for (const x of document.querySelectorAll("[data-anreise]")) { const fid = x.dataset.anreise, m = $(`[data-minuten="${fid}"]`).value; if (x.value || m) springerInfo[fid] = { anreise: x.value || null, minuten: m === "" ? null : Math.max(0, Number(m) || 0) }; }
      const quali = L.QUALI.filter((q) => $(`[data-quali="${q.id}"]`).checked || $(`[data-qbis="${q.id}"]`).value).map((q) => ({ art: q.id, bis: $(`[data-qbis="${q.id}"]`).value || null }));
      const zeit = wert("#m-pzeit") || "flexibel";
      if (zeit === "morgens" && !wert("#m-pbis")) return meldung("Bitte „bis Uhr“ angeben (nur morgens).");
      if (zeit === "abends" && !wert("#m-pab")) return meldung("Bitte „ab Uhr“ angeben (nur abends).");
      const vorher = JSON.stringify(p);
      Object.assign(p, { vorname: wert("#m-vor") || p.vorname, nachname: wert("#m-nach"), rolle: $("#m-rolle").disabled ? p.rolle : wert("#m-rolle"), stammfiliale: stamm,
        beschaeftigung: wert("#m-besch") || null, eintritt: wert("#m-eintritt") || null, befristetBis: wert("#m-befristet") || null, unter18: $("#m-u18").checked, ab16: $("#m-u18").checked && $("#m-ab16").checked,
        wochenstunden: Math.max(0, zahl("#m-std", 0)), stundenEinheit: wert("#m-einheit"), ueberschreiten: { erlaubt: $("#m-ueber").checked, bisStd: Math.max(0, zahl("#m-ueberstd", 0)) },
        profil: { zeit, bis: zeit === "morgens" ? wert("#m-pbis") : null, ab: zeit === "abends" ? wert("#m-pab") : null, tage: tage("data-ptag"), nichtTage: tage("data-pnicht"), nichtGrund: wert("#m-pgrund") || null, bereitschaft: ber },
        urlaubsanspruch: Math.max(0, zahl("#m-urlaub", 0)), urlaubUebertrag: Math.max(0, zahl("#m-uebertrag", 0)), bildungsurlaub: Math.max(0, zahl("#m-bildung", 0)),
        springer: $("#m-springer").checked, einsatzfilialen: einsatz, springerInfo, quali, aktiv: $("#m-aktiv").checked });
      if (JSON.stringify(p) !== vorher) (S.protokoll = S.protokoll || []).push({ zeit: jetztIso(), von: ICH().id, was: "Mitarbeiter", id: p.id, name: name(p) });
      speichern(); meldung("Gespeichert");
      if (breit()) { arg = p.id; ansicht = "ma"; zeichnen(); } else gehe("ma");
    },
    "imp-vorlage": () => {
      try {
        const url = URL.createObjectURL(new Blob(["﻿" + IMPORT_VORLAGE], { type: "text/csv;charset=utf-8" }));
        const a = document.createElement("a"); a.href = url; a.download = "mitarbeiter-vorlage.csv"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
      } catch (e) { importText = IMPORT_VORLAGE; zeichnen(); }
    },
    "imp-pruefen": () => { importText = $("#imp-text").value; importErgebnis = L.mitarbeiterImport(S, importText); zeichnen(); },
    "imp-ok": () => {
      const r = importErgebnis; if (!r) return;
      let n = 0;
      for (const z of r.zeilen) {
        if (!z.person || z.doppelt || (!zentrale() && z.person.stammfiliale !== FIL().id)) continue;
        S.personen.push({ id: neueId("p"), ...z.person, profil: { zeit: "flexibel" }, quali: [], ueberschreiten: { erlaubt: false, bisStd: 0 }, springerInfo: {}, urlaubUebertrag: 0, bildungsurlaub: 5, pin: "1234" }); n++;
      }
      (S.protokoll = S.protokoll || []).push({ zeit: jetztIso(), von: ICH().id, was: "Import", anzahl: n });
      importText = ""; importErgebnis = null; speichern(); meldung(`${n} Mitarbeiter angelegt`); gehe("ma");
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
    "druck-neu": (el) => { druckEntwurf = B.neuerDruck(S, el.dataset.v, FIL()); gehe("druck-edit"); },
    "druck-opt": (el) => { druckMerken(); druckEntwurf[el.dataset.k] = el.dataset.w; zeichnen(); },
    "druck-drucken": () => { druckMerken(); drucken(B.blattHtml(S, druckEntwurf, FIL(), BILD), druckEntwurf.format === "quer"); },
    "druck-speichern": () => {
      druckMerken(); const d = druckEntwurf;
      const alt = d.id && ablage().find((x) => x.id === d.id);
      const daten = { ...d }; delete daten.id;
      if (alt) Object.assign(alt, { titel: d.titel || "Ohne Titel", daten, zeit: jetztIso() });
      else { const x = { id: neueId("bl"), ordner: "studio", filiale: FIL().id, titel: d.titel || "Ohne Titel", daten, zeit: jetztIso(), vonId: ICH().id }; ablage().push(x); d.id = x.id; }
      speichern(); meldung("Gespeichert. Du findest das Blatt unter „Gespeicherte Blätter“ und im Archiv."); zeichnen();
    },
    "druck-oeffnen": (el) => { const x = ablage().find((y) => y.id === el.dataset.id); druckEntwurf = { ...x.daten, id: x.id }; gehe("druck-edit"); },
    "druck-direkt": (el) => { const x = ablage().find((y) => y.id === el.dataset.id); if (x.ordner === "briefe") return drucken(B.briefHtml(x.daten, "frooters · " + FIL().name, BILD), false); drucken(B.blattHtml(S, x.daten, filiale(x.filiale) || FIL(), BILD), x.daten.format === "quer"); },
    "druck-loeschen": () => { const x = ablage().find((y) => y.id === druckEntwurf.id); if (x) x.entfernt = jetztIso(); druckEntwurf = null; speichern(); meldung("Gelöscht"); gehe("studio"); },
    "bd-neu": (el) => { const t = $("#bd-titel").value.trim(); if (!t) return meldung("Bitte einen Titel eingeben"); ablage().push({ id: neueId("bl"), ordner: el.dataset.o, filiale: el.dataset.o === "zentrale" ? null : FIL().id, titel: t, kategorie: $("#bd-kat").value, text: $("#bd-text").value.trim(), zeit: jetztIso(), vonId: ICH().id }); speichern(); zeichnen(); },
    "bd-weg": (el) => { ablage().find((x) => x.id === el.dataset.id).entfernt = jetztIso(); speichern(); zeichnen(); },
    "ad-neu": () => { const fi = $("#ad-firma").value.trim(); if (!fi) return meldung("Bitte die Firma eingeben"); S.buero.adressen.push({ id: neueId("ad"), kategorie: $("#ad-kat").value, firma: fi, name: "", telefon: $("#ad-tel").value.trim(), email: $("#ad-mail").value.trim(), notiz: $("#ad-notiz").value.trim(), filiale: $("#ad-alle").checked ? null : FIL().id }); speichern(); zeichnen(); },
    "ad-weg": (el) => { S.buero.adressen.find((x) => x.id === el.dataset.id).entfernt = jetztIso(); speichern(); zeichnen(); },
    "hyg-bericht": (el) => drucken(B.hygieneBerichtHtml(S, FIL(), heute(), Number(el.dataset.tage), { datum: heute(), min: jetztMin() }, BILD, (id) => name(person(id))), false),
    "brief-drucken": () => { briefMerken(); drucken(B.briefHtml(briefEntwurf, "frooters · " + FIL().name, BILD), false); },
    "brief-speichern": () => { briefMerken(); const b = briefEntwurf; const alt = b.id && ablage().find((x) => x.id === b.id); const daten = { ...b }; delete daten.id;
      if (alt) Object.assign(alt, { titel: b.betreff || "Brief", daten, zeit: jetztIso() }); else { const x = { id: neueId("bl"), ordner: "briefe", filiale: null, titel: b.betreff || "Brief", daten, zeit: jetztIso(), vonId: ICH().id }; ablage().push(x); b.id = x.id; }
      speichern(); meldung("Brief gespeichert"); zeichnen(); },
    "brief-neu": () => { briefEntwurf = null; zeichnen(); },
    "brief-oeffnen": (el) => { const x = ablage().find((y) => y.id === el.dataset.id); briefEntwurf = { ...x.daten, id: x.id }; zeichnen(); },
    "mx-typ": (el) => { matrixTyp = el.dataset.t; zeichnen(); },
    "mx-neu": () => { const f = FIL(); f.matrix = f.matrix || {}; const l = (f.matrix[matrixTyp] = f.matrix[matrixTyp] || []); const letzt = l[l.length - 1]; l.push({ von: letzt ? letzt.bis : "10:00", bis: "20:00", gesamt: 2, sl: 0, stv: 1, ma: 0, maxAus: 1 }); speichern(); zeichnen(); },
    "mx-weg": (el) => { FIL().matrix[matrixTyp].splice(Number(el.dataset.i), 1); speichern(); zeichnen(); },
    "mx-kopie": () => { const f = FIL(); const w = JSON.parse(JSON.stringify(f.matrix.werktag || [])); f.matrix.sa = w; f.matrix.so = JSON.parse(JSON.stringify(w)); speichern(); meldung("Für Samstag und Sonntag übernommen"); zeichnen(); },
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
  function druckMerken() { if (!druckEntwurf) return; document.querySelectorAll("[data-druck]").forEach((x) => { druckEntwurf[x.dataset.druck] = x.value; }); const fr = $("#dk-frootie"); if (fr) druckEntwurf.frootie = fr.checked; }
  function briefMerken() { if (!briefEntwurf) return; document.querySelectorAll("[data-brief]").forEach((x) => { briefEntwurf[x.dataset.brief] = x.value; }); }
  function pinFormMerken() { const t = $("#pw-text"); if (t) pinForm.text = t.value; const w = $("#pw-wichtig"); if (w) pinForm.wichtig = w.checked; const b = $("#pw-bis"); if (b) pinForm.bis = b.value; }
  // Druckstudio und Briefe: Vorschau beim Tippen aktualisieren, ohne das Formular neu zu zeichnen
  document.addEventListener("input", (ev) => {
    const el = ev.target;
    if (el.dataset && el.dataset.druck != null && druckEntwurf) { druckEntwurf[el.dataset.druck] = el.value; const v = document.querySelector(".vorschau-rahmen"); if (v) { v.innerHTML = B.blattHtml(S, druckEntwurf, FIL(), BILD); einpassen(v); } }
    if (el.dataset && el.dataset.brief != null && briefEntwurf) { briefEntwurf[el.dataset.brief] = el.value; const v = document.querySelector(".vorschau-rahmen"); if (v) v.innerHTML = B.briefHtml(briefEntwurf, "frooters · " + FIL().name, BILD); }
  });
  document.addEventListener("input", (ev) => { const z = ev.target.dataset && ev.target.dataset.zaehler; if (z) { const n = $("#" + z); if (n) n.textContent = `${ev.target.value.length} / ${ev.target.maxLength}`; } });
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
  document.addEventListener("keydown", (ev) => { const tr = ev.target.closest && ev.target.closest("tr[data-go]"); if (tr && ev.target === tr && (ev.key === "Enter" || ev.key === " ")) { ev.preventDefault(); gehe(tr.dataset.go, tr.dataset.arg); } });
  document.addEventListener("change", (ev) => {
    const el = ev.target;
    if (el.dataset.pp != null && el.type === "checkbox") { entwurf.werte[el.dataset.pp] = el.checked; zeichnen(); }
    else if (el.dataset.pp != null) { entwurf.werte[el.dataset.pp] = el.value; zeichnen(); const n = $(`#pp${el.dataset.pp}`); if (n) n.focus(); }
    else if (el.dataset.schritt != null) { entwurf.schritte[el.dataset.schritt] = el.checked; zeichnen(); }
    else if (el.dataset.act === "geraet-status") { S.hygiene.geraete.find((g) => g.id === el.dataset.id).status = el.value; speichern(); zeichnen(); }
    else if (el.dataset.act === "uhrzeit") { const k = `${el.dataset.r}|${FIL().id}`; S.hygiene.zuteilung[k] = { ...(S.hygiene.zuteilung[k] || { status: "aktiv" }), uhrzeit: el.value || null }; speichern(); meldung("Uhrzeit gespeichert"); }
    else if (el.dataset.oz) { const [fid, t, i] = el.dataset.oz.split("|"); const f = filiale(fid); const z = f.oeffnung[t] ? [...f.oeffnung[t]] : ["10:00", "19:00"]; z[i] = el.value; f.oeffnung[t] = z[0] && z[1] ? z : null; speichern(); zeichnen(); }
    else if (el.id === "ab-von" || el.id === "ab-bis") {
      const von = $("#ab-von").value, bis = $("#ab-bis").value, art = L.abwArt(abwArtWahl), t = $("#ab-tage");
      if (t && art.konto && von && bis && bis >= von) { const n = L.urlaubsTage(von, bis, S.parameter.urlaubTage), k = L.urlaubskonto(S, ICH(), von.slice(0, 4), heute(), art.konto);
        t.textContent = `${n} Arbeitstage · Rest danach ${k.rest - k.beantragt - n} Tage${k.rest - k.beantragt - n < 0 ? " (reicht nicht)" : ""}`; }
      else if (t) t.textContent = "";
    }
    else if (el.dataset.mafilter) { maFilter[el.dataset.mafilter] = el.value; zeichnen(); }
    else if (el.id === "imp-datei" && el.files && el.files[0]) { const r = new FileReader(); r.onload = () => { importText = String(r.result || ""); importErgebnis = L.mitarbeiterImport(S, importText); zeichnen(); }; r.readAsText(el.files[0], "utf-8"); }
    else if (el.dataset.land) { filiale(el.dataset.land).bundesland = el.value || null; speichern(); meldung("Bundesland gespeichert"); zeichnen(); }
    else if (el.dataset.pakte) { const [pid, k] = el.dataset.pakte.split("|"); (S.buero.personal[pid] = S.buero.personal[pid] || {})[k] = el.value; speichern(); zeichnen(); }
    else if (el.dataset.freigabe) { const [o, rk] = el.dataset.freigabe.split("|"); (S.buero.rechte[o] = S.buero.rechte[o] || {})[rk] = el.checked; speichern(); meldung("Freigabe gespeichert"); }
    else if (el.id === "dk-frootie") { druckMerken(); zeichnen(); }
    else if (el.dataset.mx) {
      const [i, k] = el.dataset.mx.split("|"), b = FIL().matrix[matrixTyp][Number(i)];
      if (k === "von" || k === "bis") { if (el.value) b[k] = el.value; }
      else if (k === "maxAus") b[k] = el.value === "" ? null : Math.max(0, Number(el.value) || 0);
      else b[k] = Math.max(0, Number(el.value) || 0);
      if (b.gesamt < (b.sl || 0) + (b.stv || 0) + (b.ma || 0)) { b.gesamt = (b.sl || 0) + (b.stv || 0) + (b.ma || 0); meldung("Personen an die Vorgaben angepasst"); }
      speichern(); zeichnen();
    }
    else if (el.dataset.bedarf) { const [fid, sch] = el.dataset.bedarf.split("|"); filiale(fid).bedarf.standard[sch] = Number(el.value) || 0; speichern(); }
  });

  // Erst anzeigen, dann den Update-Dienst versuchen: in eingebetteten Ansichten (z. B. geteilter Link) ist er gesperrt
  // und darf die App nie am Starten hindern.
  const start = (location.hash || "").slice(1);
  if (start && V[start]) ansicht = start;
  window.addEventListener("hashchange", () => { const h = location.hash.slice(1); if (V[h] && h !== ansicht) { ansicht = h; arg = null; fenster = null; zeichnen(); } });
  zeichnen();
  if (ansicht === "start") { pinNeuFenster(); if (fenster) zeichnen(); }

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
