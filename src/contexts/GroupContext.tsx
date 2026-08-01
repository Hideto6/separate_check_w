"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  GroupContextType,
  GroupSnapshot,
  InvitePreview,
  MutationResult,
  OfflineGroupDataSummary,
  OfflinePendingRecovery,
  PaymentDraft,
  PaymentDraftInput,
  PaymentDraftTarget,
  PaymentInput,
  PaymentSaveResult,
  PendingPayment,
  Settlement,
  SnapshotSource,
} from "@/types";
import { removeRecentGroup, storeRecentGroup } from "@/lib/validation";
import { getSupabaseClient } from "@/lib/supabase";
import {
  createQueuedPendingPayment,
  offlineStore,
  type PendingPaymentUpdate,
} from "@/lib/offlineStorage";
import {
  createPendingPaymentSyncCoordinator,
  syncPendingPaymentQueue,
} from "@/lib/pendingPaymentSync";
import {
  canContinueWithOfflineData,
  mergeRecoveryPaymentsForGroup,
} from "@/lib/offlineRecovery";
import {
  addPaymentIdempotent,
  changeMyMember as changeMyMemberRemote,
  createSharedGroup as createSharedGroupRemote,
  deletePayment as deletePaymentRemote,
  deleteSharedGroup as deleteSharedGroupRemote,
  deleteTransfer as deleteTransferRemote,
  fetchGroupSnapshot,
  inspectInvite as inspectInviteRemote,
  joinSharedGroup as joinSharedGroupRemote,
  recordTransfer as recordTransferRemote,
  rotateInvite as rotateInviteRemote,
  setInviteEnabled as setInviteEnabledRemote,
  updatePayment as updatePaymentRemote,
} from "@/lib/groupRepository";

const GroupContext = createContext<GroupContextType | undefined>(undefined);
const inviteStorageKey = (groupId: string) => `waritabi:invite:${groupId}`;
const offlineGroupScopeKey = (userId: string, groupId: string) =>
  `${userId}:${groupId}`;
const GROUP_REQUEST_TIMEOUT_MS = 15_000;
const CACHE_FALLBACK_DELAY_MS = 5_000;
const RETRY_DELAYS_MS = [5_000, 15_000, 30_000, 60_000] as const;

const storeInviteToken = (groupId: string, token: string) => {
  try {
    localStorage.setItem(inviteStorageKey(groupId), token);
  } catch {
    // 保存できない場合もグループ作成は成功扱いにし、共有時に再発行する。
  }
};

const readInviteToken = (groupId: string) => {
  try {
    return localStorage.getItem(inviteStorageKey(groupId));
  } catch {
    return null;
  }
};

const removeInviteToken = (groupId: string) => {
  try {
    localStorage.removeItem(inviteStorageKey(groupId));
  } catch {
    // クラウド側の削除結果を優先する。
  }
};

const missingClient = <T = undefined,>(): MutationResult<T> => ({
  ok: false,
  code: "unknown",
  message: "Supabaseの環境変数が設定されていません。",
});

const missingGroup = <T = undefined,>(): MutationResult<T> => ({
  ok: false,
  code: "validation",
  message: "グループを読み込んでから操作してください。",
});

const unavailableMutation = <T = undefined,>(): MutationResult<T> => ({
  ok: false,
  code: navigator.onLine ? "unavailable" : "offline",
  message: navigator.onLine
    ? "共有サービスに接続できないため、この操作は利用できません。"
    : "オフライン中はこの操作を利用できません。",
});

const storageFailure = <T = undefined,>(message: string): MutationResult<T> => ({
  ok: false,
  code: "unknown",
  message,
});

const inviteLink = (token: string) =>
  `${window.location.origin}/join/${encodeURIComponent(token)}`;

const isConnectionFailure = (result: Extract<MutationResult, { ok: false }>) =>
  result.code === "offline" || result.code === "unavailable";

const syncStatusForFailure = (
  result: Extract<MutationResult, { ok: false }>
): GroupContextType["syncStatus"] =>
  result.code === "offline" ? "offline" : "unavailable";

const createTimedController = () => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    GROUP_REQUEST_TIMEOUT_MS
  );
  return {
    controller,
    clear: () => window.clearTimeout(timeoutId),
  };
};

const readExpectedCacheDenialId = async (
  authUserId: string,
  groupId: string
) => {
  const result = await offlineStore.readCachedGroupDenial(authUserId, groupId);
  return result.ok ? result.data?.denialId : undefined;
};

export const GroupProvider = ({ children }: { children: ReactNode }) => {
  const [authStatus, setAuthStatus] =
    useState<GroupContextType["authStatus"]>("checking");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [offlineDataUserId, setOfflineDataUserId] = useState<string | null>(null);
  const [authRecoveryRequired, setAuthRecoveryRequired] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);
  const [hasOfflineCache, setHasOfflineCache] = useState(false);
  const [offlinePendingRecovery, setOfflinePendingRecovery] =
    useState<OfflinePendingRecovery | null>(null);
  const [groupStatus, setGroupStatus] =
    useState<GroupContextType["groupStatus"]>("idle");
  const [syncStatus, setSyncStatus] =
    useState<GroupContextType["syncStatus"]>("connecting");
  const [remoteStatus, setRemoteStatus] =
    useState<GroupContextType["remoteStatus"]>("idle");
  const [snapshotSource, setSnapshotSource] =
    useState<SnapshotSource | null>(null);
  const [snapshot, setSnapshot] = useState<GroupSnapshot | null>(null);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [cacheFallbackAvailable, setCacheFallbackAvailable] = useState(false);
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  const [groupErrorCode, setGroupErrorCode] =
    useState<GroupContextType["groupErrorCode"]>(null);

  const authUserIdRef = useRef<string | null>(null);
  const offlineProfileUserIdRef = useRef<string | null>(null);
  const offlineModeRef = useRef(false);
  const snapshotRef = useRef<GroupSnapshot | null>(null);
  const snapshotSourceRef = useRef<SnapshotSource | null>(null);
  const cachedAtRef = useRef<string | null>(null);
  const activeGroupIdRef = useRef<string | null>(null);
  const groupRequestVersionRef = useRef(0);
  const groupRequestControllerRef = useRef<AbortController | null>(null);
  const pendingStateRequestVersionRef = useRef(0);
  const authEpochRef = useRef(0);
  const authCandidateVersionRef = useRef(0);
  const authProfileWriteQueueRef = useRef<Promise<void>>(Promise.resolve());
  const [pendingPaymentSyncCoordinator] = useState(() =>
    createPendingPaymentSyncCoordinator()
  );
  const cacheDeniedScopesRef = useRef(new Set<string>());
  const retryIndexRef = useRef(0);

  const currentOfflineUserId = () =>
    authUserIdRef.current ?? offlineProfileUserIdRef.current;

  const offlineFallbackAvailable = canContinueWithOfflineData(
    hasOfflineCache,
    offlineDataUserId,
    offlinePendingRecovery
  );

  const applySnapshot = useCallback(
    (
      nextSnapshot: GroupSnapshot | null,
      source: SnapshotSource | null = null,
      nextCachedAt: string | null = null
    ) => {
      snapshotRef.current = nextSnapshot;
      snapshotSourceRef.current = source;
      cachedAtRef.current = nextCachedAt;
      activeGroupIdRef.current = nextSnapshot?.group.id ?? null;
      setSnapshot(nextSnapshot);
      setSnapshotSource(source);
      setCachedAt(nextCachedAt);
    },
    []
  );

  const invalidatePendingGroupRequests = useCallback(() => {
    groupRequestVersionRef.current += 1;
    groupRequestControllerRef.current?.abort();
    groupRequestControllerRef.current = null;
  }, []);

  const refreshOfflineCacheAvailability = useCallback(async (userId: string) => {
    const [cachedResult, pendingResult] = await Promise.all([
      offlineStore.getLatestCachedSnapshotForUser(userId),
      offlineStore.listPendingPaymentsForUser(userId),
    ]);
    if (
      (authUserIdRef.current ?? offlineProfileUserIdRef.current) !== userId
    ) {
      return;
    }
    setHasOfflineCache(cachedResult.ok && cachedResult.data !== null);
    if (pendingResult.ok) {
      setOfflinePendingRecovery({
        authUserId: userId,
        pendingPayments: pendingResult.data,
      });
    } else {
      setOfflinePendingRecovery((current) =>
        current?.authUserId === userId
          ? current
          : { authUserId: userId, pendingPayments: [] }
      );
    }
  }, []);

  const rememberAuthenticatedUser = useCallback(
    async (userId: string) => {
      const candidateVersion = authCandidateVersionRef.current + 1;
      authCandidateVersionRef.current = candidateVersion;
      const previousUserId =
        authUserIdRef.current ?? offlineProfileUserIdRef.current;
      if (previousUserId !== null && previousUserId !== userId) {
        const previousPending = await offlineStore.listPendingPaymentsForUser(
          previousUserId
        );
        if (authCandidateVersionRef.current !== candidateVersion) return false;
        if (!previousPending.ok || previousPending.data.length > 0) {
          authEpochRef.current += 1;
          authUserIdRef.current = null;
          offlineProfileUserIdRef.current = previousUserId;
          offlineModeRef.current = true;
          setAuthUserId(null);
          setOfflineDataUserId(previousUserId);
          setOfflineMode(true);
          setAuthStatus("needs_captcha");
          setAuthRecoveryRequired(true);
          setAuthError(
            previousPending.ok
              ? "別の匿名ユーザーとして認証されました。未同期の支払いを保護するため、以前の端末データを表示しています。"
              : "以前の未同期データを確認できないため、匿名ユーザーの切り替えを停止しました。"
          );
          if (previousPending.ok) {
            setOfflinePendingRecovery({
              authUserId: previousUserId,
              pendingPayments: previousPending.data,
            });
          }
          invalidatePendingGroupRequests();
          const currentGroupId = snapshotRef.current?.group.id;
          if (currentGroupId) {
            snapshotSourceRef.current = "cache";
            setSnapshotSource("cache");
            setGroupStatus("ready");
            setSyncStatus("unavailable");
            setRemoteStatus("error");
            setPendingPayments(
              previousPending.ok
                ? previousPending.data.filter(
                    (payment) => payment.groupId === currentGroupId
                  )
                : []
            );
          }
          await refreshOfflineCacheAvailability(previousUserId);
          return false;
        }
      }
      if (previousUserId !== userId) {
        authEpochRef.current += 1;
        setHasOfflineCache(false);
        setOfflinePendingRecovery(null);
      }
      authUserIdRef.current = userId;
      offlineProfileUserIdRef.current = userId;
      offlineModeRef.current = false;
      setAuthUserId(userId);
      setOfflineDataUserId(userId);
      setOfflineMode(false);
      setAuthStatus("ready");
      setAuthError(null);
      setAuthRecoveryRequired(false);
      retryIndexRef.current = 0;
      if (previousUserId !== null && previousUserId !== userId) {
        invalidatePendingGroupRequests();
        applySnapshot(null);
        setPendingPayments([]);
        setGroupStatus("idle");
        setGroupErrorCode(null);
      }
      const rememberEpoch = authEpochRef.current;
      const profileWrite = authProfileWriteQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          if (
            authEpochRef.current !== rememberEpoch ||
            authUserIdRef.current !== userId
          ) {
            return;
          }
          await offlineStore.rememberAuthProfile(userId);
        });
      authProfileWriteQueueRef.current = profileWrite;
      await profileWrite;
      if (
        authEpochRef.current === rememberEpoch &&
        authUserIdRef.current === userId
      ) {
        await refreshOfflineCacheAvailability(userId);
      }
      return true;
    },
    [applySnapshot, invalidatePendingGroupRequests, refreshOfflineCacheAvailability]
  );

  const recoverAuthenticatedSession = useCallback(async () => {
    const client = getSupabaseClient();
    if (!client) {
      setAuthRecoveryRequired(true);
      return false;
    }
    const recoveryEpoch = authEpochRef.current;

    const acceptSession = async (
      session: { user: { id: string } } | null
    ) => {
      if (!session || authEpochRef.current !== recoveryEpoch) {
        return false;
      }
      return rememberAuthenticatedUser(session.user.id);
    };

    try {
      let sessionTimeoutId: number | undefined;
      const current = await Promise.race([
        client.auth.getSession(),
        new Promise<never>((_resolve, reject) => {
          sessionTimeoutId = window.setTimeout(
            () => reject(new Error("authentication_session_timeout")),
            GROUP_REQUEST_TIMEOUT_MS
          );
        }),
      ]).finally(() => {
        if (sessionTimeoutId !== undefined) {
          window.clearTimeout(sessionTimeoutId);
        }
      });
      if (await acceptSession(current.data.session)) return true;

      let timeoutId: number | undefined;
      try {
        const refreshed = await Promise.race([
          client.auth.refreshSession(),
          new Promise<never>((_resolve, reject) => {
            timeoutId = window.setTimeout(
              () => reject(new Error("authentication_recovery_timeout")),
              GROUP_REQUEST_TIMEOUT_MS
            );
          }),
        ]);
        if (await acceptSession(refreshed.data.session)) return true;
      } finally {
        if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      }
    } catch {
      // 同じ匿名セッションを確認できるまで端末データだけを利用する。
    }

    if (authUserIdRef.current !== null) return true;
    if (authEpochRef.current === recoveryEpoch) {
      setAuthRecoveryRequired(true);
    }
    return false;
  }, [rememberAuthenticatedUser]);

  const reloadPendingPayments = useCallback(
    async (userId: string, groupId: string) => {
      const pendingRequestVersion =
        pendingStateRequestVersionRef.current + 1;
      pendingStateRequestVersionRef.current = pendingRequestVersion;
      const result = await offlineStore.listPendingPayments(userId, groupId);
      if (
        pendingStateRequestVersionRef.current !== pendingRequestVersion ||
        (authUserIdRef.current ?? offlineProfileUserIdRef.current) !== userId ||
        activeGroupIdRef.current !== groupId
      ) {
        return result;
      }
      if (result.ok) {
        setPendingPayments(result.data);
        setOfflinePendingRecovery((current) =>
          mergeRecoveryPaymentsForGroup(
            current,
            userId,
            groupId,
            result.data
          )
        );
      } else {
        setPendingPayments([]);
        setLastError(result.message);
      }
      return result;
    },
    []
  );

  const quarantineCachedGroup = useCallback(
    async (userId: string, groupId: string) => {
      cacheDeniedScopesRef.current.add(
        offlineGroupScopeKey(userId, groupId)
      );
      const denied = await offlineStore.denyCachedGroup(userId, groupId);
      // marker保存に失敗しても、古いsnapshotの削除は独立して試す。
      const deleted = await offlineStore.deleteCachedSnapshot(userId, groupId);
      await reloadPendingPayments(userId, groupId);
      await refreshOfflineCacheAvailability(userId);

      if (denied.ok && deleted.ok) return null;
      if (denied.ok) {
        return "端末キャッシュを削除できませんでしたが、次回起動後も再利用しないよう設定しました。端末データの削除を再試行してください。";
      }
      if (deleted.ok) {
        return "端末キャッシュは削除しましたが、利用停止情報を保存できませんでした。端末の空き容量とブラウザ設定を確認してください。";
      }
      return "端末キャッシュの利用停止を保存できませんでした。この画面では再利用を停止していますが、再起動前に端末データの削除を再試行してください。";
    },
    [refreshOfflineCacheAvailability, reloadPendingPayments]
  );

  const applyRemoteSnapshot = useCallback(
    async (
      nextSnapshot: GroupSnapshot,
      requestVersion?: number,
      expectedDenialId?: string
    ) => {
      if (
        requestVersion !== undefined &&
        groupRequestVersionRef.current !== requestVersion
      ) {
        return false;
      }

      applySnapshot(nextSnapshot, "remote", cachedAtRef.current);
      setGroupStatus("ready");
      setGroupErrorCode(null);
      setSyncStatus("connected");
      setRemoteStatus("connected");
      setCacheFallbackAvailable(false);
      setLastError(null);
      retryIndexRef.current = 0;
      storeRecentGroup(localStorage, {
        groupId: nextSnapshot.group.id,
        groupName: nextSnapshot.group.name,
      });

      const userId = currentOfflineUserId();
      if (!userId) return false;
      const stored = await offlineStore.saveCachedSnapshot(
        userId,
        nextSnapshot,
        expectedDenialId
      );
      if (
        stored.ok &&
        activeGroupIdRef.current === nextSnapshot.group.id &&
        (requestVersion === undefined ||
          groupRequestVersionRef.current === requestVersion)
      ) {
        cacheDeniedScopesRef.current.delete(
          offlineGroupScopeKey(userId, nextSnapshot.group.id)
        );
        cachedAtRef.current = stored.data.cachedAt;
        setCachedAt(stored.data.cachedAt);
        setHasOfflineCache(true);
      }
      if (!stored.ok) setLastError(stored.message);
      await reloadPendingPayments(userId, nextSnapshot.group.id);
      return stored.ok;
    },
    [applySnapshot, reloadPendingPayments]
  );

  const markConnectionFailure = useCallback(
    (result: Extract<MutationResult, { ok: false }>) => {
      if (!isConnectionFailure(result)) return;
      if (snapshotRef.current) {
        snapshotSourceRef.current = "cache";
        setSnapshotSource("cache");
      }
      setSyncStatus(syncStatusForFailure(result));
      setRemoteStatus(result.code === "offline" ? "offline" : "error");
    },
    []
  );

  useEffect(() => {
    let active = true;
    const profileReady = offlineStore.readLastAuthProfile().then((result) => {
      if (!active || !result.ok || !result.data) return;
      offlineProfileUserIdRef.current = result.data.authUserId;
      setOfflineDataUserId(result.data.authUserId);
      void refreshOfflineCacheAvailability(result.data.authUserId);
    });

    const client = getSupabaseClient();
    if (!client) {
      setAuthStatus("misconfigured");
      setAuthError("Supabaseの接続情報を設定してください。");
      return () => {
        active = false;
      };
    }

    const getInitialSession = async () => {
      let timeoutId: number | undefined;
      try {
        return await Promise.race([
          client.auth.getSession(),
          new Promise<never>((_resolve, reject) => {
            timeoutId = window.setTimeout(
              () => reject(new Error("initial_session_timeout")),
              GROUP_REQUEST_TIMEOUT_MS
            );
          }),
        ]);
      } finally {
        if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      }
    };

    void profileReady
      .then(getInitialSession)
      .then(({ data, error }) => {
        if (!active) return;
        if (data.session) {
          void rememberAuthenticatedUser(data.session.user.id);
        } else if (error) {
          setAuthStatus("error");
          setAuthError("認証状態を確認できませんでした。");
        } else {
          setAuthStatus("needs_captcha");
        }
      })
      .catch(() => {
        if (!active) return;
        setAuthStatus("error");
        setAuthError("認証状態を確認できませんでした。");
      });

    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      void profileReady.then(() => {
        if (!active) return;
        if (session) {
          void rememberAuthenticatedUser(session.user.id);
        } else if (!offlineModeRef.current) {
          authCandidateVersionRef.current += 1;
          authEpochRef.current += 1;
          authUserIdRef.current = null;
          setAuthUserId(null);
          invalidatePendingGroupRequests();
          applySnapshot(null);
          setPendingPayments([]);
          setGroupStatus("idle");
          setGroupErrorCode(null);
          setAuthStatus("needs_captcha");
        }
      });
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [
    applySnapshot,
    invalidatePendingGroupRequests,
    refreshOfflineCacheAvailability,
    rememberAuthenticatedUser,
  ]);

  useEffect(() => {
    if (!offlineMode || authStatus === "ready") return;
    const checkSession = () => {
      void recoverAuthenticatedSession();
    };
    const firstRetry = window.setTimeout(checkSession, 5_000);
    const interval = window.setInterval(checkSession, 60_000);
    return () => {
      window.clearTimeout(firstRetry);
      window.clearInterval(interval);
    };
  }, [authStatus, offlineMode, recoverAuthenticatedSession]);

  const authenticate = useCallback(
    async (captchaToken: string): Promise<MutationResult> => {
      const client = getSupabaseClient();
      if (!client) {
        setAuthStatus("misconfigured");
        return missingClient();
      }

      setAuthStatus("signing_in");
      setAuthError(null);
      let response: Awaited<ReturnType<typeof client.auth.signInAnonymously>>;
      let requestTimeoutId: number | undefined;
      try {
        response = await Promise.race([
          client.auth.signInAnonymously({
            options: { captchaToken },
          }),
          new Promise<never>((_resolve, reject) => {
            requestTimeoutId = window.setTimeout(
              () => reject(new Error("authentication_timeout")),
              GROUP_REQUEST_TIMEOUT_MS
            );
          }),
        ]);
      } catch {
        const message =
          "認証サービスに接続できませんでした。再試行するか、端末データで続けてください。";
        setAuthStatus("needs_captcha");
        setAuthError(message);
        return {
          ok: false,
          code: navigator.onLine ? "unavailable" : "offline",
          message,
        };
      } finally {
        if (requestTimeoutId !== undefined) {
          window.clearTimeout(requestTimeoutId);
        }
      }
      const { data, error } = response;
      if (error || !data.session) {
        const message =
          error?.code === "captcha_failed"
            ? "認証チェックに失敗しました。もう一度お試しください。"
            : "匿名ユーザーを作成できませんでした。";
        setAuthStatus("needs_captcha");
        setAuthError(message);
        return { ok: false, code: "unknown", message };
      }

      const accepted = await rememberAuthenticatedUser(data.session.user.id);
      if (!accepted) {
        return {
          ok: false,
          code: "conflict",
          message:
            "以前の匿名ユーザーに未同期の支払いが残っています。内容を確認してから認証をやり直してください。",
        };
      }
      return { ok: true, data: undefined };
    },
    [rememberAuthenticatedUser]
  );

  const continueOffline = useCallback(() => {
    if (!offlineFallbackAvailable || !offlineProfileUserIdRef.current) return;
    offlineModeRef.current = true;
    setOfflineMode(true);
    setAuthRecoveryRequired(authUserIdRef.current === null);
  }, [offlineFallbackAvailable]);

  const loadCachedGroup = useCallback(
    async (groupId: string): Promise<MutationResult<GroupSnapshot>> => {
      activeGroupIdRef.current = groupId;
      const userId = currentOfflineUserId();
      if (!userId) {
        const message = "この端末で利用できるグループデータがありません。";
        setGroupStatus("error");
        setGroupErrorCode("forbidden");
        setRemoteStatus("error");
        setCacheFallbackAvailable(false);
        setLastError(message);
        return {
          ok: false,
          code: "forbidden",
          message,
        };
      }
      const requestVersion = groupRequestVersionRef.current + 1;
      groupRequestVersionRef.current = requestVersion;
      groupRequestControllerRef.current?.abort();
      groupRequestControllerRef.current = null;
      await reloadPendingPayments(userId, groupId);
      const scopeKey = offlineGroupScopeKey(userId, groupId);
      const persistedDenial = await offlineStore.isCachedGroupDenied(
        userId,
        groupId
      );
      if (
        groupRequestVersionRef.current !== requestVersion ||
        activeGroupIdRef.current !== groupId
      ) {
        return missingGroup();
      }
      if (!persistedDenial.ok) {
        const message =
          "端末キャッシュの利用可否を確認できませんでした。接続を再試行してください。";
        setGroupStatus("error");
        setGroupErrorCode("unknown");
        setRemoteStatus("error");
        setCacheFallbackAvailable(false);
        setLastError(message);
        return { ok: false, code: "unknown", message };
      }
      if (
        persistedDenial.data ||
        cacheDeniedScopesRef.current.has(scopeKey)
      ) {
        cacheDeniedScopesRef.current.add(scopeKey);
        const message =
          "このグループの削除または権限喪失が確認されたため、端末キャッシュは開けません。";
        setGroupStatus("error");
        setLastError(message);
        setGroupErrorCode("forbidden");
        setRemoteStatus("error");
        setCacheFallbackAvailable(false);
        return { ok: false, code: "forbidden", message };
      }
      const result = await offlineStore.readCachedSnapshot(userId, groupId);
      if (
        groupRequestVersionRef.current !== requestVersion ||
        activeGroupIdRef.current !== groupId
      ) {
        return result.ok && result.data
          ? { ok: true, data: result.data.snapshot }
          : missingGroup();
      }
      if (!result.ok || !result.data) {
        const message = result.ok
          ? "この端末に保存されたグループデータがありません。"
          : result.message;
        setGroupStatus("error");
        setGroupErrorCode("unknown");
        setRemoteStatus("error");
        setCacheFallbackAvailable(false);
        setLastError(message);
        return { ok: false, code: "unknown", message };
      }

      applySnapshot(result.data.snapshot, "cache", result.data.cachedAt);
      setGroupStatus("ready");
      setGroupErrorCode(null);
      setSyncStatus(navigator.onLine ? "unavailable" : "offline");
      setRemoteStatus(navigator.onLine ? "error" : "offline");
      setCacheFallbackAvailable(false);
      setLastError(null);
      await reloadPendingPayments(userId, groupId);
      return { ok: true, data: result.data.snapshot };
    },
    [applySnapshot, reloadPendingPayments]
  );

  const loadGroup = useCallback(
    async (groupId: string): Promise<MutationResult<GroupSnapshot>> => {
      activeGroupIdRef.current = groupId;
      setGroupErrorCode(null);
      const userId = currentOfflineUserId();
      if (offlineModeRef.current) {
        return loadCachedGroup(groupId);
      }

      const requestVersion = groupRequestVersionRef.current + 1;
      groupRequestVersionRef.current = requestVersion;
      let cacheDenied = false;
      let expectedDenialId: string | undefined;
      if (userId) {
        const scopeKey = offlineGroupScopeKey(userId, groupId);
        cacheDenied = cacheDeniedScopesRef.current.has(scopeKey);
        const persistedDenial = await offlineStore.readCachedGroupDenial(
          userId,
          groupId
        );
        cacheDenied =
          cacheDenied || !persistedDenial.ok || persistedDenial.data !== null;
        if (persistedDenial.ok && persistedDenial.data) {
          expectedDenialId = persistedDenial.data.denialId;
          cacheDeniedScopesRef.current.add(scopeKey);
        }
      }
      const cachedResult =
        userId && !cacheDenied
          ? await offlineStore.readCachedSnapshot(userId, groupId)
          : null;
      const cachedEnvelope = cachedResult?.ok ? cachedResult.data : null;
      if (userId) {
        await reloadPendingPayments(userId, groupId);
      }
      if (
        groupRequestVersionRef.current !== requestVersion ||
        activeGroupIdRef.current !== groupId
      ) {
        return missingGroup();
      }

      const client = getSupabaseClient();
      if (!client) {
        setGroupStatus("error");
        setGroupErrorCode("unknown");
        return missingClient();
      }

      setGroupStatus("loading");
      setRemoteStatus(navigator.onLine ? "connecting" : "offline");
      setSyncStatus(navigator.onLine ? "connecting" : "offline");
      setCacheFallbackAvailable(!navigator.onLine && Boolean(cachedEnvelope));
      setLastError(null);
      setGroupErrorCode(null);

      const slowTimer = window.setTimeout(() => {
        if (
          cachedEnvelope &&
          groupRequestVersionRef.current === requestVersion &&
          activeGroupIdRef.current === groupId
        ) {
          setRemoteStatus("slow");
          setCacheFallbackAvailable(true);
        }
      }, CACHE_FALLBACK_DELAY_MS);
      const timed = createTimedController();
      groupRequestControllerRef.current?.abort();
      groupRequestControllerRef.current = timed.controller;
      const result = await fetchGroupSnapshot(
        client,
        groupId,
        timed.controller.signal
      );
      window.clearTimeout(slowTimer);
      timed.clear();
      if (groupRequestControllerRef.current === timed.controller) {
        groupRequestControllerRef.current = null;
      }

      if (
        groupRequestVersionRef.current !== requestVersion ||
        activeGroupIdRef.current !== groupId
      ) {
        return result;
      }

      if (result.ok) {
        await applyRemoteSnapshot(
          result.data,
          requestVersion,
          expectedDenialId
        );
      } else {
        setGroupStatus("error");
        setLastError(result.message);
        setGroupErrorCode(result.code);
        if (isConnectionFailure(result)) {
          setSyncStatus(syncStatusForFailure(result));
          setRemoteStatus(result.code === "offline" ? "offline" : "error");
          setCacheFallbackAvailable(Boolean(cachedEnvelope));
        } else if (result.code === "forbidden") {
          setRemoteStatus("error");
          setCacheFallbackAvailable(false);
          removeRecentGroup(localStorage, groupId);
          if (userId) {
            const warning = await quarantineCachedGroup(userId, groupId);
            if (warning) setLastError(`${result.message} ${warning}`);
          }
        } else {
          setRemoteStatus("error");
          setCacheFallbackAvailable(false);
        }
      }
      return result;
    }, [
      applyRemoteSnapshot,
      loadCachedGroup,
      quarantineCachedGroup,
      reloadPendingPayments,
    ]
  );

  const refreshGroup = useCallback(async (): Promise<
    MutationResult<GroupSnapshot>
  > => {
    const currentSnapshot = snapshotRef.current;
    const client = getSupabaseClient();
    if (!currentSnapshot || !client) return missingGroup();
    if (activeGroupIdRef.current !== currentSnapshot.group.id) {
      return missingGroup();
    }
    if (authUserIdRef.current === null) {
      const recovered = await recoverAuthenticatedSession();
      if (!recovered) return unavailableMutation();
    }

    const requestVersion = groupRequestVersionRef.current + 1;
    groupRequestVersionRef.current = requestVersion;
    setGroupErrorCode(null);
    setRemoteStatus("reconnecting");
    setSyncStatus(navigator.onLine ? "reconnecting" : "offline");
    const userId = currentOfflineUserId();
    const expectedDenialId = userId
      ? await readExpectedCacheDenialId(userId, currentSnapshot.group.id)
      : undefined;
    if (
      groupRequestVersionRef.current !== requestVersion ||
      activeGroupIdRef.current !== currentSnapshot.group.id
    ) {
      return missingGroup();
    }
    const timed = createTimedController();
    groupRequestControllerRef.current?.abort();
    groupRequestControllerRef.current = timed.controller;
    const result = await fetchGroupSnapshot(
      client,
      currentSnapshot.group.id,
      timed.controller.signal
    );
    timed.clear();
    if (groupRequestControllerRef.current === timed.controller) {
      groupRequestControllerRef.current = null;
    }

    const latestSnapshot = snapshotRef.current;
    if (
      groupRequestVersionRef.current !== requestVersion ||
      activeGroupIdRef.current !== currentSnapshot.group.id ||
      latestSnapshot?.group.id !== currentSnapshot.group.id
    ) {
      return result;
    }

    if (result.ok) {
      if (result.data.group.revision < latestSnapshot.group.revision) {
        return result;
      }
      await applyRemoteSnapshot(
        result.data,
        requestVersion,
        expectedDenialId
      );
    } else {
      setLastError(result.message);
      setGroupErrorCode(result.code);
      if (result.code === "forbidden") {
        const userId = currentOfflineUserId();
        removeRecentGroup(localStorage, currentSnapshot.group.id);
        if (userId) {
          const warning = await quarantineCachedGroup(
            userId,
            currentSnapshot.group.id
          );
          if (warning) setLastError(`${result.message} ${warning}`);
        }
        invalidatePendingGroupRequests();
        applySnapshot(null);
        setGroupStatus("error");
        setRemoteStatus("error");
      } else if (isConnectionFailure(result)) {
        setSnapshotSource("cache");
        snapshotSourceRef.current = "cache";
        setSyncStatus(syncStatusForFailure(result));
        setRemoteStatus(result.code === "offline" ? "offline" : "error");
      } else {
        setSyncStatus("reconnecting");
        setRemoteStatus("error");
      }
    }
    return result;
  }, [
    applyRemoteSnapshot,
    applySnapshot,
    invalidatePendingGroupRequests,
    quarantineCachedGroup,
    recoverAuthenticatedSession,
  ]);

  const syncPendingPayments = useCallback(async (): Promise<MutationResult> => {
    const current = snapshotRef.current;
    const userId = authUserIdRef.current;
    const client = getSupabaseClient();
    if (!current || !userId || !client || !navigator.onLine) {
      return unavailableMutation();
    }

    const syncGroupId = current.group.id;
    const syncKey = `${userId}:${syncGroupId}`;
    return pendingPaymentSyncCoordinator.run(syncKey, async () => {
      const syncAuthEpoch = authEpochRef.current;
      const syncTargetIsActive = () =>
        authEpochRef.current === syncAuthEpoch &&
        authUserIdRef.current === userId &&
        activeGroupIdRef.current === syncGroupId;

      const listed = await offlineStore.listPendingPayments(
        userId,
        syncGroupId
      );
      if (!listed.ok) return storageFailure(listed.message);
      if (!syncTargetIsActive()) return unavailableMutation();
      if (listed.data.length === 0) {
        return { ok: true, data: undefined };
      }

      const outcome = await syncPendingPaymentQueue(listed.data, {
        createPayment: async (payment) => {
          if (!syncTargetIsActive()) {
            return {
              ok: false,
              code: "unavailable",
              message:
                "認証状態が変わったため、自動登録を次回へ延期しました。",
            };
          }
          const timed = createTimedController();
          try {
            const result = await addPaymentIdempotent(
              client,
              payment.operationId,
              payment.groupId,
              payment.input,
              timed.controller.signal
            );
            return syncTargetIsActive()
              ? result
              : unavailableMutation<string>();
          } finally {
            timed.clear();
          }
        },
        refreshSnapshot: async () => {
          if (!syncTargetIsActive()) {
            return unavailableMutation<GroupSnapshot>();
          }
          const expectedDenialId = await readExpectedCacheDenialId(
            userId,
            syncGroupId
          );
          if (!syncTargetIsActive()) {
            return unavailableMutation<GroupSnapshot>();
          }
          const timed = createTimedController();
          try {
            const result = await fetchGroupSnapshot(
              client,
              syncGroupId,
              timed.controller.signal
            );
            if (result.ok && syncTargetIsActive()) {
              const latest = snapshotRef.current;
              let cached: boolean;
              if (
                latest?.group.id === syncGroupId &&
                result.data.group.revision >= latest.group.revision
              ) {
                cached = await applyRemoteSnapshot(
                  result.data,
                  undefined,
                  expectedDenialId
                );
              } else {
                const stored = await offlineStore.saveCachedSnapshot(
                  userId,
                  result.data,
                  expectedDenialId
                );
                cached = stored.ok;
              }
              if (!cached) {
                return {
                  ok: false,
                  code: "unavailable",
                  message:
                    "登録結果は確認できましたが、最新データを端末へ保存できませんでした。端末の空き容量とブラウザ設定を確認してください。",
                };
              }
            }
            return syncTargetIsActive()
              ? result
              : unavailableMutation<GroupSnapshot>();
          } finally {
            timed.clear();
          }
        },
        updatePending: async (payment, updates) => {
          const storageUpdate: PendingPaymentUpdate = {};
          if (updates.status !== undefined) storageUpdate.status = updates.status;
          if (updates.input !== undefined) storageUpdate.input = updates.input;
          if (updates.attemptCount !== undefined) {
            storageUpdate.attemptCount = updates.attemptCount;
          }
          if ("serverPaymentId" in updates) {
            storageUpdate.serverPaymentId = updates.serverPaymentId ?? null;
          }
          if ("lastError" in updates) {
            storageUpdate.lastError = updates.lastError ?? null;
          }
          if ("attemptedAt" in updates) {
            storageUpdate.attemptedAt = updates.attemptedAt ?? null;
          }
          const result = await offlineStore.updatePendingPayment(
            payment.authUserId,
            payment.groupId,
            payment.operationId,
            storageUpdate
          );
          if (result.ok && syncTargetIsActive()) {
            await reloadPendingPayments(userId, syncGroupId);
          }
          return result.ok ? result.data : null;
        },
        deletePending: async (payment) => {
          const result = await offlineStore.deletePendingPayment(
            payment.authUserId,
            payment.groupId,
            payment.operationId
          );
          if (result.ok && syncTargetIsActive()) {
            await reloadPendingPayments(userId, syncGroupId);
          }
          return result.ok;
        },
      });
      if (syncTargetIsActive()) {
        await reloadPendingPayments(userId, syncGroupId);
      }

      if (outcome === "retry") {
        if (syncTargetIsActive()) {
          setSnapshotSource("cache");
          snapshotSourceRef.current = "cache";
          setSyncStatus(navigator.onLine ? "unavailable" : "offline");
          setRemoteStatus(navigator.onLine ? "error" : "offline");
        }
        return unavailableMutation();
      }
      if (outcome === "blocked") {
        const pending = await offlineStore.listPendingPayments(
          userId,
          syncGroupId
        );
        const message =
          pending.ok
            ? pending.data.find((payment) => payment.status === "blocked")
                ?.lastError
            : null;
        return {
          ok: false,
          code: "validation",
          message: message ?? "未同期の支払いに確認が必要です。",
        };
      }
      if (outcome === "storage_error") {
        return storageFailure(
          "端末の未同期データを更新できませんでした。内容を確認してください。"
        );
      }
      if (outcome === "synced" && syncTargetIsActive()) {
        await refreshGroup();
      }
      return { ok: true, data: undefined };
    });
  }, [
    applyRemoteSnapshot,
    pendingPaymentSyncCoordinator,
    refreshGroup,
    reloadPendingPayments,
  ]);

  useEffect(() => {
    const groupId = snapshot?.group.id;
    const client = getSupabaseClient();
    if (!groupId || !client || authStatus !== "ready") return;

    const channel = client
      .channel(`waritabi-group-${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "groups",
          filter: `id=eq.${groupId}`,
        },
        () => {
          void refreshGroup();
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          if (snapshotSourceRef.current === "cache") {
            setSyncStatus("reconnecting");
            setRemoteStatus("reconnecting");
            void refreshGroup();
          } else {
            setSyncStatus("connected");
            setRemoteStatus("connected");
            void syncPendingPayments();
          }
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setSyncStatus(navigator.onLine ? "reconnecting" : "offline");
          setRemoteStatus(navigator.onLine ? "error" : "offline");
        }
      });

    return () => {
      void client.removeChannel(channel);
    };
  }, [authStatus, refreshGroup, snapshot?.group.id, syncPendingPayments]);

  useEffect(() => {
    const reconnectCurrentGroup = () => {
      if (!snapshotRef.current) return;
      if (authUserIdRef.current) {
        void refreshGroup();
        return;
      }
      if (offlineModeRef.current) {
        void recoverAuthenticatedSession().then((recovered) => {
          if (recovered && snapshotRef.current) void refreshGroup();
        });
      }
    };
    const handleOffline = () => {
      setSyncStatus("offline");
      setRemoteStatus("offline");
      if (snapshotRef.current) {
        setSnapshotSource("cache");
        snapshotSourceRef.current = "cache";
      }
    };
    const handleOnline = () => {
      setSyncStatus("reconnecting");
      setRemoteStatus("reconnecting");
      reconnectCurrentGroup();
    };
    const handleVisibility = () => {
      if (
        document.visibilityState === "visible" &&
        snapshotRef.current
      ) {
        reconnectCurrentGroup();
      }
    };
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [recoverAuthenticatedSession, refreshGroup]);

  useEffect(() => {
    const needsRetry =
      remoteStatus === "error" ||
      snapshotSource === "cache" ||
      syncStatus === "offline" ||
      syncStatus === "unavailable";
    if (
      authStatus !== "ready" ||
      !snapshot ||
      remoteStatus === "connecting" ||
      remoteStatus === "reconnecting" ||
      !needsRetry
    ) {
      if (syncStatus === "connected") retryIndexRef.current = 0;
      return;
    }

    const delay =
      RETRY_DELAYS_MS[
        Math.min(retryIndexRef.current, RETRY_DELAYS_MS.length - 1)
      ];
    const timer = window.setTimeout(() => {
      if (document.visibilityState !== "visible") return;
      retryIndexRef.current += 1;
      void refreshGroup();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [
    authStatus,
    refreshGroup,
    remoteStatus,
    snapshot,
    snapshotSource,
    syncStatus,
  ]);

  useEffect(() => {
    if (
      authStatus === "ready" &&
      remoteStatus === "connected" &&
      pendingPayments.length > 0
    ) {
      void syncPendingPayments();
    }
  }, [authStatus, pendingPayments.length, remoteStatus, syncPendingPayments]);

  const finishMutation = useCallback(
    async (result: MutationResult): Promise<MutationResult> => {
      if (result.ok || result.code === "conflict") {
        await refreshGroup();
      }
      if (!result.ok) {
        markConnectionFailure(result);
        setLastError(result.message);
      }
      return result;
    },
    [markConnectionFailure, refreshGroup]
  );

  const remoteMutationAllowed = useCallback(
    () =>
      authUserIdRef.current !== null &&
      snapshotSourceRef.current === "remote" &&
      syncStatus !== "offline" &&
      syncStatus !== "unavailable",
    [syncStatus]
  );

  const createSharedGroup = useCallback(
    async (name: string, memberNames: string[], selfMemberName: string) => {
      const client = getSupabaseClient();
      if (!client) {
        return missingClient<{ groupId: string; inviteToken: string }>();
      }
      const result = await createSharedGroupRemote(
        client,
        name,
        memberNames,
        selfMemberName
      );
      if (result.ok) {
        storeInviteToken(result.data.groupId, result.data.inviteToken);
      } else {
        markConnectionFailure(result);
      }
      return result;
    },
    [markConnectionFailure]
  );

  const inspectInvite = useCallback(
    async (token: string): Promise<MutationResult<InvitePreview>> => {
      const client = getSupabaseClient();
      const result = client
        ? await inspectInviteRemote(client, token)
        : missingClient<InvitePreview>();
      if (!result.ok) markConnectionFailure(result);
      return result;
    },
    [markConnectionFailure]
  );

  const joinSharedGroup = useCallback(
    async (token: string, memberId: string) => {
      const client = getSupabaseClient();
      const result = client
        ? await joinSharedGroupRemote(client, token, memberId)
        : missingClient<{ groupId: string }>();
      if (!result.ok) markConnectionFailure(result);
      return result;
    },
    [markConnectionFailure]
  );

  const addPayment = useCallback(
    async (input: PaymentInput): Promise<MutationResult<PaymentSaveResult>> => {
      const current = snapshotRef.current;
      const userId = currentOfflineUserId();
      if (!current || !userId) return missingGroup();
      if (typeof crypto.randomUUID !== "function") {
        return storageFailure(
          "このブラウザでは安全な端末保存を利用できません。オンラインでお試しください。"
        );
      }

      const operationId = crypto.randomUUID();
      const pending = createQueuedPendingPayment(
        {
          authUserId: userId,
          groupId: current.group.id,
          operationId,
          input,
        },
        new Date().toISOString()
      );
      if (!pending) {
        return storageFailure("支払いを端末へ保存できませんでした。");
      }

      const stored = await offlineStore.promoteDraftToPending(
        { kind: "new" },
        pending
      );
      if (!stored.ok) return storageFailure(stored.message);
      await reloadPendingPayments(userId, current.group.id);

      if (remoteMutationAllowed() && navigator.onLine) {
        const synced = await syncPendingPayments();
        const remaining = await offlineStore.listPendingPayments(
          userId,
          current.group.id
        );
        if (
          synced.ok &&
          remaining.ok &&
          !remaining.data.some((payment) => payment.operationId === operationId)
        ) {
          return { ok: true, data: { status: "synced", operationId } };
        }
      }

      return { ok: true, data: { status: "queued", operationId } };
    },
    [reloadPendingPayments, remoteMutationAllowed, syncPendingPayments]
  );

  const updatePendingPayment = useCallback(
    async (operationId: string, input: PaymentInput): Promise<MutationResult> => {
      const current = snapshotRef.current;
      const userId = currentOfflineUserId();
      if (!current || !userId) return missingGroup();
      const result = await offlineStore.updatePendingPayment(
        userId,
        current.group.id,
        operationId,
        { input }
      );
      if (!result.ok) return storageFailure(result.message);
      await reloadPendingPayments(userId, current.group.id);
      return { ok: true, data: undefined };
    },
    [reloadPendingPayments]
  );

  const discardPendingPayment = useCallback(
    async (operationId: string): Promise<MutationResult> => {
      const current = snapshotRef.current;
      const userId = currentOfflineUserId();
      if (!current || !userId) return missingGroup();
      const result = await offlineStore.deleteQueuedPendingPayment(
        userId,
        current.group.id,
        operationId
      );
      if (!result.ok) return storageFailure(result.message);
      await reloadPendingPayments(userId, current.group.id);
      return { ok: true, data: undefined };
    },
    [reloadPendingPayments]
  );

  const readPaymentDraft = useCallback(
    async (
      userId: string,
      groupId: string,
      target: PaymentDraftTarget
    ): Promise<PaymentDraft | null> => {
      if (
        currentOfflineUserId() !== userId ||
        activeGroupIdRef.current !== groupId
      ) {
        return null;
      }
      const result = await offlineStore.readPaymentDraft(
        userId,
        groupId,
        target
      );
      return result.ok ? result.data : null;
    },
    []
  );

  const savePaymentDraft = useCallback(
    async (
      userId: string,
      groupId: string,
      target: PaymentDraftTarget,
      input: PaymentDraftInput,
      isDirty: boolean
    ): Promise<MutationResult> => {
      if (
        currentOfflineUserId() !== userId ||
        activeGroupIdRef.current !== groupId
      ) {
        return missingGroup();
      }
      const result = isDirty
        ? await offlineStore.savePaymentDraft({
            authUserId: userId,
            groupId,
            target,
            input,
          })
        : await offlineStore.deletePaymentDraft(
            userId,
            groupId,
            target
          );
      return result.ok
        ? { ok: true, data: undefined }
        : storageFailure(result.message);
    },
    []
  );

  const deletePaymentDraft = useCallback(
    async (
      userId: string,
      groupId: string,
      target: PaymentDraftTarget
    ): Promise<MutationResult> => {
      if (
        currentOfflineUserId() !== userId ||
        activeGroupIdRef.current !== groupId
      ) {
        return missingGroup();
      }
      const result = await offlineStore.deletePaymentDraft(
        userId,
        groupId,
        target
      );
      return result.ok
        ? { ok: true, data: undefined }
        : storageFailure(result.message);
    },
    []
  );

  const updatePayment = useCallback(
    async (paymentId: string, version: number, input: PaymentInput) => {
      if (!remoteMutationAllowed()) return unavailableMutation();
      const client = getSupabaseClient();
      if (!client || !snapshotRef.current) return missingGroup();
      return finishMutation(
        await updatePaymentRemote(client, paymentId, version, input)
      );
    },
    [finishMutation, remoteMutationAllowed]
  );

  const deletePayment = useCallback(
    async (paymentId: string, version: number) => {
      if (!remoteMutationAllowed()) return unavailableMutation();
      const client = getSupabaseClient();
      if (!client || !snapshotRef.current) return missingGroup();
      return finishMutation(await deletePaymentRemote(client, paymentId, version));
    },
    [finishMutation, remoteMutationAllowed]
  );

  const recordTransfer = useCallback(
    async (settlement: Settlement) => {
      if (!remoteMutationAllowed()) return unavailableMutation();
      const client = getSupabaseClient();
      const current = snapshotRef.current;
      if (!client || !current) return missingGroup();
      return finishMutation(
        await recordTransferRemote(
          client,
          current.group.id,
          current.group.revision,
          settlement
        )
      );
    },
    [finishMutation, remoteMutationAllowed]
  );

  const deleteTransfer = useCallback(
    async (transferId: string, version: number) => {
      if (!remoteMutationAllowed()) return unavailableMutation();
      const client = getSupabaseClient();
      if (!client || !snapshotRef.current) return missingGroup();
      return finishMutation(await deleteTransferRemote(client, transferId, version));
    },
    [finishMutation, remoteMutationAllowed]
  );

  const changeMyMember = useCallback(
    async (memberId: string) => {
      if (!remoteMutationAllowed()) return unavailableMutation();
      const client = getSupabaseClient();
      const current = snapshotRef.current;
      if (!client || !current) return missingGroup();
      return finishMutation(
        await changeMyMemberRemote(client, current.group.id, memberId)
      );
    },
    [finishMutation, remoteMutationAllowed]
  );

  const rotateInvite = useCallback(async (): Promise<MutationResult<string>> => {
    if (!remoteMutationAllowed()) return unavailableMutation();
    const client = getSupabaseClient();
    const current = snapshotRef.current;
    if (!client || !current) return missingGroup();
    const result = await rotateInviteRemote(client, current.group.id);
    if (!result.ok) {
      markConnectionFailure(result);
      setLastError(result.message);
      return result;
    }
    storeInviteToken(current.group.id, result.data);
    await refreshGroup();
    return { ok: true, data: inviteLink(result.data) };
  }, [markConnectionFailure, refreshGroup, remoteMutationAllowed]);

  const getInviteLink = useCallback(async (): Promise<MutationResult<string>> => {
    if (!remoteMutationAllowed()) return unavailableMutation();
    const current = snapshotRef.current;
    if (!current) return missingGroup();
    if (current.group.role !== "owner") {
      return {
        ok: false,
        code: "forbidden",
        message: "招待リンクはグループ作成者だけが管理できます。",
      };
    }
    if (!current.group.inviteEnabled) {
      return {
        ok: false,
        code: "validation",
        message: "招待リンクが停止されています。先に招待を有効にしてください。",
      };
    }
    const token = readInviteToken(current.group.id);
    return token
      ? { ok: true, data: inviteLink(token) }
      : rotateInvite();
  }, [remoteMutationAllowed, rotateInvite]);

  const setInviteEnabled = useCallback(
    async (enabled: boolean) => {
      if (!remoteMutationAllowed()) return unavailableMutation();
      const client = getSupabaseClient();
      const current = snapshotRef.current;
      if (!client || !current) return missingGroup();
      return finishMutation(
        await setInviteEnabledRemote(client, current.group.id, enabled)
      );
    },
    [finishMutation, remoteMutationAllowed]
  );

  const inspectOfflineGroupData = useCallback(async (
    requestedGroupId?: string
  ): Promise<MutationResult<OfflineGroupDataSummary>> => {
    const groupId =
      requestedGroupId ??
      snapshotRef.current?.group.id ??
      activeGroupIdRef.current;
    const userId = currentOfflineUserId();
    if (!groupId || !userId) return missingGroup();

    const [cached, drafts, pending] = await Promise.all([
      offlineStore.readCachedSnapshot(userId, groupId),
      offlineStore.listPaymentDrafts(userId, groupId),
      offlineStore.listPendingPayments(userId, groupId),
    ]);
    const failed = [cached, drafts, pending].find((result) => !result.ok);
    if (failed && !failed.ok) return storageFailure(failed.message);

    return {
      ok: true,
      data: {
        cachedSnapshotCount: cached.ok && cached.data ? 1 : 0,
        draftCount: drafts.ok ? drafts.data.length : 0,
        pendingCount: pending.ok ? pending.data.length : 0,
      },
    };
  }, []);

  const deleteOfflineGroupData = useCallback(async (
    requestedGroupId?: string
  ): Promise<MutationResult> => {
    const groupId =
      requestedGroupId ??
      snapshotRef.current?.group.id ??
      activeGroupIdRef.current;
    const userId = currentOfflineUserId();
    if (!groupId || !userId) return missingGroup();
    const result = await offlineStore.deleteGroupData(userId, groupId);
    if (!result.ok) return storageFailure(result.message);
    const deletingDisplayedGroup =
      snapshotRef.current?.group.id === groupId ||
      activeGroupIdRef.current === groupId;
    if (deletingDisplayedGroup || snapshotRef.current === null) {
      pendingStateRequestVersionRef.current += 1;
      setPendingPayments([]);
    }
    await refreshOfflineCacheAvailability(userId);
    if (deletingDisplayedGroup && snapshotSourceRef.current === "cache") {
      invalidatePendingGroupRequests();
      applySnapshot(null);
      setGroupStatus("idle");
    }
    if (offlineModeRef.current && authUserIdRef.current === null) {
      await recoverAuthenticatedSession();
    }
    return { ok: true, data: undefined };
  }, [
    applySnapshot,
    invalidatePendingGroupRequests,
    recoverAuthenticatedSession,
    refreshOfflineCacheAvailability,
  ]);

  const deleteSharedGroup = useCallback(async (): Promise<MutationResult> => {
    if (!remoteMutationAllowed()) return unavailableMutation();
    const client = getSupabaseClient();
    const current = snapshotRef.current;
    if (!client || !current) return missingGroup();
    const result = await deleteSharedGroupRemote(client, current.group.id);
    if (result.ok) {
      const userId = currentOfflineUserId();
      if (userId) {
        cacheDeniedScopesRef.current.add(
          offlineGroupScopeKey(userId, current.group.id)
        );
      }
      removeInviteToken(current.group.id);
      removeRecentGroup(localStorage, current.group.id);
      let cleanupMessage: string | null = null;
      if (userId) {
        const deniedLocalCache = await offlineStore.denyCachedGroup(
          userId,
          current.group.id
        );
        const deletedLocalData = await offlineStore.deleteGroupData(
          userId,
          current.group.id
        );
        if (!deletedLocalData.ok && !deniedLocalCache.ok) {
          cleanupMessage =
            "グループは削除しましたが、この端末の保存データを削除できず、次回起動後の利用停止も保存できませんでした。再起動前に端末データの削除を再試行してください。";
        } else if (!deletedLocalData.ok) {
          cleanupMessage =
            "グループは削除しましたが、この端末の保存データを削除できませんでした。キャッシュの再利用は停止しています。内容を確認して、端末データの削除を再試行してください。";
        }
        await refreshOfflineCacheAvailability(userId);
      }
      if (activeGroupIdRef.current === current.group.id) {
        invalidatePendingGroupRequests();
        applySnapshot(null);
        setCacheFallbackAvailable(false);
        if (cleanupMessage) {
          setGroupStatus("error");
          setGroupErrorCode("forbidden");
          setRemoteStatus("error");
          setLastError(cleanupMessage);
        } else {
          setPendingPayments([]);
          setGroupStatus("idle");
          setGroupErrorCode(null);
        }
      }
      if (cleanupMessage) {
        return { ok: false, code: "unknown", message: cleanupMessage };
      }
    } else if (activeGroupIdRef.current === current.group.id) {
      markConnectionFailure(result);
      setLastError(result.message);
    }
    return result;
  }, [
    applySnapshot,
    invalidatePendingGroupRequests,
    markConnectionFailure,
    remoteMutationAllowed,
    refreshOfflineCacheAvailability,
  ]);

  const clearCurrentGroup = useCallback(() => {
    invalidatePendingGroupRequests();
    applySnapshot(null);
    setPendingPayments([]);
    setGroupStatus("idle");
    setSyncStatus(navigator.onLine ? "connecting" : "offline");
    setRemoteStatus("idle");
    setCacheFallbackAvailable(false);
    setLastError(null);
    setGroupErrorCode(null);
  }, [applySnapshot, invalidatePendingGroupRequests]);

  return (
    <GroupContext.Provider
      value={{
        authStatus,
        authError,
        authUserId,
        offlineDataUserId,
        authRecoveryRequired,
        offlineMode,
        hasOfflineCache,
        offlinePendingRecovery,
        offlineFallbackAvailable,
        groupStatus,
        syncStatus,
        remoteStatus,
        snapshotSource,
        snapshot,
        cachedAt,
        cacheFallbackAvailable,
        pendingPayments,
        lastError,
        groupErrorCode,
        authenticate,
        continueOffline,
        loadGroup,
        loadCachedGroup,
        refreshGroup,
        syncPendingPayments,
        clearCurrentGroup,
        createSharedGroup,
        inspectInvite,
        joinSharedGroup,
        addPayment,
        updatePendingPayment,
        discardPendingPayment,
        readPaymentDraft,
        savePaymentDraft,
        deletePaymentDraft,
        updatePayment,
        deletePayment,
        recordTransfer,
        deleteTransfer,
        changeMyMember,
        getInviteLink,
        rotateInvite,
        setInviteEnabled,
        deleteSharedGroup,
        inspectOfflineGroupData,
        deleteOfflineGroupData,
      }}
    >
      {children}
    </GroupContext.Provider>
  );
};

export const useGroup = () => {
  const context = useContext(GroupContext);
  if (!context) {
    throw new Error("useGroup must be used within a GroupProvider");
  }
  return context;
};
