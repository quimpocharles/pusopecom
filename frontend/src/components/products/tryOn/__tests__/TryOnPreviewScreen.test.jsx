import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TryOnPreviewScreen from '../TryOnPreviewScreen';

describe('TryOnPreviewScreen', () => {
  it('shows the preview image and all three actions when a camera is available', () => {
    render(
      <TryOnPreviewScreen
        imageUrl="blob:preview"
        onUsePhoto={() => {}}
        onRetake={() => {}}
        onChooseAnother={() => {}}
        cameraAvailable
      />
    );
    expect(screen.getByAltText('Your photo preview')).toHaveAttribute('src', 'blob:preview');
    expect(screen.getByRole('button', { name: 'Use Photo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retake Photo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose Another Photo' })).toBeInTheDocument();
  });

  it('hides Retake Photo when no camera is available', () => {
    render(
      <TryOnPreviewScreen
        imageUrl="blob:preview"
        onUsePhoto={() => {}}
        onRetake={() => {}}
        onChooseAnother={() => {}}
        cameraAvailable={false}
      />
    );
    expect(screen.queryByRole('button', { name: 'Retake Photo' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose Another Photo' })).toBeInTheDocument();
  });

  it('calls the right handler for each action', async () => {
    const onUsePhoto = vi.fn();
    const onRetake = vi.fn();
    const onChooseAnother = vi.fn();
    const user = userEvent.setup();
    render(
      <TryOnPreviewScreen
        imageUrl="blob:preview"
        onUsePhoto={onUsePhoto}
        onRetake={onRetake}
        onChooseAnother={onChooseAnother}
        cameraAvailable
      />
    );

    await user.click(screen.getByRole('button', { name: 'Use Photo' }));
    expect(onUsePhoto).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Retake Photo' }));
    expect(onRetake).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Choose Another Photo' }));
    expect(onChooseAnother).toHaveBeenCalledTimes(1);
  });
});
