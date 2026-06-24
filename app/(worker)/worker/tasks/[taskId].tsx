import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Text, TextInput, View } from 'react-native';

import {
  formatCareTarget,
  formatTaskSource,
  formatTaskStatus,
} from '../../../../src/components/care-schedule-components';
import { formatCareCategory } from '../../../../src/components/care-sop-components';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  LoadingState,
  MetaRow,
  Screen,
  TopAppBar,
} from '../../../../src/components/ui';
import {
  completeTask,
  getTaskDetail,
  postponeTask,
} from '../../../../src/services/careTaskService';
import type { ActivityStatus, CareTaskDetail } from '../../../../src/types/domain';

export default function WorkerTaskDetailScreen() {
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  const [actionLoading, setActionLoading] = React.useState<'complete' | 'postpone' | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [completeNote, setCompleteNote] = React.useState('');
  const [showCompleteInput, setShowCompleteInput] = React.useState(false);
  const [postponeNote, setPostponeNote] = React.useState('');
  const [showPostponeInput, setShowPostponeInput] = React.useState(false);
  const [task, setTask] = React.useState<CareTaskDetail | null>(null);

  const loadDetail = React.useCallback(async () => {
    const normalizedTaskId = taskId?.trim();

    if (!normalizedTaskId) {
      setError('Data tugas tidak ditemukan.');
      setTask(null);
      return;
    }

    setError(null);

    const result = await getTaskDetail({ taskId: normalizedTaskId });

    if (result.error) {
      setError(result.error.message);
      setTask(null);
      return;
    }

    setTask(result.data);
  }, [taskId]);

  useFocusEffect(
    React.useCallback(() => {
      setLoading(true);
      loadDetail().finally(() => setLoading(false));
    }, [loadDetail])
  );

  async function handleComplete() {
    if (!task) {
      return;
    }

    if (!showCompleteInput) {
      setShowCompleteInput(true);
      setShowPostponeInput(false);
      return;
    }

    setActionLoading('complete');
    setError(null);

    const result = await completeTask({
      note: completeNote,
      taskId: task.id,
    });

    if (result.error) {
      setError(result.error.message);
      setActionLoading(null);
      return;
    }

    setCompleteNote('');
    setShowCompleteInput(false);
    await loadDetail();
    setActionLoading(null);
  }

  async function handlePostpone() {
    if (!task) {
      return;
    }

    if (!showPostponeInput) {
      setShowPostponeInput(true);
      setShowCompleteInput(false);
      return;
    }

    if (!postponeNote.trim()) {
      setError('Catatan penundaan wajib diisi.');
      return;
    }

    setActionLoading('postpone');
    setError(null);

    const result = await postponeTask({
      note: postponeNote,
      taskId: task.id,
    });

    if (result.error) {
      setError(result.error.message);
      setActionLoading(null);
      return;
    }

    setPostponeNote('');
    setShowPostponeInput(false);
    await loadDetail();
    setActionLoading(null);
  }

  if (loading) {
    return <LoadingState message="Memuat detail tugas..." />;
  }

  if (!task) {
    return (
      <Screen>
        <TopAppBar title="Detail Tugas" onBack={() => router.back()} />
        <ErrorBanner message={error} />
        <EmptyState title="Tugas tidak ditemukan" subtitle="Tugas mungkin tidak tersedia atau bukan milik Anda." />
      </Screen>
    );
  }

  const isCompleted = task.status === 'completed';

  return (
    <Screen
      footer={
        <>
          {showPostponeInput ? (
            <TextArea
              label="Catatan penundaan *"
              onChangeText={setPostponeNote}
              placeholder="Contoh: Stok air belum tersedia"
              value={postponeNote}
            />
          ) : null}
          {showCompleteInput ? (
            <TextArea
              label="Catatan penyelesaian (opsional)"
              onChangeText={setCompleteNote}
              placeholder="Contoh: Pekerjaan selesai sesuai instruksi"
              value={completeNote}
            />
          ) : null}
          <Button
            title={showCompleteInput ? 'Kirim Penyelesaian' : 'Selesaikan Tugas'}
            disabled={isCompleted || actionLoading === 'postpone'}
            loading={actionLoading === 'complete'}
            onPress={handleComplete}
          />
          <Button
            title={showPostponeInput ? 'Kirim Penundaan' : 'Tunda Tugas'}
            disabled={isCompleted || actionLoading === 'complete'}
            loading={actionLoading === 'postpone'}
            variant="secondary"
            onPress={handlePostpone}
          />
        </>
      }
    >
      <TopAppBar title="Detail Tugas" onBack={() => router.back()} />
      <ErrorBanner message={error} />

      <Card variant="highlight">
        <Text selectable style={{ color: '#1E2A24', fontSize: 22, fontWeight: '900', lineHeight: 28 }}>
          {task.title}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
          <Badge label={formatTaskStatus(task.status)} tone={getTaskTone(task.status)} />
          <Badge label={formatTaskSource(task)} tone="muted" />
        </View>
        <View style={{ gap: 10 }}>
          <MetaRow label="Tanggal" value={formatDate(task.dueDate)} />
          <MetaRow label="Target" value={formatCareTarget(task)} />
          <MetaRow label="Kategori" value={task.category ? formatCareCategory(task.category) : 'Tanpa kategori'} />
        </View>
      </Card>

      <Card>
        <Text selectable style={{ color: '#1E2A24', fontSize: 18, fontWeight: '900' }}>
          Instruksi
        </Text>
        <Text selectable style={{ color: '#1E2A24', fontSize: 16, lineHeight: 23 }}>
          {task.instruction || '-'}
        </Text>
      </Card>

      <Text selectable style={{ color: '#1E2A24', fontSize: 20, fontWeight: '700', paddingTop: 4 }}>
        Realisasi
      </Text>
      {task.activities.length === 0 ? (
        <EmptyState title="Belum ada realisasi" subtitle="Selesaikan atau tunda tugas untuk menyimpan realisasi." />
      ) : (
        <View style={{ gap: 12 }}>
          {task.activities.map((activity) => (
            <Card key={activity.id}>
              <MetaRow label="Status" value={formatActivityStatus(activity.status)} />
              <MetaRow label="Waktu" value={formatDateTime(activity.performedAt)} />
              <MetaRow label="Catatan" value={activity.note} />
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}

function TextArea({
  label,
  onChangeText,
  placeholder,
  value,
}: {
  label: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <View style={{ gap: 7 }}>
      <Text selectable style={{ color: '#1E2A24', fontSize: 14, fontWeight: '600' }}>
        {label}
      </Text>
      <TextInput
        multiline
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94A098"
        style={{
          backgroundColor: '#FFFFFF',
          borderColor: '#DDE4DA',
          borderCurve: 'continuous',
          borderRadius: 8,
          borderWidth: 1,
          color: '#1E2A24',
          fontSize: 16,
          minHeight: 96,
          paddingHorizontal: 14,
          paddingTop: 12,
          textAlignVertical: 'top',
        }}
        value={value}
      />
    </View>
  );
}

function formatActivityStatus(status: ActivityStatus): string {
  const labels: Record<ActivityStatus, string> = {
    completed: 'Selesai',
    postponed: 'Ditunda',
  };

  return labels[status];
}

function getTaskTone(status: CareTaskDetail['status']): 'danger' | 'muted' | 'success' | 'warning' {
  if (status === 'completed') {
    return 'success';
  }

  if (status === 'postponed') {
    return 'warning';
  }

  return 'muted';
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('id-ID', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
