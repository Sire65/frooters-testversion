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
    { id: "studio", sym: "🎨", t: "Grafik & Druck", u: "Preislisten, Schilder, Aushänge", farbe: "#c10230", rollen: ["shopleitung", "stv", "qualitaet"] },
    { id: "shop", sym: "📁", t: "Shop-Ordner", u: "Anweisungen, Geräte, Center", farbe: "#4f8a12", rollen: ["shopleitung", "stv"] },
    { id: "hygiene", sym: "🧼", t: "Hygiene-Dokumentation", u: "Berichte für Kontrolle und Berater", farbe: "#3f7f8c", rollen: ["shopleitung", "stv", "qualitaet", "berater"] },
    { id: "adressen", sym: "📒", t: "Adressbuch", u: "Lieferanten, Techniker, Center", farbe: "#8a7a4e", rollen: ["shopleitung", "stv", "qualitaet"] },
    { id: "lohn", sym: "📤", t: "Stunden & Lohn", u: "Stundenliste für den Steuerberater", farbe: "#6b6f86", rollen: ["shopleitung"] },
    { id: "archiv", sym: "🗄️", t: "Archiv", u: "Alle gespeicherten Drucke", farbe: "#5f5a57", rollen: ["shopleitung", "stv", "qualitaet"] },
    { id: "personal", sym: "👥", t: "Personalakte", u: "Verträge, Belehrungen, Schulungen", farbe: "#7d4a63", rollen: [] },
    { id: "briefe", sym: "✉️", t: "Briefe", u: "Briefbogen im frooters-Design", farbe: "#a3a983", rollen: [] },
    { id: "zentrale", sym: "🏢", t: "Zentrale-Ablage", u: "Unterlagen der Geschäftsführung", farbe: "#1d1d1b", rollen: [] },
    { id: "auswertung", sym: "📊", t: "Auswertungen", u: "Alle Filialen einzeln und gesamt", farbe: "#4a6a8a", rollen: [] },
    { id: "freigaben", sym: "🔐", t: "Freigaben", u: "Wer sieht welchen Ordner", farbe: "#55606b", rollen: [], fest: true },
  ];
  const FREIGABE_ROLLEN = [["shopleitung", "Shopleitung"], ["stv", "Stellv. Shopleitung"], ["qualitaet", "Qualität & Pflege"], ["berater", "Hygieneberater"]];
  function darfOrdner(state, rolle, ordnerId) {
    const o = ORDNER.find((x) => x.id === ordnerId);
    if (!o) return false;
    if (rolle === "zentrale") return true;
    if (o.fest) return false;
    const r = ((state.buero || {}).rechte || {})[o.id];
    return r && r[rolle] != null ? !!r[rolle] : o.rollen.includes(rolle);
  }

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
    for (const g of gruppen) for (const r of state.rezepte.rezepte.filter((x) => x.gruppe === g.id)) zeilen.push(`${r.name} | ${r.groessen.length > 1 ? r.groessen.join(" / ") : ""} | `);
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
      const rz = state.rezepte.rezepte.filter((r) => !filiale.sortiment || filiale.sortiment.includes(r.gruppe));
      const genutzt = al.filter((a) => rz.some((r) => L.allergeneVon(r).includes(a)));
      const ska = Math.max(0.45, Math.min(1, 9 / Math.max(1, rz.length)));
      inhalt = `<table class="dp-allergene" style="font-size:${((d.format === "quer" ? 2 : 2.6) * ska).toFixed(2)}cqw"><thead><tr><th>Produkt</th>${genutzt.map((a) => `<th><span>${esc(a)}</span></th>`).join("")}</tr></thead><tbody>
        ${rz.map((r) => { const x = L.allergeneVon(r); return `<tr><td>${esc(r.name)}</td>${genutzt.map((a) => `<td>${x.includes(a) ? "●" : ""}</td>`).join("")}</tr>`; }).join("")}</tbody></table>
        <p class="dp-klein">● enthalten. Nicht aufgeführte Allergene der 14 Hauptallergene sind in keinem Produkt enthalten.</p>`;
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

  return { ORDNER, FREIGABE_ROLLEN, darfOrdner, FARBEN, SYMBOLE, VORLAGEN, postenVorschlag, oeffnungText, neuerDruck, preisTxt, blattHtml, briefHtml, hygieneBerichtHtml };
});
