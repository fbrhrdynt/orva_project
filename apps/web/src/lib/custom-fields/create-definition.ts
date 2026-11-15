import { db } from "@/lib/db";
import { requirePermission, type VerifiedTenantContext } from "@/lib/tenant/access";
import { validateCustomField, type CustomFieldInput } from "./definition";

export class CustomFieldValidationError extends Error {
  constructor(readonly issues: string[]) {
    super("Custom field definition is invalid.");
    this.name = "CustomFieldValidationError";
  }
}

export async function createCustomFieldDefinition(
  context: VerifiedTenantContext,
  input: CustomFieldInput
) {
  requirePermission(context, "platform.custom_fields.create");
  const issues = validateCustomField(input);
  if (issues.length) throw new CustomFieldValidationError(issues);

  return db.customFieldDefinition.create({
    data: {
      tenantId: context.tenantId,
      entityKey: input.entityKey,
      fieldKey: input.fieldKey,
      label: input.label.trim(),
      dataType: input.dataType,
      isRequired: input.isRequired ?? false,
      configuration: input.configuration as object | undefined
    }
  });
}
