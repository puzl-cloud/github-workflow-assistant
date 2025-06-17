import { useState } from "react";
import SelectBase from "react-select";
import CreatableSelect from "react-select/creatable";
import {
  CustomOption,
  DownChevron,
  MultiValueContainer,
  MultiValueLabel,
  LoadingIndicator,
} from "@/components/Select/ui/elements.jsx";
import { FormElementMessage } from "@/components/FormElement/FormElementMessage.jsx";
import { FormElementLabel } from "@/components/FormElement/FormElementLabel.jsx";
import styles from "./Select.module.css";

export const Select = ({ options, ...props }) => {
  return (
    <div className={styles.wrapper}>
      <FormElementLabel label={props.label}>
        <SelectBase
          options={options}
          {...props}
          components={{
            DownChevron: DownChevron,
            LoadingIndicator: LoadingIndicator,
            MultiValueContainer: MultiValueContainer,
            MultiValueLabel: MultiValueLabel,
            Option: CustomOption,
          }}
          closeMenuOnSelect={false}
          closeMenuOnScroll={false}
        />
      </FormElementLabel>
    </div>
  );
};

export const SelectWithCustomInput = ({
  options: defaultOptions,
  onChange,
  validate,
  ...props
}) => {
  const [options, setOptions] = useState(defaultOptions);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const handleCreate = (inputValue) => {
    setError(null);
    setMessage(null);

    const { valid, value, reason } = validate(inputValue);

    if (!valid) {
      setError(reason);
      return;
    } else if (reason) {
      setMessage(reason);
    }

    const newOption = createOption(value || inputValue);
    setOptions((prev) => [...prev, newOption]);
    onChange(newOption);
  };

  return (
    <div className={styles.wrapper}>
      <FormElementLabel label={props.label}></FormElementLabel>
      <CreatableSelect
        onChange={(newValue) => {
          setError(null);
          setMessage(null);
          onChange(newValue);
        }}
        onCreateOption={handleCreate}
        options={options}
        isDisabled={props.isDisabled || props.isLoading}
        components={{
          DownChevron: DownChevron,
          LoadingIndicator: LoadingIndicator,
          Option: CustomOption,
        }}
        {...props}
      />
      {error && (
        <FormElementMessage isCritical={true}>{error}</FormElementMessage>
      )}
      {message && (
        <FormElementMessage isCritical={false}>{message}</FormElementMessage>
      )}
    </div>
  );
};

function createOption(label) {
  return {
    label,
    value: label.toLowerCase().replace(/\W/g, ""),
  };
}
