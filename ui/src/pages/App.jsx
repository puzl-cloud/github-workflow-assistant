import { RepoSelector } from "./_ui/RepoSelector/RepoSelector.jsx";
import { FilesExplorer } from "./_ui/FilesExplorer/FilesExplorer.jsx";
import { PlatformProvider } from "../providers/PlatformContext.jsx";
import { Row } from "../components/layout/index.js";
import { ReposProvider, useRepos } from "./providers/ReposContext.jsx";
import { OrganisationSelector } from "./_ui/OrganisationSelector/OrganisationSelector.jsx";
import { LabelsProvider } from "./providers/LabelsContext.jsx";
import { ReplacementWidget } from "@/pages/_ui/ReplacementWIdget/ReplacementWidget.jsx";
import { isUndef } from "@/lib/helpers.js";
import { WorkflowsProvider } from "@/pages/providers/WorkflowsContext.jsx";
import { Header } from "@/pages/_ui/Header/Header.jsx";
import { Card } from "@/components/ui/card.js";
import styles from "./App.module.css";
import { useEffect } from "react";
import PROJECT_META from "../../package.json";

export const App = () => {
  useEffect(() => {
    console.log(`App version: ${PROJECT_META.version}`);
  }, []);
  return (
    <PlatformProvider>
      <ReposProvider>
        <WorkflowsProvider>
          <LabelsProvider>
            <div className={styles.app}>
              <Header />
              <div className={styles.grid}>
                <div className={styles.aside}>
                  <OrganisationSelector />
                  <Row className={styles.reposSlot} style={{ marginBottom: 0 }}>
                    <RepoSelector />
                  </Row>
                </div>
                <div>
                  <BlockedByRepo>
                    <ReplacementWidget />
                    <Row style={{ marginBottom: 0 }} className={styles.treeRow}>
                      <FilesExplorer />
                    </Row>
                  </BlockedByRepo>
                </div>
              </div>
            </div>
          </LabelsProvider>
        </WorkflowsProvider>
      </ReposProvider>
    </PlatformProvider>
  );
};

function BlockedByRepo({ children }) {
  const { selectedRepos, repos, isLoading } = useRepos();

  if (isUndef(selectedRepos) || isLoading) {
    return null;
  } else if (!selectedRepos?.length && repos?.length) {
    return (
      <Row>
        <Card>
          <div
            style={{ textAlign: "center" }}
            className={"text-muted-foreground"}
          >
            Please select a repository to continue
          </div>
        </Card>
      </Row>
    );
  }

  return children;
}
