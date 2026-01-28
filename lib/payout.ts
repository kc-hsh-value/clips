export interface PayoutCalculation {
  totalViews: number;
  baseAmount: number;
  multiplier: number;
  finalAmount: number;
  tier: 'standard' | 'bronze' | 'silver';
}

export function calculatePayout(
  totalViews: number,
  ratePerK: number = 4,
  multiplier100k: number = 1.25,
  multiplier250k: number = 1.5
): PayoutCalculation {
  const baseAmount = (totalViews / 1000) * ratePerK;
  let multiplier = 1.0;
  let tier: PayoutCalculation['tier'] = 'standard';

  if (totalViews >= 250000) {
    multiplier = multiplier250k;
    tier = 'silver';
  } else if (totalViews >= 100000) {
    multiplier = multiplier100k;
    tier = 'bronze';
  }

  return {
    totalViews,
    baseAmount: Math.round(baseAmount * 100) / 100,
    multiplier,
    finalAmount: Math.round(baseAmount * multiplier * 100) / 100,
    tier,
  };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function formatViews(views: number): string {
  if (views >= 1000000) {
    return `${(views / 1000000).toFixed(1)}M`;
  }
  if (views >= 1000) {
    return `${(views / 1000).toFixed(1)}K`;
  }
  return views.toString();
}
