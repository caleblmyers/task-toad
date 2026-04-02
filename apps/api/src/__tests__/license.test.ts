import { describe, it, expect } from 'vitest';
import { requireLicense, getEnabledFeatures, isPremiumEnabled, getOrgPlan, LicenseError } from '../utils/license.js';

describe('license', () => {
  describe('isPremiumEnabled', () => {
    it('returns true for paid plan', () => {
      expect(isPremiumEnabled('paid')).toBe(true);
    });

    it('returns false for free/undefined plan', () => {
      expect(isPremiumEnabled('free')).toBe(false);
      expect(isPremiumEnabled(undefined)).toBe(false);
    });
  });

  describe('requireLicense', () => {
    it('throws LicenseError for parallel_execution on free plan', () => {
      expect(() => requireLicense('parallel_execution', 'free')).toThrow(LicenseError);
      expect(() => requireLicense('parallel_execution', undefined)).toThrow(LicenseError);
    });

    it('does not throw for parallel_execution on paid plan', () => {
      expect(() => requireLicense('parallel_execution', 'paid')).not.toThrow();
    });

    it('throws for any premium feature on free plan', () => {
      expect(() => requireLicense('slack', 'free')).toThrow(LicenseError);
      expect(() => requireLicense('initiatives', undefined)).toThrow(LicenseError);
    });

    it('does not throw for any premium feature on paid plan', () => {
      expect(() => requireLicense('slack', 'paid')).not.toThrow();
      expect(() => requireLicense('parallel_execution', 'paid')).not.toThrow();
    });
  });

  describe('getEnabledFeatures', () => {
    it('returns all features including parallel_execution for paid plan', () => {
      const features = getEnabledFeatures('paid');
      expect(features).toContain('parallel_execution');
      expect(features).toContain('slack');
    });

    it('returns empty array for free plan', () => {
      expect(getEnabledFeatures('free')).toEqual([]);
      expect(getEnabledFeatures(undefined)).toEqual([]);
    });
  });

  describe('getOrgPlan', () => {
    it('extracts plan from org object', () => {
      expect(getOrgPlan({ plan: 'paid' })).toBe('paid');
      expect(getOrgPlan({ plan: 'free' })).toBe('free');
    });

    it('returns undefined for missing org or plan', () => {
      expect(getOrgPlan(null)).toBeUndefined();
      expect(getOrgPlan(undefined)).toBeUndefined();
      expect(getOrgPlan({})).toBeUndefined();
    });
  });
});
