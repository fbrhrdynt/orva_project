export const DEMO_WORKSPACE = {
  environment: "DEMO DATA",
  tenant: { name: "Nusantara Industrial Group", slug: "nusantara-industrial", currency: "IDR" },
  companies: [
    { code: "NIG", name: "Nusantara Industrial Group", city: "Jakarta", country: "Indonesia" },
    { code: "NMS", name: "Nusantara Manufacturing Services", city: "Cikarang", country: "Indonesia" }
  ],
  businessUnits: [
    { code: "HQ", name: "Head Office", company: "NIG", city: "Jakarta" },
    { code: "CKR", name: "Cikarang Plant", company: "NMS", city: "Cikarang" },
    { code: "SBY", name: "Surabaya Distribution", company: "NIG", city: "Surabaya" }
  ],
  users: [
    { name: "Aditya Pranata", email: "aditya.pranata@example.test", role: "Finance Manager", unit: "HQ" },
    { name: "Nadia Putri", email: "nadia.putri@example.test", role: "Procurement Lead", unit: "HQ" },
    { name: "Rizky Mahendra", email: "rizky.mahendra@example.test", role: "Warehouse Supervisor", unit: "CKR" },
    { name: "Maya Lestari", email: "maya.lestari@example.test", role: "Sales Executive", unit: "SBY" }
  ],
  customers: [
    { code: "CUS-0018", name: "PT Cipta Karya Teknik", city: "Bekasi", terms: "NET 30", creditLimit: 250000000 },
    { code: "CUS-0024", name: "PT Samudra Energi Nusantara", city: "Balikpapan", terms: "NET 45", creditLimit: 400000000 },
    { code: "CUS-0031", name: "PT Mitra Sarana Industri", city: "Surabaya", terms: "NET 30", creditLimit: 180000000 }
  ],
  suppliers: [
    { code: "SUP-0007", name: "PT Baja Prima Persada", category: "Raw materials", city: "Cilegon" },
    { code: "SUP-0012", name: "PT Sumber Teknik Abadi", category: "MRO supplies", city: "Jakarta" },
    { code: "SUP-0019", name: "PT Kimia Industri Makmur", category: "Process chemicals", city: "Gresik" }
  ],
  items: [
    { sku: "RM-STEEL-PLT-06", name: "Mild steel plate 6 mm", category: "Raw material", uom: "SHEET", unitCost: 1850000 },
    { sku: "CH-IND-045", name: "Industrial degreaser 45 L", category: "Chemical", uom: "DRUM", unitCost: 1275000 },
    { sku: "MRO-BRG-220", name: "Bearing 6205-2RS", category: "MRO", uom: "PCS", unitCost: 87500 },
    { sku: "FG-PMP-100", name: "Centrifugal pump assembly 10 HP", category: "Finished goods", uom: "UNIT", unitCost: 18750000 }
  ],
  warehouses: [
    { code: "WH-CKR-01", name: "Cikarang Raw Materials", unit: "CKR" },
    { code: "WH-CKR-02", name: "Cikarang Finished Goods", unit: "CKR" },
    { code: "WH-SBY-01", name: "Surabaya Distribution", unit: "SBY" }
  ],
  purchaseOrders: [
    { number: "PO-2026-00418", supplier: "PT Baja Prima Persada", date: "2026-11-13", due: "2026-11-20", amount: 148000000, status: "Awaiting approval" },
    { number: "PO-2026-00416", supplier: "PT Sumber Teknik Abadi", date: "2026-11-12", due: "2026-11-18", amount: 26750000, status: "Approved" },
    { number: "PO-2026-00411", supplier: "PT Kimia Industri Makmur", date: "2026-11-10", due: "2026-11-17", amount: 76500000, status: "Partially received" }
  ],
  salesOrders: [
    { number: "SO-2026-00287", customer: "PT Cipta Karya Teknik", date: "2026-11-15", amount: 92500000, status: "Confirmed" },
    { number: "SO-2026-00284", customer: "PT Samudra Energi Nusantara", date: "2026-11-14", amount: 187500000, status: "Awaiting fulfilment" },
    { number: "SO-2026-00279", customer: "PT Mitra Sarana Industri", date: "2026-11-12", amount: 46300000, status: "Delivered" }
  ],
  invoices: [
    { number: "INV-AR-2026-0118", party: "PT Cipta Karya Teknik", due: "2026-11-22", amount: 92500000, status: "Unpaid" },
    { number: "INV-AR-2026-0112", party: "PT Samudra Energi Nusantara", due: "2026-11-18", amount: 187500000, status: "Overdue" },
    { number: "INV-AP-2026-0087", party: "PT Baja Prima Persada", due: "2026-11-21", amount: 148000000, status: "Pending payment" }
  ],
  activity: [
    { time: "09:42", actor: "Nadia Putri", action: "Submitted purchase order", reference: "PO-2026-00418", detail: "PT Baja Prima Persada" },
    { time: "09:16", actor: "Maya Lestari", action: "Confirmed sales order", reference: "SO-2026-00287", detail: "PT Cipta Karya Teknik" },
    { time: "08:54", actor: "Rizky Mahendra", action: "Posted goods receipt", reference: "GR-2026-00196", detail: "Warehouse WH-CKR-01" },
    { time: "08:21", actor: "Aditya Pranata", action: "Approved journal entry", reference: "JE-2026-00642", detail: "November operating expense" }
  ],
  monthlyRevenue: [
    { month: "Jun", value: 420 }, { month: "Jul", value: 465 }, { month: "Aug", value: 438 },
    { month: "Sep", value: 512 }, { month: "Oct", value: 548 }, { month: "Nov", value: 586 }
  ]
} as const;

export const formatIDR = (amount: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount);

export const formatCompactIDR = (amount: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", notation: "compact", maximumFractionDigits: 1 }).format(amount);
