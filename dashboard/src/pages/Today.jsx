import { useState, useEffect } from "react";
import BlockCard from "../components/BlockCard";
import TimelineBar from "../components/TimelineBar";
import { api } from "../api";

export default function Today() {
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchBlocks = () => {
    api.getBlocksTodayLive()
      .then((data) => {
        setBlocks(data.blocks);
        setLoading(false);
        setError(null);
      })
      .catch(() => {
        setError("Cannot connect to tracker. Is the app running?");
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchBlocks();
    const interval = setInterval(fetchBlocks, 60000);
    return () => clearInterval(interval);
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
