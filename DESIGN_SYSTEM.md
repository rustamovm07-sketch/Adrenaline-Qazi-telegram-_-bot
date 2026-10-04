# Adrenalin Qazi interface direction

## Product and workflow foundation

Adrenalin Qazi is an Uzbek grocery and deli shop inside Telegram, with a separate owner dashboard. Customers browse and search the catalog, maintain their delivery profile, add products to a persistent cart, attach a delivery location image, and place orders. The owner reviews orders, manages products and categories, tracks stock and customers, exports reports, and edits store settings. Telegram signed `initData` is the customer and owner identity source. Payment provider callbacks are not connected, so orders remain pending and paid status must not be simulated.

## Four design concepts

1. **Refined Evolution** — Keep the existing cream and brass identity, fixed left owner navigation, familiar cards, and current task sequence. Improve alignment, spacing, focus states, text contrast, and mobile menu behavior. This is the lowest-risk migration and best preserves recognition.
2. **Premium and Distinctive** — Use editorial serif display typography, larger product photography, brass rules, restrained dark wood surfaces, and a more composed store identity. Keep forms and order controls conventional. Memorable for the customer shop, but adds image and typography cost and consumes space in dense admin work.
3. **Bold and Contemporary** — Use an asymmetric catalog grid, oversized category labels, a compact rail navigation, and large type contrast with a restrained charcoal and saffron palette. This gives the brand more character but requires more component and responsive changes, increasing regression risk.
4. **Clarity and Efficiency** — Use a stable navigation rail, clear page titles, compact consistent spacing, readable operational tables, visible action hierarchy, high contrast, and mobile-first stacking. Optimize repeated owner tasks and keep the customer's catalog simple. This is the selected direction for the existing admin shell.

## Comparison (1–5)

| Direction | Usability | Preserve workflows | Readability | Mobile | Accessibility | Brand fit | Feasibility | Performance |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Refined Evolution | 4 | 5 | 4 | 4 | 4 | 5 | 5 | 5 |
| Premium and Distinctive | 4 | 4 | 4 | 3 | 4 | 5 | 3 | 3 |
| Bold and Contemporary | 3 | 3 | 3 | 4 | 3 | 4 | 2 | 4 |
| Clarity and Efficiency | 5 | 5 | 5 | 5 | 5 | 4 | 4 | 5 |

## Selected direction and implemented system

**Clarity and Efficiency**, with the existing warm cream and brass cues retained for brand continuity. The owner shell now has reusable semantic color tokens, a clearer text palette, keyboard focus outlines, reduced-motion behavior, and a narrow-screen table sizing rule. Existing page modules and workflows remain intact.

- Typography: system sans stack; page titles and labels remain differentiated by existing weight and size hierarchy.
- Colors: warm page `#f6f3ed`, near-white surface `#fffefa`, ink `#211d16`, muted text `#716a5f`, line `#e7e1d6`, brass accent `#8c6427`, focus `#9a6b20`.
- Spacing: retain existing Tailwind 4 px scale and page padding; controls retain existing component spacing.
- Interaction: explicit 3 px keyboard focus ring, reduced motion, 40 px shell controls, current mobile drawer and desktop rail.
- Responsive: existing responsive navigation collapse is preserved; tables retain readable minimum width on small screens and must be placed in horizontal scroll containers by page modules.

## Production readiness limits

This is a considered direction record and an incremental design-system implementation, not four coded prototypes or responsive screenshot approval. The repository does not currently include browser visual tests. Before a production verdict, verify the four requested viewport widths in an actual Telegram WebView/browser, confirm all table containers scroll on mobile, and run the backend, frontend, dependency, and secret audits. Payment provider setup and deployment infrastructure remain external prerequisites documented in `README.md`.
