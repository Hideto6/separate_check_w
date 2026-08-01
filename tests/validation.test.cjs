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
  clearObsoleteLocalGroupData,
  readRecentGroup,
  RECENT_GROUP_STORAGE_KEY,
  removeRecentGroup,
  parseGroupSnapshot,
  storeRecentGroup,
} = require("../src/lib/validation.ts");

const createMemoryStorage = (initial = {}) => {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
};

test("廃止済みの旧3キーを削除して直近グループを残す", () => {
  const storage = createMemoryStorage({
    groupName: JSON.stringify("旧旅行"),
    members: JSON.stringify(["A", "B"]),
    records: JSON.stringify([]),
  });
  storeRecentGroup(storage, { groupId: "group-1", groupName: "新旅行" });

  clearObsoleteLocalGroupData(storage);

  assert.equal(storage.getItem("groupName"), null);
  assert.equal(storage.getItem("members"), null);
  assert.equal(storage.getItem("records"), null);
  assert.equal(readRecentGroup(storage)?.groupName, "新旅行");
});

test("旧3キーを削除できない環境でも処理を継続する", () => {
  assert.doesNotThrow(() =>
    clearObsoleteLocalGroupData({
      removeItem: () => {
        throw new Error("remove failed");
      },
    })
  );
});

test("直近のグループ1件を保存し新しい要約で上書きする", () => {
  const storage = createMemoryStorage();
  storeRecentGroup(storage, { groupId: "group-1", groupName: " 春旅行 " });
  assert.deepEqual(readRecentGroup(storage), {
    groupId: "group-1",
    groupName: "春旅行",
  });

  storeRecentGroup(storage, { groupId: "group-2", groupName: "夏旅行" });
  assert.deepEqual(readRecentGroup(storage), {
    groupId: "group-2",
    groupName: "夏旅行",
  });
});

test("不正な直近グループとlocalStorage例外を無視する", () => {
  const invalidStorage = createMemoryStorage({
    [RECENT_GROUP_STORAGE_KEY]: JSON.stringify({
      groupId: "group-1",
      groupName: "   ",
    }),
  });
  assert.equal(readRecentGroup(invalidStorage), null);

  const throwingStorage = {
    getItem: () => {
      throw new Error("read failed");
    },
    setItem: () => {
      throw new Error("write failed");
    },
    removeItem: () => {
      throw new Error("remove failed");
    },
  };
  assert.equal(readRecentGroup(throwingStorage), null);
  assert.doesNotThrow(() =>
    storeRecentGroup(throwingStorage, {
      groupId: "group-1",
      groupName: "旅行",
    })
  );
  assert.doesNotThrow(() => removeRecentGroup(throwingStorage, "group-1"));
});

test("指定したグループが直近の場合だけ削除する", () => {
  const storage = createMemoryStorage();
  storeRecentGroup(storage, { groupId: "group-1", groupName: "旅行" });
  removeRecentGroup(storage, "group-2");
  assert.equal(readRecentGroup(storage)?.groupId, "group-1");
  removeRecentGroup(storage, "group-1");
  assert.equal(readRecentGroup(storage), null);
});

test("関連メンバーが一致する共有スナップショットだけ受け入れる", () => {
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
    payments: [
      {
        id: "payment-1",
        title: "宿泊",
        payerMemberId: "member-a",
        amount: 100,
        beneficiaryMemberIds: ["member-a", "member-b"],
        version: 1,
        createdByMemberId: "member-a",
        createdAt: "2026-07-16T00:00:00Z",
        updatedAt: "2026-07-16T00:00:00Z",
      },
    ],
    transfers: [],
  };
  assert.deepEqual(parseGroupSnapshot(snapshot), snapshot);
  snapshot.payments[0].payerMemberId = "missing";
  assert.equal(parseGroupSnapshot(snapshot), null);
});
