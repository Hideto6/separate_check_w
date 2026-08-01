import { parseGroupSnapshot } from "@/lib/validation";
import type {
  CachedSnapshotEnvelope,
  GroupSnapshot,
  OfflineAuthProfile,
  PaymentDraft,
  PaymentDraftInput,
  PaymentDraftTarget,
  PaymentInput,
  PendingPayment,
  PendingPaymentStatus,
} from "@/types";

export const OFFLINE_DATABASE_NAME = "waritabi-offline";
export const OFFLINE_DATABASE_VERSION = 1;

export const OFFLINE_STORE_NAMES = {
  profile: "profile",
  snapshots: "snapshots",
  drafts: "payment-drafts",
  pendingPayments: "pending-payments",
} as const;

const LAST_AUTH_PROFILE_KEY = "last-auth-profile";
const CACHED_GROUP_DENIAL_KEY_PREFIX = "cached-group-denial";

export type OfflineStorageErrorCode =
  | "unavailable"
  | "storage_error"
  | "invalid_data"
  | "not_found"
  | "not_editable"
  | "cache_denied";

export type OfflineStorageResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: OfflineStorageErrorCode; message: string };

export interface SavePaymentDraftInput {
  authUserId: string;
  groupId: string;
  target: PaymentDraftTarget;
  input: PaymentDraftInput;
  updatedAt?: string;
}

export interface EnqueuePendingPaymentInput {
  authUserId: string;
  groupId: string;
  operationId: string;
  input: PaymentInput;
  createdAt?: string;
}

export interface PendingPaymentUpdate {
  status?: PendingPaymentStatus;
  input?: PaymentInput;
  attemptCount?: number;
  serverPaymentId?: string | null;
  lastError?: string | null;
  attemptedAt?: string | null;
}

export interface OfflineStore {
  rememberAuthProfile: (
    authUserId: string
  ) => Promise<OfflineStorageResult<OfflineAuthProfile>>;
  readLastAuthProfile: () => Promise<
    OfflineStorageResult<OfflineAuthProfile | null>
  >;
  saveCachedSnapshot: (
    authUserId: string,
    snapshot: GroupSnapshot,
    expectedDenialId?: string
  ) => Promise<OfflineStorageResult<CachedSnapshotEnvelope>>;
  readCachedSnapshot: (
    authUserId: string,
    groupId: string
  ) => Promise<OfflineStorageResult<CachedSnapshotEnvelope | null>>;
  getLatestCachedSnapshotForUser: (
    authUserId: string
  ) => Promise<OfflineStorageResult<CachedSnapshotEnvelope | null>>;
  denyCachedGroup: (
    authUserId: string,
    groupId: string
  ) => Promise<OfflineStorageResult<void>>;
  isCachedGroupDenied: (
    authUserId: string,
    groupId: string
  ) => Promise<OfflineStorageResult<boolean>>;
  readCachedGroupDenial: (
    authUserId: string,
    groupId: string
  ) => Promise<OfflineStorageResult<CachedGroupDenial | null>>;
  deleteCachedSnapshot: (
    authUserId: string,
    groupId: string
  ) => Promise<OfflineStorageResult<void>>;
  savePaymentDraft: (
    draft: SavePaymentDraftInput
  ) => Promise<OfflineStorageResult<PaymentDraft>>;
  readPaymentDraft: (
    authUserId: string,
    groupId: string,
    target: PaymentDraftTarget
  ) => Promise<OfflineStorageResult<PaymentDraft | null>>;
  listPaymentDrafts: (
    authUserId: string,
    groupId: string
  ) => Promise<OfflineStorageResult<PaymentDraft[]>>;
  deletePaymentDraft: (
    authUserId: string,
    groupId: string,
    target: PaymentDraftTarget
  ) => Promise<OfflineStorageResult<void>>;
  enqueuePendingPayment: (
    input: EnqueuePendingPaymentInput
  ) => Promise<OfflineStorageResult<PendingPayment>>;
  listPendingPayments: (
    authUserId: string,
    groupId: string
  ) => Promise<OfflineStorageResult<PendingPayment[]>>;
  listPendingPaymentsForUser: (
    authUserId: string
  ) => Promise<OfflineStorageResult<PendingPayment[]>>;
  updatePendingPayment: (
    authUserId: string,
    groupId: string,
    operationId: string,
    update: PendingPaymentUpdate
  ) => Promise<OfflineStorageResult<PendingPayment>>;
  deletePendingPayment: (
    authUserId: string,
    groupId: string,
    operationId: string
  ) => Promise<OfflineStorageResult<void>>;
  deleteQueuedPendingPayment: (
    authUserId: string,
    groupId: string,
    operationId: string
  ) => Promise<OfflineStorageResult<void>>;
  promoteDraftToPending: (
    target: PaymentDraftTarget,
    pendingPayment: PendingPayment
  ) => Promise<OfflineStorageResult<PendingPayment>>;
  deleteGroupData: (
    authUserId: string,
    groupId: string
  ) => Promise<OfflineStorageResult<void>>;
}

export interface OfflineStoreOptions {
  factory?: IDBFactory | null;
  now?: () => string;
  randomUuid?: () => string;
}

interface ExpectedOwner {
  authUserId: string;
  groupId?: string;
}

export interface CachedGroupDenial {
  version: 1;
  authUserId: string;
  groupId: string;
  denialId: string;
  deniedAt: string;
}

const success = <T>(data: T): OfflineStorageResult<T> => ({ ok: true, data });

const failure = <T>(
  code: OfflineStorageErrorCode,
  message: string
): OfflineStorageResult<T> => ({ ok: false, code, message });

const unavailableFailure = <T>(): OfflineStorageResult<T> =>
  failure(
    "unavailable",
    "このブラウザでは端末保存を利用できません。オンラインでお試しください。"
  );

const storageFailure = <T>(): OfflineStorageResult<T> =>
  failure(
    "storage_error",
    "端末データを保存または読み込みできませんでした。オンライン機能は引き続き利用できます。"
  );

const invalidDataFailure = <T>(message: string): OfflineStorageResult<T> =>
  failure("invalid_data", message);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isUuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );

const isTimestamp = (value: unknown): value is string =>
  isNonEmptyString(value) && Number.isFinite(Date.parse(value));

const isSafeNonNegativeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

const isSafePositiveInteger = (value: unknown): value is number =>
  isSafeNonNegativeInteger(value) && value > 0;

const hasUniqueValues = (values: string[]) =>
  new Set(values).size === values.length;

const hasOwn = (value: object, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key);

const parsePaymentInput = (value: unknown): PaymentInput | null => {
  if (
    !isObject(value) ||
    !isNonEmptyString(value.title) ||
    !isNonEmptyString(value.payerMemberId) ||
    !isSafeNonNegativeInteger(value.amount) ||
    !Array.isArray(value.beneficiaryMemberIds)
  ) {
    return null;
  }

  const beneficiaryMemberIds: string[] = [];
  for (const memberId of value.beneficiaryMemberIds) {
    if (!isNonEmptyString(memberId)) return null;
    beneficiaryMemberIds.push(memberId);
  }
  if (
    beneficiaryMemberIds.length === 0 ||
    !hasUniqueValues(beneficiaryMemberIds)
  ) {
    return null;
  }

  return {
    title: value.title.trim(),
    payerMemberId: value.payerMemberId,
    amount: value.amount,
    beneficiaryMemberIds,
  };
};

const parsePaymentDraftInput = (value: unknown): PaymentDraftInput | null => {
  if (
    !isObject(value) ||
    typeof value.title !== "string" ||
    typeof value.payerMemberId !== "string" ||
    typeof value.amount !== "string" ||
    !Array.isArray(value.beneficiaryMemberIds)
  ) {
    return null;
  }

  const beneficiaryMemberIds: string[] = [];
  for (const memberId of value.beneficiaryMemberIds) {
    if (!isNonEmptyString(memberId)) return null;
    beneficiaryMemberIds.push(memberId);
  }
  if (!hasUniqueValues(beneficiaryMemberIds)) return null;

  return {
    title: value.title,
    payerMemberId: value.payerMemberId,
    amount: value.amount,
    beneficiaryMemberIds,
  };
};

export const parsePaymentDraftTarget = (
  value: unknown
): PaymentDraftTarget | null => {
  if (!isObject(value)) return null;
  if (value.kind === "new") return { kind: "new" };
  if (
    value.kind === "edit" &&
    isNonEmptyString(value.paymentId) &&
    isSafePositiveInteger(value.baseVersion)
  ) {
    return {
      kind: "edit",
      paymentId: value.paymentId,
      baseVersion: value.baseVersion,
    };
  }
  return null;
};

const matchesExpectedOwner = (
  value: { authUserId: string; groupId?: string },
  expected?: ExpectedOwner
) =>
  !expected ||
  (value.authUserId === expected.authUserId &&
    (expected.groupId === undefined || value.groupId === expected.groupId));

export const parseOfflineAuthProfile = (
  value: unknown
): OfflineAuthProfile | null => {
  if (
    !isObject(value) ||
    value.version !== 1 ||
    !isNonEmptyString(value.authUserId) ||
    !isTimestamp(value.rememberedAt)
  ) {
    return null;
  }
  return {
    version: 1,
    authUserId: value.authUserId,
    rememberedAt: value.rememberedAt,
  };
};

export const parseCachedSnapshotEnvelope = (
  value: unknown,
  expected?: ExpectedOwner
): CachedSnapshotEnvelope | null => {
  if (
    !isObject(value) ||
    value.version !== 1 ||
    !isNonEmptyString(value.authUserId) ||
    !isNonEmptyString(value.groupId) ||
    !isTimestamp(value.cachedAt) ||
    !matchesExpectedOwner(
      { authUserId: value.authUserId, groupId: value.groupId },
      expected
    )
  ) {
    return null;
  }

  const snapshot = parseGroupSnapshot(value.snapshot);
  if (!snapshot || snapshot.group.id !== value.groupId) return null;

  return {
    version: 1,
    authUserId: value.authUserId,
    groupId: value.groupId,
    cachedAt: value.cachedAt,
    snapshot,
  };
};

export const parseCachedGroupDenial = (
  value: unknown,
  expected?: ExpectedOwner
): CachedGroupDenial | null => {
  if (
    !isObject(value) ||
    value.version !== 1 ||
    !isNonEmptyString(value.authUserId) ||
    !isNonEmptyString(value.groupId) ||
    !isUuid(value.denialId) ||
    !isTimestamp(value.deniedAt) ||
    !matchesExpectedOwner(
      { authUserId: value.authUserId, groupId: value.groupId },
      expected
    )
  ) {
    return null;
  }
  return {
    version: 1,
    authUserId: value.authUserId,
    groupId: value.groupId,
    denialId: value.denialId,
    deniedAt: value.deniedAt,
  };
};

export const parsePaymentDraft = (
  value: unknown,
  expected?: ExpectedOwner
): PaymentDraft | null => {
  if (
    !isObject(value) ||
    value.version !== 1 ||
    !isNonEmptyString(value.authUserId) ||
    !isNonEmptyString(value.groupId) ||
    !isTimestamp(value.updatedAt) ||
    !matchesExpectedOwner(
      { authUserId: value.authUserId, groupId: value.groupId },
      expected
    )
  ) {
    return null;
  }

  const target = parsePaymentDraftTarget(value.target);
  const input = parsePaymentDraftInput(value.input);
  if (!target || !input) return null;

  return {
    version: 1,
    authUserId: value.authUserId,
    groupId: value.groupId,
    target,
    input,
    updatedAt: value.updatedAt,
  };
};

const pendingPaymentStatuses: PendingPaymentStatus[] = [
  "queued",
  "sending",
  "retry",
  "committed",
  "blocked",
];

const isPendingPaymentStatus = (
  value: unknown
): value is PendingPaymentStatus =>
  typeof value === "string" &&
  pendingPaymentStatuses.some((status) => status === value);

export const parsePendingPayment = (
  value: unknown,
  expected?: ExpectedOwner
): PendingPayment | null => {
  if (
    !isObject(value) ||
    value.version !== 1 ||
    !isNonEmptyString(value.authUserId) ||
    !isNonEmptyString(value.groupId) ||
    !isUuid(value.operationId) ||
    !isPendingPaymentStatus(value.status) ||
    !isSafeNonNegativeInteger(value.attemptCount) ||
    !isTimestamp(value.createdAt) ||
    !isTimestamp(value.updatedAt) ||
    (value.serverPaymentId !== undefined &&
      !isNonEmptyString(value.serverPaymentId)) ||
    (value.lastError !== undefined && !isNonEmptyString(value.lastError)) ||
    (value.attemptedAt !== undefined && !isTimestamp(value.attemptedAt)) ||
    !matchesExpectedOwner(
      { authUserId: value.authUserId, groupId: value.groupId },
      expected
    )
  ) {
    return null;
  }

  const input = parsePaymentInput(value.input);
  if (!input) return null;

  const pendingPayment: PendingPayment = {
    version: 1,
    authUserId: value.authUserId,
    groupId: value.groupId,
    operationId: value.operationId,
    input,
    status: value.status,
    attemptCount: value.attemptCount,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
  if (isNonEmptyString(value.serverPaymentId)) {
    pendingPayment.serverPaymentId = value.serverPaymentId;
  }
  if (isNonEmptyString(value.lastError)) {
    pendingPayment.lastError = value.lastError;
  }
  if (isTimestamp(value.attemptedAt)) {
    pendingPayment.attemptedAt = value.attemptedAt;
  }
  return pendingPayment;
};

export const createQueuedPendingPayment = (
  input: EnqueuePendingPaymentInput,
  timestamp: string
): PendingPayment | null =>
  parsePendingPayment({
    version: 1,
    authUserId: input.authUserId,
    groupId: input.groupId,
    operationId: input.operationId,
    input: input.input,
    status: "queued",
    attemptCount: 0,
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.createdAt ?? timestamp,
  });

export const sortCachedSnapshotsByRecency = (
  snapshots: CachedSnapshotEnvelope[]
) =>
  [...snapshots].sort(
    (left, right) =>
      Date.parse(right.cachedAt) - Date.parse(left.cachedAt) ||
      left.groupId.localeCompare(right.groupId)
  );

export const sortPendingPayments = (payments: PendingPayment[]) =>
  [...payments].sort(
    (left, right) =>
      Date.parse(left.createdAt) - Date.parse(right.createdAt) ||
      left.operationId.localeCompare(right.operationId)
  );

export const selectCachedSnapshotForStorage = (
  existing: CachedSnapshotEnvelope | null,
  incoming: CachedSnapshotEnvelope,
  replaceDeniedCache = false
) =>
  !replaceDeniedCache &&
  existing &&
  existing.snapshot.group.revision > incoming.snapshot.group.revision
    ? existing
    : incoming;

export const canReplaceDeniedCachedSnapshot = (
  denial: CachedGroupDenial | null,
  expectedDenialId?: string
) => denial === null || denial.denialId === expectedDenialId;

export const isPendingPaymentEditable = (payment: PendingPayment) =>
  payment.status === "queued";

const samePaymentInput = (left: PaymentInput, right: PaymentInput) =>
  left.title === right.title &&
  left.payerMemberId === right.payerMemberId &&
  left.amount === right.amount &&
  left.beneficiaryMemberIds.length === right.beneficiaryMemberIds.length &&
  left.beneficiaryMemberIds.every(
    (memberId, index) => memberId === right.beneficiaryMemberIds[index]
  );

const samePendingOperation = (left: PendingPayment, right: PendingPayment) =>
  left.authUserId === right.authUserId &&
  left.groupId === right.groupId &&
  left.operationId === right.operationId &&
  samePaymentInput(left.input, right.input);

const draftTargetKey = (target: PaymentDraftTarget) =>
  target.kind === "new"
    ? "new"
    : `edit:${target.paymentId}:${target.baseVersion}`;

const snapshotKey = (authUserId: string, groupId: string): IDBValidKey => [
  authUserId,
  groupId,
];

const cachedGroupDenialKey = (
  authUserId: string,
  groupId: string
): IDBValidKey => [CACHED_GROUP_DENIAL_KEY_PREFIX, authUserId, groupId];

const paymentDraftKey = (
  authUserId: string,
  groupId: string,
  target: PaymentDraftTarget
): IDBValidKey => [authUserId, groupId, draftTargetKey(target)];

const pendingPaymentKey = (
  authUserId: string,
  groupId: string,
  operationId: string
): IDBValidKey => [authUserId, groupId, operationId];

const stringKeyParts = (
  key: IDBValidKey,
  expectedLength: number
): string[] | null => {
  if (!Array.isArray(key) || key.length !== expectedLength) return null;
  const parts: string[] = [];
  for (const part of key) {
    if (typeof part !== "string") return null;
    parts.push(part);
  }
  return parts;
};

const requestAsPromise = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB request failed"));
  });

const waitForTransaction = (transaction: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
    transaction.onerror = () => {
      // abortイベントで同じtransactionの失敗を一度だけ処理する。
    };
  });

const openDatabase = (factory: IDBFactory): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = factory.open(OFFLINE_DATABASE_NAME, OFFLINE_DATABASE_VERSION);
    } catch (error) {
      reject(error);
      return;
    }

    let settled = false;
    const rejectOnce = (error: unknown) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    request.onupgradeneeded = () => {
      try {
        const database = request.result;
        if (!database.objectStoreNames.contains(OFFLINE_STORE_NAMES.profile)) {
          database.createObjectStore(OFFLINE_STORE_NAMES.profile);
        }
        if (
          !database.objectStoreNames.contains(OFFLINE_STORE_NAMES.snapshots)
        ) {
          database.createObjectStore(OFFLINE_STORE_NAMES.snapshots);
        }
        if (!database.objectStoreNames.contains(OFFLINE_STORE_NAMES.drafts)) {
          database.createObjectStore(OFFLINE_STORE_NAMES.drafts);
        }
        if (
          !database.objectStoreNames.contains(
            OFFLINE_STORE_NAMES.pendingPayments
          )
        ) {
          database.createObjectStore(OFFLINE_STORE_NAMES.pendingPayments);
        }
      } catch (error) {
        request.transaction?.abort();
        rejectOnce(error);
      }
    };
    request.onsuccess = () => {
      if (settled) {
        request.result.close();
        return;
      }
      settled = true;
      resolve(request.result);
    };
    request.onerror = () =>
      rejectOnce(request.error ?? new Error("IndexedDB open failed"));
    request.onblocked = () =>
      rejectOnce(new Error("IndexedDB upgrade was blocked"));
  });

const collectValidEntries = <T>(
  store: IDBObjectStore,
  parse: (value: unknown, key: IDBValidKey) => T | null
): Promise<T[]> =>
  new Promise((resolve, reject) => {
    const entries: T[] = [];
    const request = store.openCursor();
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB cursor failed"));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve(entries);
        return;
      }
      const value: unknown = cursor.value;
      const parsed = parse(value, cursor.primaryKey);
      if (parsed) entries.push(parsed);
      else cursor.delete();
      cursor.continue();
    };
  });

const collectCachedGroupDenials = (
  store: IDBObjectStore
): Promise<CachedGroupDenial[]> =>
  new Promise((resolve, reject) => {
    const denials: CachedGroupDenial[] = [];
    const request = store.openCursor();
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB cursor failed"));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve(denials);
        return;
      }

      const parts = stringKeyParts(cursor.primaryKey, 3);
      if (parts?.[0] === CACHED_GROUP_DENIAL_KEY_PREFIX) {
        const denial = parseCachedGroupDenial(cursor.value, {
          authUserId: parts[1],
          groupId: parts[2],
        });
        if (denial) {
          denials.push(denial);
        } else {
          // このキーに値が存在する限り安全側で利用禁止として扱う。
          denials.push({
            version: 1,
            authUserId: parts[1],
            groupId: parts[2],
            denialId: "00000000-0000-4000-8000-000000000000",
            deniedAt: new Date(0).toISOString(),
          });
        }
      }
      cursor.continue();
    };
  });

const deleteMatchingKeys = (
  store: IDBObjectStore,
  matches: (key: IDBValidKey) => boolean
): Promise<void> =>
  new Promise((resolve, reject) => {
    const request = store.openKeyCursor();
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB cursor failed"));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve();
        return;
      }
      if (matches(cursor.primaryKey)) cursor.delete();
      cursor.continue();
    };
  });

const isValidOwner = (authUserId: string, groupId?: string) =>
  isNonEmptyString(authUserId) &&
  (groupId === undefined || isNonEmptyString(groupId));

export const createOfflineStore = (
  options: OfflineStoreOptions = {}
): OfflineStore => {
  const resolveFactory = () => {
    if (options.factory === null) return null;
    if (options.factory) return options.factory;
    return typeof globalThis.indexedDB === "undefined"
      ? null
      : globalThis.indexedDB;
  };
  const now = options.now ?? (() => new Date().toISOString());
  const randomUuid =
    options.randomUuid ??
    (() =>
      typeof globalThis.crypto?.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : "");

  const execute = async <T>(
    storeNames: string | string[],
    mode: IDBTransactionMode,
    operation: (transaction: IDBTransaction) => Promise<T>
  ): Promise<OfflineStorageResult<T>> => {
    const factory = resolveFactory();
    if (!factory) return unavailableFailure();

    let database: IDBDatabase | null = null;
    try {
      database = await openDatabase(factory);
      const transaction = database.transaction(storeNames, mode);
      const completion = waitForTransaction(transaction);
      try {
        const data = await operation(transaction);
        await completion;
        return success(data);
      } catch {
        try {
          transaction.abort();
        } catch {
          // 完了済みtransactionはabortできない。
        }
        try {
          await completion;
        } catch {
          // 元の失敗をstorage_errorとして返す。
        }
        return storageFailure();
      }
    } catch {
      return storageFailure();
    } finally {
      database?.close();
    }
  };

  const executeResult = async <T>(
    storeNames: string | string[],
    mode: IDBTransactionMode,
    operation: (
      transaction: IDBTransaction
    ) => Promise<OfflineStorageResult<T>>
  ): Promise<OfflineStorageResult<T>> => {
    const result = await execute(storeNames, mode, operation);
    return result.ok ? result.data : result;
  };

  const currentTimestamp = () => {
    try {
      const value = now();
      return isTimestamp(value) ? value : null;
    } catch {
      return null;
    }
  };

  const createPendingPayment = (
    input: EnqueuePendingPaymentInput
  ): PendingPayment | null => {
    const timestamp = input.createdAt ?? currentTimestamp();
    if (!timestamp) return null;
    return createQueuedPendingPayment(input, timestamp);
  };

  const storePendingPayment = async (
    store: IDBObjectStore,
    pendingPayment: PendingPayment
  ): Promise<OfflineStorageResult<PendingPayment>> => {
    const key = pendingPaymentKey(
      pendingPayment.authUserId,
      pendingPayment.groupId,
      pendingPayment.operationId
    );
    const existingValue: unknown = await requestAsPromise(store.get(key));
    if (existingValue !== undefined) {
      const existing = parsePendingPayment(existingValue, {
        authUserId: pendingPayment.authUserId,
        groupId: pendingPayment.groupId,
      });
      if (existing) {
        return samePendingOperation(existing, pendingPayment)
          ? success(existing)
          : invalidDataFailure(
              "同じ操作IDに異なる支払い内容を保存することはできません。"
            );
      }
      await requestAsPromise(store.delete(key));
    }
    await requestAsPromise(store.put(pendingPayment, key));
    return success(pendingPayment);
  };

  return {
    rememberAuthProfile: async (authUserId) => {
      const rememberedAt = currentTimestamp();
      const profile = parseOfflineAuthProfile({
        version: 1,
        authUserId,
        rememberedAt,
      });
      if (!profile) {
        return invalidDataFailure("認証プロフィールを端末へ保存できません。")
      }
      return execute(OFFLINE_STORE_NAMES.profile, "readwrite", async (tx) => {
        await requestAsPromise(
          tx
            .objectStore(OFFLINE_STORE_NAMES.profile)
            .put(profile, LAST_AUTH_PROFILE_KEY)
        );
        return profile;
      });
    },

    readLastAuthProfile: () =>
      execute(OFFLINE_STORE_NAMES.profile, "readwrite", async (tx) => {
        const store = tx.objectStore(OFFLINE_STORE_NAMES.profile);
        const value: unknown = await requestAsPromise(
          store.get(LAST_AUTH_PROFILE_KEY)
        );
        if (value === undefined) return null;
        const profile = parseOfflineAuthProfile(value);
        if (profile) return profile;
        await requestAsPromise(store.delete(LAST_AUTH_PROFILE_KEY));
        return null;
      }),

    saveCachedSnapshot: async (
      authUserId,
      snapshot,
      expectedDenialId
    ) => {
      if (expectedDenialId !== undefined && !isUuid(expectedDenialId)) {
        return invalidDataFailure(
          "端末キャッシュの利用再開条件を確認できません。"
        );
      }
      const cachedAt = currentTimestamp();
      const envelope = parseCachedSnapshotEnvelope({
        version: 1,
        authUserId,
        groupId: snapshot.group.id,
        cachedAt,
        snapshot,
      });
      if (!envelope) {
        return invalidDataFailure(
          "検証できないグループデータは端末へ保存できません。"
        );
      }
      return executeResult(
        [OFFLINE_STORE_NAMES.snapshots, OFFLINE_STORE_NAMES.profile],
        "readwrite",
        async (tx) => {
          const store = tx.objectStore(OFFLINE_STORE_NAMES.snapshots);
          const profileStore = tx.objectStore(OFFLINE_STORE_NAMES.profile);
          const key = snapshotKey(authUserId, envelope.groupId);
          const denialKey = cachedGroupDenialKey(authUserId, envelope.groupId);
          const denialValue: unknown = await requestAsPromise(
            profileStore.get(denialKey)
          );
          const denial = parseCachedGroupDenial(denialValue, {
            authUserId,
            groupId: envelope.groupId,
          });
          if (
            denialValue !== undefined &&
            (!denial ||
              !canReplaceDeniedCachedSnapshot(denial, expectedDenialId))
          ) {
            return failure(
              "cache_denied",
              "権限状態が変わったため、この取得結果は端末キャッシュへ保存しませんでした。"
            );
          }
          const existingValue: unknown = await requestAsPromise(store.get(key));
          const existing = parseCachedSnapshotEnvelope(existingValue, {
            authUserId,
            groupId: envelope.groupId,
          });
          const selected = selectCachedSnapshotForStorage(
            existing,
            envelope,
            denial !== null
          );
          if (selected !== existing) {
            await requestAsPromise(store.put(selected, key));
          }
          if (denial) {
            await requestAsPromise(profileStore.delete(denialKey));
          }
          return success(selected);
        }
      );
    },

    readCachedSnapshot: async (authUserId, groupId) => {
      if (!isValidOwner(authUserId, groupId)) {
        return invalidDataFailure("グループの端末データを特定できません。")
      }
      return execute(
        [OFFLINE_STORE_NAMES.profile, OFFLINE_STORE_NAMES.snapshots],
        "readwrite",
        async (tx) => {
          const denialValue: unknown = await requestAsPromise(
            tx
              .objectStore(OFFLINE_STORE_NAMES.profile)
              .get(cachedGroupDenialKey(authUserId, groupId))
          );
          if (denialValue !== undefined) return null;

          const store = tx.objectStore(OFFLINE_STORE_NAMES.snapshots);
          const key = snapshotKey(authUserId, groupId);
          const value: unknown = await requestAsPromise(store.get(key));
          if (value === undefined) return null;
          const envelope = parseCachedSnapshotEnvelope(value, {
            authUserId,
            groupId,
          });
          if (envelope) return envelope;
          await requestAsPromise(store.delete(key));
          return null;
        }
      );
    },

    getLatestCachedSnapshotForUser: async (authUserId) => {
      if (!isValidOwner(authUserId)) {
        return invalidDataFailure("認証ユーザーを特定できません。")
      }
      return execute(
        [OFFLINE_STORE_NAMES.snapshots, OFFLINE_STORE_NAMES.profile],
        "readwrite",
        async (tx) => {
          const [snapshots, denials] = await Promise.all([
            collectValidEntries(
              tx.objectStore(OFFLINE_STORE_NAMES.snapshots),
              (value, key) => {
                const parts = stringKeyParts(key, 2);
                return parts
                  ? parseCachedSnapshotEnvelope(value, {
                      authUserId: parts[0],
                      groupId: parts[1],
                    })
                  : null;
              }
            ),
            collectCachedGroupDenials(
              tx.objectStore(OFFLINE_STORE_NAMES.profile)
            ),
          ]);
          const deniedGroupIds = new Set(
            denials
              .filter((denial) => denial.authUserId === authUserId)
              .map((denial) => denial.groupId)
          );
          return (
            sortCachedSnapshotsByRecency(
              snapshots.filter(
                (snapshot) =>
                  snapshot.authUserId === authUserId &&
                  !deniedGroupIds.has(snapshot.groupId)
              )
            )[0] ?? null
          );
        }
      );
    },

    denyCachedGroup: async (authUserId, groupId) => {
      const deniedAt = currentTimestamp();
      let denialId: string;
      try {
        denialId = randomUuid();
      } catch {
        denialId = "";
      }
      const denial = parseCachedGroupDenial({
        version: 1,
        authUserId,
        groupId,
        denialId,
        deniedAt,
      });
      if (!denial) {
        return invalidDataFailure(
          "利用を停止するグループの端末データを特定できません。"
        );
      }
      return execute(OFFLINE_STORE_NAMES.profile, "readwrite", async (tx) => {
        await requestAsPromise(
          tx
            .objectStore(OFFLINE_STORE_NAMES.profile)
            .put(denial, cachedGroupDenialKey(authUserId, groupId))
        );
      });
    },

    isCachedGroupDenied: async (authUserId, groupId) => {
      if (!isValidOwner(authUserId, groupId)) {
        return invalidDataFailure(
          "利用可否を確認するグループの端末データを特定できません。"
        );
      }
      return execute(OFFLINE_STORE_NAMES.profile, "readonly", async (tx) => {
        const value: unknown = await requestAsPromise(
          tx
            .objectStore(OFFLINE_STORE_NAMES.profile)
            .get(cachedGroupDenialKey(authUserId, groupId))
        );
        if (value === undefined) return false;
        // 破損した禁止情報も、そのキーに存在する限り安全側で拒否する。
        return true;
      });
    },

    readCachedGroupDenial: async (authUserId, groupId) => {
      if (!isValidOwner(authUserId, groupId)) {
        return invalidDataFailure(
          "利用可否を確認するグループの端末データを特定できません。"
        );
      }
      return execute(OFFLINE_STORE_NAMES.profile, "readonly", async (tx) => {
        const value: unknown = await requestAsPromise(
          tx
            .objectStore(OFFLINE_STORE_NAMES.profile)
            .get(cachedGroupDenialKey(authUserId, groupId))
        );
        if (value === undefined) return null;
        const denial = parseCachedGroupDenial(value, {
          authUserId,
          groupId,
        });
        if (!denial) {
          throw new Error("Invalid cached group denial");
        }
        return denial;
      });
    },

    deleteCachedSnapshot: async (authUserId, groupId) => {
      if (!isValidOwner(authUserId, groupId)) {
        return invalidDataFailure("グループの端末データを特定できません。")
      }
      return execute(
        OFFLINE_STORE_NAMES.snapshots,
        "readwrite",
        async (tx) => {
          await requestAsPromise(
            tx
              .objectStore(OFFLINE_STORE_NAMES.snapshots)
              .delete(snapshotKey(authUserId, groupId))
          );
        }
      );
    },

    savePaymentDraft: async (draftInput) => {
      const updatedAt = draftInput.updatedAt ?? currentTimestamp();
      const draft = parsePaymentDraft({
        version: 1,
        authUserId: draftInput.authUserId,
        groupId: draftInput.groupId,
        target: draftInput.target,
        input: draftInput.input,
        updatedAt,
      });
      if (!draft) {
        return invalidDataFailure("入力途中の支払いを端末へ保存できません。")
      }
      return execute(OFFLINE_STORE_NAMES.drafts, "readwrite", async (tx) => {
        await requestAsPromise(
          tx
            .objectStore(OFFLINE_STORE_NAMES.drafts)
            .put(
              draft,
              paymentDraftKey(
                draft.authUserId,
                draft.groupId,
                draft.target
              )
            )
        );
        return draft;
      });
    },

    readPaymentDraft: async (authUserId, groupId, target) => {
      const parsedTarget = parsePaymentDraftTarget(target);
      if (!isValidOwner(authUserId, groupId) || !parsedTarget) {
        return invalidDataFailure("入力途中の支払いを特定できません。")
      }
      return execute(OFFLINE_STORE_NAMES.drafts, "readwrite", async (tx) => {
        const store = tx.objectStore(OFFLINE_STORE_NAMES.drafts);
        const key = paymentDraftKey(authUserId, groupId, parsedTarget);
        const value: unknown = await requestAsPromise(store.get(key));
        if (value === undefined) return null;
        const draft = parsePaymentDraft(value, { authUserId, groupId });
        if (
          draft &&
          draftTargetKey(draft.target) === draftTargetKey(parsedTarget)
        ) {
          return draft;
        }
        await requestAsPromise(store.delete(key));
        return null;
      });
    },

    listPaymentDrafts: async (authUserId, groupId) => {
      if (!isValidOwner(authUserId, groupId)) {
        return invalidDataFailure("入力途中の支払いを特定できません。")
      }
      return execute(OFFLINE_STORE_NAMES.drafts, "readwrite", async (tx) => {
        const drafts = await collectValidEntries(
          tx.objectStore(OFFLINE_STORE_NAMES.drafts),
          (value, key) => {
            const parts = stringKeyParts(key, 3);
            const parsed = parts
              ? parsePaymentDraft(value, {
                  authUserId: parts[0],
                  groupId: parts[1],
                })
              : null;
            return parsed && draftTargetKey(parsed.target) === parts?.[2]
              ? parsed
              : null;
          }
        );
        return drafts
          .filter(
            (draft) =>
              draft.authUserId === authUserId && draft.groupId === groupId
          )
          .sort(
            (left, right) =>
              Date.parse(right.updatedAt) - Date.parse(left.updatedAt) ||
              draftTargetKey(left.target).localeCompare(
                draftTargetKey(right.target)
              )
          );
      });
    },

    deletePaymentDraft: async (authUserId, groupId, target) => {
      const parsedTarget = parsePaymentDraftTarget(target);
      if (!isValidOwner(authUserId, groupId) || !parsedTarget) {
        return invalidDataFailure("入力途中の支払いを特定できません。")
      }
      return execute(OFFLINE_STORE_NAMES.drafts, "readwrite", async (tx) => {
        await requestAsPromise(
          tx
            .objectStore(OFFLINE_STORE_NAMES.drafts)
            .delete(paymentDraftKey(authUserId, groupId, parsedTarget))
        );
      });
    },

    enqueuePendingPayment: async (input) => {
      const pendingPayment = createPendingPayment(input);
      if (!pendingPayment) {
        return invalidDataFailure("未同期の支払い内容を保存できません。")
      }
      return executeResult(
        OFFLINE_STORE_NAMES.pendingPayments,
        "readwrite",
        (tx) =>
          storePendingPayment(
            tx.objectStore(OFFLINE_STORE_NAMES.pendingPayments),
            pendingPayment
          )
      );
    },

    listPendingPayments: async (authUserId, groupId) => {
      if (!isValidOwner(authUserId, groupId)) {
        return invalidDataFailure("未同期の支払いを特定できません。")
      }
      return execute(
        OFFLINE_STORE_NAMES.pendingPayments,
        "readwrite",
        async (tx) => {
          const pendingPayments = await collectValidEntries(
            tx.objectStore(OFFLINE_STORE_NAMES.pendingPayments),
            (value, key) => {
              const parts = stringKeyParts(key, 3);
              const payment = parts
                ? parsePendingPayment(value, {
                    authUserId: parts[0],
                    groupId: parts[1],
                  })
                : null;
              return payment && payment.operationId === parts?.[2]
                ? payment
                : null;
            }
          );
          return sortPendingPayments(
            pendingPayments.filter(
              (payment) =>
                payment.authUserId === authUserId &&
                payment.groupId === groupId
            )
          );
        }
      );
    },

    listPendingPaymentsForUser: async (authUserId) => {
      if (!isValidOwner(authUserId)) {
        return invalidDataFailure("認証ユーザーの未同期支払いを特定できません。");
      }
      return execute(
        OFFLINE_STORE_NAMES.pendingPayments,
        "readwrite",
        async (tx) => {
          const pendingPayments = await collectValidEntries(
            tx.objectStore(OFFLINE_STORE_NAMES.pendingPayments),
            (value, key) => {
              const parts = stringKeyParts(key, 3);
              const payment = parts
                ? parsePendingPayment(value, {
                    authUserId: parts[0],
                    groupId: parts[1],
                  })
                : null;
              return payment && payment.operationId === parts?.[2]
                ? payment
                : null;
            }
          );
          return sortPendingPayments(
            pendingPayments.filter(
              (payment) => payment.authUserId === authUserId
            )
          );
        }
      );
    },

    updatePendingPayment: async (
      authUserId,
      groupId,
      operationId,
      update
    ) => {
      if (
        !isValidOwner(authUserId, groupId) ||
        !isNonEmptyString(operationId)
      ) {
        return invalidDataFailure("未同期の支払いを特定できません。")
      }
      if (
        (update.status !== undefined &&
          !isPendingPaymentStatus(update.status)) ||
        (update.attemptCount !== undefined &&
          !isSafeNonNegativeInteger(update.attemptCount)) ||
        (update.serverPaymentId !== undefined &&
          update.serverPaymentId !== null &&
          !isNonEmptyString(update.serverPaymentId)) ||
        (update.lastError !== undefined &&
          update.lastError !== null &&
          !isNonEmptyString(update.lastError)) ||
        (update.attemptedAt !== undefined &&
          update.attemptedAt !== null &&
          !isTimestamp(update.attemptedAt))
      ) {
        return invalidDataFailure("未同期の支払い状態が正しくありません。")
      }
      return executeResult(
        OFFLINE_STORE_NAMES.pendingPayments,
        "readwrite",
        async (tx) => {
          const store = tx.objectStore(OFFLINE_STORE_NAMES.pendingPayments);
          const key = pendingPaymentKey(authUserId, groupId, operationId);
          const value: unknown = await requestAsPromise(store.get(key));
          if (value === undefined) {
            return failure(
              "not_found",
              "更新する未同期の支払いが見つかりません。"
            );
          }
          const current = parsePendingPayment(value, {
            authUserId,
            groupId,
          });
          if (!current || current.operationId !== operationId) {
            await requestAsPromise(store.delete(key));
            return failure(
              "not_found",
              "更新する未同期の支払いが見つかりません。"
            );
          }
          if (update.input && !isPendingPaymentEditable(current)) {
            return failure(
              "not_editable",
              "送信を開始した支払い内容は変更できません。"
            );
          }
          if (current.status !== "queued" && update.status === "queued") {
            return failure(
              "not_editable",
              "送信を開始した支払いを未送信状態には戻せません。"
            );
          }

          const updatedAt = currentTimestamp();
          if (!updatedAt) return storageFailure();
          const next: PendingPayment = {
            ...current,
            input: update.input ?? current.input,
            status: update.status ?? current.status,
            attemptCount: update.attemptCount ?? current.attemptCount,
            updatedAt,
          };
          if (
            hasOwn(update, "serverPaymentId") &&
            (update.serverPaymentId === null ||
              update.serverPaymentId === undefined)
          ) {
            delete next.serverPaymentId;
          } else if (isNonEmptyString(update.serverPaymentId)) {
            next.serverPaymentId = update.serverPaymentId;
          }
          if (
            hasOwn(update, "lastError") &&
            (update.lastError === null || update.lastError === undefined)
          ) {
            delete next.lastError;
          } else if (isNonEmptyString(update.lastError)) {
            next.lastError = update.lastError;
          }
          if (
            hasOwn(update, "attemptedAt") &&
            (update.attemptedAt === null || update.attemptedAt === undefined)
          ) {
            delete next.attemptedAt;
          } else if (isTimestamp(update.attemptedAt)) {
            next.attemptedAt = update.attemptedAt;
          }

          const parsed = parsePendingPayment(next, { authUserId, groupId });
          if (!parsed) {
            return invalidDataFailure(
              "更新後の未同期支払いデータが正しくありません。"
            );
          }
          await requestAsPromise(store.put(parsed, key));
          return success(parsed);
        }
      );
    },

    deletePendingPayment: async (authUserId, groupId, operationId) => {
      if (
        !isValidOwner(authUserId, groupId) ||
        !isNonEmptyString(operationId)
      ) {
        return invalidDataFailure("未同期の支払いを特定できません。")
      }
      return execute(
        OFFLINE_STORE_NAMES.pendingPayments,
        "readwrite",
        async (tx) => {
          await requestAsPromise(
            tx
              .objectStore(OFFLINE_STORE_NAMES.pendingPayments)
              .delete(pendingPaymentKey(authUserId, groupId, operationId))
          );
        }
      );
    },

    deleteQueuedPendingPayment: async (
      authUserId,
      groupId,
      operationId
    ) => {
      if (
        !isValidOwner(authUserId, groupId) ||
        !isNonEmptyString(operationId)
      ) {
        return invalidDataFailure("未同期の支払いを特定できません。")
      }
      return executeResult(
        OFFLINE_STORE_NAMES.pendingPayments,
        "readwrite",
        async (tx) => {
          const store = tx.objectStore(OFFLINE_STORE_NAMES.pendingPayments);
          const key = pendingPaymentKey(authUserId, groupId, operationId);
          const value: unknown = await requestAsPromise(store.get(key));
          const current = parsePendingPayment(value, {
            authUserId,
            groupId,
          });
          if (!current || current.operationId !== operationId) {
            if (value !== undefined) await requestAsPromise(store.delete(key));
            return success(undefined);
          }
          if (current.status !== "queued") {
            return failure(
              "not_editable",
              "送信を開始した支払いは破棄できません。"
            );
          }
          await requestAsPromise(store.delete(key));
          return success(undefined);
        }
      );
    },

    promoteDraftToPending: async (target, pendingPaymentValue) => {
      const parsedTarget = parsePaymentDraftTarget(target);
      const pendingPayment = parsePendingPayment(pendingPaymentValue);
      if (
        !parsedTarget ||
        parsedTarget.kind !== "new" ||
        !pendingPayment ||
        pendingPayment.status !== "queued"
      ) {
        return invalidDataFailure(
          "入力途中の支払いを未同期キューへ移動できません。"
        );
      }
      return executeResult(
        [OFFLINE_STORE_NAMES.drafts, OFFLINE_STORE_NAMES.pendingPayments],
        "readwrite",
        async (tx) => {
          const pendingResult = await storePendingPayment(
            tx.objectStore(OFFLINE_STORE_NAMES.pendingPayments),
            pendingPayment
          );
          if (!pendingResult.ok) return pendingResult;
          await requestAsPromise(
            tx
              .objectStore(OFFLINE_STORE_NAMES.drafts)
              .delete(
                paymentDraftKey(
                  pendingPayment.authUserId,
                  pendingPayment.groupId,
                  parsedTarget
                )
              )
          );
          return pendingResult;
        }
      );
    },

    deleteGroupData: async (authUserId, groupId) => {
      if (!isValidOwner(authUserId, groupId)) {
        return invalidDataFailure("削除する端末データを特定できません。")
      }
      return execute(
        [
          OFFLINE_STORE_NAMES.snapshots,
          OFFLINE_STORE_NAMES.drafts,
          OFFLINE_STORE_NAMES.pendingPayments,
        ],
        "readwrite",
        async (tx) => {
          await requestAsPromise(
            tx
              .objectStore(OFFLINE_STORE_NAMES.snapshots)
              .delete(snapshotKey(authUserId, groupId))
          );
          const matchesGroup = (key: IDBValidKey) => {
            const parts = stringKeyParts(key, 3);
            return parts?.[0] === authUserId && parts[1] === groupId;
          };
          await deleteMatchingKeys(
            tx.objectStore(OFFLINE_STORE_NAMES.drafts),
            matchesGroup
          );
          await deleteMatchingKeys(
            tx.objectStore(OFFLINE_STORE_NAMES.pendingPayments),
            matchesGroup
          );
        }
      );
    },
  };
};

export const offlineStore = createOfflineStore();
