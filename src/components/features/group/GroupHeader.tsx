import type { Member, SyncStatus } from "@/types";

const syncLabels: Record<SyncStatus, string> = {
  connecting: "同期中...",
  connected: "同期済み",
  reconnecting: "再接続中...",
  offline: "オフライン（閲覧のみ）",
};

export default function GroupHeader({
  groupName,
  members,
  currentMemberId,
  syncStatus,
}: {
  groupName: string;
  members: Member[];
  currentMemberId: string;
  syncStatus: SyncStatus;
}) {
  const currentMember = members.find((member) => member.id === currentMemberId);
  return (
    <header className="flex flex-col items-center mb-2 w-full max-w-md">
      <div className="flex items-center justify-between w-full mb-2">
        <span
          role="status"
          className={`text-xs font-bold rounded-full px-3 py-1 ${
            syncStatus === "offline"
              ? "bg-red-100 text-red-700"
              : "bg-white/60 text-blue-700"
          }`}
        >
          {syncLabels[syncStatus]}
        </span>
        <span className="text-xs font-bold text-blue-700">
          あなた: {currentMember?.name ?? "未選択"}
        </span>
      </div>
      <h1 className="text-2xl font-extrabold text-blue-800 mb-2 text-center">
        {groupName}
      </h1>
      <div className="w-full p-3 mb-4 bg-white/30 backdrop-blur-sm rounded-lg shadow-sm">
        <p className="font-bold text-blue-800 mb-2">メンバー</p>
        <div className="flex flex-wrap gap-1">
          {members.map((member) => (
            <span
              key={member.id}
              className={`text-sm font-semibold px-2.5 py-1 rounded-full shadow-sm ${
                member.id === currentMemberId
                  ? "bg-blue-500 text-white"
                  : "bg-white text-blue-700"
              }`}
            >
              {member.name}
            </span>
          ))}
        </div>
      </div>
    </header>
  );
}
