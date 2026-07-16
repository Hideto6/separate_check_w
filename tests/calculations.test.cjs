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

const record = (id, payer, amount, beneficiaries) => ({
  id,
  title: `record-${id}`,
  payer,
  amount,
  for: beneficiaries,
});

test("割り切れない金額を1円単位で配分する", () => {
  const settlements = calculateSettlement(
    [record("1", "A", 100, ["A", "B", "C"])],
    ["A", "B", "C"]
  );

  assert.deepEqual(settlements, [
    { from: "B", to: "A", amount: 33 },
    { from: "C", to: "A", amount: 33 },
  ]);
});

test("支払者が精算対象外でも送金合計が記録金額と一致する", () => {
  const settlements = calculateSettlement(
    [record("1", "A", 100, ["B", "C", "D"])],
    ["A", "B", "C", "D"]
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
  const settlements = calculateSettlement(
    [record("1", "A", 2, ["A", "B", "C"])],
    ["A", "B", "C"]
  );

  assert.deepEqual(settlements, [{ from: "B", to: "A", amount: 1 }]);
});

test("複数の支払いを相殺して最小限の精算を返す", () => {
  const settlements = calculateSettlement(
    [
      record("1", "A", 100, ["A", "B"]),
      record("2", "B", 50, ["A", "B"]),
    ],
    ["A", "B"]
  );

  assert.deepEqual(settlements, [{ from: "B", to: "A", amount: 25 }]);
});
