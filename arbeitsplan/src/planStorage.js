export function mergePlanData(existingPlan = {}, updates = {}) {
  return {
    ...existingPlan,
    ...updates,
  };
}

export function mergePlanFixedData(existingFixed = {}, monthKey, isFixed) {
  return {
    ...existingFixed,
    [monthKey]: isFixed,
  };
}
