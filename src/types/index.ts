export type GroupRole = "owner" | "editor";

export interface Group {
  id: string;
  name: string;
  revision: number;
  role: GroupRole;
  currentMemberId: string;
  inviteEnabled: boolean;
}

export interface Member {
  id: string;
  name: string;
  position: number;
}

export interface PaymentInput {
  title: string;
  payerMemberId: string;
  amount: number;
  beneficiaryMemberIds: string[];
}

export type SnapshotSource = "remote" | "cache";

export type RemoteStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "slow"
  | "reconnecting"
  | "offline"
  | "error";

export interface OfflineAuthProfile {
  version: 1;
  authUserId: string;
  rememberedAt: string;
}

export interface CachedSnapshotEnvelope {
  version: 1;
  authUserId: string;
  groupId: string;
  cachedAt: string;
  snapshot: GroupSnapshot;
}

export interface PaymentDraftInput {
  title: string;
  payerMemberId: string;
  amount: string;
  beneficiaryMemberIds: string[];
}

export type PaymentDraftTarget =
  | { kind: "new" }
  | { kind: "edit"; paymentId: string; baseVersion: number };

export interface PaymentDraft {
  version: 1;
  authUserId: string;
  groupId: string;
  target: PaymentDraftTarget;
  input: PaymentDraftInput;
  updatedAt: string;
}

export type PendingPaymentStatus =
  | "queued"
  | "sending"
  | "retry"
  | "committed"
  | "blocked";

export interface PendingPayment {
  version: 1;
  authUserId: string;
  groupId: string;
  operationId: string;
  input: PaymentInput;
  status: PendingPaymentStatus;
  attemptCount: number;
  createdAt: string;
  updatedAt: string;
  serverPaymentId?: string;
  lastError?: string;
  attemptedAt?: string;
}

export interface OfflinePendingRecovery {
  authUserId: string;
  pendingPayments: PendingPayment[];
}

export interface PaymentSaveResult {
  status: "synced" | "queued";
  operationId: string;
}

export interface OfflineGroupDataSummary {
  cachedSnapshotCount: 0 | 1;
  draftCount: number;
  pendingCount: number;
}

export interface PaymentRecord extends PaymentInput {
  id: string;
  version: number;
  createdByMemberId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SettlementTransfer {
  id: string;
  fromMemberId: string;
  toMemberId: string;
  amount: number;
  version: number;
  createdByMemberId: string | null;
  createdAt: string;
}

export interface Settlement {
  fromMemberId: string;
  toMemberId: string;
  amount: number;
}

export interface GroupSnapshot {
  group: Group;
  members: Member[];
  payments: PaymentRecord[];
  transfers: SettlementTransfer[];
}

export interface InviteMember {
  id: string;
  name: string;
}

export interface InvitePreview {
  groupId: string;
  groupName: string;
  members: InviteMember[];
}

export interface RecentGroupSummary {
  groupId: string;
  groupName: string;
}

export type MutationErrorCode =
  | "validation"
  | "forbidden"
  | "conflict"
  | "offline"
  | "unavailable"
  | "unknown";

export type MutationResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; code: MutationErrorCode; message: string };

export type AuthStatus =
  | "checking"
  | "needs_captcha"
  | "signing_in"
  | "ready"
  | "misconfigured"
  | "error";

export type GroupLoadStatus = "idle" | "loading" | "ready" | "error";
export type SyncStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "offline"
  | "unavailable";

export interface GroupContextType {
  authStatus: AuthStatus;
  authError: string | null;
  authUserId: string | null;
  offlineDataUserId: string | null;
  authRecoveryRequired: boolean;
  offlineMode: boolean;
  hasOfflineCache: boolean;
  offlinePendingRecovery: OfflinePendingRecovery | null;
  offlineFallbackAvailable: boolean;
  groupStatus: GroupLoadStatus;
  syncStatus: SyncStatus;
  remoteStatus: RemoteStatus;
  snapshotSource: SnapshotSource | null;
  snapshot: GroupSnapshot | null;
  cachedAt: string | null;
  cacheFallbackAvailable: boolean;
  pendingPayments: PendingPayment[];
  lastError: string | null;
  groupErrorCode: MutationErrorCode | null;
  authenticate: (captchaToken: string) => Promise<MutationResult>;
  continueOffline: () => void;
  loadGroup: (groupId: string) => Promise<MutationResult<GroupSnapshot>>;
  loadCachedGroup: (
    groupId: string
  ) => Promise<MutationResult<GroupSnapshot>>;
  refreshGroup: () => Promise<MutationResult<GroupSnapshot>>;
  syncPendingPayments: () => Promise<MutationResult>;
  clearCurrentGroup: () => void;
  createSharedGroup: (
    name: string,
    memberNames: string[],
    selfMemberName: string
  ) => Promise<MutationResult<{ groupId: string; inviteToken: string }>>;
  inspectInvite: (token: string) => Promise<MutationResult<InvitePreview>>;
  joinSharedGroup: (
    token: string,
    memberId: string
  ) => Promise<MutationResult<{ groupId: string }>>;
  addPayment: (
    input: PaymentInput
  ) => Promise<MutationResult<PaymentSaveResult>>;
  updatePendingPayment: (
    operationId: string,
    input: PaymentInput
  ) => Promise<MutationResult>;
  discardPendingPayment: (operationId: string) => Promise<MutationResult>;
  readPaymentDraft: (
    authUserId: string,
    groupId: string,
    target: PaymentDraftTarget
  ) => Promise<PaymentDraft | null>;
  savePaymentDraft: (
    authUserId: string,
    groupId: string,
    target: PaymentDraftTarget,
    input: PaymentDraftInput,
    isDirty: boolean
  ) => Promise<MutationResult>;
  deletePaymentDraft: (
    authUserId: string,
    groupId: string,
    target: PaymentDraftTarget
  ) => Promise<MutationResult>;
  updatePayment: (
    paymentId: string,
    version: number,
    input: PaymentInput
  ) => Promise<MutationResult>;
  deletePayment: (
    paymentId: string,
    version: number
  ) => Promise<MutationResult>;
  recordTransfer: (settlement: Settlement) => Promise<MutationResult>;
  deleteTransfer: (
    transferId: string,
    version: number
  ) => Promise<MutationResult>;
  changeMyMember: (memberId: string) => Promise<MutationResult>;
  getInviteLink: () => Promise<MutationResult<string>>;
  rotateInvite: () => Promise<MutationResult<string>>;
  setInviteEnabled: (enabled: boolean) => Promise<MutationResult>;
  deleteSharedGroup: () => Promise<MutationResult>;
  inspectOfflineGroupData: (groupId?: string) => Promise<
    MutationResult<OfflineGroupDataSummary>
  >;
  deleteOfflineGroupData: (groupId?: string) => Promise<MutationResult>;
}

export interface MemberListProps {
  members: string[];
  onDeleteMember: (member: string) => void;
}

export interface AddMemberFormProps {
  onAddMember: (memberName: string) => void;
}
