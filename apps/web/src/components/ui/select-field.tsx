import type { SelectHTMLAttributes } from "react";

type SelectOption = { label: string; value: string };

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  options: SelectOption[];
  hint?: string;
};

export function SelectField({ label, options, hint, id, className = "", ...props }: SelectFieldProps) {
  const selectId = id ?? props.name ?? label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <div className="orva-field">
      <label className="orva-field__label" htmlFor={selectId}>{label}</label>
      <select id={selectId} className={`orva-select ${className}`.trim()} {...props}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      {hint ? <p className="orva-field__hint">{hint}</p> : null}
    </div>
  );
}