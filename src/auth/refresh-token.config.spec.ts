import { ConfigService } from '@nestjs/config';
import { refreshTokenTtlFromConfig } from './refresh-token.config';

const configWith = (values: Record<string, string>) =>
  ({ get: (key: string) => values[key] }) as unknown as ConfigService;

describe('refreshTokenTtlFromConfig', () => {
  it('defaults to 7 days when JWT_REFRESH_EXPIRES_IN is unset or empty', () => {
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    expect(refreshTokenTtlFromConfig(configWith({}))).toBe(sevenDays);
    expect(refreshTokenTtlFromConfig(configWith({ JWT_REFRESH_EXPIRES_IN: '  ' }))).toBe(sevenDays);
  });

  it.each([
    ['30m', 30 * 60 * 1000],
    ['2h', 2 * 60 * 60 * 1000],
    ['1d', 24 * 60 * 60 * 1000],
  ])('reads JWT_REFRESH_EXPIRES_IN=%s', (value, expected) => {
    expect(refreshTokenTtlFromConfig(configWith({ JWT_REFRESH_EXPIRES_IN: value }))).toBe(expected);
  });

  it.each(['abc', '7 lightyears', '-1d', '0'])('rejects JWT_REFRESH_EXPIRES_IN=%s', (value) => {
    expect(() => refreshTokenTtlFromConfig(configWith({ JWT_REFRESH_EXPIRES_IN: value }))).toThrow(
      /JWT_REFRESH_EXPIRES_IN/,
    );
  });
});
