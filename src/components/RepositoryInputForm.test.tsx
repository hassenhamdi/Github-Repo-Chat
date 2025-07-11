import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import RepositoryInputForm from '@/components/RepositoryInputForm';
import { AppState } from '@/types';

describe('RepositoryInputForm', () => {
  it('renders the form correctly', () => {
    const mockOnUrlSubmit = vi.fn();
    const mockOnDigestSubmit = vi.fn();

    render(
      <RepositoryInputForm
        onUrlSubmit={mockOnUrlSubmit}
        onDigestSubmit={mockOnDigestSubmit}
        isLoading={false}
        appState={AppState.AWAITING_DIGEST_INPUT}
        onSettingsClick={vi.fn()}
      />
    );

    expect(screen.getByText('Chat with a Repository')).toBeInTheDocument();
    expect(screen.getByLabelText('GitHub Repository URL')).toBeInTheDocument();
    expect(screen.getByLabelText('Upload Digest File (.txt)')).toBeInTheDocument();
    expect(screen.getByLabelText('Or Paste Digest Content')).toBeInTheDocument();
  });
});