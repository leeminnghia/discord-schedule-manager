import { describe, it, expect } from 'vitest';
import { parseDuration, formatDuration, formatDurationShort } from '../src/utils/duration.js';
import { ValidationError } from '../src/utils/errors.js';

describe('Duration Utility Tests', () => {
  it('should parse simple minute formats correctly', () => {
    expect(parseDuration('30m')).toBe(30);
    expect(parseDuration('45 min')).toBe(45);
    expect(parseDuration('90mins')).toBe(90);
    expect(parseDuration('15 phút')).toBe(15);
  });

  it('should parse whole hour formats correctly', () => {
    expect(parseDuration('1h')).toBe(60);
    expect(parseDuration('2h')).toBe(120);
    expect(parseDuration('3 giờ')).toBe(180);
    expect(parseDuration('4hrs')).toBe(240);
  });

  it('should parse decimal hour formats correctly', () => {
    expect(parseDuration('1.5h')).toBe(90);
    expect(parseDuration('2.5h')).toBe(150);
    expect(parseDuration('0.5h')).toBe(30);
  });

  it('should parse combined hour + minute formats correctly', () => {
    expect(parseDuration('1h30m')).toBe(90);
    expect(parseDuration('2h 15m')).toBe(135);
    expect(parseDuration('1h45')).toBe(105);
    expect(parseDuration('3h30')).toBe(210);
  });

  it('should parse raw numbers as minutes', () => {
    expect(parseDuration('60')).toBe(60);
    expect(parseDuration(120)).toBe(120);
  });

  it('should throw ValidationError for invalid or zero/negative durations', () => {
    expect(() => parseDuration('0m')).toThrow(ValidationError);
    expect(() => parseDuration('-10m')).toThrow(ValidationError);
    expect(() => parseDuration('abc')).toThrow(ValidationError);
    expect(() => parseDuration('')).toThrow(ValidationError);
  });

  it('should format minutes to Vietnamese readable strings', () => {
    expect(formatDuration(30)).toBe('30 phút');
    expect(formatDuration(60)).toBe('1 giờ');
    expect(formatDuration(90)).toBe('1 giờ 30 phút');
    expect(formatDuration(180)).toBe('3 giờ');
  });

  it('should format minutes to short strings', () => {
    expect(formatDurationShort(30)).toBe('30M');
    expect(formatDurationShort(60)).toBe('1H');
    expect(formatDurationShort(90)).toBe('1H30M');
    expect(formatDurationShort(180)).toBe('3H');
  });
});
