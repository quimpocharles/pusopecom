import { useState } from 'react';
import { ArchiveBoxIcon } from '@heroicons/react/24/outline';
import { Button, Badge, Panel, Modal, Input, EmptyState, ErrorState } from '../../components/ui';

/**
 * Internal, unlinked demo of the shared design system primitives. Not
 * referenced from any navigation and does not affect any existing page;
 * it exists purely so the primitives can be viewed and clicked through in
 * isolation before anything is migrated onto them.
 *
 * Button and Panel below reflect the Editorial Design Language migration
 * (docs/design/MIGRATION_PLAN.md, Part 1) — flat, bordered, rounded-editorial,
 * no shadow, no gradient (EmptyState/ErrorState's own buttons inherit this
 * too, since they call the shared .btn-* classes directly). Badge, Modal,
 * and Input haven't been migrated yet — this page still previews their
 * pre-migration styling.
 *
 * Reachable directly at /_design-system.
 */
const Section = ({ title, children }) => (
  <section className="mb-14">
    <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-4">{title}</h2>
    <div className="space-y-4">{children}</div>
  </section>
);

const DesignSystemDemo = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showEmailError, setShowEmailError] = useState(false);

  return (
    <div className="container-custom py-12 max-w-4xl">
      <h1 className="text-2xl font-bold mb-2">Design System Primitives</h1>
      <p className="text-gray-500 mb-10">
        Phase 1 — every variant here wraps an existing class already defined in <code>index.css</code>.
        Nothing on this page is new styling.
      </p>

      <Section title="Button">
        <div className="flex flex-wrap gap-3">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="text">Text</Button>
          <Button disabled>Disabled</Button>
        </div>
      </Section>

      <Section title="Badge">
        <div className="flex flex-wrap gap-3">
          <Badge tone="primary">Primary</Badge>
          <Badge tone="secondary">Secondary</Badge>
          <Badge tone="accent">Sale</Badge>
          <Badge tone="success">In Stock</Badge>
        </div>
      </Section>

      <Section title="Panel">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Panel title="With a title">
            <p className="text-sm text-gray-600">One flat, bordered treatment — no separate "elevated" variant anymore.</p>
          </Panel>
          <Panel>
            <p className="text-sm text-gray-600">Same treatment, no title. Matches the .card class real pages (Checkout, OrderConfirmation, AdminPickup) already use directly.</p>
          </Panel>
        </div>
      </Section>

      <Section title="Input">
        <div className="max-w-sm">
          <Input
            label="Email"
            placeholder="you@example.com"
            error={showEmailError ? 'Invalid email address' : undefined}
            helperText={!showEmailError ? "We'll never share this." : undefined}
          />
          <button
            type="button"
            className="text-xs text-primary-600 mt-2 underline"
            onClick={() => setShowEmailError((v) => !v)}
          >
            Toggle error state
          </button>
        </div>
      </Section>

      <Section title="EmptyState">
        <Panel padding="p-0">
          <EmptyState
            icon={ArchiveBoxIcon}
            title="No products found"
            description="Try adjusting your filters."
            actionLabel="Clear Filters"
            onAction={() => alert('Clear filters clicked')}
          />
        </Panel>
      </Section>

      <Section title="ErrorState">
        <Panel padding="p-0">
          <ErrorState
            title="Couldn't load orders"
            description="Something went wrong on our end."
            onRetry={() => alert('Retry clicked')}
          />
        </Panel>
      </Section>

      <Section title="Modal">
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setModalOpen(true)}>
            Open modal (with header)
          </Button>
          <Button variant="secondary" onClick={() => setConfirmOpen(true)}>
            Open confirm-style modal
          </Button>
        </div>
        <p className="text-xs text-gray-400">
          Try Escape, backdrop click, and Tab-cycling focus inside either modal.
        </p>
      </Section>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Example Modal" size="md">
        <div className="p-6">
          <p className="text-sm text-gray-600 mb-4">
            This panel reproduces VirtualTryOn's existing modal markup — same backdrop, same
            max-width, same rounded corners — with Escape, focus trap, and backdrop-close added.
          </p>
          <Input label="Sample field" placeholder="Try tabbing to me" />
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={() => setModalOpen(false)}>Confirm</Button>
          </div>
        </div>
      </Modal>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} size="sm">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Remove Item</h3>
          <p className="text-sm text-gray-600 mb-6">
            This reproduces CartDrawer's existing remove-confirmation modal exactly.
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => setConfirmOpen(false)}>Remove</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DesignSystemDemo;
