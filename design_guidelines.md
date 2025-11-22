# CRM Application Design Guidelines

## Design Approach

**Selected Framework**: Design System Approach inspired by Linear and Notion
**Justification**: This is a utility-focused, information-dense productivity tool where efficiency and learnability are paramount. The CRM requires clear data hierarchy, intuitive workflows, and consistent patterns for managing leads and communications.

**Key Design Principles**:
- Information clarity over decoration
- Efficient task-oriented workflows
- Visual hierarchy through typography and spacing, not color
- Immediate data accessibility
- Professional, clean aesthetic

---

## Typography System

**Primary Font**: Inter (Google Fonts)
**Secondary Font**: JetBrains Mono (for emails/data)

**Hierarchy**:
- Page Headers: text-2xl, font-semibold (Dashboard, Leads, Settings)
- Section Headers: text-lg, font-semibold (Import Leads, Lead Details)
- Lead/Task Titles: text-base, font-medium
- Body Text: text-sm, font-normal
- Meta Information: text-xs, font-normal (timestamps, status labels)
- Email Content: text-sm, font-mono (JetBrains Mono)

---

## Layout & Spacing System

**Spacing Primitives**: Tailwind units of 2, 4, 6, and 8
- Micro spacing: p-2, gap-2 (within components)
- Standard spacing: p-4, gap-4 (component padding, card spacing)
- Section spacing: p-6, gap-6 (between sections)
- Major spacing: p-8, gap-8 (page margins, major separations)

**Container Strategy**:
- Sidebar: fixed w-64 on desktop
- Main content area: flex-1 with max-w-7xl mx-auto px-8
- Modal overlays: max-w-2xl for email composer, max-w-lg for confirmations

---

## Core Component Library

### Navigation & Layout

**Sidebar Navigation** (Left):
- Fixed height, scrollable content
- Logo/brand area at top (h-16)
- Primary navigation items with icons (h-10 each)
- Active state: font-semibold with subtle left border indicator
- Items: Dashboard, All Leads, Import, Settings
- Bottom section: User profile (h-16)

**Top Bar**:
- Height: h-16
- Contains: Search bar (flex-1), notification bell icon, user avatar
- Search: Prominent search input with icon (w-96)
- Right-aligned utility controls

### Lead Management Components

**Lead Card** (Main Dashboard View):
- Card container: p-4, rounded-lg border
- Three-column internal grid layout:
  - Left: Client name (font-medium) + email (text-sm, truncate)
  - Center: Lead description/notes preview (text-sm, line-clamp-2)
  - Right: Status badge + Reply button
- Row height: min-h-20
- Hover state: subtle elevation change

**Status Badge System**:
- Compact pill design: px-3 py-1, rounded-full, text-xs, font-medium
- States: New, Contacted, Qualified, Follow-up, Closed Won, Closed Lost
- Always uppercase text

**Action Buttons**:
- Primary (Reply): px-4 py-2, rounded-md, font-medium, with icon
- Secondary: Similar sizing with different visual treatment
- Icon-only: p-2, rounded-md (for edit, delete actions)

### Data Display Components

**Lead Details Panel** (Expandable or Side Drawer):
- Width: w-96 on desktop, full-width on mobile
- Sections with clear dividers (border-b, pb-4, mb-4):
  - Client Information (name, email, phone)
  - Lead Details (source, value, notes)
  - Communication History (timeline view)
  - Status Timeline (audit log of changes)

**Communication History Timeline**:
- Vertical timeline with left border indicator
- Each entry: pl-6 with connector line
- Entry structure:
  - Timestamp (text-xs, above)
  - Message preview or status change
  - Expand/collapse for full email content
  - "Sent" vs "Received" visual distinction

**Import Upload Area**:
- Large dropzone: min-h-48, border-2 border-dashed, rounded-lg
- Center-aligned content with upload icon, heading, and helper text
- File type indicators: "Supports .xlsx, .csv, Google Sheets"
- After upload: Preview table with column mapping interface

### Modal Overlays

**Email Composer Modal**:
- Centered overlay with backdrop blur
- Modal dimensions: w-full max-w-2xl, min-h-96
- Structure:
  - Header: "Reply to [Client Name]" with close button (h-14, border-b)
  - Recipient info: To field pre-filled, display only (p-4)
  - Subject line: Input field (h-12)
  - Email body: Textarea with min-h-64, font-mono
  - Footer: Cancel + Send buttons (h-16, border-t, flex justify-end)

**Reply Notification Modal**:
- Smaller centered modal: max-w-md
- Structure:
  - Icon indicator (envelope icon, text-4xl)
  - Heading: "New Reply from [Client Name]"
  - Email preview (max-h-48, overflow-y-auto)
  - Action buttons: "View Full Email" (primary), "Dismiss" (secondary)

### Table Components

**Leads Table View** (Alternative to cards):
- Fixed header row with sortable columns
- Columns: Checkbox, Client Name, Email, Lead Source, Status, Last Contact, Actions
- Row height: h-14
- Alternating row treatment for scannability
- Sticky header on scroll

**Import Preview Table**:
- Column mapping row above table headers
- Draggable column headers for reordering
- Sample data rows (first 5 rows from import)
- Validation indicators per cell

---

## Dashboard Layout Structure

**Main Dashboard** (Primary View):
1. **Top Stats Bar**: 4-column grid of metric cards
   - Each card: p-4, rounded-lg, border
   - Large number (text-3xl, font-bold)
   - Label beneath (text-sm)
   - Metrics: Total Leads, Active, Contacted This Week, Conversion Rate

2. **Filter & Controls Bar**: h-12, flex items-center justify-between
   - Left: Status filter chips (inline, gap-2)
   - Right: View toggle (cards/table), Sort dropdown

3. **Leads Container**: 
   - Card view: grid grid-cols-1 gap-4 (single column stack)
   - Each lead card as described above
   - Infinite scroll or pagination at bottom

4. **Floating Action Button**: Fixed bottom-right
   - Large: w-14 h-14, rounded-full
   - Icon: Plus or "Import" text
   - Opens import modal

---

## Interaction Patterns

**Lead Card Interactions**:
- Click anywhere on card: Expands to show details panel
- Reply button: Opens email composer modal (prevents card expansion)
- Status dropdown: Inline status change without modal

**Search Behavior**:
- Real-time filtering as user types
- Searches: Client name, email, lead notes
- Empty state message when no results

**Email Flow**:
1. Click Reply → Modal opens with pre-filled recipient
2. Compose message → Click Send → Loading state → Success confirmation
3. Modal closes, lead card shows "Last contacted: Just now"
4. When reply received → Notification modal appears
5. Click "View Full Email" → Opens lead details with email expanded

---

## Responsive Behavior

**Desktop (lg and above)**:
- Sidebar visible, main content area flexible
- Lead cards: single column (easier scanning)
- Modals: max-w-2xl centered

**Tablet (md)**:
- Sidebar collapses to icons only (w-16)
- Main content: full width minus icon sidebar
- Stats bar: 2x2 grid

**Mobile (base)**:
- Hamburger menu replaces sidebar
- Stats bar: vertical stack
- Lead cards: full width, simplified layout (stack elements)
- Email composer: full screen modal

---

## Images

This CRM application is a productivity tool focused on data and functionality - **no hero images or decorative imagery**. The interface is driven by typography, layout, and functional components.

**Icon Usage**:
- Heroicons throughout (via CDN)
- Navigation icons: outline style
- Action buttons: outline style for secondary, solid for primary
- Status indicators: solid style
- User avatars: initials fallback in circular containers

---

## Animation Guidelines

**Minimal animations only**:
- Modal entry/exit: 200ms fade + slight scale
- Dropdown menus: 150ms slide-down
- Status badge changes: 200ms cross-fade
- NO scroll animations, parallax, or decorative motion
- Focus on instant feedback for user actions