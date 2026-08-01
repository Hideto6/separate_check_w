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
  canContinueWithOfflineData,
  mergeRecoveryPaymentsForGroup,
  pendingPaymentsAsText,
  recoveryPaymentsForUser,
} = require("../src/lib/offlineRecovery.ts");

const pendingPayment = ({
  authUserId = "user-1",
  groupId = "group-1",
  operationId = "10000000-0000-4000-8000-000000000001",
  createdAt = "2026-08-01T00:00:00.000Z",
} = {}) => ({
  version: 1,
  authUserId,
  groupId,
  operationId,
  input: {
    title: "ホテル代",
    payerMemberId: "member-a",
    amount: 12000,
    beneficiaryMemberIds: ["member-a", "member-b"],
  },
  status: "queued",
  attemptCount: 0,
  createdAt,
  updatedAt: createdAt,
});

test("cacheがなくても同じユーザーの未同期支払いがあれば回避できる", () => {
  const recovery = {
    authUserId: "user-1",
    pendingPayments: [pendingPayment()],
  };
  assert.equal(canContinueWithOfflineData(false, "user-1", recovery), true);
  assert.equal(canContinueWithOfflineData(false, "user-2", recovery), false);
  assert.equal(canContinueWithOfflineData(false, null, recovery), false);
  assert.equal(canContinueWithOfflineData(true, "user-1", null), true);
});

test("回復一覧は別ユーザーを混ぜずグループ単位で差し替える", () => {
  const firstGroup = pendingPayment();
  const secondGroup = pendingPayment({
    groupId: "group-2",
    operationId: "10000000-0000-4000-8000-000000000002",
    createdAt: "2026-08-01T01:00:00.000Z",
  });
  const initial = {
    authUserId: "user-1",
    pendingPayments: [firstGroup, secondGroup],
  };
  const replacement = pendingPayment({
    operationId: "10000000-0000-4000-8000-000000000003",
    createdAt: "2026-08-01T02:00:00.000Z",
  });
  const merged = mergeRecoveryPaymentsForGroup(
    initial,
    "user-1",
    "group-1",
    [replacement]
  );
  assert.deepEqual(
    merged.pendingPayments.map((payment) => payment.operationId),
    [secondGroup.operationId, replacement.operationId]
  );

  const switched = mergeRecoveryPaymentsForGroup(
    initial,
    "user-2",
    "group-3",
    [pendingPayment({ authUserId: "user-2", groupId: "group-3" })]
  );
  assert.equal(switched.authUserId, "user-2");
  assert.equal(switched.pendingPayments.length, 1);
  assert.equal(recoveryPaymentsForUser(switched, "user-1").length, 0);
});

test("回復用コピーにグループと支払いの識別情報を含める", () => {
  const text = pendingPaymentsAsText([pendingPayment()]);
  assert.match(text, /グループID: group-1/);
  assert.match(text, /内容: ホテル代/);
  assert.match(text, /金額: 12000円/);
  assert.match(text, /支払者ID: member-a/);
  assert.match(text, /精算対象ID: member-a, member-b/);
  assert.match(text, /操作ID: 10000000-0000-4000-8000-000000000001/);
});
