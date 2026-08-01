import type {
  GroupSnapshot,
  InvitePreview,
  Member,
  PaymentRecord,
  RecentGroupSummary,
  SettlementTransfer,
} from "@/types";

export const OBSOLETE_LOCAL_GROUP_STORAGE_KEYS = {
  groupName: "groupName",
  members: "members",
  records: "records",
} as const;

export const RECENT_GROUP_STORAGE_KEY = "waritabi:recent-group:v1";

export interface StorageReader {
  getItem: (key: string) => string | null;
}

export interface StorageWriter {
  removeItem: (key: string) => void;
}

export interface StorageSetter {
  setItem: (key: string, value: string) => void;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isSafeNonNegativeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

const isSafePositiveInteger = (value: unknown): value is number =>
  isSafeNonNegativeInteger(value) && value > 0;

const hasUniqueValues = (values: string[]) =>
  new Set(values).size === values.length;

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(isNonEmptyString);

const isNullableString = (value: unknown): value is string | null =>
  value === null || typeof value === "string";

const parseJson = (value: string | null): unknown => {
  if (value === null) {
    return undefined;
  }
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
};

export const clearObsoleteLocalGroupData = (storage: StorageWriter) => {
  Object.values(OBSOLETE_LOCAL_GROUP_STORAGE_KEYS).forEach((key) => {
    try {
      storage.removeItem(key);
    } catch {
      // 廃止済みデータを削除できなくても、現在の共有機能は継続する。
    }
  });
};

export const parseRecentGroupSummary = (
  value: unknown
): RecentGroupSummary | null => {
  if (
    !isObject(value) ||
    !isNonEmptyString(value.groupId) ||
    !isNonEmptyString(value.groupName)
  ) {
    return null;
  }
  return {
    groupId: value.groupId.trim(),
    groupName: value.groupName.trim(),
  };
};

export const readRecentGroup = (
  storage: StorageReader
): RecentGroupSummary | null => {
  try {
    return parseRecentGroupSummary(
      parseJson(storage.getItem(RECENT_GROUP_STORAGE_KEY))
    );
  } catch {
    return null;
  }
};

export const storeRecentGroup = (
  storage: StorageSetter,
  summary: RecentGroupSummary
) => {
  const parsed = parseRecentGroupSummary(summary);
  if (!parsed) {
    return;
  }
  try {
    storage.setItem(RECENT_GROUP_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // 直近リンクを保存できなくてもクラウド上の操作は成功扱いにする。
  }
};

export const removeRecentGroup = (
  storage: StorageReader & StorageWriter,
  groupId: string
) => {
  try {
    const current = readRecentGroup(storage);
    if (current?.groupId === groupId) {
      storage.removeItem(RECENT_GROUP_STORAGE_KEY);
    }
  } catch {
    // 端末の履歴削除失敗はクラウド上の状態へ影響させない。
  }
};

const isMember = (value: unknown): value is Member =>
  isObject(value) &&
  isNonEmptyString(value.id) &&
  isNonEmptyString(value.name) &&
  isSafeNonNegativeInteger(value.position);

const isPayment = (value: unknown): value is PaymentRecord =>
  isObject(value) &&
  isNonEmptyString(value.id) &&
  isNonEmptyString(value.title) &&
  isNonEmptyString(value.payerMemberId) &&
  isSafeNonNegativeInteger(value.amount) &&
  isStringArray(value.beneficiaryMemberIds) &&
  value.beneficiaryMemberIds.length > 0 &&
  hasUniqueValues(value.beneficiaryMemberIds) &&
  isSafePositiveInteger(value.version) &&
  isNullableString(value.createdByMemberId) &&
  isNonEmptyString(value.createdAt) &&
  isNonEmptyString(value.updatedAt);

const isTransfer = (value: unknown): value is SettlementTransfer =>
  isObject(value) &&
  isNonEmptyString(value.id) &&
  isNonEmptyString(value.fromMemberId) &&
  isNonEmptyString(value.toMemberId) &&
  value.fromMemberId !== value.toMemberId &&
  isSafePositiveInteger(value.amount) &&
  isSafePositiveInteger(value.version) &&
  isNullableString(value.createdByMemberId) &&
  isNonEmptyString(value.createdAt);

export const parseGroupSnapshot = (value: unknown): GroupSnapshot | null => {
  if (!isObject(value) || !isObject(value.group)) {
    return null;
  }

  const group = value.group;
  if (
    !isNonEmptyString(group.id) ||
    !isNonEmptyString(group.name) ||
    !isSafePositiveInteger(group.revision) ||
    (group.role !== "owner" && group.role !== "editor") ||
    !isNonEmptyString(group.currentMemberId) ||
    typeof group.inviteEnabled !== "boolean" ||
    !Array.isArray(value.members) ||
    !value.members.every(isMember) ||
    !Array.isArray(value.payments) ||
    !value.payments.every(isPayment) ||
    !Array.isArray(value.transfers) ||
    !value.transfers.every(isTransfer)
  ) {
    return null;
  }

  const memberIds = value.members.map((member) => member.id);
  const memberNames = value.members.map((member) => member.name);
  if (
    value.members.length < 2 ||
    !hasUniqueValues(memberIds) ||
    !hasUniqueValues(memberNames) ||
    !memberIds.includes(group.currentMemberId) ||
    value.payments.some(
      (payment) =>
        !memberIds.includes(payment.payerMemberId) ||
        payment.beneficiaryMemberIds.some((id) => !memberIds.includes(id))
    ) ||
    value.transfers.some(
      (transfer) =>
        !memberIds.includes(transfer.fromMemberId) ||
        !memberIds.includes(transfer.toMemberId)
    )
  ) {
    return null;
  }

  return {
    group: {
      id: group.id,
      name: group.name.trim(),
      revision: group.revision,
      role: group.role,
      currentMemberId: group.currentMemberId,
      inviteEnabled: group.inviteEnabled,
    },
    members: [...value.members].sort((a, b) => a.position - b.position),
    payments: value.payments,
    transfers: value.transfers,
  };
};

export const parseInvitePreview = (value: unknown): InvitePreview | null => {
  if (
    !isObject(value) ||
    !isNonEmptyString(value.groupId) ||
    !isNonEmptyString(value.groupName) ||
    !Array.isArray(value.members) ||
    !value.members.every(
      (member) =>
        isObject(member) &&
        isNonEmptyString(member.id) &&
        isNonEmptyString(member.name)
    ) ||
    value.members.length < 2
  ) {
    return null;
  }

  return {
    groupId: value.groupId,
    groupName: value.groupName.trim(),
    members: value.members.map((member) => ({
      id: member.id,
      name: member.name.trim(),
    })),
  };
};

export const parseCreatedGroup = (
  value: unknown
): { groupId: string; inviteToken: string } | null => {
  const row = Array.isArray(value) ? value[0] : value;
  if (
    !isObject(row) ||
    !isNonEmptyString(row.group_id) ||
    !isNonEmptyString(row.invite_token)
  ) {
    return null;
  }
  return { groupId: row.group_id, inviteToken: row.invite_token };
};
