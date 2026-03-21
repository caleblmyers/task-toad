/**
 * Monte Carlo sprint completion forecasting.
 * Pure functions — no side effects, fully testable.
 */

export interface ForecastPercentile {
  percentile: number;
  daysRemaining: number;
}

export interface SprintForecast {
  completionProbability: number;
  percentiles: ForecastPercentile[];
  historicalVelocity: number[];
}

/**
 * Run a Monte Carlo simulation to forecast sprint completion.
 *
 * @param remainingWork  Total remaining story points (or hours) in the sprint
 * @param daysLeft       Calendar days until the sprint end date
 * @param velocities     Array of historical velocity values (points/hours per sprint)
 * @param sprintLengths  Array of historical sprint lengths in days (parallel to velocities)
 * @param simulationCount Number of simulations to run (default 1000)
 * @returns SprintForecast with probability and percentile breakdowns
 */
export function runMonteCarloForecast(
  remainingWork: number,
  daysLeft: number,
  velocities: number[],
  sprintLengths: number[],
  simulationCount = 1000,
): SprintForecast {
  if (velocities.length === 0 || remainingWork <= 0) {
    return {
      completionProbability: remainingWork <= 0 ? 100 : 0,
      percentiles: [
        { percentile: 50, daysRemaining: 0 },
        { percentile: 75, daysRemaining: 0 },
        { percentile: 90, daysRemaining: 0 },
        { percentile: 95, daysRemaining: 0 },
      ],
      historicalVelocity: velocities,
    };
  }

  // Convert sprint velocities to daily throughput rates
  const dailyRates = velocities.map((v, i) => {
    const days = sprintLengths[i] ?? 14; // default 2-week sprint
    return days > 0 ? v / days : 0;
  });

  const completionDays: number[] = [];
  let finishedWithinSprint = 0;

  for (let sim = 0; sim < simulationCount; sim++) {
    let work = remainingWork;
    let days = 0;

    // Simulate day by day, sampling random daily rate
    while (work > 0 && days < daysLeft * 5) {
      // Cap at 5x sprint length to prevent infinite loops
      const rate = dailyRates[Math.floor(Math.random() * dailyRates.length)];
      work -= rate;
      days++;
    }

    completionDays.push(days);
    if (days <= daysLeft) {
      finishedWithinSprint++;
    }
  }

  completionDays.sort((a, b) => a - b);

  const percentile = (p: number): number => {
    const idx = Math.ceil((p / 100) * completionDays.length) - 1;
    return completionDays[Math.max(0, idx)];
  };

  return {
    completionProbability: Math.round((finishedWithinSprint / simulationCount) * 100),
    percentiles: [
      { percentile: 50, daysRemaining: percentile(50) },
      { percentile: 75, daysRemaining: percentile(75) },
      { percentile: 90, daysRemaining: percentile(90) },
      { percentile: 95, daysRemaining: percentile(95) },
    ],
    historicalVelocity: velocities,
  };
}
