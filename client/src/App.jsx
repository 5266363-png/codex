import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import TabBar from './components/TabBar.jsx';
import Home from './pages/Home.jsx';
import MapView from './pages/Map.jsx';
import MapGoogle from './pages/MapGoogle.jsx';
import Chat from './pages/Chat.jsx';
import Profile from './pages/Profile.jsx';
import 'leaflet/dist/leaflet.css';

export default function App() {
  const location = useLocation();

  useEffect(() => {
    const titleMap = {
      '/home': 'Sober Meet — Главная',
      '/map': 'Sober Meet — Карта',
      '/mapg': 'Sober Meet — Карта G',
      '/profile': 'Sober Meet — Профиль'
    };
    const base = Object.entries(titleMap).find(([path]) => location.pathname.startsWith(path));
    document.title = base ? base[1] : 'Sober Meet';
  }, [location.pathname]);

  return (
    <>
      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<Home />} />
          <Route path="/map" element={<MapView />} />
          <Route path="/mapg" element={<MapGoogle />} />
          <Route path="/chat/:id" element={<Chat />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </main>
      <TabBar />
    </>
  );
}
