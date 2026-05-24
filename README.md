# Arbeitsplan

Eine React-basierte Webanwendung zur Verwaltung von Arbeitsplänen mit Verfügbarkeitsverwaltung, automatischer Planerstellung und Tauschfunktionen.

## Features

- **BenutzerAuthentifizierung**: Login und Registrierung für Benutzer
- **Verfügbarkeitsverwaltung**: Benutzer können ihre Verfügbarkeit für 3 Monate im Voraus angeben (Grün = Kann, Gelb = Vielleicht, Leer = Nein)
- **Automatische Planerstellung**: Admin kann Pläne automatisch basierend auf Verfügbarkeit erstellen
- **Tauschvorschläge**: Benutzer können Schichten mit anderen tauschen
- **Arbeitsübersicht**: Tracking von Einsatzquoten und Arbeitstagen
- **Feiertage**: Automatische Berücksichtigung von Zürcher Feiertagen

## Getting Started

### Prerequisites
- Node.js 16+
- npm oder yarn

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Die App wird unter `http://localhost:5173` geöffnet.

### Build

```bash
npm run build
```

## Verwendung

1. **Login**: Mit den Standarddaten anmelden (admin / admin123) oder neuen Benutzer registrieren
2. **Kommende Planung**: Verfügbarkeit für die nächsten 3 Monate angeben
3. **Aktueller Plan**: Einsatzplan anschauen und Tauschvorschläge einreichen
4. **Meine Übersicht**: Statistiken zu Arbeitstagen und Einsatzquoten

## Architektur

- **React Hooks**: useState und useEffect für State Management
- **LocalStorage**: Persistierung von Daten im Browser
- **CSS-in-JS**: Inline Styles mit CSS-Variablen für Dark Mode Support
- **Komponentenstruktur**: Getrennte Komponenten für verschiedene Views

## Technologie Stack

- React 18
- Vite (Build Tool)
- Vanilla CSS
