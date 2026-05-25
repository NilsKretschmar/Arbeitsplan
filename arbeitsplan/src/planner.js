export function getPlannerCandidates({
  users,
  availability,
  year,
  month,
  dateStr,
  userCounts,
  targetCount,
  maxTargetCount,
}) {
  const keyPrefix = (username) => `${username}_${year}_${month}`;

  const getCurrent = (user) => {
    const avail = availability[keyPrefix(user.username)] || {};
    return {
      currentValue: avail[dateStr] || 0,
      currentCount: userCounts[user.username] || 0,
    };
  };

  const sortCandidates = (candidates) => {
    return candidates.sort((a, b) => {
      const countA = userCounts[a.username] || 0;
      const countB = userCounts[b.username] || 0;

      if (countA !== countB) {
        return countA - countB;
      }

      return a.name.localeCompare(b.name);
    });
  };

  const greenNeed = users
    .map((user) => ({ user, ...getCurrent(user) }))
    .filter(({ currentValue, currentCount }) => currentValue === 2 && currentCount < targetCount)
    .map(({ user }) => user);

  if (greenNeed.length > 0) {
    return sortCandidates(greenNeed);
  }

  const yellowNeed = users
    .map((user) => ({ user, ...getCurrent(user) }))
    .filter(({ currentValue, currentCount }) => currentValue === 1 && currentCount < targetCount)
    .map(({ user }) => user);

  if (yellowNeed.length > 0) {
    return sortCandidates(yellowNeed);
  }

  const greenOverflow = users
    .map((user) => ({ user, ...getCurrent(user) }))
    .filter(({ currentValue, currentCount }) => currentValue === 2 && currentCount < maxTargetCount)
    .map(({ user }) => user);

  if (greenOverflow.length > 0) {
    return sortCandidates(greenOverflow);
  }

  const yellowOverflow = users
    .map((user) => ({ user, ...getCurrent(user) }))
    .filter(({ currentValue, currentCount }) => currentValue === 1 && currentCount < maxTargetCount)
    .map(({ user }) => user);

  return sortCandidates(yellowOverflow);
}
