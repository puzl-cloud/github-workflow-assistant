import { CardContent } from "@/components/ui/card.js";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert.js";
import { AlertCircle } from "lucide-react";
import styles from "./CardElements.module.css";
import { cn } from "@/lib/utils.js";

export function CardError({
  title = "Error",
  message,
  severity = "error",
  action,
}) {
  return (
    <CardContent>
      <Alert
        variant={
          ["info", "warning"].includes(severity) ? "default" : "destructive"
        }
      >
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
        {action ? (
          <>
            <div />
            <div className={"flex mt-2 justify-self-end"}>{action}</div>
          </>
        ) : null}
      </Alert>
    </CardContent>
  );
}

export const CardActionsSlot = ({ className, ...props }) => (
  <div {...props} className={cn(className, styles.buttonContainer)} />
);
