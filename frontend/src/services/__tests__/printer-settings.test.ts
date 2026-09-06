import { parsePrinterSettings } from '../printer-settings';

it('validates the configured RAW TCP endpoint', () => {
  expect(parsePrinterSettings(' 192.168.1.100 ', '9100')).toEqual({
    host: '192.168.1.100',
    port: 9100,
    timeoutMs: 5000,
  });
  expect(() => parsePrinterSettings('192.168.1.999', '9100')).toThrow();
  expect(() => parsePrinterSettings('192.168.1.100', '70000')).toThrow();
});
