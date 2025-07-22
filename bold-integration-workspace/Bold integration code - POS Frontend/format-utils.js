// src/utils/format.js
export const formatCurrency = (amount, currency = 'COP') => {
  // Amount is in cents, convert to main unit
  const mainAmount = amount / 100;
  
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(mainAmount);
};