/**
 * Staff Help Center — content source.
 *
 * This is a dev-maintained content module, not a CMS model. CLAUDE.md's
 * CMS-first rule governs customer/marketing-facing content (homepage,
 * footer, FAQ, etc.) editable from the Admin Dashboard; this is internal
 * staff documentation, maintained by developers through normal code review,
 * the same way AGENTS.md itself is. There is deliberately no admin CRUD UI
 * for these articles — see docs/HELP_CENTER.md for how to update them.
 *
 * Canonical external source: "Puso Shop — Staff Training Guide" (Google Doc,
 * last updated September 2026). Articles marked `verified: true` were cross-
 * checked against the actual implementation at authoring time (Oct 2026) and
 * carry a `correction` field wherever the source guide was found stale —
 * those articles follow the code/runbook, not the guide, and say so. Articles
 * marked `verified: false` reproduce the source guide's own wording for
 * areas not independently re-derived from code at authoring time.
 *
 * Body block shape — one of:
 *   { type: 'p', text }
 *   { type: 'steps', items: [string, ...] }   — ordered
 *   { type: 'list', items: [string, ...] }    — unordered
 *   { type: 'note', text }                    — informational callout
 *   { type: 'warning', text }                 — safety/financial callout
 *   { type: 'image', src, alt }               — src is null until a
 *     screenshot has been extracted and placed under
 *     frontend/public/help/images/ (see docs/HELP_CENTER.md); the UI must
 *     render nothing (not a broken image) when src is null.
 */

export const HELP_CATEGORIES = [
  {
    id: 'getting-started',
    label: 'Getting Started',
    description: 'Signing in, the admin dashboard, and what your role can see.',
  },
  {
    id: 'orders-fulfillment',
    label: 'Orders & Fulfillment',
    description: 'Orders, payment status, shipments, and courier tracking.',
  },
  {
    id: 'returns-refunds',
    label: 'Returns & Refunds',
    description: 'Reviewing returns and the refund recording workflow — read the safeguards before touching a refund.',
  },
  {
    id: 'products-catalog',
    label: 'Products & Catalog',
    description: 'Products, stock, and leagues.',
  },
  {
    id: 'events-passes',
    label: 'Events & Passes',
    description: 'Venues, pass events, ticket tiers, and event-day check-in.',
  },
  {
    id: 'marketing-content',
    label: 'Marketing & Content',
    description: 'Homepage, campaigns, Fit Check, and promo codes.',
  },
  {
    id: 'reports-analytics',
    label: 'Reports & Analytics',
    description: 'Every reporting workspace and what it requires.',
  },
  {
    id: 'staff-settings',
    label: 'Account, Staff & Settings',
    description: 'Managing staff accounts, customers, and platform settings.',
  },
  {
    id: 'troubleshooting',
    label: 'Troubleshooting & Common Scenarios',
    description: 'What to do when something looks wrong.',
  },
];

export const HELP_ARTICLES = [
  // ---------------------------------------------------------------- Getting Started
  {
    slug: 'platform-overview',
    categoryId: 'getting-started',
    title: 'Platform Overview',
    summary: 'What Puso Shop is, and the two sides of the platform.',
    keywords: ['overview', 'puso shop', 'customer side', 'admin side'],
    departments: [],
    sourceRef: 'Training Guide §1',
    verified: false,
    body: [
      { type: 'p', text: 'Puso Shop (pusostore.com) is an official Philippine sports merchandise e-commerce platform. It sells jerseys, apparel, and gear for local sports teams across the PBA, PVL, UAAP, NCAA, MPBL, and more.' },
      { type: 'list', items: [
        'Customer side (pusostore.com) — browse and buy official merchandise, use Fit Check (AI Virtual Try-On), track orders, buy event passes.',
        'Admin side (pusostore.com/admin) — manage products, orders, shipments, and returns; view reports; manage customers and staff; configure settings.',
      ] },
    ],
  },
  {
    slug: 'how-customers-use-puso-shop',
    categoryId: 'getting-started',
    title: 'How Customers Use Puso Shop',
    summary: 'A quick tour of the storefront, cart, checkout, and account so you can answer a customer’s question with confidence.',
    keywords: ['customer', 'storefront', 'cart', 'checkout', 'my puso', 'locker', 'fit check', 'following'],
    departments: [],
    sourceRef: 'Training Guide §2–§10',
    verified: false,
    body: [
      { type: 'p', text: 'Customers browse products at pusostore.com/products, filtering by Category, Sport, Gender, or League, or using search (partial words work — "gilas" matches all Gilas Pilipinas products).' },
      { type: 'p', text: 'On a product page, customers pick a size (sizes with no stock are grayed out), can open a Size Guide, and can use Fit Check — the AI Virtual Try-On feature — if it’s enabled on that product.' },
      { type: 'note', text: 'Fit Check gives each customer a daily quota (logged-in and guest users have separate allowances). If a Fit Check Campaign sponsors the product, the quota is removed entirely for that product. A failed generation still counts against the quota.' },
      { type: 'p', text: 'The cart has two separate tabs: Merchandise and Passes. These are never checked out together — a customer buying a jersey and a game pass needs two separate checkouts. This is a hard platform rule, not a UI quirk.' },
      { type: 'p', text: 'Checkout is seven steps: contact info, delivery address, delivery method, promo code, payment method (Maya, GCash, Credit/Debit Card, etc. — whichever channels are configured), order summary, and Place Order. The customer is then redirected to the payment gateway and returns to an Order Confirmation page.' },
      { type: 'p', text: 'Orders move through: Awaiting Payment → Paid → Processing → Packed → Shipped → Delivered, with Returned, Cancelled, Expired, and Failed Payment as the other possible states.' },
      { type: 'p', text: 'A logged-in customer’s account is the My PUSO Portal (pusostore.com/account), organized around four sections — Home (a personalized feed), Locker (past merchandise orders and event passes, shown as scannable QR passes), Fit Check (their AI try-on history), and Following (teams they follow). Settings (profile, addresses, password, security) is a secondary area reached from the avatar.' },
      { type: 'p', text: 'If eligible, a customer can request a return from their order page. Only customers who purchased a product may leave a review on it.' },
    ],
  },
  {
    slug: 'signing-in-to-admin',
    categoryId: 'getting-started',
    title: 'Signing In to the Admin Dashboard',
    summary: 'How to reach pusostore.com/admin, and what happens if your account is deactivated.',
    keywords: ['login', 'sign in', 'admin access', 'deactivated', 'password'],
    departments: [],
    sourceRef: 'Verified against backend/middleware/auth.js',
    verified: true,
    body: [
      { type: 'p', text: 'Staff sign in at the same login as customers (pusostore.com/login), using the email and password — or Google account — tied to their staff account. There is no separate staff login page; your account’s role determines what you see.' },
      { type: 'p', text: 'Only an account with role "admin" can reach anything under /admin at all. Forgot your password? Use "Forgot Password" on the login page to receive a reset link by email.' },
      { type: 'warning', text: 'If your staff account has been deactivated, access is removed immediately on your very next request — even with a token issued before the deactivation. You do not need to log out and back in for a deactivation to take effect; it already has.' },
    ],
  },
  {
    slug: 'admin-dashboard-overview',
    categoryId: 'getting-started',
    title: 'Admin Dashboard Overview',
    summary: 'What you see when you log in, and how the sidebar adapts to your role.',
    keywords: ['dashboard', 'sidebar', 'widgets', 'navigation'],
    departments: [],
    sourceRef: 'Training Guide §11',
    verified: false,
    body: [
      { type: 'p', text: 'The Admin Dashboard (pusostore.com/admin) is the first screen after login. It shows pinned metric widgets (e.g. orders today, revenue today), a Recent Orders table, and quick links to common tasks.' },
      { type: 'image', src: null, alt: 'The Admin Dashboard, showing pinned metric widgets, top products, and a recent orders table.' },
      { type: 'note', text: 'The left sidebar only shows the sections your department has permission for. Dashboard and this Help Center are the two items every staff account sees, regardless of department — if a link you expect isn’t there, it’s a permissions question, not a bug. See "Staff Roles & Permissions."' },
    ],
  },
  {
    slug: 'staff-roles-permissions',
    categoryId: 'getting-started',
    title: 'Staff Roles & Permissions',
    summary: 'What each department can see and do — corrected against the live permission system.',
    keywords: ['roles', 'permissions', 'department', 'executive', 'finance', 'operations', 'warehouse', 'marketing', 'support', 'scanner', 'order management'],
    departments: [],
    sourceRef: 'Training Guide §12',
    verified: true,
    correction: 'The source guide’s Finance description omits refunds.manage (Record/Adjust Refund) entirely — added to Finance’s default permissions by the Oct 2026 refund-workflow hardening, after the guide’s September 2026 "last updated" date. The list below reflects the current, live permission bundles in backend/lib/permissions.js.',
    body: [
      { type: 'p', text: 'Every staff account has a department, assigned when the account is created. A department grants a default bundle of permissions; an individual account can also be granted extra permissions on top of its department’s default (but a department’s default can never be taken away without changing the department itself).' },
      { type: 'warning', text: 'Correction to the written guide: Finance’s permissions include Refunds Manage (recording and adjusting refunds), not just viewing and approving returns. This is the core of Finance’s day-to-day role — see "Returns & Refunds."' },
      { type: 'list', items: [
        'Executive — full access to everything, always. Overrides every other check.',
        'Finance — Executive, Sales, and Finance reports. View orders and returns. Approve returns. Record and adjust refunds.',
        'Operations — manage orders and fulfillment (shipments). Approve returns. View Sales, Products, and Operations reports. Manage commerce settings. Scan event passes.',
        'Warehouse — view orders, manage fulfillment/shipments. View products. Scan event passes.',
        'Marketing — manage the homepage, campaigns, Fit Check campaigns, promotions, and pass events. View Fit Check, Organizations, and Customers reports. Manage Fit Check settings.',
        'Support — view and manage users/customers. View orders and returns. Approve returns. View Customers reports.',
        'Scanner — scan and check in event passes. Nothing else.',
        'Order Management — view and manage orders; advance shipment status only (not assign courier, add notes, or cancel — those stay Operations/Warehouse-only).',
      ] },
      { type: 'note', text: 'An admin account with no department assigned at all is treated as full-access (a bootstrap safety net for the very first admin account, not the intended steady state). Every new staff account should be given a real department.' },
    ],
  },

  // ------------------------------------------------------------- Orders & Fulfillment
  {
    slug: 'viewing-orders',
    categoryId: 'orders-fulfillment',
    title: 'Viewing the Orders List',
    summary: 'Order number, customer, status badges, and filters.',
    keywords: ['orders', 'order list', 'status badge', 'filter'],
    departments: ['finance', 'operations', 'warehouse', 'order_management', 'support'],
    sourceRef: 'Training Guide §14',
    verified: false,
    body: [
      { type: 'p', text: 'pusostore.com/admin/orders lists every order with order number, customer name, date placed, a color-coded status badge, and total. Use the filter bar to search by order number or customer name, or filter by status.' },
      { type: 'image', src: null, alt: 'The Admin Orders list, showing order number, customer, total, payment, status, and date columns.' },
      { type: 'list', items: [
        'Yellow — Awaiting Payment', 'Blue — Paid', 'Indigo — Processing', 'Violet — Packed',
        'Purple — Shipped', 'Green — Delivered', 'Orange — Returned', 'Red — Cancelled',
        'Gray — Expired', 'Rose — Failed Payment',
      ] },
    ],
  },
  {
    slug: 'order-detail-and-timeline',
    categoryId: 'orders-fulfillment',
    title: 'The Order Detail Page & Event Timeline',
    summary: 'Everything that happened to an order, who did it, and how to update payment status safely.',
    keywords: ['order detail', 'timeline', 'payment status', 'admin note', 'webhook'],
    departments: ['finance', 'operations', 'warehouse', 'order_management', 'support'],
    sourceRef: 'Training Guide §14',
    verified: false,
    body: [
      { type: 'p', text: 'Click any order to open pusostore.com/admin/orders/[order-number]. It shows order number and date, customer contact info, delivery address, items (size/color/quantity/price), payment status and gateway, shipment status, and the Order Event Timeline — a full audit log of everything that happened: creation, payment attempts, status changes, admin notes, and webhook receipts.' },
      { type: 'image', src: null, alt: 'The Order Detail page, showing items, customer contact info, fulfillment status, and the order event timeline.' },
      { type: 'list', items: [
        'System — an automated platform action.',
        'Gateway webhook — the payment provider notified us.',
        'Customer — the customer took an action.',
        'Admin — a specific staff member’s name appears here.',
      ] },
      { type: 'p', text: 'Payment status (Awaiting Payment, Paid, Expired, Failed Payment) is updated from the status dropdown on this page, if you hold Orders Manage. Fulfillment statuses (Processing through Delivered) are managed through the Shipment section instead, not this dropdown — see "Shipments & Fulfillment."' },
      { type: 'warning', text: 'Never manually mark an order Paid without confirming with the payment gateway dashboard that the charge actually captured. See "An order is stuck" and "Customer says they paid" under Troubleshooting.' },
      { type: 'steps', items: [
        'Scroll to the "Add Note" section on the Order Detail page.',
        'Type your note in the text field.',
        'Click "Save Note" — it appears in the Event Timeline attributed to your name.',
      ] },
    ],
  },
  {
    slug: 'shipments-and-fulfillment',
    categoryId: 'orders-fulfillment',
    title: 'Shipments & Fulfillment',
    summary: 'The real, current fulfillment pipeline — corrected against the live status model.',
    keywords: ['shipment', 'fulfillment', 'courier', 'tracking number', 'packing', 'picking', 'cancel shipment'],
    departments: ['operations', 'warehouse', 'order_management'],
    sourceRef: 'Training Guide §15',
    verified: true,
    correction: 'The written guide describes a simplified four-stage flow (Processing → Packed → Shipped → Delivered). The live system actually uses a more granular warehouse pipeline — the stages below are the current, real ones (frontend/src/utils/shipmentStatus.js). "Processing," "Packed," and "Shipped" are not statuses on the live system; use the labels below instead.',
    body: [
      { type: 'p', text: 'A Shipment is created automatically once an order is paid, and tracks physical delivery through this sequence: Awaiting Picking → Picking → Packing → Quality Check → Ready for Courier → Courier Scheduled → Picked Up → In Transit → Out for Delivery → Delivered → Completed.' },
      { type: 'note', text: 'Separate sub-states exist for a shipment that enters a return: Return Requested, Return Approved, Returned, Refund Pending, Refunded. Cancelled and Exception are also possible at any point.' },
      { type: 'p', text: 'On the Fulfillment queue (pusostore.com/admin/shipments) or the Order Detail page, a one-click button advances a shipment to the single next stage in the happy path. The full status dropdown on the Order Detail page can also jump directly to any legal state if the one-step advance isn’t what you need.' },
      { type: 'steps', items: [
        'Open the Order Detail page and find the Shipment section.',
        'Select the courier: LBC, J&T Express, Ninja Van, Flash Express, GoGo Xpress, 2GO, GrabExpress, Lalamove, DHL Express, or FedEx.',
        'Enter the tracking number.',
        'Click Save.',
      ] },
      { type: 'p', text: 'To cancel a shipment: open the Shipment section, click "Cancel Shipment," enter a cancellation reason, and confirm. Every status change — including who made it and when — is recorded in the Order Event Timeline.' },
    ],
  },

  // -------------------------------------------------------------- Returns & Refunds
  {
    slug: 'returns-queue-and-review',
    categoryId: 'returns-refunds',
    title: 'Reviewing Return Requests',
    summary: 'The real multi-stage return pipeline — corrected against the live status model.',
    keywords: ['returns', 'return request', 'inspect', 'approve', 'reject', 'under review'],
    departments: ['finance', 'operations', 'support'],
    sourceRef: 'Training Guide §16',
    verified: true,
    correction: 'The written guide describes a simple two-step "Mark Approved or Reject" model. The live system actually runs a return through several stages — see below — before a refund is even created.',
    body: [
      { type: 'p', text: 'Customers submit a return request with a reason from their order page. It appears in pusostore.com/admin/returns, which lists customer name, order number, reason, and date submitted. Requires Returns View or Refunds View.' },
      { type: 'p', text: 'A return moves through: Requested → Under Review → Approved → Return Shipped → Received → (Inspect) → Refund Pending → (Record Refund) → Refunded, with Rejected and Closed as other possible end states.' },
      { type: 'steps', items: [
        'While a return is Requested or Under Review, click "Mark [next status]" to advance it one step, or "Reject" with a reason — the customer is notified either way.',
        'Once a return reaches Received, click "Inspect" to open the inspection modal.',
        'Review the reason and item(s) being returned, then click "Submit Inspection & Create Refund."',
      ] },
      { type: 'note', text: 'Inspection is all-or-nothing for the items on that request — it restores stock, writes a Stock Adjustment audit row, and creates the refund (bounded by the ceilings described in "Recording and Adjusting a Refund"), all in one step. Requires Returns Approve.' },
      { type: 'p', text: 'Submitting the inspection moves the return to Refund Pending, where it waits for Finance to record the refund — see the next article.' },
    ],
  },
  {
    slug: 'recording-and-adjusting-refunds',
    categoryId: 'returns-refunds',
    title: 'Recording and Adjusting a Refund',
    summary: 'How refunds actually move money on this platform — Finance-only, and nothing like the written guide describes.',
    keywords: ['refund', 'record refund', 'adjust', 'finance', 'epaygames', 'already sent', 'recompute'],
    departments: ['finance'],
    sourceRef: 'docs/REFUNDS_RUNBOOK.md §1–§3 (ADR-012)',
    verified: true,
    correction: 'The written guide says refunds are "processed manually through the payment gateway (Maya or Xendit dashboard) and recorded in the system." That is stale. ePayGames is the platform’s only integrated gateway and exposes no automated refund API, so a refund is always completed out-of-band first and then recorded here — Maya/Xendit dashboards are not part of the current refund procedure.',
    body: [
      { type: 'warning', text: 'Recording a refund never moves money. It confirms money that has already actually been sent to the customer. Recording before the money has actually moved creates a false financial record.' },
      { type: 'steps', items: [
        'Complete the refund with the provider first — outside this system, before touching anything here.',
        'Open the refund from its "Refund Pending" row by clicking "Record Refund." It shows the authoritative amount and status for that specific return.',
        'Pay exactly the amount shown. If the amount is wrong, adjust it first (see below) — never pay a different amount than what’s recorded and then record a third number.',
        'Enter the exact amount that actually left, to the centavo. A mismatch is rejected outright, not silently corrected.',
        'Optionally add a provider reference and a note. A note is required if you’re correcting a previously Failed refund.',
      ] },
      { type: 'note', text: 'Recording a refund twice is impossible — retrying an already-succeeded refund returns an error, not a duplicate. If a checked-in Pass can’t be auto-refunded, it’s reported as an exception for Finance to resolve manually, rather than failing silently.' },
      { type: 'p', text: 'Adjusting a refund only changes the recorded amount — it never moves money and never bypasses a financial ceiling. It’s only possible while a refund is Pending or Failed; a Succeeded refund is permanently locked.' },
      { type: 'list', items: [
        'Recompute — before any payment, reverts the amount to the full, promo-aware value for the returned items. Only works if no refund for that same return has already succeeded.',
        'Explicit amount — set a specific figure (e.g. a partial/goodwill refund), bounded by the remaining refundable ceiling.',
        'Already sent — a reconciliation mode for money that was already sent at the wrong amount; sets the recorded amount to exactly what actually left.',
      ] },
      { type: 'warning', text: 'Requires Refunds Manage (Finance has this by default). A refund cannot be recorded or adjusted past what the order was actually paid, or past what that specific return’s items are worth — the system enforces this, not the operator.' },
    ],
  },
  {
    slug: 'refund-safeguards-and-open-items',
    categoryId: 'returns-refunds',
    title: 'Refund Safeguards, Escalation, and What’s Still Unconfirmed',
    summary: 'The guardrails behind the refund workflow, and what has not yet been verified in production.',
    keywords: ['refund ceiling', 'escalation', 'unconfirmed', 'readiness', 'reminder'],
    departments: ['finance'],
    sourceRef: 'docs/REFUNDS_RUNBOOK.md §3–§4, §8',
    verified: true,
    body: [
      { type: 'p', text: 'Two ceilings protect every refund: the order-level ceiling (refunds can never exceed what the order was actually paid) and, for return refunds specifically, an attributable-merchandise ceiling (bounded by that return’s own items and by what’s left of the order’s refundable merchandise capacity after other committed refunds). Both are re-checked at the moment a refund is recorded, not just when it’s created.' },
      { type: 'note', text: 'A refund sitting Pending for more than 24 hours triggers an hourly reminder to every active Finance staffer, deduplicated per refund per person — this is the safety net for money that hasn’t moved yet.' },
      { type: 'p', text: 'Escalation ladder: Finance owner first, then engineering on-call for a recording/adjustment error, then the founder for any unresolved financial discrepancy (an inconclusive legacy refund, an over-refund, a provider mismatch).' },
      { type: 'warning', text: 'Still unconfirmed as of this writing: the exact ePayGames manual refund procedure — how money is actually returned, eligible channels, and any processing window. Do not assume a specific portal or steps exist for this until it has been confirmed with ePayGames directly. Treat this as an open operational gap, not a solved process.' },
    ],
  },

  // -------------------------------------------------------------- Products & Catalog
  {
    slug: 'viewing-products',
    categoryId: 'products-catalog',
    title: 'Viewing the Product List',
    summary: 'Image, category, price, stock status, and active/inactive state.',
    keywords: ['products', 'product list', 'stock status'],
    departments: ['marketing', 'warehouse'],
    sourceRef: 'Training Guide §13',
    verified: false,
    body: [
      { type: 'p', text: 'pusostore.com/admin/products shows every product with image, name, category, price, stock status, and active/inactive state. Requires Products View or Products Manage.' },
      { type: 'image', src: null, alt: 'The Admin Products list page, showing the product table with category, price, stock, and status columns.' },
    ],
  },
  {
    slug: 'adding-and-editing-products',
    categoryId: 'products-catalog',
    title: 'Adding and Editing Products',
    summary: 'Basic info, classification, images, sizes/stock or color variants, and the product toggles.',
    keywords: ['add product', 'edit product', 'variants', 'sizes', 'stock', 'cloudinary', 'fit check toggle'],
    departments: ['marketing'],
    sourceRef: 'Training Guide §13',
    verified: false,
    body: [
      { type: 'steps', items: [
        'Go to Products and click "Add Product" (pusostore.com/admin/products/new). Requires Products Manage.',
        'Fill in Basic Information: Name, Slug (auto-generated, editable), Description, Price, and optional Sale Price.',
        'Fill in Classification: Category (Jersey/T-Shirt/Cap/Shorts/Accessories), Sport, Gender, League, Team, and optionally Player.',
        'Upload images — drag-and-drop or browse; the first image becomes the main product photo. Images upload to Cloudinary automatically.',
        'Configure sizes and stock. Without color variants: a Size/Stock table (XS–3XL, One Size) — a size with 0 stock is unavailable to customers. With color variants: toggle "Use Color Variants" and enter color name, hex code, image, and sizes/stock per color.',
        'Set the product options: Featured (homepage), Fit Check (enables AI Virtual Try-On on this product), Active (visible on the storefront).',
        'Click "Create Product" to publish.',
      ] },
      { type: 'p', text: 'To restock an existing product, open it for editing, scroll to Sizes, update the stock number, and save.' },
    ],
  },
  {
    slug: 'deleting-and-deactivating-products',
    categoryId: 'products-catalog',
    title: 'Deleting vs. Deactivating a Product',
    summary: 'One is permanent, the other is reversible — know which one you need.',
    keywords: ['delete product', 'deactivate product', 'active toggle'],
    departments: ['marketing'],
    sourceRef: 'Training Guide §13',
    verified: false,
    body: [
      { type: 'warning', text: 'Deleting a product is permanent and cannot be undone. If you just want it off the storefront temporarily, use Deactivate instead.' },
      { type: 'p', text: 'To delete: click the trash icon on the product row, confirm in the dialog. To deactivate instead: open the product, toggle Active to OFF, and save — it’s immediately hidden from the storefront but stays in the system and can be reactivated later.' },
    ],
  },
  {
    slug: 'managing-leagues',
    categoryId: 'products-catalog',
    title: 'Managing Leagues',
    summary: 'The top-level categories products and pass events belong to.',
    keywords: ['leagues', 'pba', 'pvl', 'uaap'],
    departments: ['marketing'],
    sourceRef: 'Training Guide §13',
    verified: false,
    body: [
      { type: 'p', text: 'pusostore.com/admin/leagues manages the leagues (PBA, PVL, UAAP, etc.) that products and pass events belong to, and that customers filter by on the storefront. Requires Leagues Manage.' },
      { type: 'steps', items: [
        'Click "Add League."',
        'Fill in Name (full league name), Sports (check all that apply), and Teams (click "Add Team" for more rows).',
        'Click Save.',
      ] },
      { type: 'warning', text: 'Deleting a league does not delete its products — but those products lose their league tag. Reassign them to another league first.' },
    ],
  },

  // -------------------------------------------------------------- Events & Passes
  {
    slug: 'venues-and-sections',
    categoryId: 'events-passes',
    title: 'Venues & Venue Sections',
    summary: 'Physical locations and their seating areas — sections must exist before tiers can be created.',
    keywords: ['venue', 'venue section', 'seating chart'],
    departments: ['marketing'],
    sourceRef: 'Training Guide §22',
    verified: false,
    body: [
      { type: 'p', text: 'pusostore.com/admin/venues lists the physical locations where pass events are held. Requires Passes Manage. Deactivate a venue (toggle Active off) instead of deleting it if it has existing pass events — venues with events cannot be deleted.' },
      { type: 'p', text: 'Open a venue to manage its Sections — named seating areas (e.g. Lower Box, Upper Box, General Admission). A section with existing tiers assigned to it cannot be deleted.' },
      { type: 'note', text: 'A venue can carry a static seating-chart reference image for fans to view — this is a plain image, not an interactive seat picker. Individual seat selection does not exist on this platform; every tier is capacity-based.' },
    ],
  },
  {
    slug: 'pass-events-and-tiers',
    categoryId: 'events-passes',
    title: 'Pass Events & Tiers',
    summary: 'Creating a game/event for sale, and managing its admission tiers.',
    keywords: ['pass event', 'tier', 'capacity', 'ticket'],
    departments: ['marketing'],
    sourceRef: 'Training Guide §22',
    verified: true,
    correction: 'The written guide calls these "Ticket Tiers" and "Add Ticket Tier." The live screen itself just says "Tier" / "Add Tier" / "Edit Tier" — use that. Internally these are called Passes, not Tickets (a deliberate, documented naming change from an earlier design) — the screen label and the underlying concept use different words on purpose.',
    body: [
      { type: 'steps', items: [
        'Go to Pass Events and click "Add Event." Fill in name, date, venue, and participating teams.',
        'Add tiers (e.g. Lower Box ₱500, Upper Box ₱300) and set capacity per tier.',
        'Save and publish.',
      ] },
      { type: 'note', text: 'A venue needs sections before tiers can be added to its event — if none exist yet, a warning links to the venue’s settings. Editing capacity never affects tickets already sold. Events or tiers with sold passes cannot be deleted — take them offline with the Active toggle instead.' },
      { type: 'p', text: 'If you’re only editing an existing event’s description or deactivating it, its original start date is accepted as-is. If you’re changing the start date itself, the new date must be today or later.' },
    ],
  },
  {
    slug: 'pass-checkin',
    categoryId: 'events-passes',
    title: 'Pass Check-In (Event Scanner)',
    summary: 'Scanning passes at the venue on event day, including offline mode.',
    keywords: ['check-in', 'scanner', 'qr code', 'offline scanning'],
    departments: ['operations', 'warehouse', 'scanner'],
    sourceRef: 'Training Guide §22',
    verified: false,
    body: [
      { type: 'steps', items: [
        'Open the check-in page, pick today’s event from the picker. The app downloads a local copy of all passes for that event — wait for the sync to finish before relying on it.',
        'Point the camera at the customer’s QR code — it reads automatically. If the camera is unavailable, use Manual Entry with the customer’s ticket number and "Look Up."',
        'Act on the result.',
      ] },
      { type: 'list', items: [
        'Ready to Check In (green) — click "Confirm Check-In."',
        'Already Checked In (red) — do not admit; shows the original check-in time.',
        'Not Found (red) — ask the customer to check their Locker; do not admit.',
        'Cancelled or Refunded (red) — not valid for entry; do not admit.',
      ] },
      { type: 'note', text: 'If the device loses signal, lookups still work from the locally synced data and check-ins are queued, syncing automatically once connectivity returns. The result card will say "Offline result — synced X minutes ago," meaning it may not reflect another gate’s recent scans.' },
    ],
  },

  // ------------------------------------------------------------ Marketing & Content
  {
    slug: 'homepage-and-content',
    categoryId: 'marketing-content',
    title: 'Homepage & Content Management',
    summary: 'Homepage sections, featured team, partner logos, promo messages, navigation, footer, and FAQ.',
    keywords: ['homepage', 'content', 'faq', 'footer', 'navigation', 'promo message'],
    departments: ['marketing'],
    sourceRef: 'Training Guide §20',
    verified: false,
    body: [
      { type: 'p', text: 'Requires Homepage Manage. The Homepage Builder visually arranges and configures homepage sections (hero banner, product carousels, featured collections); Homepage Sections manages the individual content sections directly.' },
      { type: 'list', items: [
        'Featured Team — which team is highlighted on the homepage.',
        'Partner Logos — sponsor logos displayed on the homepage.',
        'Promo Messages — the announcement bar (e.g. "Free shipping on orders over ₱2,000"); can be pinned and scheduled.',
        'Navigation Links — the links shown in the site header.',
        'Footer — footer links, social links, and footer text.',
        'FAQ — add, edit, or reorder FAQ items shown on the site.',
      ] },
      { type: 'note', text: 'All of this is business content, not code — it lives in the database and is editable here. Nothing on this list should ever require a developer or a redeploy to change.' },
    ],
  },
  {
    slug: 'fit-check-settings-and-campaigns',
    categoryId: 'marketing-content',
    title: 'Fit Check Settings & Campaigns',
    summary: 'Platform-wide try-on behavior, and sponsoring unlimited Fit Check on specific products.',
    keywords: ['fit check settings', 'fit check campaign', 'sponsor', 'daily allowance'],
    departments: ['marketing'],
    sourceRef: 'Training Guide §19',
    verified: false,
    body: [
      { type: 'p', text: 'Fit Check Settings (Settings → Fit Check, requires Settings Fit Check Manage) configures the daily allowance per customer (logged-in and guest tracked separately) and the Try-On Ad shown during AI generation.' },
      { type: 'steps', items: [
        'Go to Fit Check Campaigns and click "New Campaign." Requires Fit Check Campaigns Manage.',
        'Select the product the campaign covers, enter the sponsor name, and set start/end dates.',
        'Save.',
      ] },
      { type: 'note', text: 'While a campaign is active, that product’s Fit Check becomes unlimited for every customer and shows "Unlimited Fit Checks — Sponsored by [Sponsor]" instead of the quota bar. To pause early, toggle Active off; to end permanently, set the End Date to today.' },
    ],
  },
  {
    slug: 'promo-codes-and-campaigns',
    categoryId: 'marketing-content',
    title: 'Promo Codes & Campaigns',
    summary: 'Creating discount codes and organizing them under a broader marketing campaign.',
    keywords: ['promo code', 'discount', 'free shipping', 'campaign'],
    departments: ['marketing'],
    sourceRef: 'Training Guide §21',
    verified: false,
    body: [
      { type: 'steps', items: [
        'Go to Promo Codes and click "New Promo Code." Requires Promotions Manage.',
        'Fill in: Code, Discount Type (percentage or fixed), Discount Amount, optional Free Shipping, Minimum Order Amount, Usage Limit, Expiry Date, and an optional Event Scope to restrict it to one pass event.',
        'Save.',
      ] },
      { type: 'p', text: 'Deactivate a code either by toggling it off or setting its Expiry Date in the past — it stops working immediately either way. Deleting a code removes its usage history permanently; editing one does not affect past usage counts.' },
      { type: 'p', text: 'Campaigns (pusostore.com/admin/campaigns) organize multiple promo codes and product promotions under one umbrella for a single marketing push.' },
    ],
  },

  // -------------------------------------------------------------- Reports & Analytics
  {
    slug: 'reports-overview',
    categoryId: 'reports-analytics',
    title: 'Reports & Analytics — Every Workspace',
    summary: 'What each report shows and which permission unlocks it.',
    keywords: ['reports', 'analytics', 'exports', 'scheduled reports'],
    departments: ['executive', 'finance', 'operations', 'marketing', 'support'],
    sourceRef: 'Training Guide §18',
    verified: false,
    body: [
      { type: 'p', text: 'pusostore.com/admin/reports. Every workspace has its own date-range selector and its own permission — you only see the ones your department grants.' },
      { type: 'list', items: [
        'Executive Dashboard (Reports Executive View) — revenue, order count, new customers, key metrics.',
        'Sales Report (Reports Sales View) — revenue by product/category/time, top sellers.',
        'Products Report (Reports Products View) — views, add-to-cart rate, conversion, stock levels.',
        'Customers Report (Reports Customers View) — acquisition, repeat purchase rate, lifetime value.',
        'Operations Report (Reports Operations View) — time to ship, carrier breakdown, delivery success rate.',
        'Fit Check Analytics (Reports Fit Check View) — generations, success rate, top products, sponsored vs. organic usage.',
        'Finance Report (Reports Finance View) — gateway breakdown, processing fees, refunds, net revenue.',
        'Organizations Report (Reports Organizations View) — revenue/activity per league and team.',
        'Exports Workspace — download any report as CSV.',
      ] },
      { type: 'note', text: 'Reports can be scheduled to email automatically (daily/weekly/monthly) to chosen recipients, configured under each report’s own settings.' },
    ],
  },

  // ------------------------------------------------------------- Account, Staff & Settings
  {
    slug: 'viewing-customer-accounts',
    categoryId: 'staff-settings',
    title: 'Viewing Customer Accounts',
    summary: 'Searching users and seeing their order history.',
    keywords: ['customers', 'users', 'search customer'],
    departments: ['support'],
    sourceRef: 'Training Guide §17',
    verified: false,
    body: [
      { type: 'p', text: 'pusostore.com/admin/users lists every registered customer and staff account. Requires Users View. Search by name or email; per customer you can see name, email, registration date, order count/history, and role (customer or admin).' },
    ],
  },
  {
    slug: 'managing-staff-accounts',
    categoryId: 'staff-settings',
    title: 'Managing Staff Accounts',
    summary: 'Creating a staff account, assigning a department, and removing admin access.',
    keywords: ['staff account', 'department', 'remove admin', 'bonus fit check'],
    departments: ['support'],
    sourceRef: 'Training Guide §17',
    verified: false,
    body: [
      { type: 'steps', items: [
        'On the Users page, find or create the account. Requires Users Manage.',
        'Set the Role to "admin."',
        'Assign a Department — see "Staff Roles & Permissions" for what each one grants.',
        'The staff member receives a password-setup email to activate their account.',
      ] },
      { type: 'p', text: 'To remove admin access: open the account, change Role from Admin back to Customer, and save. Staff accounts are never deleted — only their role changes — so the audit trail of what they did as admin is preserved.' },
      { type: 'p', text: 'If a customer has used up their daily Fit Check allowance and needs more, find their account, click "Grant Bonus Fit Checks," enter the number of extra credits, and confirm. Requires Users Manage.' },
    ],
  },
  {
    slug: 'settings-overview',
    categoryId: 'staff-settings',
    title: 'Settings — Every Section',
    summary: 'Commerce, Fit Check, notifications, security, integrations, and advanced settings.',
    keywords: ['settings', 'commerce settings', 'security settings', 'integrations', 'payment gateway'],
    departments: ['executive', 'operations', 'marketing'],
    sourceRef: 'Training Guide §23',
    verified: false,
    body: [
      { type: 'list', items: [
        'Commerce (Settings Commerce Manage) — free shipping threshold, order expiration window, payment reminder tiers, venue pickup configuration.',
        'Fit Check — see "Fit Check Settings & Campaigns."',
        'Notifications (Settings Notifications Manage) — email notification behavior for orders, shipments, customer alerts.',
        'Security (Settings Security Manage) — platform-level security configuration.',
        'Integrations (Settings Integrations Manage) — third-party connections (payment gateways, courier APIs, Cloudinary, WaveSpeed AI).',
        'Advanced (Settings Advanced Manage) — for authorized technical staff only.',
      ] },
      { type: 'note', text: 'The active payment gateway is configured under Integrations — it determines which payment channels customers see at checkout. Changing it is a technical, high-impact change; coordinate with engineering before touching it.' },
    ],
  },

  // ---------------------------------------------------------------- Troubleshooting
  {
    slug: 'scenario-stock-runs-out',
    categoryId: 'troubleshooting',
    title: 'Scenario: Stock Runs Out Mid-Order',
    summary: 'Why this happens, and what to tell the customer.',
    keywords: ['stock', 'out of stock', 'overselling'],
    departments: [],
    sourceRef: 'Training Guide, Part C, Scenario 1',
    verified: false,
    body: [
      { type: 'p', text: 'Stock is reserved the instant an order is placed, not at payment. If two customers try to buy the last item at the same time, one gets an out-of-stock error at checkout — this is the platform working as designed, not a bug.' },
      { type: 'list', items: [
        'The affected customer sees an error and cannot complete checkout.',
        'They can remove the out-of-stock size and proceed with the rest, or wait for restock.',
        'Once restocked, update the stock quantity on the product.',
      ] },
    ],
  },
  {
    slug: 'scenario-payment-failed',
    categoryId: 'troubleshooting',
    title: 'Scenario: Customer’s Payment Failed',
    summary: 'What happens to the order and the reserved stock.',
    keywords: ['payment failed', 'awaiting payment', 'expired order'],
    departments: [],
    sourceRef: 'Training Guide, Part C, Scenario 2',
    verified: false,
    body: [
      { type: 'p', text: 'The order stays Awaiting Payment or moves to Failed Payment. Reserved stock is held until the expiry window ends, then released automatically.' },
      { type: 'list', items: [
        'Check the order’s Event Timeline for the failed attempt and the gateway’s message.',
        'If not yet expired, the customer can retry via "Complete Payment" on their order page.',
        'If expired, they must place a new order.',
      ] },
    ],
  },
  {
    slug: 'scenario-shipping-rate-missing',
    categoryId: 'troubleshooting',
    title: 'Scenario: Shipping Rate Does Not Calculate',
    summary: 'Usually a region or weight rule gap.',
    keywords: ['shipping rate', 'checkout error'],
    departments: ['operations'],
    sourceRef: 'Training Guide, Part C, Scenario 3',
    verified: false,
    body: [
      { type: 'p', text: 'Shipping options fail to load, or show a "contact us" message, when the customer’s region isn’t covered by configured rates, or the cart total/weight doesn’t match any shipping rule.' },
      { type: 'list', items: [
        'Check shipping configuration under Settings → Commerce.',
        'Confirm rates are configured for the customer’s region.',
        'If urgent, contact the customer directly to arrange manual shipping.',
      ] },
    ],
  },
  {
    slug: 'scenario-fit-check-fails',
    categoryId: 'troubleshooting',
    title: 'Scenario: Fit Check Generation Fails',
    summary: 'A temporary AI service issue or a photo quality problem.',
    keywords: ['fit check error', 'try-on failed', 'wavespeed'],
    departments: [],
    sourceRef: 'Training Guide, Part C, Scenario 4',
    verified: false,
    body: [
      { type: 'p', text: 'The customer sees "Failed to generate try-on image. Please try again." Usually a temporary WaveSpeed AI issue, or a photo that failed quality validation (too dark, blurry, no clear person detected).' },
      { type: 'list', items: [
        'Ask the customer to retry with a clearer, well-lit, front-facing photo.',
        'If failures persist, check Fit Check logs under Reports → Fit Check for error patterns.',
        'During a genuine service outage, the Fit Check button hides itself automatically until it recovers.',
      ] },
      { type: 'note', text: 'A failed attempt still counts against the customer’s daily quota — use "Grant Bonus Fit Checks" if that’s unfair in context.' },
    ],
  },
  {
    slug: 'scenario-cannot-log-in',
    categoryId: 'troubleshooting',
    title: 'Scenario: Customer Cannot Log In',
    summary: 'Password reset and email verification.',
    keywords: ['login issue', 'forgot password', 'email verification'],
    departments: ['support'],
    sourceRef: 'Training Guide, Part C, Scenario 5',
    verified: false,
    body: [
      { type: 'list', items: [
        'Ask them to use "Forgot Password" on the login page to reset via email.',
        'If their email isn’t verified, ask them to check their inbox (and spam/junk) for the verification email.',
        'As an admin, look up the account under Users to confirm it exists and check its status.',
      ] },
    ],
  },
  {
    slug: 'scenario-order-stuck-processing',
    categoryId: 'troubleshooting',
    title: 'Scenario: An Order Is Stuck in "Processing"',
    summary: 'Check the shipment, then the timeline.',
    keywords: ['stuck order', 'processing order'],
    departments: ['operations', 'warehouse'],
    sourceRef: 'Training Guide, Part C, Scenario 6',
    verified: false,
    body: [
      { type: 'list', items: [
        'Open the order under Orders.',
        'Check the Shipment section — if a shipment exists, advance it once the item is ready (see "Shipments & Fulfillment" for the real status names).',
        'If no shipment exists, check the Event Timeline for a payment issue blocking shipment creation.',
      ] },
    ],
  },
  {
    slug: 'scenario-paid-but-awaiting-payment',
    categoryId: 'troubleshooting',
    title: 'Scenario: Customer Says They Paid, Order Still Shows "Awaiting Payment"',
    summary: 'Check for the webhook — and never override this by hand without confirming with the gateway.',
    keywords: ['payment stuck', 'webhook received', 'awaiting payment'],
    departments: ['finance', 'operations', 'support'],
    sourceRef: 'Training Guide, Part C, Scenario 7',
    verified: false,
    body: [
      { type: 'steps', items: [
        'Open the order and check the Event Timeline.',
        'Look for a "webhook_received" entry — the payment provider’s own confirmation. If it’s there, the backend should have updated status automatically.',
        'If the webhook was received but status didn’t update, escalate to the development team — don’t try to fix it by hand.',
      ] },
      { type: 'warning', text: 'Do NOT manually mark an order as Paid without confirming with the payment gateway dashboard that the charge was actually captured. A manual override not backed by a real captured payment creates a false financial record, the same risk recording a refund early does.' },
    ],
  },
];

export function getCategoryWithCounts() {
  return HELP_CATEGORIES.map((category) => ({
    ...category,
    articleCount: HELP_ARTICLES.filter((article) => article.categoryId === category.id).length,
  }));
}
