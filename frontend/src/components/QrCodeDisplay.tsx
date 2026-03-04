import { QRCodeSVG } from 'qrcode.react';

interface QrCodeDisplayProps {
  value: string;
  /**
   * Size in pixels for the QR code SVG.
   * Minimum recommended: 128px for short strings, 200px+ for long tokens.
   */
  size?: number;
  className?: string;
  caption?: string;
}

export function QrCodeDisplay({ value, size = 256, className = '', caption }: QrCodeDisplayProps) {
  // Guard: render nothing if value is empty/falsy
  if (!value) return null;

  return (
    <div
      className={`bg-white rounded-lg flex-shrink-0 dark:ring-1 dark:ring-amber-700/50 ${className}`}
    >
      {/* White bg + padding provides quiet zone for QR scanners. Standard requires 4 modules (~31px) but p-4 (16px) works reliably with modern phone cameras */}
      <div className="p-4 [&>svg]:max-w-full [&>svg]:h-auto">
        <QRCodeSVG value={value} size={size} level="Q" title="QR code containing your API token" />
        {caption && <p className="text-xs text-center text-gray-500 mt-2">{caption}</p>}
      </div>
    </div>
  );
}
