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
