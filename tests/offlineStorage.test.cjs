const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  const resolvedRequest = request.startsWith("@/")
    ? path.join(__dirname, "..", "src", request.slice(2))
    : request;
  return originalResolveFilename.call(
    this,
    resolvedRequest,
    parent,
    isMain,
    options
  );
};

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
  canReplaceDeniedCachedSnapshot,
  createOfflineStore,
  createQueuedPendingPayment,
  isPendingPaymentEditable,
  parseCachedGroupDenial,
  parseCachedSnapshotEnvelope,
  parseOfflineAuthProfile,
  parsePaymentDraft,
  parsePendingPayment,
  sortCachedSnapshotsByRecency,
  sortPendingPayments,
  selectCachedSnapshotForStorage,
} = require("../src/lib/offlineStorage.ts");

const snapshot = {
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
  payments: [],
  transfers: [],
};

const snapshotEnvelope = (overrides = {}) => ({
  version: 1,
  authUserId: "user-1",
  groupId: "group-1",
  cachedAt: "2026-08-01T00:00:00.000Z",
  snapshot,
  ...overrides,
});

const draft = (overrides = {}) => ({
  version: 1,
  authUserId: "user-1",
  groupId: "group-1",
  target: { kind: "new" },
  input: {
    title: "",
    payerMemberId: "",
    amount: "",
    beneficiaryMemberIds: [],
  },
  updatedAt: "2026-08-01T00:00:00.000Z",
  ...overrides,
});

const pendingInput = (operationId, createdAt) => ({
  authUserId: "user-1",
  groupId: "group-1",
  operationId,
  input: {
    title: "ホテル代",
    payerMemberId: "member-a",
    amount: 12000,
    beneficiaryMemberIds: ["member-a", "member-b"],
  },
  createdAt,
});

const operationId = (suffix) =>
  `10000000-0000-4000-8000-${suffix.padStart(12, "0")}`;

test("所有者とグループが一致する検証済みsnapshotだけ受け入れる", () => {
  const value = snapshotEnvelope();
  assert.deepEqual(
    parseCachedSnapshotEnvelope(value, {
      authUserId: "user-1",
      groupId: "group-1",
    }),
    value
  );
  assert.equal(
    parseCachedSnapshotEnvelope(value, {
      authUserId: "different-user",
      groupId: "group-1",
    }),
    null
  );
  assert.equal(
    parseCachedSnapshotEnvelope(
      snapshotEnvelope({ groupId: "different-group" })
    ),
    null
  );
  assert.equal(
    parseCachedSnapshotEnvelope(
      snapshotEnvelope({
        snapshot: {
          ...snapshot,
          group: { ...snapshot.group, currentMemberId: "missing" },
        },
      })
    ),
    null
  );
});

test("cache利用禁止情報は所有者と日時が一致する場合だけ受け入れる", () => {
  const denial = {
    version: 1,
    authUserId: "user-1",
    groupId: "group-1",
    denialId: "10000000-0000-4000-8000-000000000099",
    deniedAt: "2026-08-01T00:00:00.000Z",
  };
  assert.deepEqual(
    parseCachedGroupDenial(denial, {
      authUserId: "user-1",
      groupId: "group-1",
    }),
    denial
  );
  assert.equal(
    parseCachedGroupDenial(denial, {
      authUserId: "different-user",
      groupId: "group-1",
    }),
    null
  );
  assert.equal(
    parseCachedGroupDenial({ ...denial, deniedAt: "invalid" }),
    null
  );
  assert.equal(
    canReplaceDeniedCachedSnapshot(denial, denial.denialId),
    true
  );
  assert.equal(
    canReplaceDeniedCachedSnapshot(
      denial,
      "10000000-0000-4000-8000-000000000098"
    ),
    false
  );
  assert.equal(canReplaceDeniedCachedSnapshot(denial), false);
  assert.equal(canReplaceDeniedCachedSnapshot(null), true);
});

test("未知versionと破損した端末データを拒否する", () => {
  assert.equal(parseOfflineAuthProfile({ version: 2 }), null);
  assert.equal(
    parseCachedSnapshotEnvelope(snapshotEnvelope({ version: 2 })),
    null
  );
  assert.equal(parsePaymentDraft(draft({ version: 2 })), null);

  const pending = createQueuedPendingPayment(
    pendingInput(operationId("1"), "2026-08-01T00:00:00.000Z"),
    "2026-08-01T00:00:00.000Z"
  );
  assert.ok(pending);
  assert.equal(parsePendingPayment({ ...pending, version: 2 }), null);
  assert.equal(
    parsePendingPayment({ ...pending, operationId: "not-a-uuid" }),
    null
  );
  assert.equal(
    parsePendingPayment({
      ...pending,
      input: { ...pending.input, amount: Number.MAX_SAFE_INTEGER + 1 },
    }),
    null
  );
});

test("新規と編集の入力下書きを区別し、不完全な入力値も保持する", () => {
  assert.deepEqual(parsePaymentDraft(draft()), draft());

  const editDraft = draft({
    target: {
      kind: "edit",
      paymentId: "payment-1",
      baseVersion: 3,
    },
    input: {
      title: "入力途中",
      payerMemberId: "member-a",
      amount: "12.",
      beneficiaryMemberIds: ["member-a"],
    },
  });
  assert.deepEqual(parsePaymentDraft(editDraft), editDraft);
  assert.equal(
    parsePaymentDraft(
      draft({
        target: {
          kind: "edit",
          paymentId: "payment-1",
          baseVersion: 0,
        },
      })
    ),
    null
  );
});

test("queuedだけを編集可能とし全同期状態を検証する", () => {
  const queued = createQueuedPendingPayment(
    pendingInput(operationId("1"), "2026-08-01T00:00:00.000Z"),
    "2026-08-01T00:00:00.000Z"
  );
  assert.ok(queued);

  for (const status of [
    "queued",
    "sending",
    "retry",
    "committed",
    "blocked",
  ]) {
    const value = parsePendingPayment({ ...queued, status });
    assert.ok(value);
    assert.equal(isPendingPaymentEditable(value), status === "queued");
  }
  assert.equal(
    parsePendingPayment(queued, {
      authUserId: "different-user",
      groupId: "group-1",
    }),
    null
  );
});

test("snapshotは新しい順、未同期支払いは作成順に決定的に並べる", () => {
  const cached = [
    snapshotEnvelope({
      groupId: "group-b",
      cachedAt: "2026-08-01T01:00:00.000Z",
      snapshot: {
        ...snapshot,
        group: { ...snapshot.group, id: "group-b" },
      },
    }),
    snapshotEnvelope({ cachedAt: "2026-08-01T02:00:00.000Z" }),
  ].map((value) => parseCachedSnapshotEnvelope(value));
  assert.ok(cached.every(Boolean));
  assert.deepEqual(
    sortCachedSnapshotsByRecency(cached).map((value) => value.groupId),
    ["group-1", "group-b"]
  );

  const pending = [
    pendingInput(operationId("11"), "2026-08-01T02:00:00.000Z"),
    pendingInput(operationId("12"), "2026-08-01T01:00:00.000Z"),
    pendingInput(operationId("10"), "2026-08-01T02:00:00.000Z"),
  ].map((value) =>
    createQueuedPendingPayment(value, "2026-08-01T00:00:00.000Z")
  );
  assert.ok(pending.every(Boolean));
  assert.deepEqual(
    sortPendingPayments(pending).map((value) => value.operationId),
    [operationId("12"), operationId("10"), operationId("11")]
  );
});

test("古いrevisionのsnapshotで新しい端末キャッシュを上書きしない", () => {
  const newer = parseCachedSnapshotEnvelope(
    snapshotEnvelope({
      cachedAt: "2026-08-01T02:00:00.000Z",
      snapshot: {
        ...snapshot,
        group: { ...snapshot.group, revision: 3 },
      },
    })
  );
  const older = parseCachedSnapshotEnvelope(
    snapshotEnvelope({
      cachedAt: "2026-08-01T03:00:00.000Z",
      snapshot: {
        ...snapshot,
        group: { ...snapshot.group, revision: 2 },
      },
    })
  );
  assert.ok(newer);
  assert.ok(older);
  assert.equal(selectCachedSnapshotForStorage(newer, older), newer);
  assert.equal(selectCachedSnapshotForStorage(older, newer), newer);
  assert.equal(selectCachedSnapshotForStorage(newer, older, true), older);
});

test("IndexedDB非対応とopen失敗をthrowせず型付き失敗で返す", async () => {
  const unavailableStore = createOfflineStore({
    factory: null,
    now: () => "2026-08-01T00:00:00.000Z",
  });
  const unavailable = await unavailableStore.rememberAuthProfile("user-1");
  assert.equal(unavailable.ok, false);
  assert.equal(unavailable.code, "unavailable");

  const invalid = await unavailableStore.readCachedSnapshot("", "group-1");
  assert.equal(invalid.ok, false);
  assert.equal(invalid.code, "invalid_data");

  const throwingStore = createOfflineStore({
    factory: {
      open: () => {
        throw new Error("open failed");
      },
    },
  });
  const failed = await throwingStore.readLastAuthProfile();
  assert.equal(failed.ok, false);
  assert.equal(failed.code, "storage_error");
});
