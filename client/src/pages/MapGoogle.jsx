import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import { apiGet } from '../api.js';
import { socket } from '../socket.js';

const DEFAULT_LOCATION = { lat: 7.8906, lng: 98.2966 };
const mapContainerStyle = { width: '100%', height: 'calc(100vh - 5rem)' };

export default function MapGoogle() {
  const navigate = useNavigate();
  const [coords, setCoords] = useState(DEFAULT_LOCATION);
  const [tables, setTables] = useState([]);
  const googleKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    if (!navigator.geolocation) {
      console.warn('Geolocation unavailable, using fallback.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      },
      (error) => {
        console.warn('Geolocation declined, fallback to Phuket.', error);
      }
    );
  }, []);

  const fetchTables = useMemo(
    () => async () => {
      if (!googleKey) return;
      try {
        const list = await apiGet('/api/tables', {
          lat: coords.lat,
          lng: coords.lng,
          radius: 10
        });
        setTables(list);
      } catch (error) {
        console.error('Failed to load Google map data', error);
      }
    },
    [coords.lat, coords.lng, googleKey]
  );

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  useEffect(() => {
    const handler = () => fetchTables();
    socket.on('tables_updated', handler);
    return () => {
      socket.off('tables_updated', handler);
    };
  }, [fetchTables]);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: googleKey || 'noop'
  });

  if (!googleKey) {
    return (
      <section>
        <h1>Карта Google</h1>
        <div className="notice">
          Добавьте ключ Google Maps API (VITE_GOOGLE_MAPS_API_KEY), чтобы увидеть карту. Пока используйте вкладку OSM.
        </div>
      </section>
    );
  }

  return (
    <section>
      <h1>Карта Google</h1>
      {isLoaded ? (
        <GoogleMap mapContainerStyle={mapContainerStyle} center={coords} zoom={13}>
          <Marker position={coords} title="Вы здесь" />
          {tables.map((table) => (
            <Marker
              key={table.id}
              position={{ lat: table.lat, lng: table.lng }}
              title={table.title}
              onClick={() => {
                window.localStorage.setItem('lastChatId', table.id);
                navigate(`/chat/${table.id}`);
              }}
            />
          ))}
        </GoogleMap>
      ) : (
        <p>Загрузка карты...</p>
      )}
    </section>
  );
}
