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
export type SyncStatus = "connecting" | "connected" | "reconnecting" | "offline";

export interface GroupContextType {
  authStatus: AuthStatus;
  authError: string | null;
  groupStatus: GroupLoadStatus;
  syncStatus: SyncStatus;
  snapshot: GroupSnapshot | null;
  lastError: string | null;
  authenticate: (captchaToken: string) => Promise<MutationResult>;
  loadGroup: (groupId: string) => Promise<MutationResult<GroupSnapshot>>;
  refreshGroup: () => Promise<MutationResult<GroupSnapshot>>;
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
  addPayment: (input: PaymentInput) => Promise<MutationResult>;
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
}

export interface MemberListProps {
  members: string[];
  onDeleteMember: (member: string) => void;
}

export interface AddMemberFormProps {
  onAddMember: (memberName: string) => void;
}
