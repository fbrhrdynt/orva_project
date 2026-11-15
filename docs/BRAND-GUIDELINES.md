# ORVA Brand & Interface Guidelines

**Version:** 1.0  
**Product:** orva.  
**Owner:** LogiSource Digital

These guidelines govern all ORVA surfaces: application launcher, platform shell, business modules, administration, reports, and documentation.

## 1. Brand identity

- Product wordmark: `orva.`
- Always use lowercase.
- Preserve the terminal period.
- Do not recreate the wordmark using arbitrary font substitutions when official vector artwork is available.
- Brand descriptor: **by LogiSource Digital**.
- Product category: Enterprise Business Platform.

## 2. Brand character

ORVA should feel:

- Calm and confident.
- Precise and dependable.
- Modern without chasing visual trends.
- Professional without feeling cold.
- Dense with useful information when the task requires it.
- Consistent across modules.

ORVA is not a SAP visual clone. Enterprise process discipline is a reference; visual identity and interaction patterns must remain original to ORVA.

## 3. Core visual tokens

| Token | Value | Use |
|---|---|---|
| Navy | `#1A2334` | Primary brand surfaces, key navigation and wordmark contexts |
| Accent blue | `#4263D6` | Primary actions, selected states, links and restrained emphasis |
| White | `#FFFFFF` | Main light surfaces |
| UI neutrals | Derived neutral scale | Text, borders, backgrounds and disabled states |

Do not introduce extra accent colors without a documented design decision. Status colors must be semantic and restrained, not decorative.

## 4. Typography

Primary typeface: **Manrope**.

Approved weights:
- 400 Regular: body text and standard controls.
- 500 Medium: labels and secondary emphasis.
- 600 SemiBold: section titles and important values.
- 700 Bold: limited high-emphasis headings.

Use a clear hierarchy. Avoid oversized marketing-style headings inside operational screens. Numeric data should align consistently and remain easy to scan.

## 5. Layout and components

- Prefer structured layouts, clear alignment, and consistent spacing.
- Use restrained borders and subtle elevation.
- Use compact, readable data tables for transactional work.
- Use clear page titles, breadcrumbs, contextual actions, and predictable navigation.
- Forms should group fields by business meaning and show validation beside the relevant field.
- Use drawers or dialogs only when they improve task continuity.
- Keep responsive behavior usable on tablet and mobile without sacrificing desktop productivity.

## 6. Motion and interaction

- Use short, subtle transitions.
- Motion must communicate state changes or preserve spatial context.
- Respect reduced-motion preferences.
- Avoid parallax, decorative animation, bouncing controls, and animated backgrounds.

## 7. Anti-AI-slop rules

Do not use:
- Generic gradient hero sections.
- Glassmorphism as a default surface treatment.
- Excessive rounded cards or pill-shaped controls.
- Random colorful icon tiles.
- Emoji as application icons.
- Decorative charts with fabricated data.
- Repeated KPI cards that add no decision value.
- Huge empty dashboard areas.
- Marketing copy inside operational workflows.
- Unnecessary labels such as “AI-powered” without a real capability.
- Inconsistent icon families or arbitrary color choices.

Every component must have a clear purpose. Prefer hierarchy, typography, spacing, and useful data over decoration.

## 8. Iconography

Use one consistent line-icon family with consistent stroke weight and optical sizing. Icons must improve recognition or navigation. Do not mix emoji, filled illustrations, and unrelated icon styles.

## 9. Accessibility

- Maintain readable contrast.
- Provide visible keyboard focus.
- Label form controls.
- Do not communicate status by color alone.
- Support keyboard navigation and reduced motion.
- Use semantic HTML and accessible interaction patterns.

## 10. Design review checklist

Before accepting a screen, verify:
1. Does it look and feel like ORVA?
2. Is the information hierarchy obvious?
3. Are color and motion restrained?
4. Does every visual element serve a purpose?
5. Can a user complete the business task efficiently?
6. Is the screen consistent with other ORVA modules?
7. Does it work at the required viewport sizes?
8. Is it accessible and keyboard usable?

## 11. Shared component implementation

The web application implements reusable primitives under `apps/web/src/components/ui`:
- Button: primary, secondary, ghost, and danger variants; small, medium, and large sizes.
- Badge: neutral, info, success, warning, and danger semantic tones.
- TextField and SelectField: associated labels, optional helper text, and validation support.
- PageHeader: consistent eyebrow, title, description, and action placement.
- DataTable: semantic table markup, aligned numeric columns, and an explicit empty state.

New module screens should compose these primitives rather than introducing module-specific visual patterns. Add a new primitive only when it represents a repeated interaction pattern or a meaningful accessibility improvement.
