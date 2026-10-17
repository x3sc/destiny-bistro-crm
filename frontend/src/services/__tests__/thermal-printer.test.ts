import { sendToThermalPrinter } from '../thermal-printer';

const settings = { host: '192.168.1.100', port: 9100, timeoutMs: 5000 };

it('explains that missing native printing requires a compatible build rather than blaming the network', async () => {
  await expect(sendToThermalPrinter(Uint8Array.from([1]), settings, {
    platform: 'android', getModule: () => { throw new Error('Cannot find native module ThermalPrinter'); },
  })).rejects.toThrow('A impressão exige um build nativo com ThermalPrinter; não está disponível no Expo Go.');
});

it('sends base64 bytes through the native RAW TCP module', async () => {
  const print = jest.fn().mockResolvedValue(4);
  await expect(
    sendToThermalPrinter(Uint8Array.from([0x1b, 0x40, 0x0a, 0xff]), settings, {
      getModule: () => ({ print }),
      platform: 'android',
    }),
  ).resolves.toBe(4);
  expect(print).toHaveBeenCalledWith(
    '192.168.1.100',
    9100,
    'G0AK/w==',
    5000,
  );
});

it('rejects web and connection failures without automatic retry', async () => {
  const print = jest.fn().mockRejectedValue(new Error('timeout'));
  await expect(
    sendToThermalPrinter(Uint8Array.from([1]), settings, {
      getModule: () => ({ print }),
      platform: 'ios',
    }),
  ).rejects.toThrow('Não foi possível conectar à impressora 192.168.1.100:9100.');
  expect(print).toHaveBeenCalledTimes(1);

  await expect(
    sendToThermalPrinter(Uint8Array.from([1]), settings, {
      getModule: () => ({ print }),
      platform: 'web',
    }),
  ).rejects.toThrow('somente no aplicativo mobile');
});
