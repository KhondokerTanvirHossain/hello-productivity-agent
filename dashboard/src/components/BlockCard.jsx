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
