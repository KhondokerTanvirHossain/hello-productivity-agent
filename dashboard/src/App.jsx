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
