export type ModuleStatus = "AVAILABLE" | "COMING_SOON" | "DISABLED";

export type ModuleDefinition = {
  key: string;
  name: string;
  description: string;
  category: "CORE" | "OPERATIONS" | "PEOPLE" | "PLATFORM";
  version: string;
  requiredPermissions: readonly string[];
  status: ModuleStatus;
};

/** Product catalogue only. Tenant entitlements must be checked server-side before access. */
export const MODULE_REGISTRY: readonly ModuleDefinition[] = [
  { key: "finance", name: "Finance", description: "General ledger, accounts payable, receivable and financial reporting.", category: "CORE", version: "0.1.0", requiredPermissions: ["finance.access"], status: "COMING_SOON" },
  { key: "sales", name: "Sales", description: "Customer accounts, quotations, sales orders and invoicing.", category: "CORE", version: "0.1.0", requiredPermissions: ["sales.access"], status: "COMING_SOON" },
  { key: "procurement", name: "Procurement", description: "Supplier management, requisitions, purchase orders and goods receiving.", category: "CORE", version: "0.1.0", requiredPermissions: ["procurement.access"], status: "AVAILABLE" },
  { key: "inventory", name: "Inventory", description: "Item master, stock movements, warehouses and inventory valuation.", category: "OPERATIONS", version: "0.1.0", requiredPermissions: ["inventory.access"], status: "AVAILABLE" },
  { key: "people", name: "People", description: "Employee records, organization structure and workforce administration.", category: "PEOPLE", version: "0.1.0", requiredPermissions: ["people.access"], status: "COMING_SOON" },
  { key: "projects", name: "Projects", description: "Project planning, delivery, resources and cost tracking.", category: "OPERATIONS", version: "0.1.0", requiredPermissions: ["projects.access"], status: "COMING_SOON" },
  { key: "operations", name: "Operations", description: "Operational execution, assets, maintenance and service processes.", category: "OPERATIONS", version: "0.1.0", requiredPermissions: ["operations.access"], status: "COMING_SOON" },
  { key: "documents", name: "Documents", description: "Controlled business documents, records and approvals.", category: "PLATFORM", version: "0.1.0", requiredPermissions: ["documents.access"], status: "COMING_SOON" }
] as const;

export function getModuleDefinition(key: string): ModuleDefinition | undefined {
  return MODULE_REGISTRY.find((module) => module.key === key);
}
