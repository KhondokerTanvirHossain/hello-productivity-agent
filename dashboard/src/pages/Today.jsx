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
