# ORVA interface and code quality standard

This document translates principles from unslop (https://github.com/heydamir/unslop) and anti-slop (https://github.com/miqdadbadjuber/anti-slop) into ORVA-specific review rules. The references remain their authors' work; this is an original project standard.

## Product direction
- Product: configurable, multi-company business software for teams operating finance, sales, procurement, inventory, people and operational processes.
- Character: measured, precise, practical.
- World: industrial operations, accounting records and well-maintained paper trails.
- Rich moments: meaningful operational charts and dense, legible transaction tables.
- Signature: document references and status history remain visible wherever a transaction is reviewed.

## Interface rules
1. Keep navigation and controls quiet. Use ORVA navy and one blue accent; reserve semantic colors for actual status.
2. No gradient backgrounds, glow, glassmorphism, decorative blobs, gradient text, emoji icons or animated attention effects.
3. Avoid KPI-card grids as the default. Summary metrics must answer a real operational question and show units and periods.
4. Prefer tables, filters, clear empty states, inline validation, document references, approval states and audit history for business workflows.
5. Use sentence case, concise labels and specific copy. No generic welcome headlines, hype claims or exclamation marks in product UI.
6. Sample records must be plausible, internally consistent and explicitly marked as demo data. Use coherent numbering, realistic legal entities, locations, dates, currencies, units and linked counterparties.
7. Layouts must work at 390px mobile width and desktop widths. Dense tables may scroll horizontally; never shrink text until unreadable.
8. Use the existing Manrope family, 4px spacing rhythm, restrained borders and tabular numerals for financial values.
9. Every interactive control must have a working action, keyboard focus and accessible name. Do not ship decorative controls that pretend to work.
10. Do not invent production integrations, live metrics or completed workflows. Label placeholders and disabled modules honestly.

## Code rules
- Prefer small, typed modules and explicit domain names over generic abstractions.
- Keep business rules out of presentation components.
- Validate at boundaries; never trust tenant, company, user or role identifiers supplied by the browser.
- Scope every tenant-owned query by verified tenant context and enforce company access separately.
- Use decimal-safe money handling in persisted business transactions; never use JavaScript floating point for ledger arithmetic.
- Use database constraints for uniqueness and referential integrity. Add indexes for real query patterns.
- Audit consequential actions with actor, tenant, entity, timestamp and concise metadata.
- Avoid untyped escape hatches, silent catch blocks, dead code, duplicate helpers, unexplained magic values and catch-all components.
- Tests must cover authorization boundaries, validation, calculations and state transitions.

## Review checklist
- [ ] Purpose and hierarchy are clear without decorative copy.
- [ ] Spacing follows a consistent rhythm.
- [ ] Color is semantic; no glows, gradients or decorative effects.
- [ ] Icons use the existing Lucide set and consistent stroke.
- [ ] Sample data has plausible names, identifiers, dates and amounts.
- [ ] Empty, loading, error and permission-denied states are considered.
- [ ] Every visible control works or is explicitly disabled with a reason.
- [ ] Tenant and company boundaries are enforced server-side.
- [ ] Mobile layout remains readable and keyboard-accessible.
- [ ] Lint, typecheck, schema validation and build pass.
