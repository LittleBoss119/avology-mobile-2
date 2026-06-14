import { supabase } from '../lib/supabase';
import type {
  GetTreeHistoryInput,
  MemberRole,
  MemberStatus,
  ServiceResult,
  SuccessData,
  TreeHistoryItem,
  TreeHistoryType,
  UUID,
} from '../types/domain';
import { fail, ok } from '../utils/serviceResult';

const TREE_HISTORY_SELECT =
  'tree_id, farm_id, history_type, title, description, actor_id, happened_at';

type TreeHistoryRow = {
  tree_id: string;
  farm_id: string;
  history_type: TreeHistoryType;
  title: string;
  description: string | null;
  actor_id: string;
  happened_at: string;
};

type TreeFarmRow = {
  id: string;
  farm_id: string;
};

type MembershipRow = {
  role: MemberRole;
  status: MemberStatus;
};

export async function getTreeHistory(
  input: GetTreeHistoryInput
): Promise<ServiceResult<TreeHistoryItem[]>> {
  const treeFarmIdResult = await getAccessibleTreeFarmId(input.treeId);

  if (treeFarmIdResult.error) {
    return fail(treeFarmIdResult.error);
  }

  const accessResult = await ensureActiveOwnerOrWorker(treeFarmIdResult.data);

  if (accessResult.error) {
    return fail(accessResult.error);
  }

  const { data, error } = await supabase
    .from('tree_history_view')
    .select(TREE_HISTORY_SELECT)
    .eq('tree_id', input.treeId)
    .order('happened_at', { ascending: false })
    .returns<TreeHistoryRow[]>();

  if (error) {
    if (isMissingHistoryViewError(error)) {
      return fail(
        new Error('Tree history view belum tersedia. Jalankan migration tree_history_view sebelum memakai riwayat pohon terintegrasi.')
      );
    }

    return fail(error, 'Gagal memuat riwayat pohon.');
  }

  return ok((data ?? []).map(mapTreeHistoryItem));
}

async function getAccessibleTreeFarmId(treeId: UUID): Promise<ServiceResult<UUID>> {
  const { data, error } = await supabase
    .from('trees')
    .select('id, farm_id')
    .eq('id', treeId)
    .maybeSingle<TreeFarmRow>();

  if (error) {
    return fail(error, 'Gagal memeriksa akses pohon.');
  }

  if (!data) {
    return fail(new Error('Data pohon tidak ditemukan atau tidak dapat diakses.'));
  }

  return ok(data.farm_id);
}

async function ensureActiveOwnerOrWorker(farmId: UUID): Promise<ServiceResult<SuccessData>> {
  const membershipResult = await getCurrentUserMembership(farmId);

  if (membershipResult.error) {
    return fail(membershipResult.error);
  }

  const membership = membershipResult.data;

  if (
    !membership ||
    membership.status !== 'active' ||
    (membership.role !== 'owner' && membership.role !== 'worker')
  ) {
    return fail(new Error('Hanya owner atau worker aktif yang dapat mengakses riwayat pohon.'));
  }

  return ok({
    success: true,
  });
}

async function getCurrentUserMembership(
  farmId: UUID
): Promise<ServiceResult<MembershipRow | null>> {
  const userIdResult = await getCurrentUserId();

  if (userIdResult.error) {
    return fail(userIdResult.error);
  }

  const { data, error } = await supabase
    .from('farm_members')
    .select('role, status')
    .eq('farm_id', farmId)
    .eq('user_id', userIdResult.data)
    .maybeSingle<MembershipRow>();

  if (error) {
    return fail(error, 'Gagal memeriksa akses kebun.');
  }

  return ok(data);
}

async function getCurrentUserId(): Promise<ServiceResult<UUID>> {
  const userResult = await supabase.auth.getUser();

  if (userResult.error) {
    if (isMissingSessionError(userResult.error)) {
      return fail(new Error('Silakan login terlebih dahulu.'));
    }

    return fail(userResult.error, 'Gagal memuat pengguna saat ini.');
  }

  const userId = userResult.data.user?.id;

  if (!userId) {
    return fail(new Error('Silakan login terlebih dahulu.'));
  }

  return ok(userId);
}

function mapTreeHistoryItem(row: TreeHistoryRow): TreeHistoryItem {
  return {
    treeId: row.tree_id,
    farmId: row.farm_id,
    historyType: row.history_type,
    title: row.title,
    description: row.description,
    actorId: row.actor_id,
    happenedAt: row.happened_at,
  };
}

function isMissingHistoryViewError(error: { code?: string; message?: string }): boolean {
  const message = error.message?.toLowerCase() ?? '';

  return (
    error.code === 'PGRST205' ||
    error.code === '42P01' ||
    (message.includes('tree_history_view') &&
      (message.includes('not found') || message.includes('schema cache') || message.includes('does not exist')))
  );
}

function isMissingSessionError(error: { message?: string; name?: string }): boolean {
  return (
    error.name === 'AuthSessionMissingError' ||
    error.message?.toLowerCase().includes('auth session missing') === true
  );
}
