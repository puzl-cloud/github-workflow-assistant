import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { LoaderCircular } from "@/components/Loader/index.js";

export function SubmitDialog({
  submitProgress,
  submitTotal,
  abortControllerRef,
  submitting,
  onSubmit,
  disabled,
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button disabled={disabled} variant={"success"}>
          {submitting ? (
            <LoaderCircular size={"1em"} className={"mr-1"} />
          ) : null}
          Commit and Push
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Commit changes</AlertDialogTitle>
          <AlertDialogDescription>
            Workflow Ci runs will be skipped
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div>
          {submitting && (
            <div className={"text-right text-muted-foreground"}>
              <p>
                Submitting... {submitProgress} / {submitTotal}
              </p>
              <button
                className="btn btn-sm btn-destructive"
                onClick={() => abortControllerRef.current?.abort()}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onSubmit} disabled={submitting}>
            Commit and Push
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
