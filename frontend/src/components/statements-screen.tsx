import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import Calendar from 'react-native-calendars/src/calendar';
import type { DateData } from 'react-native-calendars/src/types';
import { SafeAreaView } from 'react-native-safe-area-context';
import LocaleConfig from 'xdate';

import { normalizeApiBaseUrl } from '../services/api-base-url';
import { formatCentsAsBrl } from '../services/money';
import { exportStatementPdf } from '../services/statement-export';
import {
  loadStatement,
  type StatementReport,
} from '../services/statements-api';
import { themeColors } from '../theme/tokens';
import { statementStyles as styles } from './statements-screen.styles';

LocaleConfig.locales['pt-br'] = {
  dayNames: [
    'domingo',
    'segunda-feira',
    'terça-feira',
    'quarta-feira',
    'quinta-feira',
    'sexta-feira',
    'sábado',
  ],
  dayNamesShort: ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'],
  monthNames: [
    'janeiro',
    'fevereiro',
    'março',
    'abril',
    'maio',
    'junho',
    'julho',
    'agosto',
    'setembro',
    'outubro',
    'novembro',
    'dezembro',
  ],
  monthNamesShort: [
    'jan',
    'fev',
    'mar',
    'abr',
    'mai',
    'jun',
    'jul',
    'ago',
    'set',
    'out',
    'nov',
    'dez',
  ],
  today: 'Hoje',
};
LocaleConfig.defaultLocale = 'pt-br';

type ScreenState =
  | { kind: 'error' }
  | { kind: 'loading' }
  | { kind: 'success'; report: StatementReport };

export function StatementsScreen({
  apiBaseUrl = process.env.EXPO_PUBLIC_API_URL,
  exportRequest = exportStatementPdf,
  loadRequest = loadStatement,
  onBack,
  today = saoPauloToday(),
}: {
  apiBaseUrl?: string;
  exportRequest?: typeof exportStatementPdf;
  loadRequest?: typeof loadStatement;
  onBack: () => void;
  today?: string;
}) {
  const normalizedApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
  const [draftFrom, setDraftFrom] = useState(today);
  const [draftTo, setDraftTo] = useState<string | null>(today);
  const [appliedFrom, setAppliedFrom] = useState(today);
  const [appliedTo, setAppliedTo] = useState(today);
  const [state, setState] = useState<ScreenState>({ kind: 'loading' });
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);

  const requestPeriod = useCallback(
    (from: string, to: string) => {
      const request = normalizedApiBaseUrl
        ? loadRequest(normalizedApiBaseUrl, from, to)
        : Promise.reject(new Error('API não configurada'));

      void request.then(
        (report) => setState({ kind: 'success', report }),
        () => setState({ kind: 'error' }),
      );
    },
    [loadRequest, normalizedApiBaseUrl],
  );

  useEffect(() => {
    requestPeriod(today, today);
  }, [requestPeriod, today]);

  const markedDates = useMemo(
    () => createPeriodMarkings(draftFrom, draftTo),
    [draftFrom, draftTo],
  );

  const selectDay = (day: DateData) => {
    const selected = day.dateString;
    if (draftTo !== null || selected < draftFrom) {
      setDraftFrom(selected);
      setDraftTo(null);
    } else {
      setDraftTo(selected);
    }
  };

  const applyPeriod = () => {
    if (!draftTo) {
      return;
    }

    setAppliedFrom(draftFrom);
    setAppliedTo(draftTo);
    setExportError(false);
    setState({ kind: 'loading' });
    requestPeriod(draftFrom, draftTo);
  };

  const retry = () => {
    setState({ kind: 'loading' });
    requestPeriod(appliedFrom, appliedTo);
  };

  const exportPdf = () => {
    if (!normalizedApiBaseUrl || exporting) {
      return;
    }

    setExporting(true);
    setExportError(false);
    void exportRequest(normalizedApiBaseUrl, appliedFrom, appliedTo).then(
      () => setExporting(false),
      () => {
        setExporting(false);
        setExportError(true);
      },
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>Destiny Bistro CRM</Text>
          <Text style={styles.title}>Extratos</Text>
          <Text style={styles.description}>
            Acompanhe vendas, recebimentos e comandas por período.
          </Text>
        </View>

        <View style={styles.calendarCard}>
          <Calendar
            current={draftFrom}
            enableSwipeMonths
            firstDay={1}
            markedDates={markedDates}
            markingType="period"
            onDayPress={selectDay}
            testID="statement-calendar"
            theme={{
              arrowColor: themeColors.primary,
              calendarBackground: themeColors.surface,
              monthTextColor: themeColors.foreground,
              selectedDayBackgroundColor: themeColors.primary,
              todayTextColor: themeColors.primary,
            }}
          />
          <Text style={styles.period}>
            {formatDateKey(draftFrom)}
            {draftTo ? ` até ${formatDateKey(draftTo)}` : ' até ...'}
          </Text>
          <StatementButton
            disabled={!draftTo}
            label="Aplicar período"
            onPress={applyPeriod}
          />
        </View>

        {state.kind === 'loading' && (
          <View style={styles.loading}>
            <ActivityIndicator color={themeColors.primaryActivity} size="large" />
            <Text style={styles.description}>Carregando extrato...</Text>
          </View>
        )}

        {state.kind === 'error' && (
          <View style={styles.actions}>
            <Text style={styles.error}>
              Não foi possível carregar o extrato selecionado.
            </Text>
            <StatementButton
              label="Tentar novamente"
              onPress={retry}
            />
          </View>
        )}

        {state.kind === 'success' && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Resumo do período</Text>
              <View style={styles.metrics}>
                <MetricCard
                  label="Valor vendido"
                  value={formatCentsAsBrl(state.report.summary.soldCents)}
                />
                <MetricCard
                  label="Valor recebido"
                  value={formatCentsAsBrl(state.report.summary.receivedCents)}
                />
                <MetricCard
                  label="Comandas processadas"
                  value={String(state.report.summary.processedCommandCount)}
                />
                <MetricCard
                  label="Fechadas"
                  value={String(state.report.summary.closedCommandCount)}
                />
                <MetricCard
                  label="Canceladas"
                  value={String(state.report.summary.cancelledCommandCount)}
                />
                <MetricCard
                  label="Itens vendidos"
                  value={String(state.report.summary.soldItemCount)}
                />
                <MetricCard
                  label="Itens recebidos"
                  value={String(state.report.summary.receivedItemCount)}
                />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Detalhamento diário</Text>
              {state.report.days.map((day) => (
                <View key={day.date} style={styles.dailyCard}>
                  <Text style={styles.dailyDate}>
                    {formatDateKey(day.date)}
                  </Text>
                  <Text style={styles.dailyMeta}>
                    Vendido {formatCentsAsBrl(day.soldCents)} · Recebido{' '}
                    {formatCentsAsBrl(day.receivedCents)}
                  </Text>
                  <Text style={styles.dailyMeta}>
                    Itens: {day.soldItemCount} vendidos · {day.receivedItemCount}{' '}
                    recebidos
                  </Text>
                  <Text style={styles.dailyMeta}>
                    Comandas: {day.processedCommandCount} processadas ·{' '}
                    {day.closedCommandCount} fechadas ·{' '}
                    {day.cancelledCommandCount} canceladas
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.actions}>
              {exportError && (
                <Text style={styles.error}>
                  Não foi possível gerar ou compartilhar o PDF.
                </Text>
              )}
              <StatementButton
                disabled={exporting}
                label={exporting ? 'Gerando PDF...' : 'Exportar PDF'}
                onPress={exportPdf}
              />
            </View>
          </>
        )}

        <StatementButton
          label="Voltar ao menu"
          onPress={onBack}
          tone="secondary"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={styles.cardValue}>{value}</Text>
    </View>
  );
}

function StatementButton({
  disabled = false,
  label,
  onPress,
  tone = 'primary',
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'secondary';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        tone === 'secondary' && styles.buttonSecondary,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          tone === 'secondary' && styles.buttonSecondaryText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function createPeriodMarkings(from: string, to: string | null) {
  const markings: Record<
    string,
    {
      color: string;
      endingDay?: boolean;
      startingDay?: boolean;
      textColor: string;
    }
  > = {};
  const end = to ?? from;
  let date = from;

  while (date <= end) {
    markings[date] = {
      color: themeColors.primary,
      endingDay: date === end,
      startingDay: date === from,
      textColor: themeColors.foregroundOnPrimary,
    };
    date = addDays(date, 1);
  }

  return markings;
}

function addDays(dateKey: string, amount: number) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount));

  return [
    date.getUTCFullYear().toString().padStart(4, '0'),
    (date.getUTCMonth() + 1).toString().padStart(2, '0'),
    date.getUTCDate().toString().padStart(2, '0'),
  ].join('-');
}

function formatDateKey(value: string) {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function saoPauloToday() {
  const values = new Map(
    new Intl.DateTimeFormat('en-US', {
      day: '2-digit',
      month: '2-digit',
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
    })
      .formatToParts(new Date())
      .map((part) => [part.type, part.value]),
  );

  return `${values.get('year')}-${values.get('month')}-${values.get('day')}`;
}
