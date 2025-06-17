import { Label } from "@/components/ui/label.js";
import { Select } from "@/components/Select/index.js";
import { FormItem } from "@/components/Form/index.js";
import React, { useState } from "react";
import { formatSelectOptions } from "@/components/Select/lib/helpers.js";
import { Button } from "@/components/ui/button.js";
import { Separator } from "@/components/ui/separator.js";
import { CardActionsSlot } from "@/components/Card/CardElements.jsx";
import { useWorkflows } from "@/pages/providers/WorkflowsContext.jsx";

export const BranchFilter = ({ onSubmit }) => {
  const { workflows } = useWorkflows();
  const [selectedBranches, setSelectedBranches] = useState(null);
  const [excludedBranches, setExcludedBranches] = useState(null);

  const branches = workflows
    ? [
        ...new Set(
          Object.values(workflows).flatMap(({ data }) =>
            data?.map((entry) => entry.branch),
          ),
        ),
      ]
    : [];

  return (
    <>
      <Separator />
      <div className="branch-filter">
        <FormItem
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gridGap: "1rem",
          }}
        >
          <div className="w-full">
            <Label htmlFor="branches-to-include">Select branches</Label>
            <Select
              id="branches-to-include"
              name="branches-to-include"
              placeholder="ubuntu-latest, ubuntu-22.04"
              value={formatSelectOptions(selectedBranches)}
              closeMenuOnSelect={false}
              isMulti={true}
              onChange={(value) => {
                setSelectedBranches(value.map((v) => v.value));
              }}
              options={formatSelectOptions(branches)}
              isDisabled={!branches?.length}
            />
          </div>
          <div className=" w-full">
            <Label htmlFor="branches-to-exclude">Exclude branches</Label>
            <Select
              id="branches-to-exclude"
              name="branches-to-exclude"
              placeholder="ubuntu-latest, ubuntu-22.04"
              value={formatSelectOptions(excludedBranches)}
              closeMenuOnSelect={false}
              isMulti={true}
              onChange={(value) => {
                setExcludedBranches(value.map((v) => v.value));
              }}
              options={formatSelectOptions(branches)}
              isDisabled={!branches?.length}
            />
          </div>
        </FormItem>
      </div>
      <CardActionsSlot className={"mb-6"}>
        <Button
          onClick={() => {
            onSubmit({
              add: selectedBranches,
              remove: excludedBranches,
            });
          }}
        >
          Apply
        </Button>
      </CardActionsSlot>
      <Separator />
    </>
  );
};
