import React from "react";

interface ContentBoxProps {
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  titleClassName?: string;
  bodyClassName?: string;
  containerClassName?: string;
}

const ContentBox: React.FC<ContentBoxProps> = ({
  title,
  children,
  footer,
  titleClassName = "",
  bodyClassName = "",
  containerClassName = "",
}) => {
  const baseContainerClasses =
    "flex flex-col items-center w-full p-3 rounded-lg mb-4 shadow-md";
  const baseTitleClasses = "font-bold mb-2 text-base";
  const baseBodyClasses = "w-full overflow-y-auto rounded-lg";

  return (
    <div className={`${baseContainerClasses} ${containerClassName}`}>
      {title && (
        <div className={`${baseTitleClasses} ${titleClassName}`}>{title}</div>
      )}
      <div className={`${baseBodyClasses} ${bodyClassName}`}>{children}</div>
      {footer && <div className="w-full mt-4">{footer}</div>}
    </div>
  );
};

export default ContentBox;
