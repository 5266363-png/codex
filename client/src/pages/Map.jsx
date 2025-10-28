import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import { Icon } from 'leaflet';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../api.js';
import { socket } from '../socket.js';

const DEFAULT_LOCATION = { lat: 7.8906, lng: 98.2966 };

const userIcon = new Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

export default function MapView() {
  const navigate = useNavigate();
  const [coords, setCoords] = useState(DEFAULT_LOCATION);
  const [tables, setTables] = useState([]);

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
      try {
        const list = await apiGet('/api/tables', {
          lat: coords.lat,
          lng: coords.lng,
          radius: 10
        });
        setTables(list);
      } catch (error) {
        console.error('Failed to load map tables', error);
      }
    },
    [coords.lat, coords.lng]
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

  return (
    <section>
      <h1>Карта встреч</h1>
      <MapContainer center={[coords.lat, coords.lng]} zoom={13} scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[coords.lat, coords.lng]} icon={userIcon}>
          <Popup>Вы здесь</Popup>
        </Marker>
        {tables.map((table) => (
          <Marker key={table.id} position={[table.lat, table.lng]} icon={userIcon}>
            <Popup>
              <strong>{table.title}</strong>
              <br />
              Свободно: {table.free} / {table.size}
              <br />
              <button
                type="button"
                onClick={() => {
                  window.localStorage.setItem('lastChatId', table.id);
                  navigate(`/chat/${table.id}`);
                }}
              >
                Присоединиться
              </button>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </section>
  );
}
