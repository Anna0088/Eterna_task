import crypto from 'crypto';

export const generateMockTxHash = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

export const generateMockSignature = (): string => {
  return crypto.randomBytes(64).toString('base64');
};

// Generate a random number within a range
export const randomInRange = (min: number, max: number): number => {
  return Math.random() * (max - min) + min;
};

// Generate realistic price with variance
export const generatePriceWithVariance = (
  basePrice: number,
  varianceMin: number,
  varianceMax: number
): number => {
  const variance = randomInRange(varianceMin, varianceMax);
  const direction = Math.random() > 0.5 ? 1 : -1;
  return basePrice * (1 + direction * variance);
};
