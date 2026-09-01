import { supabase } from '../lib/supabase';
import { getCurrentProfile } from './authService';
import { getFarmActorDisplayProfiles, getFarmMemberBasicProfiles } from './memberService';
import type {
  CareActivityOrigin,
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

// `kategori` ditambahkan migrasi 065. Ia melengkapi `description`, bukan
// menggantikannya: pada cabang perawatan, view mengisi description dengan
// catatan ATAU kategori (coalesce, 045:273), sehingga kategori hilang begitu
// pekerja menulis catatan. Kolom ini membawanya terpisah supaya keduanya bisa
// tampil bersama.
// `dibuat_pada` ditambahkan migrasi 066: waktu baris catatan itu DITULIS, dari
// keempat cabang view. Ia bukan pengganti happened_at dan tidak pernah
// ditampilkan — perannya tunggal, jadi pemecah seri urutan (lihat query di
// bawah).
const TREE_HISTORY_SELECT =
  'source_id, tree_id, farm_id, history_type, title, description, actor_id, happened_at, asal, produk, kategori, dibuat_pada';

type TreeHistoryRow = {
  source_id: string | null;
  tree_id: string;
  farm_id: string;
  history_type: TreeHistoryType;
  title: string;
  description: string | null;
  actor_id: string;
  happened_at: string;
  asal: CareActivityOrigin | null;
  produk: string | null;
  kategori: string | null;
  dibuat_pada: string;
};

type TreeFarmRow = {
  id: string;
  farm_id: string;
};

type MembershipRow = {
  role: MemberRole;
  status: MemberStatus;
};

type HistoryActorDisplay = {
  fullName: string | null;
  role: MemberRole | null;
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

  // URUTAN SEKUNDER dibuat_pada, MENGGANTIKAN source_id.
  //
  // Kenapa perlu urutan sekunder sama sekali: happened_at pada view ini berasal
  // dari empat kolom timestamptz yang seluruh jalur tulisnya — kecuali
  // complete_task — mengisi dengan string tanggal saja ('2026-08-28') yang
  // di-cast Postgres jadi tengah malam. Semua catatan pada hari yang sama punya
  // happened_at IDENTIK, bukan sekadar berdekatan, dan `order by` satu kolom
  // pada nilai yang seri tidak menjanjikan urutan apa pun.
  //
  // KENAPA source_id DIGANTI. Ia menyelesaikan separuh masalah: sebagai primary
  // key ia unik, jadi urutannya STABIL — sama setiap kali dimuat. Tapi nilainya
  // uuid acak, jadi urutan di dalam satu hari juga acak. Riwayat hari itu tidak
  // pernah berpindah-pindah, ia hanya salah urut secara tetap.
  //
  // dibuat_pada (migrasi 066) memberi keduanya. Ia timestamptz `default now()`
  // yang ditulis database saat barisnya lahir — bukan tanggal yang diketik
  // pencatat — jadi ia satu-satunya kolom di view ini yang tahu urutan
  // SEBENARNYA dari dua catatan pada hari yang sama. Dengan desc, catatan yang
  // ditulis belakangan tampil lebih dulu, sepadan dengan happened_at desc di
  // atasnya.
  //
  // Ia TIDAK PERNAH ditampilkan. Layar tetap menulis '28 Agu' tanpa jam —
  // jamnya nyata untuk kolom ini, tapi menampilkannya berarti dua waktu di satu
  // baris yang bisa berbeda hari (catatan bertanggal mundur), dan pembacanya
  // tidak punya cara tahu mana yang mana.
  //
  // KEUNIKAN TIDAK LAGI DIJAMIN, dan itu diterima. Dua baris bisa punya
  // dibuat_pada identik kalau ditulis dalam transaksi yang sama — jalur nyatanya
  // complete_task pada jadwal multi-pohon, yang membuat satu care_activities
  // untuk banyak pohon. Tapi baris-baris itu milik POHON yang berbeda, sedangkan
  // query ini disaring ke satu tree_id: di dalam satu pohon mereka tidak pernah
  // bertemu. Sisanya perlu dua catatan lahir pada mikrodetik yang sama untuk
  // pohon yang sama — dan kalaupun terjadi, akibatnya kembali persis ke keadaan
  // sebelum baris ini ada.
  const { data, error } = await supabase
    .from('tree_history_view')
    .select(TREE_HISTORY_SELECT)
    .eq('tree_id', input.treeId)
    .order('happened_at', { ascending: false })
    .order('dibuat_pada', { ascending: false })
    .returns<TreeHistoryRow[]>();

  if (error) {
    if (isMissingHistoryViewError(error)) {
      return fail(
        new Error('Riwayat pohon belum tersedia. Jalankan pembaruan database sebelum memakai riwayat pohon terintegrasi.')
      );
    }

    return fail(error, 'Gagal memuat riwayat pohon.');
  }

  const history = (data ?? []).map(mapTreeHistoryItem);
  const actorDisplays = await getHistoryActorDisplays(
    treeFarmIdResult.data,
    history.map((item) => item.actorId)
  );

  return ok(
    history.map((item) => ({
      ...item,
      actorName: actorDisplays[item.actorId]?.fullName ?? null,
      actorRole: actorDisplays[item.actorId]?.role ?? null,
    }))
  );
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
    return fail(new Error('Hanya pemilik atau pekerja aktif yang dapat mengakses riwayat pohon.'));
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
    actorName: null,
    actorRole: null,
    sourceId: row.source_id,
    treeId: row.tree_id,
    farmId: row.farm_id,
    historyType: row.history_type,
    title: row.title,
    description: row.description,
    actorId: row.actor_id,
    happenedAt: row.happened_at,
    asal: row.asal,
    produk: row.produk,
    kategori: row.kategori,
    dibuatPada: row.dibuat_pada,
  };
}

async function getHistoryActorDisplays(
  farmId: UUID,
  actorIds: UUID[]
): Promise<Record<string, HistoryActorDisplay>> {
  const uniqueActorIds = Array.from(new Set(actorIds));

  if (uniqueActorIds.length === 0) {
    return {};
  }

  const actorDisplays: Record<string, HistoryActorDisplay> = {};

  const profileResult = await getCurrentProfile();

  if (profileResult.data?.fullName) {
    actorDisplays[profileResult.data.id] = {
      fullName: profileResult.data.fullName,
      role: null,
    };
  }

  const actorProfilesResult = await getFarmActorDisplayProfiles(farmId);

  if (actorProfilesResult.data) {
    for (const profile of actorProfilesResult.data) {
      actorDisplays[profile.userId] = {
        fullName: profile.fullName,
        role: profile.role,
      };
    }
  } else {
    const memberProfilesResult = await getFarmMemberBasicProfiles(farmId);

    if (memberProfilesResult.data) {
      for (const profile of memberProfilesResult.data) {
        actorDisplays[profile.userId] = {
          fullName: profile.fullName,
          role: null,
        };
      }
    }
  }

  return Object.fromEntries(
    uniqueActorIds
      .map((actorId) => [actorId, actorDisplays[actorId]])
      .filter((entry): entry is [string, HistoryActorDisplay] => Boolean(entry[1]))
  );
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
