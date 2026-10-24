export class FinalQCValidationError extends Error {}

export function parseWholeNumber(value, label) {
  if (typeof value !== 'number' && typeof value !== 'string') {
    throw new FinalQCValidationError(`${label} must be a whole number.`);
  }

  if (typeof value === 'string' && value.trim() === '') {
    throw new FinalQCValidationError(`${label} must be a whole number.`);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new FinalQCValidationError(`${label} must be a non-negative whole number.`);
  }
  return parsed;
}

export function validateInspectionQuantities({
  inputQuantity,
  acceptedQuantity,
  reworkQuantity,
  rejectedQuantity,
  pendingQuantity,
}) {
  const input = parseWholeNumber(inputQuantity, 'Inspected quantity');
  if (input <= 0) {
    throw new FinalQCValidationError('Inspected quantity must be greater than zero.');
  }

  const outcomes = [
    ['Accepted quantity', acceptedQuantity],
    ['Rework quantity', reworkQuantity],
    ['Rejected quantity', rejectedQuantity],
    ['Pending quantity', pendingQuantity],
  ].map(([label, value]) => parseWholeNumber(value, label));

  const accounted = outcomes.reduce((sum, quantity) => sum + quantity, 0);
  if (accounted !== input) {
    throw new FinalQCValidationError(
      `Accepted, rework, rejected, and pending quantities must total ${input}; received ${accounted}.`,
    );
  }

  return { input, accepted: outcomes[0], rework: outcomes[1], rejected: outcomes[2], pending: outcomes[3] };
}

export function availableAcceptedQuantity(accepted, transferred) {
  const acceptedQuantity = parseWholeNumber(accepted, 'Accepted quantity');
  const transferredQuantity = parseWholeNumber(transferred, 'Transferred quantity');
  return Math.max(0, acceptedQuantity - transferredQuantity);
}

export function validateHandoverQuantity(requested, available) {
  const quantity = parseWholeNumber(requested, 'Handover quantity');
  if (quantity <= 0) {
    throw new FinalQCValidationError('Handover quantity must be greater than zero.');
  }
  const availableQuantity = parseWholeNumber(available, 'Available accepted quantity');
  if (quantity > availableQuantity) {
    throw new FinalQCValidationError(`Cannot hand over ${quantity} pieces; only ${availableQuantity} accepted pieces remain.`);
  }
  return quantity;
}

export function inspectionPassed(checks, overallResult) {
  return overallResult === 'PASS' && checks.every((check) => check === 'PASS');
}
