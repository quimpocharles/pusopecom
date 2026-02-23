const FREE_SHIPPING_THRESHOLD = 2000;

/**
 * Props:
 *   cartTotal (Number) — current cart subtotal in PHP
 *   country   (String) — only renders when 'Philippines'
 */
const FreeShippingBar = ({ cartTotal, country = 'Philippines' }) => {
  if (country !== 'Philippines') return null;

  const reached        = cartTotal >= FREE_SHIPPING_THRESHOLD;
  const progressPercent = Math.min((cartTotal / FREE_SHIPPING_THRESHOLD) * 100, 100);
  const amountNeeded   = FREE_SHIPPING_THRESHOLD - cartTotal;

  return (
    <div className="px-6 py-3 bg-white border-b border-gray-100">
      <p
        className={`text-xs font-medium text-center mb-2 transition-colors ${
          reached ? 'text-green-600 animate-pulse' : 'text-gray-600'
        }`}
      >
        {reached
          ? "🎉 You've unlocked FREE shipping!"
          : `You are ₱${amountNeeded.toLocaleString('en-PH', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })} away from FREE nationwide shipping!`
        }
      </p>

      <div className="bg-gray-200 rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full rounded-full bg-green-500 transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
};

export default FreeShippingBar;
