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
    setError(null);
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
