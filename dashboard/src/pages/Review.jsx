import { useState, useEffect } from "react";
import { PieChart, Pie, Cell, Legend, Tooltip } from "recharts";
import { CATEGORIES } from "../constants";
import BlockCard from "../components/BlockCard";
import TimelineBar from "../components/TimelineBar";
import { api } from "../api";

export default function Review() {
  const [blocks, setBlocks] = useState([]);
  const [originalBlocks, setOriginalBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    api.getBlocksToday()
      .then((data) => {
        setBlocks(data.blocks);
        setOriginalBlocks(JSON.parse(JSON.stringify(data.blocks)));
        setLoading(false);
      })
      .catch(() => {
        setError("Cannot connect to tracker. Is the app running?");
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
          await api.updateBlock(block.id, {
            category: block.category,
            note: block.note || null,
            user_confirmed: block.user_confirmed,
          });
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
