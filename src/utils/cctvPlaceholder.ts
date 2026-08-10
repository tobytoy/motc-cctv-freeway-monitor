/**
 * Generates an authentic SVG Data URI for a CCTV monitor standby screen.
 * This guarantees no external stock photos (like flowers/nature) are shown when a stream is offline or loading.
 */
export function getCctvPlaceholderSvg(locationName: string, roadName: string, statusText: string = '即時影像訊號搜尋中...'): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#090d16"/>
        <stop offset="50%" stop-color="#0f172a"/>
        <stop offset="100%" stop-color="#050811"/>
      </linearGradient>
      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" stroke-width="0.8" opacity="0.6"/>
      </pattern>
      <pattern id="scanlines" width="100" height="4" patternUnits="userSpaceOnUse">
        <line x1="0" y1="0" x2="100" y2="0" stroke="#ffffff" stroke-width="1" opacity="0.03"/>
      </pattern>
    </defs>
    
    <!-- Dark Background -->
    <rect width="800" height="450" fill="url(#bg)"/>
    <rect width="800" height="450" fill="url(#grid)"/>
    <rect width="800" height="450" fill="url(#scanlines)"/>
    
    <!-- Viewfinder Corners -->
    <path d="M 40 70 L 40 40 L 70 40" fill="none" stroke="#3b82f6" stroke-width="3" opacity="0.8"/>
    <path d="M 760 70 L 760 40 L 730 40" fill="none" stroke="#3b82f6" stroke-width="3" opacity="0.8"/>
    <path d="M 40 380 L 40 410 L 70 410" fill="none" stroke="#3b82f6" stroke-width="3" opacity="0.8"/>
    <path d="M 760 380 L 760 410 L 730 410" fill="none" stroke="#3b82f6" stroke-width="3" opacity="0.8"/>
    
    <!-- Center Crosshair -->
    <circle cx="400" cy="225" r="40" fill="none" stroke="#334155" stroke-width="1.5" stroke-dasharray="4,4"/>
    <line x1="380" y1="225" x2="420" y2="225" stroke="#475569" stroke-width="1.5"/>
    <line x1="400" y1="205" x2="400" y2="245" stroke="#475569" stroke-width="1.5"/>
    
    <!-- Camera Icon & Signal Status -->
    <g transform="translate(400, 170)" text-anchor="middle">
      <rect x="-30" y="-30" width="60" height="40" rx="6" fill="#1e293b" stroke="#3b82f6" stroke-width="2"/>
      <circle cx="0" cy="-10" r="10" fill="#0f172a" stroke="#60a5fa" stroke-width="2"/>
      <polygon points="30,-15 45,-25 45,5 30,-5" fill="#1e293b" stroke="#3b82f6" stroke-width="2"/>
    </g>
    
    <!-- Highway Badge & Title Text -->
    <text x="400" y="275" font-family="sans-serif" font-size="20" font-weight="bold" fill="#f8fafc" text-anchor="middle">${escapeXml(locationName)}</text>
    <text x="400" y="305" font-family="monospace" font-size="14" fill="#94a3b8" text-anchor="middle">${escapeXml(roadName)} • 交通部高公局 CCTV</text>
    
    <!-- Status Pill -->
    <rect x="300" y="325" width="200" height="28" rx="14" fill="#1e293b" stroke="#475569" stroke-width="1"/>
    <circle cx="320" cy="339" r="4" fill="#f59e0b"/>
    <text x="410" y="344" font-family="sans-serif" font-size="12" fill="#fbbf24" font-weight="bold" text-anchor="middle">${escapeXml(statusText)}</text>

    <!-- Top Watermark -->
    <text x="50" y="30" font-family="monospace" font-size="12" fill="#64748b">[MOTC FREEWAY CCTV MONITOR]</text>
    <text x="750" y="30" font-family="monospace" font-size="12" fill="#ef4444" text-anchor="end">● STANDBY</text>
  </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
