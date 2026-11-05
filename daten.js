// frooters Team-App – Datenzugang über austauschbare Adapter (KICC-Regel 4 und 18).
// Version 0.1: Adapter "demo" speichert im Browser (Beispieldaten). Ein Adapter "supabase" (Edge Function fr-app)
// muss dieselben Methoden liefern: laden() → Zustand, speichern(zustand), zuruecksetzen().
(function (root, fabrik) {
  if (typeof module === "object" && module.exports) module.exports = fabrik(require("./logik.js"));
  else root.FRD = fabrik(root.FRL);
})(typeof self !== "undefined" ? self : this, function (L) {
  "use strict";
  const SCHLUESSEL = "frooters_demo_v7";

  const ALLERGENE = ["Gluten", "Krebstiere", "Ei", "Fisch", "Erdnüsse", "Soja", "Milch", "Schalenfrüchte", "Sellerie", "Senf", "Sesam", "Schwefeldioxid", "Lupinen", "Weichtiere"];

  function demoDaten(heuteIso) {
    let n = 0;
    const id = (p) => `${p}${++n}`;
    const offen = (mo, sa) => ({ mo, di: mo, mi: mo, do: mo, fr: sa || mo, sa: sa || mo, so: null });
    // Filialen laut Fragebogen (04.11.2026): Ochtrup ist Pilot. Öffnungszeiten und Besetzung sind Beispiele, mit frooters abstimmen.
    const frooters = ["froyo", "obst", "smoothie", "saft", "stiel", "warm", "quark", "snack"];
    const mo0 = L.montag(heuteIso);
    const filialen = [
      { id: "och", name: "Ochtrup · Designer Outlet", kurz: "Ochtrup", betreiber: "gm", marke: "frooters", pilot: true, oeffnung: offen(["10:00", "20:00"]), bedarf: { standard: { frueh: 2, spaet: 2 }, sa: { frueh: 3, spaet: 3 } }, sortiment: frooters },
      { id: "obh", name: "Oberhausen · Centro", kurz: "Oberhausen", betreiber: "gm", marke: "frooters", oeffnung: offen(["10:00", "20:00"]), bedarf: { standard: { frueh: 2, spaet: 2 }, sa: { frueh: 3, spaet: 3 } }, sortiment: frooters },
      { id: "sin", name: "Sinsheim · Therme", kurz: "Sinsheim", betreiber: "gm", marke: "frooters", oeffnung: Object.assign(offen(["11:00", "21:00"]), { so: ["11:00", "21:00"] }), bedarf: { standard: { frueh: 2, spaet: 2 }, sa: { frueh: 3, spaet: 3 }, so: { frueh: 3, spaet: 3 } }, sortiment: frooters },
      { id: "osn", name: "Osnabrück · Bowls & Smoothie · Café", kurz: "Osnabrück", betreiber: "gm", marke: "Bowls & Smoothie", oeffnung: offen(["10:00", "19:00"]), bedarf: { standard: { frueh: 2, spaet: 2 } }, sortiment: ["bowl", "smoothie", "saft", "kaffee", "obst"] },
      { id: "rr", name: "Road Runner · mobiler Stand", kurz: "Road Runner", betreiber: "gm", marke: "frooters", art: "mobil", oeffnung: {}, bedarf: { standard: { frueh: 2, spaet: 2 } }, sortiment: ["froyo", "smoothie", "obst"],
        einsaetze: [
          { datum: L.plusTage(mo0, 5), ort: "Wochenmarkt (Beispiel)", von: "09:00", bis: "15:00" },
          { datum: L.plusTage(mo0, 11), ort: "Stadtfest (Beispiel)", von: "12:00", bis: "22:00" },
          { datum: L.plusTage(mo0, 12), ort: "Stadtfest (Beispiel)", von: "11:00", bis: "22:00" },
          { datum: L.plusTage(mo0, 19), ort: "Firmenfeier (Beispiel)", von: "14:00", bis: "20:00" },
        ] },
    ];
    // Besetzungsmatrix je Filiale (Beispiel, mit frooters abstimmen): Personen je Zeitblock und Vorgabe je Rolle
    const B = (von, bis, gesamt, stv, ma, maxAus, sl) => ({ von, bis, gesamt, sl: sl || 0, stv: stv || 0, ma: ma || 0, maxAus });
    const MATRIX = {
      och: { werktag: [B("10:00", "12:00", 2, 1, 0, 1), B("12:00", "18:00", 2, 1, 1, 1), B("18:00", "20:00", 2, 1, 0, 1)], sa: [B("10:00", "12:00", 2, 1, 0, 1), B("12:00", "18:00", 3, 1, 1, 1, 1), B("18:00", "20:00", 2, 1, 0, 1)] },
      obh: { werktag: [B("10:00", "20:00", 2, 1, 0, 1)], sa: [B("10:00", "12:00", 2, 1, 0, 1), B("12:00", "18:00", 3, 1, 1, 1), B("18:00", "20:00", 2, 1, 0, 1)] },
      sin: { werktag: [B("11:00", "21:00", 2, 1, 0, 1)], sa: [B("11:00", "21:00", 3, 1, 1, 1)], so: [B("11:00", "21:00", 3, 1, 1, 1)] },
      osn: { werktag: [B("10:00", "19:00", 2, 1, 0, 1)], sa: [B("10:00", "19:00", 2, 1, 0, 1)] },
      rr: { einsatz: [B("00:00", "23:59", 2, 0, 1, 1)] },
    };
    for (const f of filialen) f.matrix = MATRIX[f.id];
    const P = (vorname, nachname, rolle, stamm, extra) => Object.assign({ id: id("p"), vorname, nachname, rolle, stammfiliale: stamm, springer: false, einsatzfilialen: [], wochenstunden: 30, stundenEinheit: "woche", urlaubsanspruch: 30, urlaubUebertrag: 0, bildungsurlaub: 5, pin: "1234", aktiv: true }, extra || {});
    // Bezirksleitung macht laut Fragebogen der Inhaber selbst. Eine feste Person pflegt Rezepte und Hygiene, ein externer Berater liest mit.
    const personen = [
      P("Inhaber", "(Demo)", "zentrale", null, { wochenstunden: 0 }),
      P("Petra", "Lange", "qualitaet", null, { wochenstunden: 0 }),
      P("Hygieneberater", "(Demo)", "berater", null, { wochenstunden: 0 }),
      P("Sandra", "Becker", "shopleitung", "och", { wochenstunden: 38 }),
      P("Tom", "Krüger", "stv", "och", { wochenstunden: 35 }),
      P("Lena", "Hoffmann", "mitarbeiter", "och", { wochenstunden: 25 }),
      P("Leonie", "Fischer", "mitarbeiter", "och", { wochenstunden: 20 }),
      P("Jonas", "Wagner", "aushilfe", "och", { stundenEinheit: "monat", urlaubsanspruch: 20, wochenstunden: 40, springer: true, einsatzfilialen: ["rr", "osn"] }),
      P("Anna", "Wolf", "shopleitung", "obh", { wochenstunden: 38 }),
      P("Lukas", "Braun", "mitarbeiter", "obh", { wochenstunden: 30 }),
      P("Can", "Öztürk", "mitarbeiter", "obh", { wochenstunden: 20 }),
      P("Emma", "Neumann", "aushilfe", "obh", { stundenEinheit: "monat", urlaubsanspruch: 20, wochenstunden: 35, springer: true, einsatzfilialen: ["rr"] }),
      P("Mehmet", "Yilmaz", "shopleitung", "sin", { wochenstunden: 38 }),
      P("Julia", "Schmitz", "stv", "sin", { wochenstunden: 32 }),
      P("Paul", "Richter", "mitarbeiter", "sin", { wochenstunden: 25 }),
      P("Sophie", "Klein", "aushilfe", "sin", { stundenEinheit: "monat", urlaubsanspruch: 20, wochenstunden: 45 }),
      P("Nina", "Vogel", "shopleitung", "osn", { wochenstunden: 38 }),
      P("Ben", "Hartmann", "mitarbeiter", "osn", { wochenstunden: 30 }),
      P("Mia", "Schulz", "aushilfe", "osn", { stundenEinheit: "monat", urlaubsanspruch: 20, wochenstunden: 40, springer: true, einsatzfilialen: ["och", "rr"] }),
    ];
    const pid = (vorname) => personen.find((p) => p.vorname === vorname).id;

    const bereiche = [
      { id: "kuehl", name: "Kühlung" }, { id: "froyo", name: "Froyo-Station" }, { id: "saft", name: "Saftbar" },
      { id: "theke", name: "Theke" }, { id: "personal", name: "Personal" }, { id: "waren", name: "Wareneingang" }, { id: "lager", name: "Lager" },
    ];
    const geraetetypen = [
      { id: "vitrine", name: "Kühlvitrine" }, { id: "tk", name: "Tiefkühler" }, { id: "froyo", name: "Froyo-Maschine" },
      { id: "eis", name: "Eismaschine" }, { id: "presse", name: "Saftpresse" }, { id: "mixer", name: "Mixer" }, { id: "waffel", name: "Waffeleisen" },
      { id: "kaffee", name: "Kaffeemaschine" }, { id: "kuehlbox", name: "Kühlbox (mobil)" },
    ];
    const G = (filiale, typ, name) => ({ id: id("g"), filiale, typ, name, status: "aktiv" });
    const geraete = [
      G("och", "vitrine", "Kühlvitrine 1 (links)"), G("och", "vitrine", "Kühlvitrine 2 (rechts)"), G("och", "tk", "Tiefkühler"), G("och", "froyo", "Froyo-Maschine"),
      G("och", "presse", "Saftpresse"), G("och", "mixer", "Mixer"), G("och", "waffel", "Waffeleisen"),
      G("obh", "vitrine", "Kühlvitrine"), G("obh", "tk", "Tiefkühler"), G("obh", "froyo", "Froyo-Maschine"), G("obh", "presse", "Saftpresse"),
      G("sin", "vitrine", "Kühlvitrine"), G("sin", "tk", "Tiefkühler"), G("sin", "froyo", "Froyo-Maschine"), G("sin", "eis", "Eismaschine"), G("sin", "mixer", "Mixer"),
      G("osn", "vitrine", "Kühlvitrine"), G("osn", "tk", "Tiefkühler"), G("osn", "mixer", "Mixer"), G("osn", "presse", "Saftpresse"), G("osn", "kaffee", "Kaffeemaschine"),
      G("rr", "kuehlbox", "Kühlbox 1"), G("rr", "froyo", "Froyo-Maschine mobil"), G("rr", "mixer", "Mixer"),
    ];
    const massnahmen = [
      { id: "m_kuehl", titel: "Kühlung zu warm", schritte: ["Tür und Dichtung prüfen, Gerät nicht überladen", "Ware prüfen: in Ordnung → in anderes Gerät umlagern, sonst verwerfen", "Shopleitung informieren, bei Bedarf Techniker rufen"], nachkontrolle: 30 },
      { id: "m_tk", titel: "Tiefkühler zu warm", schritte: ["Tür schließen, Eisbildung prüfen", "Angetaute Ware nicht wieder einfrieren, verwerfen", "Shopleitung informieren, Techniker rufen"], nachkontrolle: 30 },
      { id: "m_standzeit", titel: "Standzeit überschritten", schritte: ["Ware aus der Vitrine nehmen und verwerfen", "Frisch nachproduzieren"], nachkontrolle: 0 },
      { id: "m_waren", titel: "Lieferung mangelhaft", schritte: ["Ware nicht annehmen oder aussortieren", "Foto machen, Lieferschein vermerken", "Shopleitung informieren"], nachkontrolle: 0 },
      { id: "m_reinigung", titel: "Reinigung nicht in Ordnung", schritte: ["Reinigung wiederholen", "Fehlendes Reinigungsmittel nachbestellen", "Shopleitung informieren"], nachkontrolle: 30 },
      { id: "m_personal", titel: "Personalhygiene", schritte: ["Mangel sofort beheben (Händewaschen, Kleidung, Schmuck)", "Bei Krankheitsanzeichen: nicht mit Lebensmitteln arbeiten, Shopleitung informieren"], nachkontrolle: 0 },
    ];
    const R = (titel, bereich, geraetetyp, intervall, zustaendig, pruefpunkte, massnahme, extra) =>
      Object.assign({ id: id("r"), titel, bereich, geraetetyp, intervall, zustaendig, pruefpunkte, massnahme, standard: "alle", pflicht: true, toleranz: 60, aktiv: true,
        anleitung: "" }, extra || {});
    const regeln = [
      R("Temperatur Kühlvitrine", "kuehl", "vitrine", { art: "uhrzeiten", zeiten: ["10:15", "14:00", "18:30"] }, { art: "alle" }, [{ art: "messwert", text: "Temperatur", einheit: "°C", max: 7, krit: 8 }], "m_kuehl", { anleitung: "Thermometer in die Mitte der Vitrine legen, 1 Minute warten, Wert ablesen." }),
      R("Temperatur Tiefkühler", "kuehl", "tk", { art: "oeffnung", versatz: 15 }, { art: "schicht", wert: "frueh" }, [{ art: "messwert", text: "Temperatur", einheit: "°C", max: -18, krit: -15 }], "m_tk"),
      R("Froyo-Maschine prüfen", "froyo", "froyo", { art: "oeffnung", versatz: 0 }, { art: "schicht", wert: "frueh" }, [{ art: "messwert", text: "Temperatur Behälter", einheit: "°C", max: 6, krit: 8 }, { art: "haken", text: "Sichtprüfung sauber, Ausgabe dicht" }], "m_kuehl"),
      R("Froyo-Maschine reinigen", "froyo", "froyo", { art: "schliessung", versatz: 0 }, { art: "schicht", wert: "spaet" }, [{ art: "haken", text: "Nach Herstellervorgabe gereinigt" }, { art: "auswahl", text: "Ergebnis", werte: ["sauber", "nicht sauber"], schlecht: ["nicht sauber"] }], "m_reinigung"),
      R("Eismaschine reinigen", "froyo", "eis", { art: "schliessung", versatz: 0 }, { art: "schicht", wert: "spaet" }, [{ art: "haken", text: "Gereinigt und desinfiziert" }], "m_reinigung"),
      R("Saftpresse zerlegen und reinigen", "saft", "presse", { art: "schliessung", versatz: 0 }, { art: "schicht", wert: "spaet" }, [{ art: "haken", text: "Zerlegt, gereinigt, getrocknet" }], "m_reinigung"),
      R("Mixer reinigen", "saft", "mixer", { art: "schliessung", versatz: 0 }, { art: "schicht", wert: "spaet" }, [{ art: "haken", text: "Behälter und Messer gereinigt" }], "m_reinigung"),
      R("Waffeleisen reinigen", "theke", "waffel", { art: "schliessung", versatz: 0 }, { art: "schicht", wert: "spaet" }, [{ art: "haken", text: "Abgekühlt und gereinigt" }], "m_reinigung"),
      R("Handwaschplatz", "personal", null, { art: "oeffnung", versatz: 0 }, { art: "schicht", wert: "frueh" }, [{ art: "haken", text: "Seife da" }, { art: "haken", text: "Desinfektion da" }, { art: "haken", text: "Papiertücher da" }], "m_personal"),
      R("Standzeit Obstsalat und geschnittenes Obst", "theke", null, { art: "alle_std", std: 2 }, { art: "alle" }, [{ art: "auswahl", text: "Standzeit", werte: ["in Ordnung", "überschritten"], schlecht: ["überschritten"] }], "m_standzeit", { toleranz: 45 }),
      R("Theke und Arbeitsflächen reinigen", "theke", null, { art: "uhrzeiten", zeiten: ["13:00"] }, { art: "schicht", wert: "frueh" }, [{ art: "haken", text: "Gereinigt" }], "m_reinigung"),
      R("Boden und Abfall", "theke", null, { art: "schliessung", versatz: 0 }, { art: "schicht", wert: "spaet" }, [{ art: "haken", text: "Boden gewischt, Abfall entsorgt" }], "m_reinigung"),
      R("Kühlgeräte innen reinigen", "kuehl", "vitrine", { art: "wochentage", tage: ["mo"], zeit: "11:00" }, { art: "schicht", wert: "frueh" }, [{ art: "haken", text: "Ausgeräumt, gereinigt, eingeräumt" }], "m_reinigung", { pflicht: false }),
      R("Kaffeemaschine reinigen", "saft", "kaffee", { art: "schliessung", versatz: 0 }, { art: "schicht", wert: "spaet" }, [{ art: "haken", text: "Brühgruppe und Milchsystem gereinigt" }], "m_reinigung"),
      R("Temperatur Kühlbox", "kuehl", "kuehlbox", { art: "alle_std", std: 3 }, { art: "alle" }, [{ art: "messwert", text: "Temperatur", einheit: "°C", max: 7, krit: 8 }], "m_kuehl", { anleitung: "Kühlbox nur kurz öffnen, Thermometer in die Mitte, Wert ablesen." }),
      R("Schädlingskontrolle", "lager", null, { art: "monatlich", tagAb: 1, zeit: "11:00" }, { art: "rolle", wert: "shopleitung" }, [{ art: "auswahl", text: "Ergebnis", werte: ["kein Befall", "Befall"], schlecht: ["Befall"] }], "m_reinigung"),
    ];
    const warengruppen = [
      { id: "froyo", name: "Frozen Yogurt", sym: "🍦" }, { id: "obst", name: "Obstsalate", sym: "🍉" }, { id: "smoothie", name: "Smoothies", sym: "🥤" },
      { id: "saft", name: "Frische Säfte", sym: "🍊" }, { id: "stiel", name: "Eis am Stiel", sym: "🍭" }, { id: "warm", name: "Porridge & Milchreis", sym: "🥣" },
      { id: "quark", name: "Quark & Pudding", sym: "🍮" }, { id: "snack", name: "Waffeln & Snacks", sym: "🧇" },
      { id: "bowl", name: "Bowls", sym: "🥗" }, { id: "kaffee", name: "Café", sym: "☕" },
    ];
    const Z = (name, menge, einheit, allergene) => ({ name, menge, einheit, allergene: allergene || [] });
    const Rz = (gruppe, name, beschreibung, zutaten, schritte, extra) => Object.assign({ id: id("z"), gruppe, name, beschreibung, groessen: ["S", "M", "L"], zutaten, schritte }, extra || {});
    const rezepte = [
      Rz("froyo", "Frozen Yogurt Natur", "Der Klassiker, Basis für alle Becher.", [Z("Froyo-Basis Natur", { S: 150, M: 220, L: 300 }, "g", ["Milch"])], ["Becher wiegen und tarieren", "Froyo in gleichmäßiger Spirale einfüllen", "Toppings nach Wunsch, Saucen zuletzt"]),
      Rz("froyo", "Froyo Mango-Maracuja", "Fruchtig mit frischer Mango.", [Z("Froyo-Basis Natur", { S: 130, M: 190, L: 260 }, "g", ["Milch"]), Z("Mango gewürfelt", { S: 30, M: 45, L: 60 }, "g"), Z("Maracuja-Sauce", { S: 10, M: 15, L: 20 }, "ml")], ["Froyo einfüllen", "Mango darauf verteilen", "Sauce in Linien darüber"]),
      Rz("obst", "Obstsalat Klassik", "Bunter Obstsalat aus Saisonobst.", [Z("Apfel", { S: 40, M: 60, L: 80 }, "g"), Z("Banane", { S: 30, M: 45, L: 60 }, "g"), Z("Weintrauben", { S: 30, M: 45, L: 60 }, "g"), Z("Orange", { S: 40, M: 60, L: 80 }, "g"), Z("Zitronensaft", { S: 5, M: 5, L: 10 }, "ml")], ["Obst waschen", "In mundgerechte Stücke schneiden", "Mit Zitronensaft mischen", "Abdecken, Uhrzeit auf den Behälter"], { standzeit: "4 Std. in der Vitrine" }),
      Rz("obst", "Obstsalat Exotik", "Mit Ananas, Mango und Kiwi.", [Z("Ananas", { S: 50, M: 70, L: 90 }, "g"), Z("Mango gewürfelt", { S: 40, M: 60, L: 80 }, "g"), Z("Kiwi", { S: 30, M: 45, L: 60 }, "g"), Z("Granatapfelkerne", { S: 10, M: 15, L: 20 }, "g")], ["Obst schälen und schneiden", "Mischen", "Granatapfelkerne obendrauf"], { standzeit: "4 Std. in der Vitrine" }),
      Rz("smoothie", "Smoothie Beere", "Erdbeere, Himbeere, Banane.", [Z("Erdbeeren", { S: 80, M: 120, L: 160 }, "g"), Z("Himbeeren", { S: 40, M: 60, L: 80 }, "g"), Z("Banane", { S: 50, M: 70, L: 90 }, "g"), Z("Apfelsaft", { S: 100, M: 150, L: 200 }, "ml")], ["Obst in den Mixer", "Saft dazu", "30 Sekunden auf höchster Stufe mixen"]),
      Rz("smoothie", "Smoothie Grün", "Spinat, Apfel, Ingwer.", [Z("Babyspinat", { S: 20, M: 30, L: 40 }, "g"), Z("Apfel", { S: 80, M: 120, L: 160 }, "g"), Z("Ingwer", { S: 3, M: 5, L: 7 }, "g"), Z("Selleriestange", { S: 20, M: 30, L: 40 }, "g", ["Sellerie"]), Z("Wasser", { S: 100, M: 150, L: 200 }, "ml")], ["Alles in den Mixer", "45 Sekunden mixen"]),
      Rz("saft", "Orangensaft frisch", "Frisch gepresst.", [Z("Orangen", { S: 3, M: 4, L: 6 }, "Stück")], ["Orangen halbieren", "Auspressen", "Sofort servieren"]),
      Rz("stiel", "Eis am Stiel Erdbeere-Joghurt", "Handgemacht.", [Z("Joghurt", 60, "g", ["Milch"]), Z("Erdbeerpüree", 40, "g"), Z("Zucker", 8, "g")], ["Zutaten verrühren", "In Formen füllen, Stiel einsetzen", "Mindestens 6 Std. gefrieren"], { groessen: ["Stück"] }),
      Rz("warm", "Porridge Apfel-Zimt", "Warm und cremig.", [Z("Haferflocken", { S: 40, M: 60, L: 80 }, "g", ["Gluten"]), Z("Milch", { S: 150, M: 220, L: 300 }, "ml", ["Milch"]), Z("Apfel", { S: 30, M: 45, L: 60 }, "g"), Z("Zimt", { S: 1, M: 1, L: 2 }, "g")], ["Haferflocken mit Milch aufkochen", "3 Minuten quellen lassen", "Apfel und Zimt darauf"]),
      Rz("warm", "Milchreis Kirsch", "Klassisch mit Kirschen.", [Z("Milchreis gekocht", { S: 150, M: 220, L: 300 }, "g", ["Milch"]), Z("Kirschen", { S: 40, M: 60, L: 80 }, "g")], ["Milchreis erwärmen", "Kirschen darauf"]),
      Rz("quark", "Quark Beere", "Leichter Quark mit Beeren.", [Z("Magerquark", { S: 120, M: 180, L: 240 }, "g", ["Milch"]), Z("Beerenmischung", { S: 40, M: 60, L: 80 }, "g"), Z("Mandelblättchen", { S: 5, M: 8, L: 10 }, "g", ["Schalenfrüchte"])], ["Quark glatt rühren", "Beeren darauf", "Mandeln darüber"]),
      Rz("snack", "Waffel Classic", "Frisch gebacken.", [Z("Waffelteig", 120, "g", ["Gluten", "Ei", "Milch"]), Z("Puderzucker", 5, "g")], ["Waffeleisen vorheizen", "Teig einfüllen, 3 Minuten backen", "Mit Puderzucker bestäuben"], { groessen: ["Stück"] }),
      Rz("bowl", "Açaí Bowl", "Açaí-Basis mit Obst und Granola.", [Z("Açaí-Basis", { S: 150, M: 220, L: 300 }, "g"), Z("Banane", { S: 30, M: 45, L: 60 }, "g"), Z("Erdbeeren", { S: 30, M: 45, L: 60 }, "g"), Z("Granola", { S: 20, M: 30, L: 40 }, "g", ["Gluten", "Schalenfrüchte"])], ["Açaí-Basis cremig mixen", "In die Schale füllen", "Obst in Reihen anlegen", "Granola zuletzt, damit es knusprig bleibt"]),
      Rz("bowl", "Smoothie Bowl Mango", "Mango-Smoothie zum Löffeln.", [Z("Mango gewürfelt", { S: 120, M: 180, L: 240 }, "g"), Z("Banane", { S: 40, M: 60, L: 80 }, "g"), Z("Kokosraspeln", { S: 5, M: 8, L: 10 }, "g"), Z("Chiasamen", { S: 3, M: 5, L: 7 }, "g")], ["Mango und Banane dick mixen", "In die Schale füllen", "Mit Kokos und Chia bestreuen"]),
      Rz("kaffee", "Cappuccino", "Espresso mit Milchschaum.", [Z("Espresso", { S: 1, M: 1, L: 2 }, "Shot"), Z("Milch", { S: 120, M: 180, L: 240 }, "ml", ["Milch"])], ["Espresso beziehen", "Milch aufschäumen (60–65 °C)", "Schaum auf den Espresso geben"]),
    ];

    const state = {
      version: 7, erstellt: heuteIso, filialen, personen, wuensche: [], plan: [], abwesenheiten: [], stempel: [], pinnwand: [], tausch: [],
      // Büro: Ablage (Drucke, Notizen, Briefe), Adressbuch (Beispiele), Personalakte, Freigaben der Ordner
      buero: { ablage: [], adressen: [], personal: {}, rechte: {} },
      // Betreiber mit eigener Datenbank (Admin-Einstellungen). Nur öffentliche Verbindungsdaten, nie Geheimnisse.
      betreiber: [
        { id: "gm", name: "Genussmanufaktur (eigene Filialen)", art: "eigen", kontakt: "", email: "", avvDatum: "", supabase: { url: "", key: "", region: "eu-central-1" }, neon: { projekt: "", region: "aws-eu-central-1" }, schritte: { antrag: true }, pruefung: {}, freigegeben: false },
        { id: "fr1", name: "Beispiel-Franchise GmbH", art: "franchise", kontakt: "Beispiel", email: "", avvDatum: "", supabase: { url: "", key: "", region: "eu-central-1" }, neon: { projekt: "", region: "aws-eu-central-1" }, schritte: {}, pruefung: {}, freigegeben: false },
      ],
      veroeffentlicht: {}, parameter: { pause6: 30, pause9: 45, max: 600, pinnwand: { maxZettel: 4, zeichen: 200, erinnernTage: 3, pauseTage: 7 } },
      hygiene: { bereiche, geraetetypen, geraete, regeln, massnahmen, zuteilung: {}, durchfuehrungen: [], nachkontrollen: [], abweichungen: [] },
      rezepte: { warengruppen, rezepte, allergene: ALLERGENE },
    };
    // Wünsche für die nächste Woche, ein Urlaubsantrag, eine Krankmeldung
    const mo = L.montag(heuteIso), naechste = L.plusTage(mo, 7);
    state.wuensche.push({ id: id("w"), personId: pid("Lena"), datum: L.plusTage(naechste, 1), art: "nicht", schicht: "egal", notiz: "Arzttermin" });
    state.wuensche.push({ id: id("w"), personId: pid("Mia"), datum: L.plusTage(mo, 11), art: "moechte", schicht: "spaet", notiz: "Road Runner Stadtfest" });
    state.wuensche.push({ id: id("w"), personId: pid("Jonas"), datum: L.plusTage(naechste, 5), art: "moechte", schicht: "frueh", notiz: "" });
    // Urlaub dieses Jahres (genommen) und Übertrag, für das Urlaubskonto
    const jahr = heuteIso.slice(0, 4);
    const U = (vorname, von, bis, art, status) => state.abwesenheiten.push({ id: id("a"), personId: pid(vorname), art: art || "urlaub", von: `${jahr}-${von}`, bis: `${jahr}-${bis}`, status: status || "genehmigt", notiz: "" });
    U("Lena", "03-02", "03-13"); U("Lena", "07-20", "07-31"); U("Sandra", "05-11", "05-22"); U("Sandra", "08-17", "08-28"); U("Tom", "06-01", "06-12");
    U("Leonie", "09-07", "09-11"); U("Anna", "04-06", "04-17"); U("Mehmet", "07-06", "07-24"); U("Nina", "10-12", "10-23"); U("Ben", "02-16", "02-20");
    U("Tom", "11-23", "11-25", "bildungsurlaub", "beantragt");
    U("Lena", "12-21", "12-24", "urlaub", "beantragt");
    state.personen.find((x) => x.vorname === "Sandra").urlaubUebertrag = 3;
    state.abwesenheiten.push({ id: id("a"), personId: pid("Paul"), art: "urlaub", von: L.plusTage(naechste, 2), bis: L.plusTage(naechste, 4), status: "beantragt", notiz: "Familienfeier" });
    // Plan dieser Woche automatisch füllen und veröffentlichen
    // erst alle Filialen mit eigenem Team, dann Lücken mit Springern füllen
    for (const f of filialen) state.plan.push(...L.planVorschlag(state, f.id, mo, () => id("s"), { nurStamm: true }));
    for (const f of filialen) {
      state.plan.push(...L.planVorschlag(state, f.id, mo, () => id("s")));
      state.veroeffentlicht[`${f.id}|${mo}`] = true;
    }
    state.abwesenheiten.push({ id: id("a"), personId: pid("Lukas"), art: "krank", von: heuteIso, bis: L.plusTage(heuteIso, 1), status: "gemeldet", notiz: "" });
    // Beispiel-Stempelzeiten der vergangenen Tage dieser Woche (für Stundenliste und Export)
    for (const sc of state.plan) {
      if (sc.datum >= heuteIso) continue;
      const f = filialen.find((x) => x.id === sc.filiale), z = L.schichtZeit(f, sc.datum, sc.schicht);
      const vers = (n % 7) - 3; n++;
      state.stempel.push({ id: id("t"), personId: sc.personId, filiale: sc.filiale, art: "kommen", zeit: `${sc.datum}T${L.minZuZeit(z.start + vers)}:00` });
      state.stempel.push({ id: id("t"), personId: sc.personId, filiale: sc.filiale, art: "pause", zeit: `${sc.datum}T${L.minZuZeit(z.start + 180)}:00` });
      state.stempel.push({ id: id("t"), personId: sc.personId, filiale: sc.filiale, art: "weiter", zeit: `${sc.datum}T${L.minZuZeit(z.start + 195)}:00` });
      state.stempel.push({ id: id("t"), personId: sc.personId, filiale: sc.filiale, art: "gehen", zeit: `${sc.datum}T${L.minZuZeit(z.ende + vers + 4)}:00` });
    }
    // Tauschbörse: ein offenes Angebot (nur Stunden) und eine Anfrage, die die Shopleitung bestätigen muss
    const kuenftig = (vorname) => state.plan.filter((x) => x.personId === pid(vorname) && x.datum > heuteIso).sort((a, b) => a.datum.localeCompare(b.datum));
    const lenaS = kuenftig("Lena")[0];
    if (lenaS) { const z = L.planZeit(state, lenaS); state.tausch.push({ id: id("x"), schichtId: lenaS.id, vonId: pid("Lena"), teil: { start: z.ende - 120, ende: z.ende }, notiz: "Arzttermin am Nachmittag", status: "offen", zeit: heuteIso + "T08:30" }); }
    const tomS = kuenftig("Tom")[0];
    if (tomS) { const fremdOk = (p) => !L.schichtenAm(state, tomS.datum, (x) => x.personId === p).length && !L.abwesenheitAm(state, p, tomS.datum);
      const nehmer = ["Leonie", "Jonas", "Mia"].map(pid).find(fremdOk);
      if (nehmer) state.tausch.push({ id: id("x"), schichtId: tomS.id, vonId: pid("Tom"), teil: null, notiz: "Familienfeier", status: "angefragt", nehmerId: nehmer, gegenId: null, zeit: heuteIso + "T07:45", anfrage: heuteIso + "T09:15" }); }
    // Pinnwand: Zettel mit Empfängern, Farbe, wichtig und Lesebestätigung (wer hat wann gelesen)
    const PZ = (filiale, von, text, extra) => Object.assign({ id: id("n"), filiale, vonId: pid(von), text, zeit: heuteIso + "T09:00", wichtig: false, farbe: 1, fuer: "alle", empfaenger: [], gelesen: {}, abgenommen: {}, bis: null }, extra || {});
    state.pinnwand.push(PZ("och", "Sandra", "Neue Mango-Sauce ist da. Bitte zuerst die alte aufbrauchen.", { wichtig: true, gelesen: { [pid("Tom")]: heuteIso + "T09:20" } }));
    state.pinnwand.push(PZ(null, "Inhaber", "Willkommen in der neuen frooters Team-App (Testversion). Schaut euch alles in Ruhe an! 🍓", { farbe: 3, zeit: L.plusTage(heuteIso, -4) + "T08:00" }));
    state.pinnwand.push(PZ("och", "Tom", "Lena, kannst du am Samstag die Kühlgeräte-Reinigung übernehmen? Ich bin erst ab 12 da.", { farbe: 2, fuer: "personen", empfaenger: [pid("Lena")], zeit: heuteIso + "T10:05" }));
    state.pinnwand.push(PZ("och", "Sandra", "Inventur am Montag nach Ladenschluss. Bitte im Dienstplan eintragen, wer helfen kann.", { farbe: 4, fuer: "leitung", zeit: L.plusTage(heuteIso, -1) + "T16:30" }));
    // Büro-Beispiele (keine echten Firmen, keine echten Nummern)
    const A = (kategorie, firma, name, telefon, email, notiz, filiale) => state.buero.adressen.push({ id: id("ad"), kategorie, firma, name, telefon, email, notiz, filiale: filiale || null });
    A("Techniker", "Kältetechnik (Beispiel)", "Notdienst", "0000 000000", "", "Kühlvitrinen und Tiefkühler", null);
    A("Techniker", "Froyo-Maschinen-Service (Beispiel)", "", "0000 000001", "", "Wartung laut Hersteller", null);
    A("Center", "Center-Management Designer Outlet (Beispiel)", "", "0000 000002", "", "Hausmeister, Öffnungszeiten Feiertage", "och");
    A("Lieferant", "Obst und Gemüse (Beispiel)", "", "0000 000003", "", "Lieferung Mo, Mi, Fr", null);
    A("Hygiene", "Hygieneberatung (Beispiel)", "", "0000 000004", "", "Externer Berater", null);
    A("Steuerberater", "Steuerbüro (Beispiel)", "", "0000 000005", "", "Lohnabrechnung, Stundenliste monatlich", null);
    state.buero.ablage.push({ id: id("bl"), ordner: "shop", filiale: "och", titel: "Froyo-Maschine: Reinigung", kategorie: "Anweisung", text: "Jeden Abend nach Ladenschluss nach Herstellervorgabe reinigen. Foto in der Hygiene-Liste nicht vergessen.", zeit: heuteIso + "T08:00", vonId: pid("Sandra") });
    state.buero.ablage.push({ id: id("bl"), ordner: "zentrale", filiale: null, titel: "Pilot Ochtrup: Notizen", kategorie: "Notiz", text: "Rückmeldungen aus dem Pilot hier sammeln.", zeit: heuteIso + "T08:00", vonId: pid("Inhaber") });
    for (const p of personen.filter((x) => !L.UEBERGREIFEND.includes(x.rolle))) {
      const k = Number(p.id.slice(1));
      state.buero.personal[p.id] = { vertrag: `${Number(jahr) - 1 - (k % 3)}-0${1 + (k % 9)}-01`, belehrung: `${Number(jahr) - 1 - (k % 2)}-${String(1 + (k % 12)).padStart(2, "0")}-15`, datenschutz: k % 4 ? `${jahr}-0${1 + (k % 8)}-10` : "", schulung: k % 3 ? `${Number(jahr) - (k % 2)}-0${1 + (k % 9)}-20` : "" };
    }
    state.naechsteId = n + 1;
    return state;
  }

  // ---------- Adapter ----------
  const ADAPTER = {
    demo: {
      name: "Demo im Browser",
      laden() { try { const t = localStorage.getItem(SCHLUESSEL); return t ? JSON.parse(t) : null; } catch (e) { return null; } },
      speichern(s) { try { localStorage.setItem(SCHLUESSEL, JSON.stringify(s)); return true; } catch (e) { return false; } },
      zuruecksetzen() { try { localStorage.removeItem(SCHLUESSEL); } catch (e) { /* nichts gespeichert */ } },
    },
  };
  function adapter(name) { return ADAPTER[name || "demo"]; }

  return { demoDaten, adapter, ALLERGENE, SCHLUESSEL };
});
