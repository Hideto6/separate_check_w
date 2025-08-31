import { GroupHeaderProps } from "@/types";

const GroupHeader = ({ groupName, members }: GroupHeaderProps) => {
  return (
    <div className="flex flex-col items-center mb-2">
      <h2 className="text-2xl font-extrabold text-blue-800 mb-2">
        {groupName}
      </h2>
      <div className="w-full max-w-md p-3 mb-4 bg-white/30 backdrop-blur-sm rounded-lg shadow-sm flex items-center justify-center space-x-2">
        <p className="font-bold text-blue-800 w-20 ">メンバー:</p>
        <div className="flex flex-wrap gap-1 w-50">
          {members.map((member, index) => (
            <span
              key={index}
              className="bg-white text-blue-700 text-sm font-semibold px-2.5 py-1 rounded-full shadow-sm hover:bg-blue-400 active:bg-blue-400 transition"
            >
              {member}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GroupHeader;
