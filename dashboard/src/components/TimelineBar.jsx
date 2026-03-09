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
