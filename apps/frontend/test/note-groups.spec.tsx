import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NOTE_GROUPS, NoteGroups } from '@/notes/note-groups';
import { noteOf } from './conversations-backend';

describe('NoteGroups', () => {
  it('orders the four groups and hides empty ones', () => {
    render(
      <NoteGroups
        notes={[
          noteOf('missed', 'Could you run that by me again?'),
          noteOf('phrase', 'That makes sense.'),
          noteOf('phrase', 'Let me think about it.'),
          noteOf('correction', 'I went home.'),
        ]}
      />,
    );

    expect(NOTE_GROUPS.map(({ kind, title }) => [kind, title])).toEqual([
      ['phrase', 'Câu hay'],
      ['word', 'Từ / cụm'],
      ['correction', 'Sửa lỗi'],
      ['missed', 'Câu nghe sót'],
    ]);
    expect(
      screen.getAllByRole('heading').map((heading) => heading.textContent),
    ).toEqual(['Câu hay (2)', 'Sửa lỗi (1)', 'Câu nghe sót (1)']);
    const missed = screen.getByRole('region', { name: 'Câu nghe sót (1)' });
    expect(
      within(missed).getByText('Could you run that by me again?'),
    ).toBeVisible();
    expect(
      within(missed).getByText('Nghĩa của Could you run that by me again?'),
    ).toBeVisible();
  });

  it('a correction shows said struck through, an arrow and the corrected sentence', () => {
    render(
      <NoteGroups
        notes={[
          noteOf('correction', 'I went home.', {
            said: 'I goed home.',
            meaning: 'Quá khứ của go là went.',
          }),
        ]}
      />,
    );

    const corrections = screen.getByRole('region', { name: 'Sửa lỗi (1)' });
    const said = within(corrections).getByText('I goed home.');
    expect(said.tagName).toBe('DEL');
    expect(within(corrections).getByText('I went home.')).toBeVisible();
    expect(corrections).toHaveTextContent(/I goed home\.\s*→\s*I went home\./);
    expect(
      within(corrections).getByText('Quá khứ của go là went.'),
    ).toBeVisible();
  });

  it('renders note text as text', () => {
    const { container } = render(
      <NoteGroups
        notes={[
          noteOf('word', '<b>x</b>', {
            meaning: '<img src=x onerror=alert(1)>',
          }),
        ]}
      />,
    );

    expect(screen.getByText('<b>x</b>')).toBeVisible();
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeVisible();
    expect(container.querySelector('b')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });

  it('each group heading has an icon', () => {
    const { container } = render(
      <NoteGroups
        notes={[
          noteOf('phrase', 'That makes sense.'),
          noteOf('word', 'run by'),
          noteOf('correction', 'I went home.'),
          noteOf('missed', 'Say again?'),
        ]}
      />,
    );

    const headings = container.querySelectorAll('h3');
    expect(headings).toHaveLength(4);
    for (const heading of headings) {
      const icon = heading.querySelector('svg');
      expect(icon).not.toBeNull();
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    }
  });
});
