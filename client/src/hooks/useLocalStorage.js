import { useEffect, useState } from 'react';

export default function useLocalStorage(key, initialValue) {
  const readValue = () => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    const item = window.localStorage.getItem(key);
    if (item === null) {
      return initialValue;
    }
    try {
      return JSON.parse(item);
    } catch (error) {
      return item;
    }
  };

  const [storedValue, setStoredValue] = useState(readValue);

  useEffect(() => {
    setStoredValue(readValue());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const setValue = (value) => {
    if (typeof window === 'undefined') return;
    const valueToStore = value instanceof Function ? value(storedValue) : value;
    setStoredValue(valueToStore);
    try {
      window.localStorage.setItem(
        key,
        typeof valueToStore === 'string' ? valueToStore : JSON.stringify(valueToStore)
      );
    } catch (error) {
      console.warn('Cannot persist to localStorage', error);
    }
  };

  return [storedValue, setValue];
}
