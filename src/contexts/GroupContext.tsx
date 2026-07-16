"use client";

import {
  createContext,
  useState,
  useContext,
  ReactNode,
  useEffect,
  useCallback,
} from "react";
import { Record, GroupContextType } from "@/types";

const GroupContext = createContext<GroupContextType | undefined>(undefined);

const storageKeys = {
  groupName: "groupName",
  members: "members",
  records: "records",
} as const;

const removeStoredValue = (key: string) => {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`Failed to remove localStorage key: ${key}`, error);
  }
};

const readStoredValue = (key: string): unknown => {
  try {
    const storedValue = localStorage.getItem(key);
    if (storedValue === null) {
      return undefined;
    }

    return JSON.parse(storedValue);
  } catch (error) {
    console.error(`Failed to read localStorage key: ${key}`, error);
    removeStoredValue(key);
    return undefined;
  }
};

const persistValue = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Failed to write localStorage key: ${key}`, error);
  }
};

const isValidMembers = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.every(
    (member) => typeof member === "string" && member.trim().length > 0
  ) &&
  new Set(value).size === value.length;

const isValidRecord = (
  value: unknown,
  members: string[]
): value is Record => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Partial<Record>;
  return (
    typeof record.id === "string" &&
    record.id.length > 0 &&
    typeof record.title === "string" &&
    record.title.trim().length > 0 &&
    typeof record.payer === "string" &&
    members.includes(record.payer) &&
    typeof record.amount === "number" &&
    Number.isSafeInteger(record.amount) &&
    record.amount >= 0 &&
    isValidMembers(record.for) &&
    record.for.length > 0 &&
    record.for.every((member) => members.includes(member))
  );
};

export const GroupProvider = ({ children }: { children: ReactNode }) => {
  const [groupName, setGroupName] = useState<string>("");
  const [members, setMembers] = useState<string[]>([]);
  const [records, setRecords] = useState<Record[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const storedGroupName = readStoredValue(storageKeys.groupName);
    const storedMembers = readStoredValue(storageKeys.members);
    const storedRecords = readStoredValue(storageKeys.records);

    const restoredGroupName =
      typeof storedGroupName === "string" && storedGroupName.trim().length > 0
        ? storedGroupName.trim()
        : "";
    const restoredMembers = isValidMembers(storedMembers) ? storedMembers : [];
    const restoredRecords = Array.isArray(storedRecords)
      ? storedRecords.filter((record) =>
          isValidRecord(record, restoredMembers)
        )
      : [];

    setGroupName(restoredGroupName);
    setMembers(restoredMembers);
    setRecords(restoredRecords);
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated) {
      persistValue(storageKeys.groupName, groupName);
    }
  }, [groupName, isHydrated]);

  useEffect(() => {
    if (isHydrated) {
      persistValue(storageKeys.members, members);
    }
  }, [isHydrated, members]);

  useEffect(() => {
    if (isHydrated) {
      persistValue(storageKeys.records, records);
    }
  }, [isHydrated, records]);

  const addRecord = useCallback((record: Omit<Record, "id">) => {
    const newRecord = { ...record, id: crypto.randomUUID() };
    setRecords((prevRecords) => [...prevRecords, newRecord]);
  }, []);

  const deleteRecord = useCallback((id: string) => {
    setRecords((prevRecords) =>
      prevRecords.filter((record) => record.id !== id)
    );
  }, []);

  // グループ情報をリセット
  const resetGroup = useCallback(() => {
    setGroupName("");
    setMembers([]);
    setRecords([]);
    Object.values(storageKeys).forEach(removeStoredValue);
  }, []);

  return (
    <GroupContext.Provider
      value={{
        isHydrated,
        groupName,
        setGroupName,
        members,
        setMembers,
        records,
        addRecord,
        deleteRecord,
        resetGroup,
      }}
    >
      {children}
    </GroupContext.Provider>
  );
};

export const useGroup = () => {
  const context = useContext(GroupContext);
  if (context === undefined) {
    throw new Error("useGroup must be used within a GroupProvider");
  }
  return context;
};
