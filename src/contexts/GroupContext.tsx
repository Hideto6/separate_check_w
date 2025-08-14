"use client";

import { createContext, useState, useContext, ReactNode } from "react";
import { Record } from "@/types";

// Contextで共有するデータの型を定義
interface GroupContextType {
  groupName: string;
  setGroupName: (name: string) => void;
  members: string[];
  setMembers: (members: string[]) => void;
  records: Record[];
  addRecord: (record: Omit<Record, "id">) => void;
  deleteRecord: (id: string) => void;
  resetGroup: () => void;
}

const GroupContext = createContext<GroupContextType | undefined>(undefined);

export const GroupProvider = ({ children }: { children: ReactNode }) => {
  const [groupName, setGroupName] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [records, setRecords] = useState<Record[]>([]);

  const addRecord = (record: Omit<Record, "id">) => {
    const newRecord = { ...record, id: new Date().toISOString() };
    setRecords((prevRecords) => [...prevRecords, newRecord]);
  };

  const deleteRecord = (id: string) => {
    setRecords((prevRecords) =>
      prevRecords.filter((record) => record.id !== id)
    );
  };

  const resetGroup = () => {
    setGroupName("");
    setMembers([]);
    setRecords([]);
  };

  return (
    <GroupContext.Provider
      value={{
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
