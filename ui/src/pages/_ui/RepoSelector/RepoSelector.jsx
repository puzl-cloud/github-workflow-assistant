import { usePlatformContext } from "@/providers/PlatformContext.jsx";
import { ReposList } from "./_ui/ReposList.jsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.js";
import { Skeleton } from "@/components/ui/skeleton.js";
import { CardError } from "@/components/Card/CardElements.jsx";
import { isUndef } from "@/lib/helpers.js";
import { useRepos } from "@/pages/providers/ReposContext.jsx";
import { Button } from "@/components/ui/button.js";

export const RepoSelector = () => {
  const { organisation } = usePlatformContext();
  const { repos, error, isLoading, retryAll } = useRepos();

  return !organisation ? null : (
    <Card>
      <CardHeader>
        <CardTitle>Repositories</CardTitle>
        <CardDescription>
          Select repositories to apply replacements.
        </CardDescription>
      </CardHeader>
      {error && !isLoading ? (
        <CardError
          message={error.message}
          severity={error.severity}
          action={
            error.severity === "error" ? (
              <Button
                onClick={retryAll}
                variant={"default"}
                className={"text-foreground"}
              >
                Retry All
              </Button>
            ) : null
          }
        />
      ) : null}
      <CardContent>
        {isLoading || isUndef(repos) ? (
          <Loader />
        ) : repos?.length ? (
          <ReposList />
        ) : (
          <Placeholder />
        )}
      </CardContent>
    </Card>
  );
};

function Loader() {
  return (
    <div className="space-y-2">
      <div className="space-x-2 flex items-center">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-[250px]" />
      </div>
      <div className="space-x-2 flex items-center">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-[250px]" />
      </div>
    </div>
  );
}

function Placeholder() {
  const { organisation } = usePlatformContext();

  return (
    <div className="text-muted-foreground">
      <div className="text-lg font-semibold">
        No Repositories found for organisation {organisation}.
      </div>
      <div className="text-lg font-semibold">
        Please, check that your Personal Access Token has been issues with
        necessary permissions.
      </div>
      <ul className="my-6 ml-6 list-disc [&>li]:mt-2">
        <li>
          <strong>Repository</strong>: <strong>Read</strong> access to{" "}
          <strong>metadata</strong>
        </li>
        <li>
          <strong>Repository</strong>: <strong>Read</strong> and{" "}
          <strong>Write</strong> access to <strong>code (content)</strong> and{" "}
          <strong>workflows</strong>
        </li>
        <li>
          <strong>Organisation</strong>: <strong>Read</strong> access to{" "}
          <strong>members</strong>
        </li>
      </ul>
    </div>
  );
}
