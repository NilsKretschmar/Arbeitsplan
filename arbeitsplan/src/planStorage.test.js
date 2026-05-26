import { mergePlanData, mergePlanFixedData } from './planStorage';

describe('planStorage helpers', () => {
  test('mergePlanData keeps existing month data and appends the current month changes', () => {
    const existingPlan = {
      '2026-04-01': 'Anna',
      '2026-04-02': 'Lukas'
    };

    const updatedPlan = mergePlanData(existingPlan, {
      '2026-05-03': 'Mia',
      '2026-05-04': 'Jonas'
    });

    expect(updatedPlan).toEqual({
      '2026-04-01': 'Anna',
      '2026-04-02': 'Lukas',
      '2026-05-03': 'Mia',
      '2026-05-04': 'Jonas'
    });
  });

  test('mergePlanFixedData preserves existing lock flags and updates the selected month', () => {
    const existingFixed = {
      '2026-04': true
    };

    const updatedFixed = mergePlanFixedData(existingFixed, '2026-05', true);

    expect(updatedFixed).toEqual({
      '2026-04': true,
      '2026-05': true
    });
  });
});
