import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeAll } from 'vitest';
import Home from './Home.jsx';

vi.mock('../api.js', () => ({
  apiGet: vi.fn(() => Promise.resolve([])),
  apiPost: vi.fn(() => Promise.resolve({ id: 'test' }))
}));

vi.mock('../socket.js', () => ({
  socket: {
    on: vi.fn(),
    off: vi.fn()
  }
}));

beforeAll(() => {
  global.navigator.geolocation = {
    getCurrentPosition: (success, error) => {
      if (error) error(new Error('no geo'));
    }
  };
});

describe('Home page', () => {
  it('renders form without crashing', async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );
    expect(await screen.findByText(/Иду на напиток/i)).toBeInTheDocument();
  });
});
