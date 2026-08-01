const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filename,
  });
  module._compile(outputText, filename);
};

const {
  syncPendingPaymentQueue,
} = require("../src/lib/pendingPaymentSync.ts");

const pending = (operationId, createdAt, status = "queued") => ({
  version: 1,
  authUserId: "user-1",
  groupId: "group-1",
  operationId,
  input: {
    title: operationId,
    payerMemberId: "member-a",
    amount: 100,
    beneficiaryMemberIds: ["member-a", "member-b"],
  },
  status,
  attemptCount: 0,
  createdAt,
  updatedAt: createdAt,
});

const snapshotWith = (...paymentIds) => ({
  group: {
    id: "group-1",
    name: "旅行",
    revision: 1,
    role: "owner",
    currentMemberId: "member-a",
    inviteEnabled: true,
  },
  members: [
    { id: "member-a", name: "A", position: 0 },
    { id: "member-b", name: "B", position: 1 },
  ],
  payments: paymentIds.map((id) => ({
    id,
    title: id,
    payerMemberId: "member-a",
    amount: 100,
    beneficiaryMemberIds: ["member-a", "member-b"],
    version: 1,
    createdByMemberId: "member-a",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  })),
  transfers: [],
});

const updatedPending = (payment, update) => ({
  ...payment,
  ...update,
  updatedAt: "2026-08-01T00:02:00.000Z",
});

test("未同期支払いを作成日時順に送信し反映確認後に削除する", async () => {
  const sent = [];
  const deleted = [];
  const updates = [];
  const first = pending("op-1", "2026-08-01T00:00:00.000Z");
  const second = pending("op-2", "2026-08-01T00:01:00.000Z");
  const serverIds = [];
  const outcome = await syncPendingPaymentQueue([second, first], {
    createPayment: async (payment) => {
      sent.push(payment.operationId);
      const id = `server-${payment.operationId}`;
      serverIds.push(id);
      return { ok: true, data: id };
    },
    refreshSnapshot: async () => ({
      ok: true,
      data: snapshotWith(...serverIds),
    }),
    updatePending: async (payment, update) => {
      updates.push([payment.operationId, update.status]);
      return updatedPending(payment, update);
    },
    deletePending: async (payment) => {
      deleted.push(payment.operationId);
      return true;
    },
  });

  assert.equal(outcome, "synced");
  assert.deepEqual(sent, ["op-1", "op-2"]);
  assert.deepEqual(deleted, ["op-1", "op-2"]);
  assert.deepEqual(
    updates.filter(([, status]) => status === "sending").map(([id]) => id),
    ["op-1", "op-2"]
  );
});

test("通信失敗では同じ操作を再試行待ちとして保持する", async () => {
  const item = pending("op-retry", "2026-08-01T00:00:00.000Z");
  const updates = [];
  const outcome = await syncPendingPaymentQueue([item], {
    createPayment: async () => ({
      ok: false,
      code: "unavailable",
      message: "接続できません",
    }),
    refreshSnapshot: async () => {
      throw new Error("refresh should not run");
    },
    updatePending: async (_payment, update) => {
      updates.push(update);
      return updatedPending(item, update);
    },
    deletePending: async () => false,
  });

  assert.equal(outcome, "retry");
  assert.equal(updates.at(-1).status, "retry");
  assert.equal(updates.at(-1).lastError, "接続できません");
});

test("送信状態を確保した時点の最新入力だけを登録する", async () => {
  const listed = pending("op-latest", "2026-08-01T00:00:00.000Z");
  const latestInput = {
    ...listed.input,
    title: "修正後の内容",
    amount: 250,
  };
  let sentInput;

  const outcome = await syncPendingPaymentQueue([listed], {
    createPayment: async (payment) => {
      sentInput = payment.input;
      return { ok: true, data: "server-latest" };
    },
    refreshSnapshot: async () => ({
      ok: true,
      data: snapshotWith("server-latest"),
    }),
    updatePending: async (payment, update) =>
      updatedPending(
        { ...payment, input: latestInput },
        update
      ),
    deletePending: async () => true,
  });

  assert.equal(outcome, "synced");
  assert.deepEqual(sentInput, latestInput);
});

test("入力エラーでは自動同期を停止する", async () => {
  const item = pending("op-blocked", "2026-08-01T00:00:00.000Z");
  let lastUpdate;
  const outcome = await syncPendingPaymentQueue([item], {
    createPayment: async () => ({
      ok: false,
      code: "validation",
      message: "入力を確認してください",
    }),
    refreshSnapshot: async () => {
      throw new Error("refresh should not run");
    },
    updatePending: async (payment, update) => {
      lastUpdate = update;
      return updatedPending(payment, update);
    },
    deletePending: async () => false,
  });

  assert.equal(outcome, "blocked");
  assert.equal(lastUpdate.status, "blocked");
});

test("登録済み操作は再作成せず最新snapshotだけで確認する", async () => {
  const item = {
    ...pending("op-committed", "2026-08-01T00:00:00.000Z", "committed"),
    serverPaymentId: "server-payment",
  };
  let createCount = 0;
  let deleteCount = 0;
  const outcome = await syncPendingPaymentQueue([item], {
    createPayment: async () => {
      createCount += 1;
      return { ok: true, data: "unexpected" };
    },
    refreshSnapshot: async () => ({
      ok: true,
      data: snapshotWith("server-payment"),
    }),
    updatePending: async (payment, update) =>
      updatedPending(payment, update),
    deletePending: async () => {
      deleteCount += 1;
      return true;
    },
  });

  assert.equal(outcome, "synced");
  assert.equal(createCount, 0);
  assert.equal(deleteCount, 1);
});

test("端末キューの更新に失敗した場合は送信を開始しない", async () => {
  const item = pending("op-storage", "2026-08-01T00:00:00.000Z");
  let createCount = 0;
  const outcome = await syncPendingPaymentQueue([item], {
    createPayment: async () => {
      createCount += 1;
      return { ok: true, data: "server-payment" };
    },
    refreshSnapshot: async () => ({
      ok: true,
      data: snapshotWith("server-payment"),
    }),
    updatePending: async () => null,
    deletePending: async () => false,
  });

  assert.equal(outcome, "storage_error");
  assert.equal(createCount, 0);
});

test("作成RPCが例外になっても再試行待ちへ戻す", async () => {
  const item = pending("op-throw", "2026-08-01T00:00:00.000Z");
  const updates = [];
  const outcome = await syncPendingPaymentQueue([item], {
    createPayment: async () => {
      throw new Error("network aborted");
    },
    refreshSnapshot: async () => {
      throw new Error("refresh should not run");
    },
    updatePending: async (payment, update) => {
      updates.push(update);
      return updatedPending(payment, update);
    },
    deletePending: async () => false,
  });

  assert.equal(outcome, "retry");
  assert.equal(updates.at(-1).status, "retry");
});

test("登録済み操作の確認取得が例外でもcommittedを保持する", async () => {
  const item = {
    ...pending("op-confirm-throw", "2026-08-01T00:00:00.000Z", "committed"),
    serverPaymentId: "server-payment",
  };
  let deleteCount = 0;
  const outcome = await syncPendingPaymentQueue([item], {
    createPayment: async () => {
      throw new Error("create should not run");
    },
    refreshSnapshot: async () => {
      throw new Error("network aborted");
    },
    updatePending: async (payment, update) =>
      updatedPending(payment, update),
    deletePending: async () => {
      deleteCount += 1;
      return true;
    },
  });

  assert.equal(outcome, "retry");
  assert.equal(deleteCount, 0);
});
