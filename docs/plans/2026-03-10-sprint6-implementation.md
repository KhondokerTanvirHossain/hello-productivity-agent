# Sprint 6: React Dashboard — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Use frontend-design and react-best-practices skills when writing JSX components.

**Goal:** Build a React dashboard with three pages — EOD Review (edit + confirm blocks → pie chart), Today (read-only timeline), and Weekly (stacked bar chart) — served on localhost:5173, talking to the FastAPI API on localhost:9147.

**Architecture:** Single-page React app with React Router. Vite dev server proxies API calls to port 9147. Shared components (BlockCard, CategoryPill, TimelineBar) used across pages. Plain useState + fetch for data — no state management library. Tailwind CSS for styling.

**Tech Stack:** React 18, Vite, Tailwind CSS, React Router, Recharts

---

### Task 1: Project Scaffold

**Files:**
- Create: `dashboard/package.json`
- Create: `dashboard/vite.config.js`
- Create: `dashboard/tailwind.config.js`
- Create: `dashboard/postcss.config.js`
- Create: `dashboard/index.html`
- Create: `dashboard/src/index.css`

**Step 1: Create package.json**

```json
{
  "name": "productivity-tracker-dashboard",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.28.0",
    "recharts": "^2.15.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.17",
    "vite": "^6.0.5"
  }
}
```

**Step 2: Create vite.config.js**

```js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/blocks": "http://localhost:9147",
      "/summary": "http://localhost:9147",
    },
  },
});
```

**Step 3: Create tailwind.config.js**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

**Step 4: Create postcss.config.js**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

**Step 5: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Productivity Tracker</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

**Step 6: Create src/index.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Step 7: Install dependencies**

Run: `cd dashboard && npm install`
Expected: `node_modules/` created, no errors

**Step 8: Verify Vite starts**

Run: `cd dashboard && npx vite --host 2>&1 | head -5`
Expected: Output shows "Local: http://localhost:5173/"

(Kill the dev server after verifying)

**Step 9: Commit**

```bash
git add dashboard/package.json dashboard/package-lock.json dashboard/vite.config.js dashboard/tailwind.config.js dashboard/postcss.config.js dashboard/index.html dashboard/src/index.css
git commit -m "feat: scaffold Vite + React + Tailwind dashboard"
```

---

### Task 2: Constants + Main + App Shell

**Files:**
- Create: `dashboard/src/constants.js`
- Create: `dashboard/src/main.jsx`
- Create: `dashboard/src/App.jsx`
- Create: `dashboard/src/components/NavBar.jsx`

**Step 1: Create constants.js**

```js
export const CATEGORIES = {
  meeting: { label: "Meetings", color: "#6366F1" },
  coding: { label: "Coding", color: "#10B981" },
  research: { label: "Research", color: "#F59E0B" },
  bizdev: { label: "Business Dev", color: "#EF4444" },
  infra: { label: "Infrastructure", color: "#8B5CF6" },
  planning: { label: "Planning", color: "#3B82F6" },
  admin: { label: "Admin", color: "#6B7280" },
};
```

**Step 2: Create NavBar.jsx**

```jsx
import { NavLink } from "react-router-dom";

const links = [
  { to: "/review", label: "Review" },
  { to: "/today", label: "Today" },
  { to: "/weekly", label: "Weekly" },
];

export default function NavBar() {
  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-3">
      <div className="max-w-4xl mx-auto flex items-center gap-6">
        <span className="font-semibold text-gray-900">Productivity Tracker</span>
        <div className="flex gap-4">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `text-sm font-medium px-3 py-1 rounded ${
                  isActive
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-500 hover:text-gray-700"
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
```

**Step 3: Create App.jsx**

```jsx
import { Routes, Route, Navigate } from "react-router-dom";
import NavBar from "./components/NavBar";
import Review from "./pages/Review";
import Today from "./pages/Today";
import Weekly from "./pages/Weekly";

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <main className="max-w-4xl mx-auto px-6 py-6">
        <Routes>
          <Route path="/review" element={<Review />} />
          <Route path="/today" element={<Today />} />
          <Route path="/weekly" element={<Weekly />} />
          <Route path="*" element={<Navigate to="/review" replace />} />
        </Routes>
      </main>
    </div>
  );
}
```

**Step 4: Create main.jsx**

```jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
```

**Step 5: Create placeholder pages**

Create three placeholder files so the app compiles:

`dashboard/src/pages/Review.jsx`:
```jsx
export default function Review() {
  return <h1 className="text-2xl font-bold">Review</h1>;
}
```

`dashboard/src/pages/Today.jsx`:
```jsx
export default function Today() {
  return <h1 className="text-2xl font-bold">Today</h1>;
}
```

`dashboard/src/pages/Weekly.jsx`:
```jsx
export default function Weekly() {
  return <h1 className="text-2xl font-bold">Weekly</h1>;
}
```

**Step 6: Verify app loads**

Run: `cd dashboard && npx vite --host 2>&1 | head -5`

Open `http://localhost:5173` in a browser. Expected:
- NavBar visible at top with Review, Today, Weekly links
- Redirects to `/review` by default
- Clicking nav links switches between placeholder pages
- Tailwind styles applied (font renders correctly)

(Kill the dev server after verifying)

**Step 7: Commit**

```bash
git add dashboard/src/
git commit -m "feat: add app shell with React Router and NavBar"
```

---

### Task 3: CategoryPill + TimelineBar Components

**Files:**
- Create: `dashboard/src/components/CategoryPill.jsx`
- Create: `dashboard/src/components/TimelineBar.jsx`

**Step 1: Create CategoryPill.jsx**

```jsx
import { CATEGORIES } from "../constants";

export default function CategoryPill({ category }) {
  const cat = CATEGORIES[category] || { label: category, color: "#9CA3AF" };

  return (
    <span
      className="inline-block text-xs font-medium px-2 py-0.5 rounded-full text-white"
      style={{ backgroundColor: cat.color }}
    >
      {cat.label}
    </span>
  );
}
```

**Step 2: Create TimelineBar.jsx**

This component renders a horizontal stacked bar. Each segment is proportional to the block's duration and colored by category.

```jsx
import { CATEGORIES } from "../constants";

export default function TimelineBar({ blocks }) {
  if (!blocks || blocks.length === 0) return null;

  const totalMin = blocks.reduce((sum, b) => sum + b.duration_min, 0);
  if (totalMin === 0) return null;

  return (
    <div className="flex w-full h-8 rounded overflow-hidden mb-6">
      {blocks.map((block) => {
        const pct = (block.duration_min / totalMin) * 100;
        const cat = CATEGORIES[block.category] || { color: "#9CA3AF" };
        return (
          <div
            key={block.id}
            className="h-full"
            style={{ width: `${pct}%`, backgroundColor: cat.color }}
            title={`${CATEGORIES[block.category]?.label || block.category}: ${block.duration_min}m`}
          />
        );
      })}
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add dashboard/src/components/CategoryPill.jsx dashboard/src/components/TimelineBar.jsx
git commit -m "feat: add CategoryPill and TimelineBar components"
```

---

### Task 4: BlockCard Component

**Files:**
- Create: `dashboard/src/components/BlockCard.jsx`

**Step 1: Create BlockCard.jsx**

This is the most complex component. It has two modes: read-only (Today page) and editable (Review page).

```jsx
import { CATEGORIES } from "../constants";
import CategoryPill from "./CategoryPill";

function formatTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function BlockCard({ block, editable, onChange }) {
  const handleCategoryChange = (e) => {
    onChange({ ...block, category: e.target.value, user_confirmed: true });
  };

  const handleNoteChange = (e) => {
    onChange({ ...block, note: e.target.value });
  };

  const handleConfirm = () => {
    onChange({ ...block, user_confirmed: true });
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            {formatTime(block.started_at)} – {formatTime(block.ended_at)}
          </span>
          <span className="text-sm text-gray-400">{block.duration_min}m</span>
        </div>
        {editable ? (
          <div className="flex items-center gap-2">
            <select
              value={block.category}
              onChange={handleCategoryChange}
              className="text-sm border border-gray-300 rounded px-2 py-1"
            >
              {Object.entries(CATEGORIES).map(([id, { label }]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
            {!block.user_confirmed && (
              <button
                onClick={handleConfirm}
                className="text-sm bg-green-50 text-green-700 border border-green-200 rounded px-2 py-1 hover:bg-green-100"
              >
                ✓
              </button>
            )}
            {block.user_confirmed && (
              <span className="text-sm text-green-600">✓</span>
            )}
          </div>
        ) : (
          <CategoryPill category={block.category} />
        )}
      </div>

      <div className="flex items-center gap-2 mb-2">
        <CategoryPill category={block.category} />
        <span className="text-xs text-gray-400">
          {block.apps_used?.join(", ")}
        </span>
      </div>

      {editable ? (
        <input
          type="text"
          value={block.note || ""}
          onChange={handleNoteChange}
          placeholder="Add a note (optional)"
          className="w-full text-sm border border-gray-200 rounded px-3 py-1.5 text-gray-700 placeholder-gray-400"
        />
      ) : (
        block.note && (
          <p className="text-sm text-gray-600 italic">{block.note}</p>
        )
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add dashboard/src/components/BlockCard.jsx
git commit -m "feat: add BlockCard component with editable and read-only modes"
```

---

### Task 5: Review Page

**Files:**
- Modify: `dashboard/src/pages/Review.jsx`

**Step 1: Implement Review.jsx**

This is the primary page. It fetches today's blocks, lets the user edit them, and on "Done" PATCHes all changed blocks then shows a pie chart.

```jsx
import { useState, useEffect } from "react";
import { PieChart, Pie, Cell, Legend, Tooltip } from "recharts";
import { CATEGORIES } from "../constants";
import BlockCard from "../components/BlockCard";
import TimelineBar from "../components/TimelineBar";

export default function Review() {
  const [blocks, setBlocks] = useState([]);
  const [originalBlocks, setOriginalBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch("/blocks/today")
      .then((res) => {
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setBlocks(data.blocks);
        setOriginalBlocks(JSON.parse(JSON.stringify(data.blocks)));
        setLoading(false);
      })
      .catch((err) => {
        setError("Cannot connect to tracker API. Is the server running on port 9147?");
        setLoading(false);
      });
  }, []);

  const handleBlockChange = (index, updatedBlock) => {
    const next = [...blocks];
    next[index] = updatedBlock;
    setBlocks(next);
  };

  const handleDone = async () => {
    setSaving(true);
    try {
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        const original = originalBlocks[i];
        const changed =
          block.category !== original.category ||
          block.note !== original.note ||
          block.user_confirmed !== original.user_confirmed;
        if (changed) {
          const res = await fetch(`/blocks/${block.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              category: block.category,
              note: block.note || null,
              user_confirmed: block.user_confirmed,
            }),
          });
          if (!res.ok) {
            console.error(`Failed to save block ${block.id}`);
          }
        }
      }
      setDone(true);
    } catch (err) {
      setError("Failed to save some blocks. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (error) return <p className="text-red-500">{error}</p>;
  if (blocks.length === 0)
    return <p className="text-gray-500">No activity tracked today.</p>;

  if (done) {
    const breakdown = {};
    let totalMin = 0;
    blocks.forEach((b) => {
      breakdown[b.category] = (breakdown[b.category] || 0) + b.duration_min;
      totalMin += b.duration_min;
    });
    const chartData = Object.entries(breakdown).map(([cat, min]) => ({
      name: CATEGORIES[cat]?.label || cat,
      value: min,
      color: CATEGORIES[cat]?.color || "#9CA3AF",
    }));
    const hours = Math.floor(totalMin / 60);
    const mins = totalMin % 60;

    return (
      <div>
        <h1 className="text-2xl font-bold mb-2">Today's Summary</h1>
        <p className="text-gray-500 mb-6">
          Total tracked: {hours}h {mins}m
        </p>
        <div className="flex justify-center">
          <PieChart width={400} height={300}>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={120}
              dataKey="value"
              label={({ name, value }) => `${name}: ${value}m`}
            >
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => `${value}m`} />
            <Legend />
          </PieChart>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Review Your Day</h1>
      <TimelineBar blocks={blocks} />
      {blocks.map((block, i) => (
        <BlockCard
          key={block.id}
          block={block}
          editable
          onChange={(updated) => handleBlockChange(i, updated)}
        />
      ))}
      <button
        onClick={handleDone}
        disabled={saving}
        className="mt-4 w-full bg-gray-900 text-white py-2 px-4 rounded font-medium hover:bg-gray-800 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Done"}
      </button>
    </div>
  );
}
```

**Step 2: Verify**

Run the Vite dev server and the API server. Open `http://localhost:5173/review`. Expected:
- If API has blocks for today → shows editable cards with timeline bar
- If no blocks → shows "No activity tracked today."
- If API is not running → shows error message

**Step 3: Commit**

```bash
git add dashboard/src/pages/Review.jsx
git commit -m "feat: implement Review page with block editing and pie chart summary"
```

---

### Task 6: Today Page

**Files:**
- Modify: `dashboard/src/pages/Today.jsx`

**Step 1: Implement Today.jsx**

```jsx
import { useState, useEffect } from "react";
import BlockCard from "../components/BlockCard";
import TimelineBar from "../components/TimelineBar";

export default function Today() {
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/blocks/today")
      .then((res) => {
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setBlocks(data.blocks);
        setLoading(false);
      })
      .catch(() => {
        setError("Cannot connect to tracker API. Is the server running on port 9147?");
        setLoading(false);
      });
  }, []);

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (error) return <p className="text-red-500">{error}</p>;
  if (blocks.length === 0)
    return <p className="text-gray-500">No activity tracked today.</p>;

  const totalMin = blocks.reduce((sum, b) => sum + b.duration_min, 0);
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Today</h1>
        <span className="text-sm text-gray-500">
          {hours}h {mins}m tracked
        </span>
      </div>
      <TimelineBar blocks={blocks} />
      {blocks.map((block) => (
        <BlockCard key={block.id} block={block} editable={false} />
      ))}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add dashboard/src/pages/Today.jsx
git commit -m "feat: implement Today page with read-only timeline"
```

---

### Task 7: Weekly Page

**Files:**
- Modify: `dashboard/src/pages/Weekly.jsx`

**Step 1: Implement Weekly.jsx**

```jsx
import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { CATEGORIES } from "../constants";

function formatDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function getMonday(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff)).toISOString().split("T")[0];
}

function shiftWeek(dateStr, delta) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + delta * 7);
  return d.toISOString().split("T")[0];
}

export default function Weekly() {
  const [weekDate, setWeekDate] = useState(() => {
    const today = new Date().toISOString().split("T")[0];
    return getMonday(today);
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/summary/week?date=${weekDate}`)
      .then((res) => {
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        setError("Cannot connect to tracker API. Is the server running on port 9147?");
        setLoading(false);
      });
  }, [weekDate]);

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  const chartData = data.daily.map((day) => {
    const entry = { name: formatDate(day.date) };
    Object.keys(CATEGORIES).forEach((cat) => {
      entry[cat] = day.breakdown[cat] || 0;
    });
    return entry;
  });

  const totalHours = Math.floor(data.total_tracked_min / 60);
  const totalMins = data.total_tracked_min % 60;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setWeekDate(shiftWeek(weekDate, -1))}
          className="text-sm text-gray-500 hover:text-gray-700 px-2 py-1"
        >
          ← Prev
        </button>
        <h1 className="text-2xl font-bold">
          Week of {formatDate(data.start_date)}
        </h1>
        <button
          onClick={() => setWeekDate(shiftWeek(weekDate, 1))}
          className="text-sm text-gray-500 hover:text-gray-700 px-2 py-1"
        >
          Next →
        </button>
      </div>

      <p className="text-sm text-gray-500 text-center mb-6">
        Total: {totalHours}h {totalMins}m
      </p>

      <div className="mb-8">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis
              tick={{ fontSize: 12 }}
              label={{ value: "minutes", angle: -90, position: "insideLeft", fontSize: 12 }}
            />
            <Tooltip formatter={(value) => `${value}m`} />
            <Legend />
            {Object.entries(CATEGORIES).map(([id, { label, color }]) => (
              <Bar key={id} dataKey={id} name={label} stackId="a" fill={color} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-lg font-semibold mb-3">Category Breakdown</h2>
        {Object.entries(data.category_breakdown).map(([cat, min]) => {
          const catInfo = CATEGORIES[cat] || { label: cat, color: "#9CA3AF" };
          const hours = Math.floor(min / 60);
          const mins = min % 60;
          return (
            <div key={cat} className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full inline-block"
                  style={{ backgroundColor: catInfo.color }}
                />
                <span className="text-sm text-gray-700">{catInfo.label}</span>
              </div>
              <span className="text-sm text-gray-500">
                {hours}h {mins}m
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add dashboard/src/pages/Weekly.jsx
git commit -m "feat: implement Weekly page with stacked bar chart and navigation"
```

---

### Task 8: Seed Script + Manual Verification

**Files:**
- Create: `scripts/seed_demo_data.py`

**Step 1: Create a seed script for manual testing**

This script inserts sample work blocks into the database so you can test the dashboard visually.

```python
"""Seed demo work blocks for dashboard testing."""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tracker.db import init_db, get_connection
from datetime import date

def seed():
    init_db()
    conn = get_connection()
    today = date.today().isoformat()

    blocks = [
        (today, f"{today}T09:00:00", f"{today}T10:30:00", 90, "coding", "coding", 0, '["VS Code", "GitHub"]', None),
        (today, f"{today}T10:30:00", f"{today}T11:00:00", 30, "admin", "admin", 0, '["Slack"]', None),
        (today, f"{today}T11:00:00", f"{today}T12:00:00", 60, "meeting", "meeting", 0, '["Zoom"]', None),
        (today, f"{today}T13:00:00", f"{today}T14:30:00", 90, "coding", "coding", 0, '["VS Code", "Terminal"]', None),
        (today, f"{today}T14:30:00", f"{today}T15:00:00", 30, "research", "research", 0, '["Google Chrome"]', None),
        (today, f"{today}T15:00:00", f"{today}T16:00:00", 60, "planning", "planning", 0, '["Notion", "Linear"]', None),
        (today, f"{today}T16:00:00", f"{today}T17:00:00", 60, "coding", "coding", 0, '["VS Code"]', None),
        (today, f"{today}T17:00:00", f"{today}T17:30:00", 30, "admin", "admin", 0, '["Gmail", "Slack"]', None),
    ]

    conn.execute("DELETE FROM work_blocks WHERE date = ?", (today,))
    for b in blocks:
        conn.execute(
            "INSERT INTO work_blocks (date, started_at, ended_at, duration_min, category, auto_category, user_confirmed, apps_used, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            b,
        )
    conn.commit()
    print(f"Seeded {len(blocks)} work blocks for {today}")

if __name__ == "__main__":
    seed()
```

**Step 2: Seed data and run full stack**

```bash
# Seed demo data
source .venv/bin/activate && python3 scripts/seed_demo_data.py

# Start API server (background)
source .venv/bin/activate && uvicorn api.server:app --port 9147 &

# Start dashboard
cd dashboard && npm run dev
```

**Step 3: Manual verification checklist**

Open `http://localhost:5173` and verify:

- [ ] NavBar shows Review, Today, Weekly links
- [ ] `/review` shows 8 editable block cards with timeline bar
- [ ] Can change category via dropdown on Review
- [ ] Can add notes on Review
- [ ] Confirm button (✓) works
- [ ] "Done" button saves and shows pie chart summary
- [ ] `/today` shows 8 read-only cards with timeline bar
- [ ] `/weekly` shows stacked bar chart
- [ ] Week navigation (Prev/Next) works
- [ ] `http://localhost:5173/review` loads directly (EOD notification URL)

**Step 4: Commit seed script**

```bash
git add scripts/seed_demo_data.py
git commit -m "feat: add demo data seed script for dashboard testing"
```

---

## Task Dependency Graph

```
Task 1 (scaffold) → Task 2 (app shell + nav)
                          ↓
                    Task 3 (CategoryPill + TimelineBar)
                          ↓
                    Task 4 (BlockCard)
                          ↓
              ┌───────────┼───────────┐
              ↓           ↓           ↓
        Task 5        Task 6      Task 7
       (Review)      (Today)     (Weekly)
              └───────────┼───────────┘
                          ↓
                    Task 8 (seed + verify)
```

Tasks 1→2→3→4 are sequential (each builds on the previous). Tasks 5, 6, 7 are independent of each other (all use the shared components from Tasks 3-4). Task 8 depends on all pages being complete.
