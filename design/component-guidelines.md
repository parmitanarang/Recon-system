# Component Guidelines
## Reconciliation Platform UI

This document defines how UI components must be implemented.

All components should follow the design tokens in `design-tokens.json`.

Preferred stack:

- React
- Tailwind
- Shadcn UI
- TanStack Table
- Recharts

---

# 1. Buttons

Buttons represent primary actions.

### Types

Primary

Used for main actions.

Examples:

- Run Reconciliation
- Confirm Match

Style:

- background: primary color
- text: white
- radius: md
- padding: 10px 16px

---

Secondary

Used for secondary actions.

Style:

- background: white
- border: default border color
- text: primary text color

---

Danger

Used for destructive actions.

Examples:

- Delete Rule
- Reject Match

Style:

- background: error color
- text: white

---

# 2. Cards

Cards are used to display metrics or grouped information.

Card rules:

- padding: 16px
- border radius: md
- subtle shadow
- white background

Example content:

Metric cards
Analytics cards
Summary panels

---

# 3. KPI Cards

Used in dashboards.

Structure:

Metric Label  
Large Value  
Trend Indicator

Example:

Auto Match Rate  
92.4%  
↑ 2.1%

Rules:

- value must be large and prominent
- trend indicator color coded
- cards arranged in horizontal row

---

# 4. Data Tables

Tables are the primary UI element.

Use TanStack Table.

Tables must support:

- sorting
- column filters
- pagination
- column resizing
- sticky header

Example columns:

Transaction ID  
Merchant  
Amount  
Status  
Gateway  
Date

---

# 5. Status Chips

Use chips to represent status.

Matched

- background: success light
- text: success

Exception

- background: error light
- text: error

Pending

- background: warning light
- text: warning

---

# 6. Filters

Filters must appear above tables.

Standard filters:

Date Range  
Merchant  
Gateway  
Status  
Amount Range

Filters should support:

- multi select
- clear all
- saved filter sets

---

# 7. Modals

Use modals for secondary workflows.

Examples:

Transaction details  
Match confirmation  
Rule creation

Modal rules:

- width: 600–800px
- padding: 24px
- backdrop blur

---

# 8. Charts

Charts should use Recharts.

Preferred charts:

Line chart → trends  
Bar chart → comparisons  
Donut chart → proportions

Rules:

- max 3 colors
- avoid gradients
- clean gridlines

---

# 9. Side Panels

Use side panels for investigation workflows.

Example:

Transaction investigation

Panel width:

400px

Panel sections:

Transaction Details  
Suggested Match  
Investigation Notes

---

# 10. Skeleton Loading

Use skeleton loaders for async data.

Skeletons should mimic:

- table rows
- card layout
- charts

---

# 11. Empty States

Empty states must be informative.

Example:

"No exceptions found"

Include:

- icon
- message
- optional action button

---

# 12. Hover States

All interactive elements must have hover states.

Examples:

Table row highlight  
Button background change  
Clickable card shadow increase

---

# 13. Keyboard Navigation

Tables must support:

Arrow key navigation  
Enter to open detail view

Global search:

CMD + K

---

# 14. Accessibility

All components must include:

ARIA labels  
Focus outlines  
Keyboard support

---

# 15. Performance

Components must support large datasets.

Guidelines:

- virtualized tables
- server side filtering
- pagination

