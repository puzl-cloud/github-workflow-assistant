import React, { useEffect, useState } from "react";
import { FormItem } from "@/components/Form/index.js";
import { useLabels } from "../../providers/LabelsContext.jsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.js";
import { CardError } from "@/components/Card/CardElements.jsx";
import { Label } from "@/components/ui/label.js";
import { Select } from "@/components/Select/index.js";
import { useWorkflows } from "@/pages/providers/WorkflowsContext.jsx";
import { isUndef } from "@/lib/helpers.js";
import { Skeleton } from "@/components/ui/skeleton.js";
import { SelectWithCustomInput } from "@/components/Select/Select.jsx";
import { formatSelectOptions } from "@/components/Select/lib/helpers.js";
import { validateAndFixCustomLabel } from "@/pages/_ui/ReplacementWIdget/lib/validation.js";
import { FormElementMessage } from "@/components/FormElement/FormElementMessage.jsx";
import styles from "./ReplacementWidget.module.css";

export const ReplacementWidget = ({ title = "Replacement Rules" }) => {
  const {
    labelsToReplace,
    replacementValue,
    replacementOptions,
    setLabelsToReplace,
    setReplacementValue,
    addCustomReplacementLabel,
    error: labelsError,
    isLoading: labelsLoading,
  } = useLabels();

  const { workflows, overallStatus } = useWorkflows();

  const [error, setError] = useState(undefined);
  const [labelsToReplaceTmp, setLabelsToReplaceTmp] = useState(() =>
    formatSelectOptions(labelsToReplace),
  );

  const [replacementValueTmp, setReplacementValueTmp] =
    useState(replacementValue);

  useEffect(() => {
    setReplacementValueTmp(replacementValue);
  }, [replacementValue]);

  if (isUndef(workflows)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <Loader />
        </CardContent>
      </Card>
    );
  } else if (!workflows) {
    return null;
  }

  const handleSubmit = (replacementValue) => {
    setError(undefined);

    if (!labelsToReplaceTmp) {
      setError("No labels to replace");
      return;
    }

    if (!replacementValue) {
      setError("No replacement value");
      return;
    }

    setLabelsToReplace(labelsToReplaceTmp);
    setReplacementValue(replacementValue);
  };

  const optionsSet = new Set(
    Object.values(workflows)
      .flatMap(({ data }) => data || [])
      .flatMap(({ labels }) => labels || [])
      .filter((label) => !/^\s*\${{\s*[^}]+}}/.test(label)), // filters out "${{ ... }}"
  );

  const options = formatSelectOptions(Array.from(optionsSet).sort());

  const currentValues = formatSelectOptions(labelsToReplaceTmp);

  return (
    <Card style={{ position: "relative", zIndex: 2 }}>
      {error ? <CardError message={error} /> : null}
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          Define labels to replace and their replacement value.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <FormItem className={styles.form}>
          <div className="w-full">
            <Label>My Labels</Label>
            <Select
              id="labels-to-replace"
              name="labels-to-replace"
              placeholder="ubuntu-latest, ubuntu-22.04"
              value={currentValues}
              closeMenuOnSelect={false}
              isMulti={true}
              onChange={(value) => {
                setLabelsToReplaceTmp(value.map((v) => v.value));
                setLabelsToReplace(value.map((v) => v.value));
              }}
              options={options}
              isLoading={overallStatus === "LOADING"}
              isDisabled={!options?.length}
            />
          </div>
          <div className="w-full">
            <Label>Replace With</Label>
            <SelectWithCustomInput
              id="replacement-label"
              name="replacement-label"
              placeholder="ubuntu-22.04"
              isLoading={labelsLoading}
              isDisabled={!labelsToReplaceTmp?.length}
              value={
                replacementValueTmp
                  ? { value: replacementValueTmp, label: replacementValueTmp }
                  : undefined
              }
              closeMenuOnSelect={true}
              isMulti={false}
              validate={validateAndFixCustomLabel}
              onChange={(value) => {
                addCustomReplacementLabel(value.label);
                setReplacementValueTmp(value.label);
                handleSubmit(value.label);
              }}
              options={
                replacementOptions?.map((v) => ({ value: v, label: v })) || []
              }
            />
            {labelsError ? (
              <FormElementMessage isCritical={true}>
                {labelsError}
              </FormElementMessage>
            ) : null}
          </div>
        </FormItem>
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
