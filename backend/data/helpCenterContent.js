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
 *   { type: 'image', src, alt, caption? }      — src is null until a
 *     screenshot has been extracted and placed under
 *     frontend/public/help/images/ (see docs/HELP_CENTER.md); the UI must
 *     render nothing (not a broken image) when src is null. `caption` is
 *     optional — a short line shown under the image (e.g. to flag that a
 *     screenshot shows seed/fixture data, not a universal label).
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
    verified: true,
    correction: 'The "two sides" structural claim is confirmed by this guide’s own full audit of the admin sidebar/routes (Products, Orders, Fulfillment, Returns & Refunds, Reports, Users, Settings all real and independently checked in their own articles). Softened "manage... staff" to match what "Managing Staff Accounts" actually found: there is no self-service staff creation/promotion/demotion in the admin UI today, only department assignment for an already-admin account. The specific sport/league list (PBA, PVL, UAAP, NCAA, MPBL) is descriptive content, not a technically enforced set — a product’s league is a free-text field, not a fixed list — so treat it as illustrative, not exhaustive.',
    body: [
      { type: 'p', text: 'Puso Shop (pusostore.com) is an official Philippine sports merchandise e-commerce platform. It sells jerseys, apparel, and gear for local sports teams across the PBA, PVL, UAAP, NCAA, MPBL, and more.' },
      { type: 'list', items: [
        'Customer side (pusostore.com) — browse and buy official merchandise, use Fit Check (AI Virtual Try-On), track orders, buy event passes.',
        'Admin side (pusostore.com/admin) — manage products, orders, shipments, and returns; view reports; manage customers; assign departments to existing staff; configure settings.',
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
    verified: true,
    correction: 'Checked against existing code/domain facts rather than fresh screenshots: the Merchandise/Passes split is a hard platform rule (AGENTS.md); order statuses match prisma/schema.prisma’s OrderStatus enum exactly; and the My PUSO Portal’s four sections are real routes (frontend/src/App.jsx: /account, /account/locker, /account/fit-check, /account/following). Nothing here was found inaccurate.',
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
    verified: true,
    body: [
      { type: 'p', text: 'The Admin Dashboard (pusostore.com/admin) is the first screen after login. It shows four top-line stats (Total Revenue, Total Orders, Fulfillment Rate, Users), a "Needs Attention" panel (out-of-stock products, shipment exceptions, low stock), a Performance section (Top Selling Products, Most Viewed Products, Most Tried-On Products), and a Recent Orders table.' },
      { type: 'image', src: '/help/images/admin-dashboard-overview.png', alt: 'The Admin Dashboard, showing top-line stats, the Needs Attention panel, Top Selling Products, and Recent Orders.' },
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
    verified: true,
    body: [
      { type: 'p', text: 'pusostore.com/admin/orders lists every order with order number, customer name, total, payment status, fulfillment status, date placed, and a shipping column. A banner reminds you that fulfillment actions themselves live on the Fulfillment page — this list is for finding and reviewing an order, not advancing it. Use "All Statuses" / "All Payments" to filter, or "Export CSV" for a raw download.' },
      { type: 'image', src: '/help/images/orders-list.png', alt: 'The Admin Orders list, showing order number, customer, total, payment, status, date, and shipping columns.' },
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
    keywords: ['order detail', 'timeline', 'payment status', 'admin note', 'webhook', 'cancel order'],
    departments: ['finance', 'operations', 'warehouse', 'order_management', 'support'],
    sourceRef: 'Training Guide §14',
    verified: true,
    body: [
      { type: 'p', text: 'Click any order to open pusostore.com/admin/orders/[order-number]. It shows order number and date, customer contact info, delivery address, items (size/color/quantity/price), payment status and gateway, shipment status, and the Order Event Timeline — a full audit log of everything that happened: creation, payment attempts, status changes, admin notes, and webhook receipts.' },
      {
        type: 'image',
        src: '/help/images/order-detail-timeline.png',
        alt: 'The Order Detail page, showing items, customer & shipping info, and the event timeline.',
        caption: 'This example is seeded local test data — a real payment confirmation is attributed to "Gateway webhook," not "System" as shown here (the seed script simulates the event directly, skipping the real webhook).',
      },
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
      { type: 'p', text: 'The Fulfillment section on this page is also where you cancel the order itself: click "Cancel Order," optionally enter a reason, and confirm. This is not a status dropdown change — it releases any reserved stock and creates a pending refund atomically, in one transaction, not as two separate steps.' },
      { type: 'image', src: '/help/images/order-cancel-confirmation.png', alt: 'The Cancel Order confirmation, with an optional reason field and the note that it releases stock and creates a pending refund atomically.' },
    ],
  },
  {
    slug: 'shipments-and-fulfillment',
    categoryId: 'orders-fulfillment',
    title: 'Shipments & Fulfillment',
    summary: 'The real, current fulfillment pipeline — corrected against the live status model.',
    keywords: ['shipment', 'fulfillment', 'fulfillment queue', 'courier', 'tracking number', 'packing', 'picking'],
    departments: ['operations', 'warehouse', 'order_management'],
    sourceRef: 'Training Guide §15',
    verified: true,
    correction: 'The written guide describes a simplified four-stage flow (Processing → Packed → Shipped → Delivered) and a "Cancel Shipment" action. The live system actually uses a more granular warehouse pipeline (below), and there is no separate "Cancel Shipment" button — cancelling happens at the order level ("Cancel Order," on the Order Detail page — see "The Order Detail Page & Event Timeline").',
    body: [
      { type: 'p', text: 'A Shipment is created automatically once an order is paid, and tracks physical delivery through this sequence: Awaiting Picking → Picking → Packing → Quality Check → Ready for Courier → Courier Scheduled → Picked Up → In Transit → Out for Delivery → Delivered → Completed.' },
      { type: 'note', text: 'Separate sub-states exist for a shipment that enters a return: Return Requested, Return Approved, Returned, Refund Pending, Refunded. Cancelled and Exception are also possible at any point.' },
      { type: 'p', text: 'The Fulfillment Queue (pusostore.com/admin/shipments, labeled "Fulfillment" in the sidebar) lists shipments with a tab per stage, who it’s assigned to, and a one-click "Mark [next stage]" button to advance the single next step in the happy path.' },
      { type: 'image', src: '/help/images/fulfillment-queue.png', alt: 'The Fulfillment Queue, with tabs for each pipeline stage and a one-click advance action per shipment.' },
      { type: 'p', text: 'The full status dropdown on the Order Detail page can jump directly to any legal state if the one-step advance isn’t what you need — that’s also where you assign a courier and tracking number.' },
      { type: 'steps', items: [
        'Open the Order Detail page and find the Fulfillment section.',
        'Select the courier: LBC, J&T Express, Ninja Van, Flash Express, GoGo Xpress, 2GO, GrabExpress, Lalamove, DHL Express, or FedEx.',
        'Enter the tracking number.',
        'Click Save.',
      ] },
      { type: 'image', src: '/help/images/order-fulfillment-section.png', alt: 'The Fulfillment section on the Order Detail page, with Status, Courier, Tracking #, Assigned To, and Cancel Order.' },
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
      { type: 'image', src: '/help/images/returns-under-review.png', alt: 'The Returns & Refunds queue, Under Review tab, with "Mark Approved" and "Reject" actions.' },
      { type: 'steps', items: [
        'While a return is Requested or Under Review, click "Mark [next status]" to advance it one step, or "Reject" with a reason — the customer is notified either way.',
        'Once a return reaches Received, click "Inspect" to open the inspection modal.',
        'Review the reason and item(s) being returned, then click "Submit Inspection & Create Refund."',
      ] },
      { type: 'image', src: null, alt: 'The Inspect Return modal.' },
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
      { type: 'image', src: null, alt: 'The Record Refund modal.' },
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
    verified: true,
    body: [
      { type: 'p', text: 'pusostore.com/admin/products shows every product with image, name, category, sport, price, stock, and active/inactive status. Search by name, or filter by Category/Sport. Requires Products View or Products Manage.' },
      { type: 'image', src: '/help/images/products-list.png', alt: 'The Admin Products list page, showing the product table with category, sport, price, stock, and status columns.' },
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
    verified: true,
    body: [
      { type: 'steps', items: [
        'Go to Products and click "Add Product" (pusostore.com/admin/products/new). Requires Products Manage.',
        'Fill in Basic Information: Name, Slug (auto-generated, editable), Description, Price, and optional Sale Price.',
        'Fill in Classification: Category (Jersey/T-Shirt/Cap/Shorts/Accessories), Sport, Gender, League, Team, and optionally Player.',
        'Upload images — drag-and-drop/browse (uploads to Cloudinary automatically, max 5MB each) or paste image URLs directly. The first image becomes the main product photo.',
        'Configure sizes and stock. Without color variants: a Size/Stock table (XS–3XL, One Size) — a size with 0 stock is unavailable to customers. With color variants: toggle "Use Color Variants" and enter color name, hex code, image, and sizes/stock per color.',
        'Set the product options: Featured (homepage), Fit Check (enables AI Virtual Try-On on this product), Active (visible on the storefront — on by default for a new product).',
        'Click "Create Product" to publish.',
      ] },
      { type: 'image', src: '/help/images/add-product-form.png', alt: 'The Add Product form — Basic Information and Classification fields.' },
      { type: 'p', text: 'To restock an existing product, open it for editing, scroll to Sizes, update the stock number, and save.' },
    ],
  },
  {
    slug: 'deleting-and-deactivating-products',
    categoryId: 'products-catalog',
    title: 'Deleting vs. Deactivating a Product',
    summary: '"Delete" is actually reversible — it’s the same soft action as Deactivate, not a permanent removal.',
    keywords: ['delete product', 'deactivate product', 'active toggle'],
    departments: ['marketing'],
    sourceRef: 'Training Guide §13',
    verified: true,
    correction: 'The written guide says deleting a product "permanently removes" it and "cannot be undone." That is incorrect on the live system: the Delete confirmation dialog itself states "This will deactivate the product. It can be restored by toggling the status back to active." Clicking the trash icon and toggling Active off are, today, the same reversible action — there is no separate hard-delete in the product UI.',
    body: [
      { type: 'p', text: 'Click the trash icon on a product row to open the confirmation dialog, which explains exactly what will happen before you confirm.' },
      { type: 'image', src: '/help/images/delete-product-modal.png', alt: 'The Delete Product confirmation, stating that deleting only deactivates the product and it can be restored.' },
      { type: 'p', text: 'To deactivate directly instead (same result, no confirmation dialog): open the product, toggle Active to OFF, and save. Either way, the product is immediately hidden from the storefront but stays in the system and can be reactivated by toggling Active back on.' },
    ],
  },
  {
    slug: 'managing-leagues',
    categoryId: 'products-catalog',
    title: 'Managing Leagues',
    summary: 'The top-level categories products and pass events belong to — "Delete" here is reversible, the same pattern as Products.',
    keywords: ['leagues', 'pba', 'pvl', 'uaap', 'deactivate'],
    departments: ['marketing'],
    sourceRef: 'Training Guide §13',
    verified: true,
    correction: 'The written guide implies deleting a league is a real delete that strips the league tag from its products. Checked directly against frontend/src/pages/admin/AdminLeagues.jsx and backend/routes/leagues.js: the delete action is a soft deactivation — the confirm dialog says "This will deactivate the league. You can reactivate it later by toggling the status," and the route (itself commented "Soft-delete league") only sets the league’s own `active: false`; it does not touch any product. Products keep whatever league name they already had either way — this route contains no logic that reassigns or clears a product’s league tag, so that part of the guide’s claim is not asserted here.',
    body: [
      { type: 'p', text: 'pusostore.com/admin/leagues manages the leagues (PBA, PVL, UAAP, etc.) that products and pass events belong to, and that customers filter by on the storefront. Requires Leagues Manage.' },
      { type: 'steps', items: [
        'Click "Add League."',
        'Fill in Name (full league name), Sports (check all that apply), and Teams (click "Add Team" for more rows).',
        'Click Save.',
      ] },
      { type: 'warning', text: 'Clicking the trash icon does not permanently delete a league. The confirmation dialog deactivates it instead — you can reactivate it later by toggling its status back on. This does not change any product’s existing league tag.' },
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
    verified: true,
    body: [
      { type: 'p', text: 'pusostore.com/admin/venues lists the physical locations where pass events are held, with name, city, capacity, and active/inactive status. Requires Passes Manage. Deactivate a venue instead of deleting it if it has existing pass events — venues with events cannot be deleted.' },
      { type: 'image', src: '/help/images/venues-list.png', alt: 'The Venues list, with Name, City, Capacity, Status, and Actions columns.' },
      { type: 'p', text: 'Open a venue to manage its Sections — named seating areas (e.g. a numbered range like "Section 106-110," or "Upper Box"). A section with existing tiers assigned to it cannot be deleted.' },
      { type: 'image', src: '/help/images/venue-sections.png', alt: 'A venue’s Sections list, each a named seating area.' },
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
      { type: 'image', src: '/help/images/pass-event-tiers.png', alt: 'A pass event’s Tiers table — Tier, Section, Price, Availability, and Actions.' },
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
    verified: true,
    correction: 'Checked directly against frontend/src/pages/admin/AdminPassCheckin.jsx’s STATUS_STYLE map and result-card markup: the camera-unavailable fallback message is "Could not start the camera. Manual entry still works below." (not "Camera unavailable"), the success heading is "Ready to Admit" (the guide said "Ready to Check In"), and — the one the written guide and an earlier pass at this article both got wrong — there is no combined "Cancelled or Refunded" card. Cancelled and Refunded are two separate, distinctly labeled results: "Cancelled — Do Not Admit" and "Refunded — Do Not Admit." All five result states below (Ready to Admit, Already Checked In, Not Found, Cancelled, Refunded) and the offline-sync wording are confirmed directly from this file.',
    body: [
      { type: 'steps', items: [
        'Open Check-In, pick today’s event — "Choose an Event" downloads a local copy of all its passes for offline lookup. Wait for the sync to finish before relying on it.',
        'Point the camera at the customer’s QR code — it reads automatically. If the camera can’t start, the panel says so and manual entry still works: type the Pass code and click "Look Up."',
        'Act on the result.',
      ] },
      { type: 'image', src: '/help/images/checkin-choose-event.png', alt: 'Pass Check-In’s "Choose an Event" step, before scanning begins.' },
      { type: 'list', items: [
        'Ready to Admit (green) — click "Confirm Check-In."',
        'Already Checked In (red) — do not admit; shows the original check-in time, then "Scan Next."',
        'Not Found (red) — the screen says "No Pass matches that code" (or, offline, "...in this device’s offline copy"); ask the customer to check their Locker; do not admit.',
        'Cancelled — Do Not Admit (red) — not valid for entry; do not admit.',
        'Refunded — Do Not Admit (red) — not valid for entry; do not admit.',
      ] },
      { type: 'image', src: '/help/images/checkin-scan-result.png', alt: 'An "Already Checked In" scan result, showing the original check-in time and a "Scan Next" button.' },
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
    verified: true,
    correction: 'The written guide describes these as separate top-level sections (Homepage Builder, Homepage Sections, Featured Team, Partner Logos, Promo Messages, Navigation Links, Footer, FAQ). The live system instead has one "Homepage" entry in the sidebar that opens a hub of 9 cards — each card opens its own sub-page. Requires Homepage Manage either way.',
    body: [
      { type: 'p', text: 'pusostore.com/admin/homepage opens a hub described right on the page as "Everything a marketing employee needs to manage the homepage, without touching code" — nine cards, each its own sub-page:' },
      { type: 'image', src: '/help/images/homepage-hub.png', alt: 'The Homepage hub, showing nine cards: Hero, Fit Check, Featured Team, Partners, FAQ, Announcement Bar, Navigation, Footer, Section Order.' },
      { type: 'list', items: [
        'Hero — the landing statement: headline, image, CTA.',
        'Fit Check — the homepage before/after teaser section.',
        'Featured Team — the rotating team spotlight.',
        'Partners — logos in the scrolling partner strip.',
        'FAQ — questions shown on the homepage.',
        'Announcement Bar — the top bar and homepage marquee strip (e.g. "Free shipping on orders over ₱2,000").',
        'Navigation — the site header’s nav menu.',
        'Footer — company info, links, social, payment methods.',
        'Section Order — which homepage sections show, and in what order.',
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
    verified: true,
    correction: 'Settings → Fit Check has considerably more in it than the guide describes — not just a daily allowance and a Try-On Ad. The fields below are what’s actually on the page. A Fit Check Campaign can also target an entire product category, not only individual products.',
    body: [
      { type: 'p', text: 'Settings → Fit Check (requires Settings Fit Check Manage) configures:' },
      { type: 'list', items: [
        'Experience — daily allowance per fan tier: Guest / day, Registered / day, and Premium / day (Premium is reserved for Membership, not yet assignable to any account). Guest Retention (hours) controls how long a guest’s result is kept before it’s dropped, unless they register first.',
        'Trending — how far back (window, in days) and how many products the homepage’s trending module looks at.',
        'Rewards — one-time bonus Fit Checks a fan earns for completing their profile, verifying their email, and their first purchase; these carry over until used. (For a one-off bonus to a specific fan instead, use "Grant Fit Checks" on their row in Users.)',
        'Sponsored Experience — the loading-video URL (or direct upload), CTA text, and destination URL shown during AI generation.',
        'AI Generation — provider, timeout, queue, prompt, and quality preset are shown but not yet configurable here; they’re fixed in code.',
      ] },
      { type: 'image', src: '/help/images/settings-fitcheck.png', alt: 'Settings → Fit Check, showing Experience, Trending, Rewards, Sponsored Experience, and AI Generation sections.' },
      { type: 'steps', items: [
        'Go to Fit Check Campaigns and click "New Campaign." Requires Fit Check Campaigns Manage.',
        'Give it an internal name and sponsor name, then choose which products it covers — search for specific products, and/or select an entire category (a product is covered if it’s in the list OR matches the category).',
        'Set a headline, description, and CTA.',
        'Save.',
      ] },
      { type: 'image', src: '/help/images/fitcheck-campaign-form.png', alt: 'The Add Fit Check Campaign form, with internal name, sponsor name, product/category targeting, headline, and description.' },
      { type: 'note', text: 'While a campaign is active, every covered product’s Fit Check becomes unlimited for every customer and shows "Unlimited Fit Checks — Sponsored by [Sponsor]" instead of the quota bar. To pause early, toggle Active off; to end permanently, set the End Date to today.' },
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
    verified: true,
    correction: 'The live "Add Promo Code" form has an Internal Note field (not shown to fans) and splits the guide’s single "Expiry Date" into separate Starts/Ends dates; it also has both a Total Uses limit AND a separate Per Customer limit, where the guide only mentions one "Usage Limit." A Free Shipping toggle may exist further down the same form — not confirmed in the portion captured.',
    body: [
      { type: 'p', text: 'pusostore.com/admin/promo-codes lists every code with its discount, usage, active window, and status.' },
      { type: 'image', src: '/help/images/promo-codes-list.png', alt: 'The Promo Codes list, with Code, Discount, Usage, Window, Status, and Actions columns.' },
      { type: 'steps', items: [
        'Click "Add Code." Requires Promotions Manage.',
        'Fill in: Code (what fans type at checkout), an Internal Note (for telling codes apart in this list — not shown to fans), Discount (e.g. "Percent off order") and its amount, Starts/Ends dates (leave blank on either side for no bound), Total Uses, and Per Customer (both optional — unlimited if left blank).',
        'Leave "Active (redeemable at checkout)" checked, then Save.',
      ] },
      { type: 'image', src: '/help/images/promo-code-form.png', alt: 'The Add Promo Code form — Code, Internal Note, Discount, Starts/Ends, Total Uses, Per Customer, Min Order, and Active.' },
      { type: 'p', text: 'Deactivate a code by unchecking Active, or by setting its Ends date in the past — it stops working immediately either way. Deleting a code removes its usage history permanently; editing one does not affect past usage counts.' },
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
    verified: true,
    correction: 'The sidebar’s own sub-nav list and date-range filter options (Today/Yesterday/Last 7 Days/This Month/Last Month/Year to Date/3 Months/All Time/Custom Range) matched the guide exactly when checked. Executive Dashboard and Fit Check Analytics were independently confirmed screen-by-screen this round; the remaining report pages’ own internal fields were not re-screenshotted and still reflect the guide’s brief descriptions below.',
    body: [
      { type: 'p', text: 'pusostore.com/admin/reports. Every workspace has its own date-range selector and its own permission — you only see the ones your department grants.' },
      { type: 'list', items: [
        'Executive Dashboard (Reports Executive View) — revenue, order count, average order value, fulfillment rate; a "Needs Attention Today" alert list; revenue-over-time and sales-by-category charts; top products; recent orders.',
        'Sales Report (Reports Sales View) — revenue by product/category/time, top sellers.',
        'Products Report (Reports Products View) — views, add-to-cart rate, conversion, stock levels.',
        'Customers Report (Reports Customers View) — acquisition, repeat purchase rate, lifetime value.',
        'Operations Report (Reports Operations View) — fulfillment, shipping, checkout recovery, webhook health.',
        'Fit Check Analytics (Reports Fit Check View) — total attempts, success/failure rate, avg generation time, guest vs. registered vs. premium split, cost/duration by AI provider, a usage-over-time chart, most-tried products, conversion after Fit Check, and a per-attempt log exportable as CSV/Excel/PDF.',
        'Organizations Report (Reports Organizations View) — revenue by org, league, team; followers.',
        'Finance Report (Reports Finance View) — net revenue, refunds, payment reconciliation.',
        'Exports Workspace — every report, as Excel/CSV/PDF.',
      ] },
      { type: 'image', src: '/help/images/reports-executive-dashboard.png', alt: 'The Executive Dashboard report, with summary stats, alerts, revenue-over-time, and top products.' },
      { type: 'image', src: '/help/images/reports-fitcheck-analytics.png', alt: 'The Fit Check Analytics report, with attempt counts, success rate, usage charts, and a per-attempt log.' },
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
    verified: true,
    correction: 'The list columns are User, Email, Role, Provider (login method — e.g. Local/Google), Verified, and Joined — not "order count/history" directly in the list as the guide implies. Open a specific customer to see their orders.',
    body: [
      { type: 'p', text: 'pusostore.com/admin/users lists every registered customer and staff account. Requires Users View. Search by name/email, or filter by role.' },
      { type: 'image', src: '/help/images/users-list.png', alt: 'The Users list, with User, Email, Role, Provider, Verified, and Joined columns.' },
    ],
  },
  {
    slug: 'managing-staff-accounts',
    categoryId: 'staff-settings',
    title: 'Managing Staff Accounts',
    summary: 'What actually exists today: founder-only department assignment, and a bonus Fit Check grant — not the self-service creation flow the written guide describes.',
    keywords: ['staff account', 'department', 'remove admin', 'bonus fit check', 'roles and permissions'],
    departments: ['support'],
    sourceRef: 'Training Guide §17',
    verified: true,
    correction: 'The written guide describes creating/promoting a staff account, assigning a department, and demoting one back to customer, all from the Users page, with a password-setup email on creation. None of that exists in the current Users page (frontend/src/pages/admin/AdminUsers.jsx) or its API (backend/routes/staff.js only lists admin accounts and PATCHes department/permissions — there is no role-change or account-creation endpoint). Flipping an account to role "admin" in the first place is not a self-service admin action today; it requires a developer/founder to set it directly. The rest of this article describes what the current UI actually does.',
    body: [
      { type: 'warning', text: 'There is no in-app way to create a new staff account or promote an existing customer to admin. If someone needs staff access, ask engineering or the founder to set their account’s role directly — this is not something Users Manage or any admin UI currently exposes.' },
      { type: 'p', text: 'Once an account already has role "admin," its Department and individual permission overrides are assigned at Settings → Security → Roles & Permissions — and that page itself is restricted to the founder account(s) specifically (not just the Executive department).' },
      { type: 'steps', items: [
        'Go to Settings → Security.',
        'Find the admin account’s row and choose its Department from the dropdown — see "Staff Roles & Permissions" for what each one grants.',
        'Optionally grant individual permissions beyond that department’s default.',
        'Save.',
      ] },
      { type: 'p', text: 'There is also no in-app action to remove admin access (demote an account back to customer) today.' },
      { type: 'p', text: 'Granting a bonus Fit Check credit is a separate, unrelated action available to any account, customer or staff: on the Users page, click "Grant Fit Checks" on the account’s row, enter an amount and an optional note, and confirm. Requires Users Manage.' },
      { type: 'image', src: '/help/images/bonus-fitcheck-modal.png', alt: 'The Grant Bonus Fit Checks modal, with current balance, amount, an optional note, and grant history.' },
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
    verified: true,
    correction: 'All six sections below are now checked directly against their own components (frontend/src/pages/admin/settings/*.jsx), not just Security. The guide significantly overstates what’s configurable in several of them: Commerce has no free-shipping-threshold or payment-reminder-tier field at all (its own UI lists Payment Providers, Shipping Defaults, Return Window, and Tax Settings as explicitly "not yet configurable"); Notifications configures who receives scheduled reports and on what cadence, not order/shipment/customer-alert email behavior (those emails are hardcoded templates today, per that same page’s own text); Integrations is read-only connection status only ("never edited here" — configured via environment variables, not this screen); and Advanced is entirely placeholder — no feature-flag system, maintenance mode, or experimentation framework exists yet. Security’s Roles & Permissions editor is founder-only (requireFounder), not available to Settings Security Manage generally — see "Managing Staff Accounts."',
    body: [
      { type: 'list', items: [
        'Commerce (Settings Commerce Manage) — Order Expiration (enable/disable, and the retention-window hours an unpaid order stays recoverable before it expires and releases its reserved stock — this is also, today, the same window used for inventory reservation itself, not a separate setting) and Venue Pickup configuration. A "Reserved for later" section explicitly lists Payment Providers, Shipping Defaults, Return Window, and Tax Settings as not yet configurable here.',
        'Fit Check — see "Fit Check Settings & Campaigns."',
        'Notifications (Settings Notifications Manage) — Scheduled Reports (who receives which report, and how often) and a placeholder for Email Templates ("not yet configurable — every transactional email is a hardcoded template in code today").',
        'Security (Settings Security Manage to view; the Roles & Permissions editor itself is founder-only) — who has admin access and what they can do (Roles & Permissions — see "Managing Staff Accounts"); Session Timeout (currently a fixed 7-day expiry, not admin-configurable); API Keys (no platform API key system exists yet).',
        'Integrations (Settings Integrations Manage) — read-only connection status (Connected / Not Configured), sourced from real environment variables, never edited on this screen: Xendit, Maya, Cloudinary, AI Provider, Redis, and Email.',
        'Advanced (Settings Advanced Manage) — entirely placeholder today: Feature Flags, Maintenance Mode, and Experimental Features each explicitly say no such system exists yet.',
      ] },
      { type: 'image', src: '/help/images/settings-security.png', alt: 'Settings → Security, showing Roles & Permissions, Session Timeout, and API Keys.' },
      { type: 'note', text: 'There is no in-app screen to change the active payment gateway — Integrations only reports whether each one’s credentials are present as environment variables; switching gateways is an environment-variable change on the hosting platform, done by engineering, not a Settings action.' },
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
    verified: true,
    correction: 'Confirmed against the hard platform rule documented in AGENTS.md/CLAUDE.md: stock is read live and reserved atomically at order placement, never cached or optimistic. No code contradicted this scenario.',
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
    verified: true,
    correction: 'Confirmed against frontend/src/pages/admin/settings/CommerceSettings.jsx’s "Order Expiration" section: an unpaid order’s retention window (in hours) is what determines when it’s marked Expired and its reserved stock released — checked hourly, and (per that same page) also the window inventory reservation itself uses today.',
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
    title: 'Scenario: Shipping Shows "Contact Us" Instead of a Rate',
    summary: 'This only happens for one specific reason: an international order to a country with no mapped shipping zone.',
    keywords: ['shipping rate', 'checkout error', 'contact us'],
    departments: ['operations'],
    sourceRef: 'Training Guide, Part C, Scenario 3',
    verified: true,
    correction: 'The written guide attributes this to "a region isn’t covered" or "cart total/weight doesn’t match any rule." Checked directly against backend/lib/shipping/calculateShipping.js and lib/config/shipping.js: there is no weight-based rule anywhere, and no domestic Philippine region can be "uncovered" — any unrecognized region code silently falls back to a flat ₱200 rate. "Contact us" (method: contact_us) is produced by exactly one path: an international order to a country that’s in the address dropdown but has no entry in the country-to-shipping-zone map. There is also no Commerce settings screen for shipping rates to "check" — that page itself lists "Shipping Defaults" as not yet admin-configurable; rates live in a code config file.',
    body: [
      { type: 'p', text: 'A domestic (Philippines) order always gets a rate — an unrecognized region silently falls back to the same flat rate used for Mindanao, so this specific "no rate" failure can’t happen for a domestic address. It only shows up for an international order to a country that has no mapped shipping zone.' },
      { type: 'list', items: [
        'Confirm the order is international and note the exact destination country.',
        'There is no admin screen to add or fix a shipping zone yourself — rates are defined in code (backend/lib/config/shipping.js), not Settings → Commerce. Escalate to engineering to add the country’s zone mapping.',
        'If the customer needs to ship now, contact them directly to arrange shipping manually outside the normal checkout flow.',
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
    verified: true,
    correction: 'Confirmed against backend/routes/auth.js: POST /forgot-password, POST /reset-password, GET /verify-email, and POST /resend-verification all exist as described.',
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
    verified: true,
    correction: 'The Shipment section and Event Timeline referenced here are confirmed real (see "The Order Detail Page & Event Timeline" and "Shipments & Fulfillment," both independently verified). No separate code check was needed beyond those.',
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
    verified: true,
    correction: 'Confirmed: "webhook_received" is a real, exact OrderEventType (prisma/schema.prisma) and is literally the type string logged by backend/routes/orders.js on an incoming gateway webhook.',
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
