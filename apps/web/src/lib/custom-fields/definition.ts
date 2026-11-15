export const CUSTOM_FIELD_TYPES = ["TEXT", "NUMBER", "BOOLEAN", "DATE", "DATETIME", "SELECT"] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export type CustomFieldInput = {
  entityKey: string;
  fieldKey: string;
  label: string;
  dataType: CustomFieldType;
  isRequired?: boolean;
  configuration?: Record<string, unknown>;
};

const KEY_PATTERN = /^[a-z][a-z0-9_]{1,62}$/;

export function validateCustomField(input: CustomFieldInput): string[] {
  const errors: string[] = [];
  if (!KEY_PATTERN.test(input.entityKey)) errors.push("entityKey must be lowercase snake_case and 2-63 characters.");
  if (!KEY_PATTERN.test(input.fieldKey)) errors.push("fieldKey must be lowercase snake_case and 2-63 characters.");
  if (!input.label.trim() || input.label.length > 100) errors.push("label must contain 1-100 characters.");
  if (!CUSTOM_FIELD_TYPES.includes(input.dataType)) errors.push("Unsupported custom field type.");
  if (input.dataType === "SELECT") {
    const options = input.configuration?.options;
    if (!Array.isArray(options) || options.length === 0 || options.some((option) => typeof option !== "string" || !option.trim())) {
      errors.push("SELECT fields require a non-empty string options array.");
    }
  }
  return errors;
}
