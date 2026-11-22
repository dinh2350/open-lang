import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  findStatusMessage,
  getStatusMessage,
  queryStatusMessage,
} from './status-message';

describe('the status message helpers', () => {
  it('skip the empty status regions and return the one with a message', () => {
    render(
      <>
        <div role="status" />
        <div role="status">Saved.</div>
        <div role="status"> </div>
      </>,
    );
    expect(getStatusMessage()).toHaveTextContent('Saved.');
    expect(queryStatusMessage()).toHaveTextContent('Saved.');
  });

  it('query returns null when every status region is empty', () => {
    render(<div role="status" />);
    expect(queryStatusMessage()).toBeNull();
    expect(() => getStatusMessage()).toThrow('No status region has a message.');
  });

  it('throw when two status regions have a message at once', async () => {
    render(
      <>
        <div role="status">Saved.</div>
        <div role="status">Saving…</div>
      </>,
    );
    expect(() => queryStatusMessage()).toThrow(
      'More than one status region has a message.',
    );
    expect(() => getStatusMessage()).toThrow(
      'More than one status region has a message.',
    );
    await expect(findStatusMessage()).rejects.toThrow(
      'More than one status region has a message.',
    );
  });

  it('look only inside the container they are given', () => {
    const { container } = render(
      <>
        <div role="status">Outside.</div>
        <section>
          <div role="status">Inside.</div>
        </section>
      </>,
    );
    const section = container.querySelector('section');
    if (section === null) {
      throw new Error('no section');
    }
    expect(getStatusMessage(section)).toHaveTextContent('Inside.');
  });
});
