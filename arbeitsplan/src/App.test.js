import { render, screen } from '@testing-library/react';
import App from './App';

test('renders login view', async () => {
  render(<App />);

  expect(await screen.findByRole('heading', { name: /anmelden/i })).toBeInTheDocument();
  expect(await screen.findByRole('button', { name: /anmelden/i })).toBeInTheDocument();
});
