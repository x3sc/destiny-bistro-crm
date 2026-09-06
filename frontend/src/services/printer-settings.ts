import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export interface PrinterSettings {
  host: string;
  port: number;
  timeoutMs: number;
}

export const defaultPrinterSettings: PrinterSettings = {
  host: '192.168.1.100',
  port: 9100,
  timeoutMs: 5_000,
};

const storageKey = 'destiny-bistro-printer-settings-v1';

export async function loadPrinterSettings(): Promise<PrinterSettings> {
  const serialized =
    Platform.OS === 'web'
      ? globalThis.localStorage?.getItem(storageKey) ?? null
      : await SecureStore.getItemAsync(storageKey);
  if (!serialized) return defaultPrinterSettings;
  try {
    const value: unknown = JSON.parse(serialized);
    return isPrinterSettings(value) ? value : defaultPrinterSettings;
  } catch {
    return defaultPrinterSettings;
  }
}

export async function savePrinterSettings(settings: PrinterSettings) {
  if (!isPrinterSettings(settings)) {
    throw new Error('Configuração de impressora inválida.');
  }
  const serialized = JSON.stringify(settings);
  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(storageKey, serialized);
  } else {
    await SecureStore.setItemAsync(storageKey, serialized);
  }
}

export function parsePrinterSettings(host: string, port: string): PrinterSettings {
  const normalizedHost = host.trim();
  const parsedPort = Number(port);
  if (!isHost(normalizedHost) || !Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65_535) {
    throw new Error('Informe um IP e uma porta válidos.');
  }
  return { host: normalizedHost, port: parsedPort, timeoutMs: 5_000 };
}

function isPrinterSettings(value: unknown): value is PrinterSettings {
  if (!value || typeof value !== 'object') return false;
  const settings = value as Partial<PrinterSettings>;
  return (
    typeof settings.host === 'string' &&
    isHost(settings.host) &&
    Number.isInteger(settings.port) &&
    Number(settings.port) >= 1 &&
    Number(settings.port) <= 65_535 &&
    Number.isInteger(settings.timeoutMs) &&
    Number(settings.timeoutMs) >= 1_000 &&
    Number(settings.timeoutMs) <= 30_000
  );
}

function isHost(value: string) {
  const parts = value.split('.');
  return (
    parts.length === 4 &&
    parts.every((part) => /^\d{1,3}$/u.test(part) && Number(part) >= 0 && Number(part) <= 255)
  );
}
