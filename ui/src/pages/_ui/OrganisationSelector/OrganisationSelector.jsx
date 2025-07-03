import { useEffect, useState } from "react";
import { PanelError } from "@/components/Panel/index.js";
import { usePlatformContext } from "@/providers/PlatformContext.jsx";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.js";
import styles from "./OrganisationSelector.module.css";
import { useAsync } from "@/lib/useAsync.js";
import { LoaderCircular } from "@/components/Loader/index.js";
import { useRepos } from "@/pages/providers/ReposContext.jsx";

export const OrganisationSelector = ({}) => {
  const [input, setInput] = useState(null);
  const { getOrganisations, setOrganisation } = usePlatformContext();
  const { setSelectedRepos } = useRepos();
  const { data: orgs, error, isLoading, run } = useAsync();

  useEffect(() => {
    run(getOrganisations());
  }, []);

  const shouldPrefillOrganisation = orgs?.length && !input;

  useEffect(() => {
    if (shouldPrefillOrganisation) {
      setInput(orgs[0]);
      setOrganisation(orgs[0]);
    }
  }, [shouldPrefillOrganisation]);
  
  if (error) {
    return (
        <div className={styles.errorOverlay}>
          <div className={styles.errorOverlayContent}>
            <div>{error.message}</div>
            <div>Please, make sure that you provided valid GitHub fine-grained personal token, issued with the following permissions:</div>
            <div className={styles.permissions}>
              <p><strong>Repositories:</strong></p>
              <div>   - Content: `Read and write`</div>
              <div>   - Workflows: `Read and write`</div>
              <p><strong>Organizations:</strong></p>
              <div>   - Members: `Read-only`</div>
            </div>
          </div>
        </div>
    );
  } else if (orgs?.length === 0) {
    return (
      <div className={styles.errorOverlay}>
        <div className={styles.errorOverlayContent}>
          <div>No organisations found.</div>
          <div>At this moment assistant works only for repos within organisation.</div>
          <div>Check that your token was issued with following permissions:</div>
          <div className={styles.permissions}>
            <p><strong>Repositories:</strong></p>
            <div>   - Content: `Read and write`</div>
            <div>   - Workflows: `Read and write`</div>
            <p><strong>Organizations:</strong></p>
            <div>   - Members: `Read-only`</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <Select
        onValueChange={(value) => {
          setInput(value);
          setOrganisation(value);
          setSelectedRepos(undefined);
        }}
        defaultValue={input}
      >
        <SelectTrigger className={styles.picker}>
          <SelectValue placeholder="Organisation">
            {isLoading ? (
              <LoaderCircular size={"1em"} />
            ) : (
              input || "Select organisation"
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {orgs?.map((org) => (
              <SelectItem key={org} value={org}>
                {org}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      {error ? <PanelError className={"mt-1"}>{error}</PanelError> : null}
    </div>
  );
};
