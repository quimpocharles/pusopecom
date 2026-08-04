// Every stage label is deliberately non-technical — no "MB", "compression",
// "resizing", or "optimization" — the pipeline running behind these labels
// (imageOptimization.js / imageValidation.js) is an implementation detail
// a fan never needs to see.
const STAGE_LABELS = {
  preparing: 'Preparing your photo...',
  optimizing: 'Optimizing image...',
  validating: 'Checking photo quality...',
  starting: 'Starting Fit Check...',
};

const TryOnPreparingScreen = ({ stage }) => (
  <div className="w-full aspect-[3/4] border-2 border-ink-200 bg-paper flex flex-col items-center justify-center gap-4">
    <div className="w-10 h-10 border-2 border-ink-900 border-t-transparent rounded-full animate-spin" />
    <p className="text-sm font-medium text-ink-700">{STAGE_LABELS[stage] || STAGE_LABELS.preparing}</p>
  </div>
);

export default TryOnPreparingScreen;
