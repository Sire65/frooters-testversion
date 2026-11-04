// frooters Team-App – Datenzugang über austauschbare Adapter (KICC-Regel 4 und 18).
// Version 0.1: Adapter "demo" speichert im Browser (Beispieldaten). Ein Adapter "supabase" (Edge Function fr-app)
// muss dieselben Methoden liefern: laden() → Zustand, speichern(zustand), zuruecksetzen().
(function (root, fabrik) {
  if (typeof module === "object" && module.exports) module.exports = fabrik(require("./logik.js"));
  else root.FRD = fabrik(root.FRL);
})(typeof self !== "undefined" ? self : this, function (L) {
  "use strict";
  const SCHLUESSEL = "frooters_demo_v1";

  const ALLERGENE = ["Gluten", "Krebstiere", "Ei", "Fisch", "Erdnüsse", "Soja", "Milch", "Schalenfrüchte", "Sellerie", "Senf", "Sesam", "Schwefeldioxid", "Lupinen", "Weichtiere"];

  function demoDaten(heuteIso) {
    let n = 0;
    const id = (p) => `${p}${++n}`;
    const offen = (mo, sa) => ({ mo, di: mo, mi: mo, do: mo, fr: sa || mo, sa: sa || mo, so: null });
    const filialen = [
      { id: "min", name: "Minden · Hagemeyer", kurz: "Minden", oeffnung: offen(["10:00", "19:00"], ["10:00", "19:00"]), bedarf: { standard: { frueh: 2, spaet: 2 }, sa: { frueh: 3, spaet: 3 } } },
      { id: "ess", name: "Essen · Limbecker Platz", kurz: "Essen", oeffnung: offen(["10:00", "20:00"]), bedarf: { standard: { frueh: 2, spaet: 2 }, sa: { frueh: 3, spaet: 3 } } },
      { id: "obh", name: "Oberhausen · Centro", kurz: "Oberhausen", oeffnung: offen(["10:00", "20:00"], ["10:00", "22:00"]), bedarf: { standard: { frueh: 2, spaet: 2 }, sa: { frueh: 3, spaet: 3 } } },
    ];
    const P = (vorname, nachname, rolle, stamm, extra) => Object.assign({ id: id("p"), vorname, nachname, rolle, stammfiliale: stamm, springer: false, einsatzfilialen: [], wochenstunden: 30, pin: "1234", aktiv: true }, extra || {});
    const personen = [
      P("Inhaber", "(Demo)", "zentrale", null, { wochenstunden: 0 }),
      P("Sandra", "Becker", "shopleitung", "min", { wochenstunden: 38 }),
      P("Tom", "Krüger", "stv", "min", { wochenstunden: 35 }),
      P("Lena", "Hoffmann", "mitarbeiter", "min", { wochenstunden: 25 }),
      P("Jonas", "Wagner", "aushilfe", "min", { wochenstunden: 10, springer: true, einsatzfilialen: ["ess"] }),
      P("Mehmet", "Yilmaz", "shopleitung", "ess", { wochenstunden: 38 }),
      P("Julia", "Schmitz", "stv", "ess", { wochenstunden: 32 }),
      P("Paul", "Richter", "mitarbeiter", "ess", { wochenstunden: 25 }),
      P("Sophie", "Klein", "aushilfe", "ess", { wochenstunden: 12, springer: true, einsatzfilialen: ["obh", "min"] }),
      P("Anna", "Wolf", "shopleitung", "obh", { wochenstunden: 38 }),
      P("Lukas", "Braun", "mitarbeiter", "obh", { wochenstunden: 30 }),
      P("Emma", "Neumann", "aushilfe", "obh", { wochenstunden: 10, springer: true, einsatzfilialen: ["ess"] }),
      P("Can", "Öztürk", "mitarbeiter", "obh", { wochenstunden: 20 }),
    ];
    const pid = (vorname) => personen.find((p) => p.vorname === vorname).id;

    const bereiche = [
      { id: "kuehl", name: "Kühlung" }, { id: "froyo", name: "Froyo-Station" }, { id: "saft", name: "Saftbar" },
      { id: "theke", name: "Theke" }, { id: "personal", name: "Personal" }, { id: "waren", name: "Wareneingang" }, { id: "lager", name: "Lager" },
    ];
    const geraetetypen = [
      { id: "vitrine", name: "Kühlvitrine" }, { id: "tk", name: "Tiefkühler" }, { id: "froyo", name: "Froyo-Maschine" },
      { id: "eis", name: "Eismaschine" }, { id: "presse", name: "Saftpresse" }, { id: "mixer", name: "Mixer" }, { id: "waffel", name: "Waffeleisen" },
    ];
    const G = (filiale, typ, name) => ({ id: id("g"), filiale, typ, name, status: "aktiv" });
    const geraete = [
      G("min", "vitrine", "Kühlvitrine 1 (links)"), G("min", "vitrine", "Kühlvitrine 2 (rechts)"), G("min", "tk", "Tiefkühler"), G("min", "froyo", "Froyo-Maschine"),
      G("min", "presse", "Saftpresse"), G("min", "mixer", "Mixer"), G("min", "waffel", "Waffeleisen"),
      G("ess", "vitrine", "Kühlvitrine"), G("ess", "tk", "Tiefkühler"), G("ess", "froyo", "Froyo-Maschine"), G("ess", "eis", "Eismaschine"), G("ess", "mixer", "Mixer"),
      G("obh", "vitrine", "Kühlvitrine"), G("obh", "tk", "Tiefkühler"), G("obh", "froyo", "Froyo-Maschine"), G("obh", "presse", "Saftpresse"),
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
      R("Schädlingskontrolle", "lager", null, { art: "monatlich", tagAb: 1, zeit: "11:00" }, { art: "rolle", wert: "shopleitung" }, [{ art: "auswahl", text: "Ergebnis", werte: ["kein Befall", "Befall"], schlecht: ["Befall"] }], "m_reinigung"),
    ];
    const warengruppen = [
      { id: "froyo", name: "Frozen Yogurt", sym: "🍦" }, { id: "obst", name: "Obstsalate", sym: "🍉" }, { id: "smoothie", name: "Smoothies", sym: "🥤" },
      { id: "saft", name: "Frische Säfte", sym: "🍊" }, { id: "stiel", name: "Eis am Stiel", sym: "🍭" }, { id: "warm", name: "Porridge & Milchreis", sym: "🥣" },
      { id: "quark", name: "Quark & Pudding", sym: "🍮" }, { id: "snack", name: "Waffeln & Snacks", sym: "🧇" },
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
    ];

    const state = {
      version: 1, erstellt: heuteIso, filialen, personen, wuensche: [], plan: [], abwesenheiten: [], stempel: [], pinnwand: [],
      veroeffentlicht: {}, parameter: { pause6: 30, pause9: 45, max: 600 },
      hygiene: { bereiche, geraetetypen, geraete, regeln, massnahmen, zuteilung: {}, durchfuehrungen: [], nachkontrollen: [], abweichungen: [] },
      rezepte: { warengruppen, rezepte, allergene: ALLERGENE },
    };
    // Wünsche für die nächste Woche, ein Urlaubsantrag, eine Krankmeldung
    const mo = L.montag(heuteIso), naechste = L.plusTage(mo, 7);
    state.wuensche.push({ id: id("w"), personId: pid("Lena"), datum: L.plusTage(naechste, 1), art: "nicht", schicht: "egal", notiz: "Arzttermin" });
    state.wuensche.push({ id: id("w"), personId: pid("Jonas"), datum: L.plusTage(naechste, 5), art: "moechte", schicht: "frueh", notiz: "" });
    state.abwesenheiten.push({ id: id("a"), personId: pid("Paul"), art: "urlaub", von: L.plusTage(naechste, 2), bis: L.plusTage(naechste, 4), status: "beantragt", notiz: "Familienfeier" });
    // Plan dieser Woche automatisch füllen und veröffentlichen
    // erst alle Filialen mit eigenem Team, dann Lücken mit Springern füllen
    for (const f of filialen) state.plan.push(...L.planVorschlag(state, f.id, mo, () => id("s"), { nurStamm: true }));
    for (const f of filialen) {
      state.plan.push(...L.planVorschlag(state, f.id, mo, () => id("s")));
      state.veroeffentlicht[`${f.id}|${mo}`] = true;
    }
    state.abwesenheiten.push({ id: id("a"), personId: pid("Lukas"), art: "krank", von: heuteIso, bis: L.plusTage(heuteIso, 1), status: "gemeldet", notiz: "" });
    state.pinnwand.push({ id: id("n"), filiale: "min", vonId: pid("Sandra"), text: "Neue Mango-Sauce ist da. Bitte zuerst die alte aufbrauchen.", zeit: heuteIso + "T09:00", wichtig: true });
    state.pinnwand.push({ id: id("n"), filiale: null, vonId: pid("Inhaber"), text: "Willkommen in der neuen frooters Team-App (Testversion).", zeit: heuteIso + "T08:00", wichtig: false });
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
