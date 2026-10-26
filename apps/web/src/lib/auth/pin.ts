const MIN_PIN_LENGTH = 4;

/** Returns an error message when the PIN is unacceptable, otherwise null. */
export function validatePin(pin: unknown): string | null {
  if (typeof pin !== 'string' || pin.trim().length < MIN_PIN_LENGTH) {
    return `PIN / password must be at least ${MIN_PIN_LENGTH} characters.`;
  }
  if (/^(\d)\1+$/.test(pin.trim()) || ['1234', '12345', '123456', '0000', '1111'].includes(pin.trim())) {
    return 'This PIN is too easy to guess. Choose a different one.';
  }
  return null;
}
