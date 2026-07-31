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
  PaymentInput,
  Settlement,
} from "@/types";
import { removeRecentGroup, storeRecentGroup } from "@/lib/validation";
import { getSupabaseClient } from "@/lib/supabase";
import {
  addPayment as addPaymentRemote,
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

const inviteLink = (token: string) =>
  `${window.location.origin}/join/${encodeURIComponent(token)}`;

export const GroupProvider = ({ children }: { children: ReactNode }) => {
  const [authStatus, setAuthStatus] =
    useState<GroupContextType["authStatus"]>("checking");
  const [authError, setAuthError] = useState<string | null>(null);
  const [groupStatus, setGroupStatus] =
    useState<GroupContextType["groupStatus"]>("idle");
  const [syncStatus, setSyncStatus] =
    useState<GroupContextType["syncStatus"]>("connecting");
  const [snapshot, setSnapshot] = useState<GroupSnapshot | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const snapshotRef = useRef<GroupSnapshot | null>(null);
  const activeGroupIdRef = useRef<string | null>(null);
  const groupRequestVersionRef = useRef(0);

  const applySnapshot = useCallback((nextSnapshot: GroupSnapshot | null) => {
    snapshotRef.current = nextSnapshot;
    activeGroupIdRef.current = nextSnapshot?.group.id ?? null;
    setSnapshot(nextSnapshot);
  }, []);

  const invalidatePendingGroupRequests = useCallback(() => {
    groupRequestVersionRef.current += 1;
  }, []);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) {
      setAuthStatus("misconfigured");
      setAuthError("Supabaseの接続情報を設定してください。");
      return;
    }

    let active = true;
    void client.auth.getSession().then(({ data, error }) => {
      if (!active) {
        return;
      }
      if (error) {
        setAuthStatus("error");
        setAuthError("認証状態を確認できませんでした。");
      } else {
        setAuthStatus(data.session ? "ready" : "needs_captcha");
      }
    });

    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      if (active) {
        setAuthStatus(session ? "ready" : "needs_captcha");
        if (!session) {
          invalidatePendingGroupRequests();
          applySnapshot(null);
          setGroupStatus("idle");
        }
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [applySnapshot, invalidatePendingGroupRequests]);

  const authenticate = useCallback(
    async (captchaToken: string): Promise<MutationResult> => {
      const client = getSupabaseClient();
      if (!client) {
        setAuthStatus("misconfigured");
        return missingClient();
      }

      setAuthStatus("signing_in");
      setAuthError(null);
      const { data, error } = await client.auth.signInAnonymously({
        options: { captchaToken },
      });
      if (error || !data.session) {
        const message =
          error?.code === "captcha_failed"
            ? "認証チェックに失敗しました。もう一度お試しください。"
            : "匿名ユーザーを作成できませんでした。";
        setAuthStatus("needs_captcha");
        setAuthError(message);
        return { ok: false, code: "unknown", message };
      }

      setAuthStatus("ready");
      return { ok: true, data: undefined };
    },
    []
  );

  const loadGroup = useCallback(
    async (groupId: string): Promise<MutationResult<GroupSnapshot>> => {
      const requestVersion = groupRequestVersionRef.current + 1;
      groupRequestVersionRef.current = requestVersion;
      activeGroupIdRef.current = groupId;

      const client = getSupabaseClient();
      if (!client) {
        setGroupStatus("error");
        return missingClient();
      }

      setGroupStatus("loading");
      setLastError(null);
      const result = await fetchGroupSnapshot(client, groupId);
      if (
        groupRequestVersionRef.current !== requestVersion ||
        activeGroupIdRef.current !== groupId
      ) {
        return result;
      }

      if (result.ok) {
        applySnapshot(result.data);
        setGroupStatus("ready");
        storeRecentGroup(localStorage, {
          groupId: result.data.group.id,
          groupName: result.data.group.name,
        });
      } else {
        applySnapshot(null);
        setGroupStatus("error");
        setLastError(result.message);
        if (result.code === "forbidden") {
          removeRecentGroup(localStorage, groupId);
        }
      }
      return result;
    },
    [applySnapshot]
  );

  const refreshGroup = useCallback(async (): Promise<
    MutationResult<GroupSnapshot>
  > => {
    const currentSnapshot = snapshotRef.current;
    const client = getSupabaseClient();
    if (!currentSnapshot) {
      return missingGroup();
    }
    if (activeGroupIdRef.current !== currentSnapshot.group.id) {
      return missingGroup();
    }
    const requestVersion = groupRequestVersionRef.current + 1;
    groupRequestVersionRef.current = requestVersion;
    if (!client) {
      return missingClient();
    }
    if (!navigator.onLine) {
      setSyncStatus("offline");
      return {
        ok: false,
        code: "offline",
        message: "オフライン中は最新データを取得できません。",
      };
    }

    setSyncStatus("connecting");
    const result = await fetchGroupSnapshot(client, currentSnapshot.group.id);
    const latestSnapshot = snapshotRef.current;
    if (
      groupRequestVersionRef.current !== requestVersion ||
      activeGroupIdRef.current !== currentSnapshot.group.id ||
      latestSnapshot?.group.id !== currentSnapshot.group.id
    ) {
      return result;
    }

    if (result.ok) {
      if (
        result.data.group.id !== currentSnapshot.group.id ||
        result.data.group.revision < latestSnapshot.group.revision
      ) {
        return result;
      }

      applySnapshot(result.data);
      setGroupStatus("ready");
      setSyncStatus("connected");
      setLastError(null);
      storeRecentGroup(localStorage, {
        groupId: result.data.group.id,
        groupName: result.data.group.name,
      });
    } else {
      if (latestSnapshot.group.revision > currentSnapshot.group.revision) {
        return result;
      }

      setLastError(result.message);
      if (result.code === "forbidden") {
        removeRecentGroup(localStorage, currentSnapshot.group.id);
        invalidatePendingGroupRequests();
        applySnapshot(null);
        setGroupStatus("error");
      } else {
        setSyncStatus("reconnecting");
      }
    }
    return result;
  }, [applySnapshot, invalidatePendingGroupRequests]);

  useEffect(() => {
    const groupId = snapshot?.group.id;
    const client = getSupabaseClient();
    if (!groupId || !client || authStatus !== "ready") {
      return;
    }

    setSyncStatus(navigator.onLine ? "connecting" : "offline");
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
          setSyncStatus("connected");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setSyncStatus(navigator.onLine ? "reconnecting" : "offline");
        }
      });

    return () => {
      void client.removeChannel(channel);
    };
  }, [authStatus, refreshGroup, snapshot?.group.id]);

  useEffect(() => {
    const handleOffline = () => setSyncStatus("offline");
    const handleOnline = () => {
      setSyncStatus("reconnecting");
      if (snapshotRef.current) {
        void refreshGroup();
      }
    };
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [refreshGroup]);

  const finishMutation = useCallback(
    async (result: MutationResult): Promise<MutationResult> => {
      if (result.ok || result.code === "conflict") {
        await refreshGroup();
      }
      if (!result.ok) {
        setLastError(result.message);
      }
      return result;
    },
    [refreshGroup]
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
      }
      return result;
    },
    []
  );

  const inspectInvite = useCallback(
    async (token: string): Promise<MutationResult<InvitePreview>> => {
      const client = getSupabaseClient();
      return client ? inspectInviteRemote(client, token) : missingClient();
    },
    []
  );

  const joinSharedGroup = useCallback(async (token: string, memberId: string) => {
    const client = getSupabaseClient();
    return client
      ? joinSharedGroupRemote(client, token, memberId)
      : missingClient<{ groupId: string }>();
  }, []);

  const addPayment = useCallback(
    async (input: PaymentInput) => {
      const client = getSupabaseClient();
      const current = snapshotRef.current;
      if (!client) return missingClient();
      if (!current) return missingGroup();
      return finishMutation(
        await addPaymentRemote(client, current.group.id, input)
      );
    },
    [finishMutation]
  );

  const updatePayment = useCallback(
    async (paymentId: string, version: number, input: PaymentInput) => {
      const client = getSupabaseClient();
      if (!client) return missingClient();
      if (!snapshotRef.current) return missingGroup();
      return finishMutation(
        await updatePaymentRemote(client, paymentId, version, input)
      );
    },
    [finishMutation]
  );

  const deletePayment = useCallback(
    async (paymentId: string, version: number) => {
      const client = getSupabaseClient();
      if (!client) return missingClient();
      if (!snapshotRef.current) return missingGroup();
      return finishMutation(
        await deletePaymentRemote(client, paymentId, version)
      );
    },
    [finishMutation]
  );

  const recordTransfer = useCallback(
    async (settlement: Settlement) => {
      const client = getSupabaseClient();
      const current = snapshotRef.current;
      if (!client) return missingClient();
      if (!current) return missingGroup();
      return finishMutation(
        await recordTransferRemote(
          client,
          current.group.id,
          current.group.revision,
          settlement
        )
      );
    },
    [finishMutation]
  );

  const deleteTransfer = useCallback(
    async (transferId: string, version: number) => {
      const client = getSupabaseClient();
      if (!client) return missingClient();
      if (!snapshotRef.current) return missingGroup();
      return finishMutation(
        await deleteTransferRemote(client, transferId, version)
      );
    },
    [finishMutation]
  );

  const changeMyMember = useCallback(
    async (memberId: string) => {
      const client = getSupabaseClient();
      const current = snapshotRef.current;
      if (!client) return missingClient();
      if (!current) return missingGroup();
      return finishMutation(
        await changeMyMemberRemote(client, current.group.id, memberId)
      );
    },
    [finishMutation]
  );

  const rotateInvite = useCallback(async (): Promise<MutationResult<string>> => {
    const client = getSupabaseClient();
    const current = snapshotRef.current;
    if (!client) return missingClient();
    if (!current) return missingGroup();
    const result = await rotateInviteRemote(client, current.group.id);
    if (!result.ok) {
      setLastError(result.message);
      return result;
    }
    storeInviteToken(current.group.id, result.data);
    await refreshGroup();
    return { ok: true, data: inviteLink(result.data) };
  }, [refreshGroup]);

  const getInviteLink = useCallback(async (): Promise<MutationResult<string>> => {
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
  }, [rotateInvite]);

  const setInviteEnabled = useCallback(
    async (enabled: boolean) => {
      const client = getSupabaseClient();
      const current = snapshotRef.current;
      if (!client) return missingClient();
      if (!current) return missingGroup();
      return finishMutation(
        await setInviteEnabledRemote(client, current.group.id, enabled)
      );
    },
    [finishMutation]
  );

  const deleteSharedGroup = useCallback(async () => {
    const client = getSupabaseClient();
    const current = snapshotRef.current;
    if (!client) return missingClient();
    if (!current) return missingGroup();
    const result = await deleteSharedGroupRemote(client, current.group.id);
    if (result.ok) {
      removeInviteToken(current.group.id);
      removeRecentGroup(localStorage, current.group.id);
      if (activeGroupIdRef.current === current.group.id) {
        invalidatePendingGroupRequests();
        applySnapshot(null);
        setGroupStatus("idle");
      }
    } else if (activeGroupIdRef.current === current.group.id) {
      setLastError(result.message);
    }
    return result;
  }, [applySnapshot, invalidatePendingGroupRequests]);

  const clearCurrentGroup = useCallback(() => {
    invalidatePendingGroupRequests();
    applySnapshot(null);
    setGroupStatus("idle");
    setLastError(null);
  }, [applySnapshot, invalidatePendingGroupRequests]);

  return (
    <GroupContext.Provider
      value={{
        authStatus,
        authError,
        groupStatus,
        syncStatus,
        snapshot,
        lastError,
        authenticate,
        loadGroup,
        refreshGroup,
        clearCurrentGroup,
        createSharedGroup,
        inspectInvite,
        joinSharedGroup,
        addPayment,
        updatePayment,
        deletePayment,
        recordTransfer,
        deleteTransfer,
        changeMyMember,
        getInviteLink,
        rotateInvite,
        setInviteEnabled,
        deleteSharedGroup,
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
