import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Text, TextInput, View } from 'react-native';

import {
  formatCareTarget,
  formatTaskStatus,
} from '../../../../src/components/care-schedule-components';
import { formatCareCategory } from '../../../../src/components/care-sop-components';
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  LoadingState,
  MetaRow,
  PageIntro,
  Screen,
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
  const [postponeNote, setPostponeNote] = React.useState('');
  const [showPostponeInput, setShowPostponeInput] = React.useState(false);
  const [task, setTask] = React.useState<CareTaskDetail | null>(null);

  const loadDetail = React.useCallback(async () => {
    const normalizedTaskId = taskId?.trim();

    if (!normalizedTaskId) {
      setError('Task ID tidak ditemukan.');
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

    setActionLoading('complete');
    setError(null);

    const result = await completeTask({
      taskId: task.id,
    });

    if (result.error) {
      setError(result.error.message);
      setActionLoading(null);
      return;
    }

    await loadDetail();
    setActionLoading(null);
  }

  async function handlePostpone() {
    if (!task) {
      return;
    }

    if (!showPostponeInput) {
      setShowPostponeInput(true);
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
      <Screen footer={<Button title="Kembali" variant="secondary" onPress={() => router.replace('/worker/tasks')} />}>
        <PageIntro title="Detail Tugas" subtitle="Data tugas tidak dapat dimuat." />
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
          <Button
            title="Selesaikan Tugas"
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
          <Button
            title="Kembali ke Tugas"
            variant="secondary"
            disabled={Boolean(actionLoading)}
            onPress={() => router.replace('/worker/tasks')}
          />
        </>
      }
    >
      <PageIntro title={task.title} subtitle="Detail tugas perawatan dan aksi realisasi." />
      <ErrorBanner message={error} />

      <Card>
        <MetaRow label="Judul" value={task.title} />
        <MetaRow label="Kategori" value={task.category ? formatCareCategory(task.category) : 'Tanpa kategori'} />
        <MetaRow label="Jatuh tempo" value={task.dueDate} />
        <MetaRow label="Status" value={formatTaskStatus(task.status)} />
        <MetaRow label="Target" value={formatCareTarget(task)} />
      </Card>

      <Card>
        <Text selectable style={{ color: '#1E2A24', fontSize: 17, fontWeight: '700' }}>
          Instruksi
        </Text>
        <Text selectable style={{ color: '#68746D', lineHeight: 21 }}>
          {task.instruction || 'Instruksi belum diisi.'}
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
