import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPost } from '../api.js';
import { socket } from '../socket.js';
import useLocalStorage from '../hooks/useLocalStorage.js';

const DEFAULT_LOCATION = { lat: 7.8906, lng: 98.2966 };

const sizeOptions = [2, 3, 4, 5];
const radiusOptions = [0.5, 1, 3];
const durationOptions = [60, 120, 180];

export default function Home() {
  const navigate = useNavigate();
  const [nick, setNick] = useLocalStorage('soberNick', '');
  const [tables, setTables] = useState([]);
  const [coords, setCoords] = useState(DEFAULT_LOCATION);
  const [radiusFilter, setRadiusFilter] = useState(3);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    title: '',
    size: 3,
    radius: 1,
    duration: 180,
    nick: ''
  });

  useEffect(() => {
    if (!nick && form.nick) {
      setNick(form.nick);
    } else if (nick && !form.nick) {
      setForm((prev) => ({ ...prev, nick }));
    }
  }, [nick, form.nick, setNick]);

  useEffect(() => {
    if (!navigator.geolocation) {
      console.warn('Geolocation unavailable, using fallback.');
      setCoords(DEFAULT_LOCATION);
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
        setCoords(DEFAULT_LOCATION);
      }
    );
  }, []);

  const fetchTables = useMemo(
    () => async () => {
      try {
        const list = await apiGet('/api/tables', {
          lat: coords?.lat,
          lng: coords?.lng,
          radius: radiusFilter
        });
        setTables(list);
      } catch (error) {
        console.error('Failed to load tables', error);
        setStatus('Не удалось загрузить список.');
      }
    },
    [coords?.lat, coords?.lng, radiusFilter]
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

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (name === 'nick') {
      setNick(value);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.title.trim()) {
      setStatus('Укажите тему встречи.');
      return;
    }
    setLoading(true);
    try {
      const payload = await apiPost('/api/tables', {
        title: form.title,
        size: Number(form.size),
        radius: Number(form.radius),
        lat: coords.lat,
        lng: coords.lng,
        duration: Number(form.duration),
        owner: form.nick || 'Гость'
      });
      window.localStorage.setItem('lastChatId', payload.id);
      setStatus('Стол создан, перенаправляем в чат...');
      navigate(`/chat/${payload.id}`);
    } catch (error) {
      console.error('Failed to create table', error);
      setStatus(error.payload?.error || 'Ошибка при создании.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section>
      <div className="card">
        <h1>Иду на напиток</h1>
        <form className="form-grid" onSubmit={handleSubmit}>
          <label>
            Название
            <input name="title" value={form.title} onChange={handleChange} required />
          </label>
          <label>
            Ник
            <input name="nick" value={form.nick} onChange={handleChange} placeholder="Гость" />
          </label>
          <label>
            Размер компании
            <select name="size" value={form.size} onChange={handleChange}>
              {sizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            Радиус поиска (км)
            <select
              name="radius"
              value={form.radius}
              onChange={(event) => {
                handleChange(event);
                setRadiusFilter(Number(event.target.value));
              }}
            >
              {radiusOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            Длительность (мин)
            <select name="duration" value={form.duration} onChange={handleChange}>
              {durationOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={loading}>
            {loading ? 'Создаём...' : 'Создать стол'}
          </button>
        </form>
        {status && <p>{status}</p>}
      </div>

      <div className="card">
        <h2>Кто рядом сейчас</h2>
        {tables.length === 0 && <p>Поблизости пока никого.</p>}
        {tables.map((table) => (
          <div key={table.id}>
            <strong>{table.title}</strong>
            <p>
              Свободно мест: {table.free} / {table.size}
              <br />
              Расстояние: {table.distance !== null ? `${table.distance.toFixed(2)} км` : '—'}
            </p>
            <button
              type="button"
              onClick={() => {
                window.localStorage.setItem('lastChatId', table.id);
                navigate(`/chat/${table.id}`);
              }}
            >
              В чат стола
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
