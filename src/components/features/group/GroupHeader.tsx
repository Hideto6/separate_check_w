import type { Member } from "@/types";

export default function GroupHeader({
  groupName,
  members,
  currentMemberId,
}: {
  groupName: string;
  members: Member[];
  currentMemberId: string;
}) {
  return (
    <header className="flex w-full flex-col items-center">
      <h1 className="mb-3 max-w-full text-center text-2xl font-extrabold text-blue-800 [overflow-wrap:anywhere]">
        {groupName}
      </h1>
      <section
        aria-labelledby="group-members-heading"
        className="w-full rounded-xl bg-white/40 p-4 shadow-sm backdrop-blur-sm"
      >
        <h2
          id="group-members-heading"
          className="mb-2 font-extrabold text-blue-800"
        >
          メンバー
        </h2>
        <div className="flex flex-wrap gap-1">
          {members.map((member) => (
            <span
              key={member.id}
              className={`max-w-full rounded-full px-2.5 py-1 text-sm font-semibold shadow-sm [overflow-wrap:anywhere] ${
                member.id === currentMemberId
                  ? "bg-blue-500 text-white"
                  : "bg-white text-blue-700"
              }`}
            >
              {member.name}
            </span>
          ))}
        </div>
      </section>
    </header>
  );
}
