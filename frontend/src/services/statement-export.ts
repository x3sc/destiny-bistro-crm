import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import {
  authenticatedFetch,
  getActiveAuthToken,
} from './auth-session';
import {
  defaultStatementEntryFilters,
  statementPdfUrl,
  type StatementEntryFilters,
  type StatementView,
} from './statements-api';

export async function exportStatementPdf(
  apiBaseUrl: string,
  from: string,
  to: string,
  view: StatementView,
  filters: StatementEntryFilters = defaultStatementEntryFilters,
  runtime: StatementExportRuntime = defaultRuntime,
) {
  const url = statementPdfUrl(apiBaseUrl, from, to, view, filters);
  const viewLabel = view === 'summary' ? 'resumido' : 'detalhado';
  const filename = `extrato-${viewLabel}-${from}-a-${to}.pdf`;

  if (runtime.platform === 'web') {
    await runtime.downloadWeb(url, filename);
    return;
  }

  await runtime.downloadAndShare(url, filename, getActiveAuthToken());
}

interface StatementExportRuntime {
  downloadAndShare: (
    url: string,
    filename: string,
    token: string | null,
  ) => Promise<void>;
  downloadWeb: (url: string, filename: string) => Promise<void>;
  platform: string;
}

const defaultRuntime: StatementExportRuntime = {
  downloadAndShare,
  downloadWeb,
  platform: Platform.OS,
};

async function downloadAndShare(
  url: string,
  filename: string,
  token: string | null,
) {
  const destination = new File(Paths.cache, filename);
  if (destination.exists) {
    destination.delete();
  }

  const file = await File.downloadFileAsync(url, destination, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Compartilhamento indisponível neste dispositivo.');
  }

  await Sharing.shareAsync(file.uri, {
    dialogTitle: 'Exportar extrato',
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
  });
}

async function downloadWeb(url: string, filename: string) {
  const response = await authenticatedFetch(url);

  if (!response.ok) {
    throw new Error('Não foi possível exportar o extrato.');
  }

  const objectUrl = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(objectUrl);
}
