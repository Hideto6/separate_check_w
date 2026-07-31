import { useId, type ReactNode } from "react";

interface ContentBoxProps {
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  titleClassName?: string;
  bodyClassName?: string;
  containerClassName?: string;
  headingLevel?: 2 | 3;
}

export default function ContentBox({
  title,
  children,
  footer,
  titleClassName = "",
  bodyClassName = "",
  containerClassName = "",
  headingLevel = 2,
}: ContentBoxProps) {
  const generatedTitleId = useId();
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const baseContainerClasses =
    "flex w-full flex-col rounded-2xl p-4 shadow-md";
  const baseTitleClasses = "mb-3 text-center text-base font-extrabold";
  const baseBodyClasses = "w-full rounded-xl";

  return (
    <section
      aria-labelledby={title ? generatedTitleId : undefined}
      className={`${baseContainerClasses} ${containerClassName}`}
    >
      {title && (
        <Heading
          id={generatedTitleId}
          className={`${baseTitleClasses} ${titleClassName}`}
        >
          {title}
        </Heading>
      )}
      <div className={`${baseBodyClasses} ${bodyClassName}`}>{children}</div>
      {footer && <div className="w-full mt-4">{footer}</div>}
    </section>
  );
}
