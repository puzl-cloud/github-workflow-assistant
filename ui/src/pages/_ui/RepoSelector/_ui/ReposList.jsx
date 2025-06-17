import { useRepos } from "../../../providers/ReposContext.jsx";
import styles from "./ReposList.module.css";
import { Checkbox } from "@/components/ui/checkbox.js";
import { LoaderCircular } from "@/components/Loader/index.js";
import { Badge } from "@/components/ui/badge.js";
import { Icon } from "@/components/Icon/Icon.jsx";
import { OVERALL_STATUSES } from "@/lib/useBatchRequest.jsx";
import { cn } from "@/lib/utils.js";

export const ReposList = () => {
  const { setSelectedRepos, repos, selectedRepos, isReady } = useRepos();

  return (
    <div className={cn(styles.list)}>
      {repos?.map((repo) => {
        const status = repo.cloned;

        return (
          <div
            className={cn(styles.listItem, "flex items-start space-x-2")}
            key={repo.id}
          >
            <div className={styles.checkboxSlot}>
              <Checkbox
                id={repo.id}
                disabled={!isReady || status !== OVERALL_STATUSES.SUCCESS}
                checked={selectedRepos?.includes(repo.name)}
                onCheckedChange={() => {
                  setSelectedRepos((prev) =>
                    prev?.includes(repo.name)
                      ? prev.filter((r) => r !== repo.name)
                      : [...(prev || []), repo.name],
                  );
                }}
              />
            </div>
            <label htmlFor={repo.id}>
              {repo.name}&nbsp;
              <Status status={status} />
            </label>
          </div>
        );
      })}
    </div>
  );
};

function Status({ status }) {
  if (!status || status === OVERALL_STATUSES.LOADING) {
    return (
      <Badge variant="secondary">
        <LoaderCircular size="0.8em" />
        &nbsp;fetching
      </Badge>
    );
  }

  if (status === "RETRYING") {
    return (
      <Badge variant="outline">
        <LoaderCircular size="0.8em" />
        &nbsp;retrying
      </Badge>
    );
  }

  if (status === OVERALL_STATUSES.SUCCESS) {
    return (
      <span className="inline-flex items-center text-text-success">
        <Icon name="arrow-down-to-line" size="0.9em" className="text-success" />
      </span>
    );
  }

  if (status === OVERALL_STATUSES.ERROR) {
    return (
      <span className="inline-flex items-center text-destructive align-middle">
        <Icon name="x" size="0.8em" />
        &nbsp;failed
      </span>
    );
  }

  return null;
}
