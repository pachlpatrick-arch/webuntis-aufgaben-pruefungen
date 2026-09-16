# WebUntis Aufgaben und Prüfungen iCal

Dieses Repository erstellt einen eigenständigen iCal-Kalender aus:

- WebUntis-Hausaufgaben
- WebUntis-Prüfungen

Der Stundenplan wird nicht in diesen Kalender aufgenommen.

## Ausgabedatei

aufgaben-pruefungen.ics

## Hausaufgaben

Hausaufgaben werden als Ganztagstermin am Aufgabedatum eingetragen.

Beispiel:

HÜ: E - 17.09.2026

Beschreibung:

Hausaufgabe: WB 7/8
WB 8/9
Fällig am: 17.09.2026
Status: Offen

## Prüfungen

Beispiele:

SA: Englisch

Test: Englisch

Die Prüfungsart und das Fach werden direkt aus WebUntis übernommen.

## Benötigte GitHub-Secrets

WEBUNTIS_SCHOOL

WEBUNTIS_USERNAME

WEBUNTIS_PASSWORD

## Automatische Aktualisierung

Der GitHub-Workflow erzeugt und aktualisiert automatisch:

aufgaben-pruefungen.ics
