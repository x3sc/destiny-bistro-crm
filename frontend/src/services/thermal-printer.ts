import { requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

import type { PrinterSettings } from './printer-settings';

interface NativeThermalPrinter {
  print(host: string, port: number, payloadBase64: string, timeoutMs: number): Promise<number>;
}

interface ThermalPrinterRuntime {
  getModule(): NativeThermalPrinter;
  platform: string;
}

const defaultRuntime: ThermalPrinterRuntime = {
  getModule: () => requireNativeModule<NativeThermalPrinter>('ThermalPrinter'),
  platform: Platform.OS,
};

export async function sendToThermalPrinter(
  bytes: Uint8Array,
  settings: PrinterSettings,
  runtime: ThermalPrinterRuntime = defaultRuntime,
) {
  if (runtime.platform === 'web') {
    throw new Error('Impressão térmica disponível somente no aplicativo mobile.');
  }
  try {
    const written = await runtime
      .getModule()
      .print(settings.host, settings.port, bytesToBase64(bytes), settings.timeoutMs);
    if (written !== bytes.length) {
      throw new Error('A impressora não recebeu todos os dados.');
    }
    return written;
  } catch (error) {
    if (error instanceof Error && error.message === 'A impressora não recebeu todos os dados.') {
      throw error;
    }
    throw new Error(`Não foi possível conectar à impressora ${settings.host}:${settings.port}.`);
  }
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return globalThis.btoa(binary);
}
