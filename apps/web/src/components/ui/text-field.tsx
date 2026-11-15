import type { InputHTMLAttributes } from "react";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
};

export function TextField({ label, hint, error, id, className = "", ...props }: TextFieldProps) {
  const inputId = id ?? props.name ?? label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
  return (
    <div className="orva-field">
      <label className="orva-field__label" htmlFor={inputId}>{label}</label>
      <input id={inputId} className={`orva-input ${error ? "orva-input--error" : ""} ${className}`.trim()} aria-invalid={Boolean(error)} aria-describedby={describedBy} {...props} />
      {error ? <p className="orva-field__error" id={`${inputId}-error`}>{error}</p> : hint ? <p className="orva-field__hint" id={`${inputId}-hint`}>{hint}</p> : null}
    </div>
  );
}