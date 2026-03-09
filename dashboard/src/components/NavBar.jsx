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
