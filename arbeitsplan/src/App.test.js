import { render, screen } from '@testing-library/react';
import App, { getFixedPlanSummary } from './App';

test('renders login view', async () => {
  render(<App />);

  expect(await screen.findByRole('heading', { name: /anmelden/i })).toBeInTheDocument();
  expect(await screen.findByRole('button', { name: /anmelden/i })).toBeInTheDocument();
});

test('groups fixed plan assignments by month for the current user', () => {
  const plan = {
    '2026-05-04': 'lea',
    '2026-05-12': 'lea',
    '2026-06-03': 'lea',
    '2026-07-01': 'max'
  };

  const planFixed = {
    '2026-05': true,
    '2026-06': true,
    '2026-07': false
  };

  expect(getFixedPlanSummary(plan, planFixed, 'lea')).toEqual([
    {
      monthKey: '2026-06',
      year: 2026,
      month: 5,
      dates: ['2026-06-03']
    },
    {
      monthKey: '2026-05',
      year: 2026,
      month: 4,
      dates: ['2026-05-04', '2026-05-12']
    }
  ]);
});
