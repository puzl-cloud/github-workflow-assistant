import { useEffect, useRef } from "react";
import Prism from "prismjs";
import "prismjs/components/prism-yaml";
import "prismjs/themes/prism-okaidia.min.css";

import styles from "./Code.module.css";
import { cn } from "@/lib/utils.js";

export const Code = ({ code }) => {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) {
      Prism.highlightElement(ref.current);
    }
  }, [code]);

  return (
    <pre className={cn(styles.code, "rounded-md border-input border")}>
      <code ref={ref} className={`language-yaml`}>
        {code}
      </code>
    </pre>
  );
};
