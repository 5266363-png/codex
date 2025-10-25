import { NavLink } from 'react-router-dom';
import { useEffect, useState } from 'react';

const tabs = [
  { to: '/home', label: 'Главная' },
  { to: '/map', label: 'Карта' },
  { to: '/mapg', label: 'Карта G' },
  { to: '/profile', label: 'Профиль' }
];

export default function TabBar() {
  const [chatId, setChatId] = useState(() => {
    if (typeof window === 'undefined') return 'recent';
    return window.localStorage.getItem('lastChatId') || 'recent';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => {
      setChatId(window.localStorage.getItem('lastChatId') || 'recent');
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  return (
    <nav className="tab-bar">
      {tabs.map((tab) => (
        <NavLink key={tab.to} to={tab.to} className={({ isActive }) => (isActive ? 'active' : undefined)}>
          {tab.label}
        </NavLink>
      ))}
      <NavLink to={`/chat/${chatId}`} className={({ isActive }) => (isActive ? 'active' : undefined)}>
        Чат
      </NavLink>
    </nav>
  );
}
