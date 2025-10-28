import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiGet, apiPost } from '../api.js';
import { socket } from '../socket.js';
import useLocalStorage from '../hooks/useLocalStorage.js';

export function canSendMessage(text) {
  return text.trim().length > 0;
}

export default function Chat() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [nick] = useLocalStorage('soberNick', '');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [notice, setNotice] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    window.localStorage.setItem('lastChatId', id);
  }, [id]);

  useEffect(() => {
    socket.emit('subscribe_table', id);
    return () => {
      socket.emit('unsubscribe_table', id);
    };
  }, [id]);

  const loadHistory = useMemo(
    () => async () => {
      try {
        const history = await apiGet(`/api/tables/${id}/messages`);
        setMessages(history.map((item) => ({ ...item, type: 'chat' })));
      } catch (error) {
        console.error('Failed to load history', error);
        setNotice('Не удалось загрузить историю.');
      }
    },
    [id]
  );

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await apiPost(`/api/tables/${id}/join`, { user: nick || 'Гость' });
        if (!cancelled) {
          setNotice('');
        }
      } catch (error) {
        if (cancelled) return;
        if (error.status === 400 && error.payload?.error === 'table full') {
          setNotice('Стол заполнен. Можно читать чат, но писать нельзя.');
        } else if (error.status === 404) {
          setNotice('Стол не найден или встреча завершена.');
        } else {
          setNotice('Не удалось подключиться к столу.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, nick]);

  useEffect(() => {
    const messageHandler = (message) => {
      if (message.table_id !== id) return;
      setMessages((prev) => [...prev, { ...message, type: 'chat' }]);
    };
    const systemHandler = (payload) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `system-${Date.now()}`,
          type: 'system',
          text:
            payload?.type === 'join'
              ? `${payload.user || 'Гость'} присоединился`
              : 'Системное событие'
        }
      ]);
    };
    socket.on('chat_message', messageHandler);
    socket.on('system', systemHandler);
    return () => {
      socket.off('chat_message', messageHandler);
      socket.off('system', systemHandler);
    };
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (event) => {
    event.preventDefault();
    if (!canSendMessage(input)) {
      return;
    }
    try {
      await apiPost(`/api/tables/${id}/messages`, {
        user: nick || 'Гость',
        text: input
      });
      setInput('');
    } catch (error) {
      console.error('Failed to send message', error);
      setNotice('Не удалось отправить сообщение.');
    }
  };

  return (
    <section className="chat-container">
      <header>
        <h1>Чат стола</h1>
        <button type="button" onClick={() => navigate('/home')}>
          Покинуть
        </button>
      </header>
      {notice && <div className="notice">{notice}</div>}
      <div className="chat-log">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`chat-message${message.type === 'system' ? ' system' : ''}`}
          >
            {message.type === 'system' ? (
              <em>{message.text}</em>
            ) : (
              <>
                <strong>{message.user}</strong>
                <span> — {message.text}</span>
              </>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form className="chat-input" onSubmit={handleSend}>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Напишите сообщение"
        />
        <button type="submit" disabled={!canSendMessage(input)}>
          Отправить
        </button>
      </form>
    </section>
  );
}
