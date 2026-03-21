import { describe, it, expect } from 'vitest';
import { runMonteCarloForecast } from '../utils/monteCarloForecast.js';

describe('runMonteCarloForecast', () => {
  it('returns 100% probability and 0-day percentiles when remaining work is 0', () => {
    const result = runMonteCarloForecast(0, 10, [20, 25, 30], [14, 14, 14]);
    expect(result.completionProbability).toBe(100);
    for (const p of result.percentiles) {
      expect(p.daysRemaining).toBe(0);
    }
  });

  it('returns 100% probability when remaining work is negative', () => {
    const result = runMonteCarloForecast(-5, 10, [20, 25], [14, 14]);
    expect(result.completionProbability).toBe(100);
    for (const p of result.percentiles) {
      expect(p.daysRemaining).toBe(0);
    }
  });

  it('returns 0% probability and 0-day percentiles when velocity array is empty', () => {
    const result = runMonteCarloForecast(50, 10, [], []);
    expect(result.completionProbability).toBe(0);
    for (const p of result.percentiles) {
      expect(p.daysRemaining).toBe(0);
    }
    expect(result.historicalVelocity).toEqual([]);
  });

  it('runs simulation with a single velocity data point', () => {
    const result = runMonteCarloForecast(10, 14, [14], [14]);
    // With velocity=14 over 14 days (1 pt/day), 10 pts should finish in ~10 days
    expect(result.completionProbability).toBeGreaterThan(0);
    expect(result.percentiles).toHaveLength(4);
    expect(result.percentiles[0].daysRemaining).toBeGreaterThan(0);
  });

  it('handles large simulation count without timeout', () => {
    const start = Date.now();
    const result = runMonteCarloForecast(20, 14, [10, 15, 20], [14, 14, 14], 10000);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5000); // should finish well under 5s
    expect(result.completionProbability).toBeGreaterThanOrEqual(0);
    expect(result.completionProbability).toBeLessThanOrEqual(100);
    expect(result.percentiles).toHaveLength(4);
  });

  it('returns valid percentiles even with negative days left', () => {
    const result = runMonteCarloForecast(20, -5, [10, 15], [14, 14]);
    // Negative days left means sprint is overdue — probability should be 0
    expect(result.completionProbability).toBe(0);
    expect(result.percentiles).toHaveLength(4);
    for (const p of result.percentiles) {
      expect(p.daysRemaining).toBeGreaterThanOrEqual(0);
    }
  });

  it('returns correct percentile order (50 < 75 < 90 < 95)', () => {
    const result = runMonteCarloForecast(30, 20, [5, 10, 15, 20, 25], [14, 14, 14, 14, 14], 5000);
    const [p50, p75, p90, p95] = result.percentiles;
    expect(p50.percentile).toBe(50);
    expect(p75.percentile).toBe(75);
    expect(p90.percentile).toBe(90);
    expect(p95.percentile).toBe(95);
    expect(p50.daysRemaining).toBeLessThanOrEqual(p75.daysRemaining);
    expect(p75.daysRemaining).toBeLessThanOrEqual(p90.daysRemaining);
    expect(p90.daysRemaining).toBeLessThanOrEqual(p95.daysRemaining);
  });
});
