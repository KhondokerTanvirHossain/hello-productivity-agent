# Sprint 6 Design — React Dashboard

## Scope

Build the React dashboard with three pages: EOD Review (primary), Today timeline, and Weekly breakdown. Single sprint covering scaffold + all pages + shared components.

## Tech Stack

- React 18 + Vite (port 5173)
- Tailwind CSS (utility classes, functional styling)
- React Router (URL-based routing)
- Recharts (pie chart, bar chart)
- API: FastAPI on port 9147

## Files to Create

| File | Purpose |
|------|---------|
| `dashboard/package.json` | Dependencies: react, react-dom, react-router-dom, recharts, tailwindcss, vite |
| `dashboard/vite.config.js` | React plugin, port 5173, proxy `/blocks` and `/summary` to `:9147` |
| `dashboard/tailwind.config.js` | Tailwind config pointing to `src/**/*.jsx` |
| `dashboard/postcss.config.js` | PostCSS with Tailwind + autoprefixer |
| `dashboard/index.html` | Vite entry HTML |
| `dashboard/src/main.jsx` | ReactDOM.createRoot + BrowserRouter |
| `dashboard/src/App.jsx` | NavBar + Routes |
| `dashboard/src/constants.js` | CATEGORIES map (id → label + color) |
| `dashboard/src/pages/Review.jsx` | EOD review screen |
| `dashboard/src/pages/Today.jsx` | Today's read-only timeline |
| `dashboard/src/pages/Weekly.jsx` | Weekly category breakdown |
| `dashboard/src/components/NavBar.jsx` | Top navigation bar |
| `dashboard/src/components/BlockCard.jsx` | Work block card (editable + read-only modes) |
| `dashboard/src/components/CategoryPill.jsx` | Colored category badge |
| `dashboard/src/components/TimelineBar.jsx` | Horizontal stacked bar |

## Architecture

Single-page React app. Three routes served by React Router:

| Route | Page | Purpose |
|-------|------|---------|
| `/review` | Review.jsx | EOD review — edit blocks, Done → pie chart |
| `/today` | Today.jsx | Read-only timeline of today |
| `/weekly` | Weekly.jsx | Weekly bar chart + breakdown |

Vite proxies API calls to `http://localhost:9147` so the dashboard can `fetch("/blocks/today")` without CORS issues in dev.

## Categories (constants.js)

```js
{
  meeting:  { label: "Meetings",       color: "#6366F1" },
  coding:   { label: "Coding",         color: "#10B981" },
  research: { label: "Research",       color: "#F59E0B" },
  bizdev:   { label: "Business Dev",   color: "#EF4444" },
  infra:    { label: "Infrastructure", color: "#8B5CF6" },
  planning: { label: "Planning",       color: "#3B82F6" },
  admin:    { label: "Admin",          color: "#6B7280" },
}
```

## Shared Components

### NavBar
Horizontal bar with three NavLinks (Review, Today, Weekly). Active route highlighted. Always visible.

### CategoryPill
Small colored badge. Takes `category` prop, looks up label/color from CATEGORIES.

### BlockCard
Displays one work block. Two modes:
- **Read-only** (Today page): time range, CategoryPill, apps used, note
- **Editable** (Review page): same plus confirm button, category dropdown (7 options), note input

Props: `block`, `editable`, `onChange`. onChange passes `{category, note, user_confirmed}` to parent.

### TimelineBar
Horizontal stacked bar showing day's blocks as colored segments proportional to duration. Each segment colored by category.

## Pages

### Review.jsx (primary)
1. Fetch `/blocks/today` on mount
2. TimelineBar at top
3. Editable BlockCards for each block
4. User confirms/edits categories, adds optional notes
5. "Done" button → PATCH each changed block to `/blocks/{id}` in sequence
6. After PATCHes complete → switch to summary view:
   - PieChart (Recharts) showing category breakdown
   - Total tracked time
7. Empty state if no blocks

### Today.jsx
1. Fetch `/blocks/today` on mount
2. TimelineBar at top
3. Read-only BlockCards
4. No editing, no charts

### Weekly.jsx
1. Fetch `/summary/week` on mount
2. Stacked BarChart — one bar per day (Mon–Sun), stacked by category
3. Category breakdown legend/table
4. Total tracked hours for the week
5. Previous/next week navigation (pass `?date=` to API)

## Data Flow

- Plain `fetch()` in `useEffect` — no state management library
- Review page: local `useState` holds blocks with edits, bulk PATCH on "Done"
- Each page fetches its own data independently

## Error Handling

- API unreachable → "Cannot connect to tracker API. Is the server running on port 9147?"
- PATCH failure → inline error on that card, don't block others
- Empty data → friendly empty states per page
- No loading spinners — API is local and fast, simple conditional render

## Styling

Functional + clean Tailwind. Good spacing, category colors, readable typography. No animations, no dark mode, no fancy transitions. Professional but minimal.

## Testing

No frontend unit tests in Sprint 6. The dashboard is a thin UI over a well-tested API (146 backend tests). Manual testing with seeded data. Add Vitest + React Testing Library if dashboard grows in Phase 2+.

## Done Criteria

- `npm run dev` serves dashboard on port 5173
- `/review` loads blocks, allows editing, Done shows pie chart
- `/today` shows read-only timeline
- `/weekly` shows stacked bar chart with week navigation
- EOD notification URL (`http://localhost:5173/review`) lands correctly
