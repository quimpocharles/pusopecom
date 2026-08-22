import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import VirtualTryOn from '../VirtualTryOn';

// Mock only external service/store dependencies. The component body itself is
// real (not mocked), so a missing state hook (e.g. setShowPreview) would
// surface as a render-time ReferenceError — which is exactly the regression
// this guards against.
vi.mock('../../../services/api', () => ({ default: { post: vi.fn() } }));
vi.mock('../../../services/settingsService', () => ({ default: { getSettings: vi.fn().mockResolvedValue({ data: {} }) } }));
vi.mock('../../../services/fitCheckCampaignService', () => ({
  default: { getActiveForProduct: vi.fn().mockResolvedValue(null), recordView: vi.fn() },
}));
vi.mock('../../../store/cartStore', () => ({ default: (sel) => sel({ addItem: vi.fn() }) }));
vi.mock('../../../store/authStore', () => ({ default: () => ({ isAuthenticated: false, user: null }) }));
vi.mock('../../../services/activityService', () => ({ getSessionId: vi.fn(() => 's') }));
vi.mock('../../../hooks/useCameraCapture', () => ({
  useCameraCapture: () => ({ canvasRef: { current: null }, isOpen: false, error: null, open: vi.fn(), stop: vi.fn() }),
}));
vi.mock('../../../utils/imageOptimization', () => ({ optimizeImage: vi.fn() }));
vi.mock('../../../utils/imageValidation', () => ({ validateImage: vi.fn() }));

const eligibleProduct = {
  _id: 'p1', name: 'Gilas Jersey', slug: 'gilas-test',
  images: ['https://res.cloudinary.com/x.jpg'], tryOnEnabled: true,
};

describe('VirtualTryOn — mounts without crashing', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the entry screen for a try-on-eligible product when opened', () => {
    // This would throw a ReferenceError if the component referenced an
    // undeclared state hook (the setShowPreview regression).
    render(<VirtualTryOn product={eligibleProduct} isOpen onClose={() => {}} />);
    expect(screen.getByText('Fit Check')).toBeTruthy();
  });
});
