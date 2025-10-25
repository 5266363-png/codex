import { describe, expect, it } from 'vitest';
import { canSendMessage } from './Chat.jsx';

describe('chat message guard', () => {
  it('rejects empty or whitespace messages', () => {
    expect(canSendMessage('')).toBe(false);
    expect(canSendMessage('   ')).toBe(false);
  });

  it('allows trimmed content', () => {
    expect(canSendMessage(' привет ')).toBe(true);
  });
});
