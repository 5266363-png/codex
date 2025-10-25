import useLocalStorage from '../hooks/useLocalStorage.js';

export default function Profile() {
  const [nick, setNick] = useLocalStorage('soberNick', '');
  const [about, setAbout] = useLocalStorage('soberAbout', '');
  const [soberOnly, setSoberOnly] = useLocalStorage('soberFlag', false);
  const [ageConfirmed, setAgeConfirmed] = useLocalStorage('soberAgeConfirmed', false);

  return (
    <section>
      {!ageConfirmed && (
        <div className="age-gate">
          <div className="card">
            <h2>Возрастное подтверждение</h2>
            <p>Вам уже исполнилось 20 лет?</p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
              <button type="button" onClick={() => setAgeConfirmed(true)}>
                Да
              </button>
              <button type="button" onClick={() => alert('Приложение доступно пользователям 20+.')}>
                Нет
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="card">
        <h1>Профиль</h1>
        <label>
          Ник
          <input value={nick} onChange={(event) => setNick(event.target.value)} placeholder="Гость" />
        </label>
        <label>
          О себе
          <textarea rows={4} value={about} onChange={(event) => setAbout(event.target.value)} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input
            type="checkbox"
            checked={Boolean(soberOnly)}
            onChange={(event) => setSoberOnly(event.target.checked)}
          />
          Предпочитаю только безалкогольные напитки
        </label>
      </div>
      <div className="card">
        <h2>Безопасность</h2>
        <p>Делитесь локацией и контактами только с теми, кому доверяете. Сообщите друзьям, куда направляетесь.</p>
        <button type="button" onClick={() => alert('SOS сигнал отправлен условно.')}>
          SOS
        </button>
      </div>
    </section>
  );
}
