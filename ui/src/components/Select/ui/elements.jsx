import { ChevronDownIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import styles from "@/components/Select/Select.module.css";
import * as React from "react";
import { cn } from "@/lib/utils.js";
import { LoaderCircular } from "@/components/Loader/index.js";

export const DownChevron = () => {
  return <ChevronDownIcon className="size-4 opacity-50" />;
};

export const LoadingIndicator = () => {
  return <LoaderCircular size={"16px"} />;
};

export const MultiValueContainer = (props) => {
  return (
    <Badge
      variant={"secondary"}
      {...props}
      className={"badge m-1 my-1 whitespace-normal break-all"}
    />
  );
};

export const MultiValueLabel = (props) => {
  return <span className={styles.label} {...props} />;
};

export const CustomOption = ({ innerRef, innerProps, className, ...props }) => (
  <div
    ref={innerRef}
    {...innerProps}
    {...props}
    className={cn("rounded-md", styles.option, className)}
  />
);
