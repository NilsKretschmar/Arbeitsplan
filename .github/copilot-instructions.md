<!-- Workspace-specific instructions for Copilot -->

# Arbeitsplan Project

This is a React-based shift planning application for managing work schedules, availability, and shift swaps.

## Project Setup Complete

- Project Type: Vite + React
- Language: JavaScript/JSX
- Key Files:
  - `src/App.jsx` - Main application component
  - `index.html` - HTML entry point
  - `package.json` - Dependencies configuration

## Key Features

- User authentication (login/register)
- Availability management with calendar interface
- Automatic shift plan generation (admin only)
- Shift swap suggestions
- Work statistics and tracking
- Swiss holiday support (Zurich)
- Dark mode support via CSS variables

## Development Workflow

- Local storage for data persistence
- Monthly planning cycles
- Color-coded availability (green=available, yellow=maybe, empty=unavailable)
- Admin and user role differentiation

## Installation & Running

1. Install dependencies: `npm install`
2. Start dev server: `npm run dev`
3. Build for production: `npm run build`

## Important Notes

- App uses localStorage for data persistence (no backend)
- All components use inline styles with CSS variables for theming
- Holidays are hardcoded for 2025-2026 (Zurich region)
- Currently supports German language interface
