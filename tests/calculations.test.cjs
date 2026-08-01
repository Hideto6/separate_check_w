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

const { calculateSettlement } = require("../src/lib/calculations.ts");

const member = (id, position) => ({ id, name: id, position });
const members = (...ids) => ids.map(member);
const payment = (id, payerMemberId, amount, beneficiaryMemberIds) => ({
  id,
  title: `payment-${id}`,
  payerMemberId,
  amount,
  beneficiaryMemberIds,
  version: 1,
  createdByMemberId: payerMemberId,
  createdAt: "2026-07-16T00:00:00Z",
  updatedAt: "2026-07-16T00:00:00Z",
});
const transfer = (id, fromMemberId, toMemberId, amount) => ({
  id,
  fromMemberId,
  toMemberId,
  amount,
  version: 1,
  createdByMemberId: fromMemberId,
  createdAt: "2026-07-16T00:00:00Z",
});

test("割り切れない金額を対象者の順番で1円単位に配分する", () => {
  const settlements = calculateSettlement(
    [payment("1", "A", 100, ["A", "B", "C"])],
    members("A", "B", "C")
  );
  assert.deepEqual(settlements, [
    { fromMemberId: "B", toMemberId: "A", amount: 33 },
    { fromMemberId: "C", toMemberId: "A", amount: 33 },
  ]);
});

test("支払者が精算対象外でも送金合計が記録金額と一致する", () => {
  const settlements = calculateSettlement(
    [payment("1", "A", 100, ["B", "C", "D"])],
    members("A", "B", "C", "D")
  );
  assert.equal(
    settlements.reduce((total, settlement) => total + settlement.amount, 0),
    100
  );
  assert.deepEqual(
    settlements.map(({ amount }) => amount),
    [34, 33, 33]
  );
});

test("端数処理によって0円の精算を生成しない", () => {
  assert.deepEqual(
    calculateSettlement(
      [payment("1", "A", 2, ["A", "B", "C"])],
      members("A", "B", "C")
    ),
    [{ fromMemberId: "B", toMemberId: "A", amount: 1 }]
  );
});

test("複数の支払いを相殺して精算を返す", () => {
  assert.deepEqual(
    calculateSettlement(
      [
        payment("1", "A", 100, ["A", "B"]),
        payment("2", "B", 50, ["A", "B"]),
      ],
      members("A", "B")
    ),
    [{ fromMemberId: "B", toMemberId: "A", amount: 25 }]
  );
});

test("精算送金を未精算残高から差し引く", () => {
  assert.deepEqual(
    calculateSettlement(
      [payment("1", "A", 100, ["A", "B"])],
      members("A", "B"),
      [transfer("t1", "B", "A", 50)]
    ),
    []
  );
});

test("複数の精算送金を順番に反映する", () => {
  assert.deepEqual(
    calculateSettlement(
      [payment("1", "A", 120, ["A", "B", "C"])],
      members("A", "B", "C"),
      [transfer("t1", "B", "A", 40)]
    ),
    [{ fromMemberId: "C", toMemberId: "A", amount: 40 }]
  );
});

test("精算送金を削除すると元の精算候補に戻る", () => {
  const records = [payment("1", "A", 100, ["A", "B"])];
  const parsedMembers = members("A", "B");
  const completed = calculateSettlement(records, parsedMembers, [
    transfer("t1", "B", "A", 50),
  ]);
  const reverted = calculateSettlement(records, parsedMembers, []);
  assert.deepEqual(completed, []);
  assert.deepEqual(reverted, [
    { fromMemberId: "B", toMemberId: "A", amount: 50 },
  ]);
});

test("無効な支払いと精算送金を計算へ含めない", () => {
  assert.deepEqual(
    calculateSettlement(
      [payment("1", "missing", 100, ["A", "B"])],
      members("A", "B"),
      [transfer("t1", "B", "missing", 50)]
    ),
    []
  );
});
