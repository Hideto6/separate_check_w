"use client";

import {
  createContext,
  useState,
  useContext,
  ReactNode,
  useEffect,
} from "react";
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
  const [groupName, setGroupName] = useState<string>("");
  const [members, setMembers] = useState<string[]>([]);
  const [records, setRecords] = useState<Record[]>([]);

  useEffect(() => {
    try {
      const storedGroupName = localStorage.getItem("groupName");
      if (storedGroupName) {
        setGroupName(JSON.parse(storedGroupName));
      }
      const storedMembers = localStorage.getItem("members");
      if (storedMembers) {
        setMembers(JSON.parse(storedMembers));
      }
      const storedRecords = localStorage.getItem("records");
      if (storedRecords) {
        setRecords(JSON.parse(storedRecords));
      }
    } catch (error) {
      console.error("Failed to parse from localStorage", error);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("groupName", JSON.stringify(groupName));
  }, [groupName]);

  useEffect(() => {
    localStorage.setItem("members", JSON.stringify(members));
  }, [members]);

  useEffect(() => {
    localStorage.setItem("records", JSON.stringify(records));
  }, [records]);

  const addRecord = (record: Omit<Record, "id">) => {
    const newRecord = { ...record, id: new Date().toISOString() };
    setRecords((prevRecords) => [...prevRecords, newRecord]);
  };

  const deleteRecord = (id: string) => {
    setRecords((prevRecords) =>
      prevRecords.filter((record) => record.id !== id)
    );
  };

  // グループ情報をリセット
  const resetGroup = () => {
    setGroupName("");
    setMembers([]);
    setRecords([]);
    localStorage.removeItem("groupName");
    localStorage.removeItem("members");
    localStorage.removeItem("records");
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
