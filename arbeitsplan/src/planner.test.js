import { getPlannerCandidates } from './planner';

describe('getPlannerCandidates', () => {
  const users = [
    { username: 'anna', name: 'Anna' },
    { username: 'ben', name: 'Ben' },
    { username: 'cara', name: 'Cara' },
  ];

  const baseAvailability = {
    anna_2026_4: { '2026-05-01': 2 },
    ben_2026_4: { '2026-05-01': 2 },
    cara_2026_4: { '2026-05-01': 1 },
  };

  test('priorisiert grüne Tage vor gelben', () => {
    const candidates = getPlannerCandidates({
      users,
      availability: baseAvailability,
      year: 2026,
      month: 4,
      dateStr: '2026-05-01',
      userCounts: { anna: 0, ben: 0, cara: 0 },
      targetCount: 4,
      maxTargetCount: 6,
    });

    expect(candidates.map((user) => user.username)).toEqual(['anna', 'ben']);
  });

  test('bevorzugt grüne Kandidaten, aber nimmt keine Person über das Ziel auf, solange andere unter dem Ziel sind', () => {
    const candidates = getPlannerCandidates({
      users,
      availability: {
        ...baseAvailability,
        anna_2026_4: { '2026-05-01': 2 },
      },
      year: 2026,
      month: 4,
      dateStr: '2026-05-01',
      userCounts: { anna: 4, ben: 0, cara: 0 },
      targetCount: 4,
      maxTargetCount: 6,
    });

    expect(candidates.map((user) => user.username)).toEqual(['ben']);
  });

  test('verwendet gelbe Tage nur als Fallback, wenn keine grünen Kandidaten unter dem Ziel mehr verfügbar sind', () => {
    const candidates = getPlannerCandidates({
      users,
      availability: {
        anna_2026_4: { '2026-05-01': 2 },
        ben_2026_4: { '2026-05-01': 1 },
        cara_2026_4: { '2026-05-01': 1 },
      },
      year: 2026,
      month: 4,
      dateStr: '2026-05-01',
      userCounts: { anna: 4, ben: 0, cara: 0 },
      targetCount: 4,
      maxTargetCount: 6,
    });

    expect(candidates.map((user) => user.username)).toEqual(['ben', 'cara']);
  });
});
