import { useId } from 'react';
import { flagEmojiToIso } from '@/lib/geoRegions';

export type FlagSize = 'xs' | 'sm' | 'md' | 'lg';

const SIZE_MAP: Record<FlagSize, { width: number; height: number }> = {
  xs: { width: 15, height: 10 },
  sm: { width: 18, height: 12 },
  md: { width: 21, height: 14 },
  lg: { width: 28, height: 19 },
};

function normalizeIso(code?: string | null): string {
  const raw = (code ?? '').trim();
  if (!raw) return 'GL';
  const fromEmoji = flagEmojiToIso(raw);
  const iso = (fromEmoji ?? raw).toUpperCase();
  if (iso === 'UK') return 'GB';
  return /^[A-Z]{2}$/.test(iso) ? iso : 'GL';
}

function renderUnionJackCanton(w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2;
  return (
    <g>
      <rect width={w} height={h} fill="#1B3B8C" />
      <path d={`M0,0 L${w},${h} M${w},0 L0,${h}`} stroke="#F4F6F9" strokeWidth={h * 0.22} />
      <path d={`M0,0 L${w},${h} M${w},0 L0,${h}`} stroke="#D62839" strokeWidth={h * 0.11} />
      <path d={`M${cx},0 V${h} M0,${cy} H${w}`} stroke="#F4F6F9" strokeWidth={h * 0.34} />
      <path d={`M${cx},0 V${h} M0,${cy} H${w}`} stroke="#D62839" strokeWidth={h * 0.19} />
    </g>
  );
}

/**
 * Pure geometric flat-design flag vectors on a crisp 24x16 grid.
 * Slightly calibrated editorial tones so flags look sleek against both dark and light Liquid Glass.
 */
function renderFlagArtwork(iso: string) {
  switch (iso) {
    /* ── East & Southeast Asia ─────────────────────────────────────── */
    case 'HK':
      return (
        <>
          <rect width="24" height="16" fill="#D92B2B" />
          <g transform="translate(12 8)" fill="#F8FAFC">
            {[0, 72, 144, 216, 288].map((deg) => (
              <ellipse
                key={deg}
                cx="0"
                cy="-2.8"
                rx="1.35"
                ry="2.55"
                transform={`rotate(${deg})`}
              />
            ))}
            <circle r="0.9" fill="#D92B2B" />
          </g>
        </>
      );

    case 'CN':
      return (
        <>
          <rect width="24" height="16" fill="#D92B2B" />
          <polygon
            points="5.2,2.5 5.9,4.6 8.1,4.6 6.3,5.9 7.0,8.0 5.2,6.7 3.4,8.0 4.1,5.9 2.3,4.6 4.5,4.6"
            fill="#F6D04D"
          />
          <circle cx="9.6" cy="2.6" r="0.65" fill="#F6D04D" />
          <circle cx="10.8" cy="4.2" r="0.65" fill="#F6D04D" />
          <circle cx="10.8" cy="6.2" r="0.65" fill="#F6D04D" />
          <circle cx="9.5" cy="7.7" r="0.65" fill="#F6D04D" />
        </>
      );

    case 'TW':
      return (
        <>
          <rect width="24" height="16" fill="#DC2626" />
          <rect width="12" height="8.5" fill="#1D3A8A" />
          <g transform="translate(6 4.25)">
            {[0, 30, 60, 90, 120, 150].map((deg) => (
              <rect
                key={deg}
                x="-0.4"
                y="-2.8"
                width="0.8"
                height="5.6"
                fill="#F8FAFC"
                transform={`rotate(${deg})`}
              />
            ))}
            <circle r="1.75" fill="#1D3A8A" />
            <circle r="1.35" fill="#F8FAFC" />
          </g>
        </>
      );

    case 'MO':
      return (
        <>
          <rect width="24" height="16" fill="#0F7A60" />
          <g fill="#F8FAFC" transform="translate(12 9.2)">
            <ellipse cx="0" cy="-1.6" rx="1.5" ry="2.8" />
            <ellipse cx="-2.4" cy="-0.6" rx="1.3" ry="2.4" transform="rotate(-38 -2.4 -0.6)" />
            <ellipse cx="2.4" cy="-0.6" rx="1.3" ry="2.4" transform="rotate(38 2.4 -0.6)" />
            <rect x="-4.2" y="1.7" width="8.4" height="0.8" rx="0.4" />
            <rect x="-2.8" y="3.0" width="5.6" height="0.7" rx="0.35" />
          </g>
          <circle cx="12" cy="3.6" r="0.7" fill="#F6D04D" />
          <circle cx="9.5" cy="4.4" r="0.5" fill="#F6D04D" />
          <circle cx="14.5" cy="4.4" r="0.5" fill="#F6D04D" />
        </>
      );

    case 'JP':
      return (
        <>
          <rect width="24" height="16" fill="#F8FAFC" />
          <circle cx="12" cy="8" r="4.4" fill="#C81E37" />
        </>
      );

    case 'KR':
      return (
        <>
          <rect width="24" height="16" fill="#F8FAFC" />
          <g transform="translate(12 8)">
            <circle r="3.7" fill="#1F4AA8" />
            <path d="M-3.7,0 A3.7,3.7 0 0,1 3.7,0 A1.85,1.85 0 0,1 0,0 A1.85,1.85 0 0,0 -3.7,0 Z" fill="#D42838" />
            <g stroke="#1E2430" strokeWidth="0.85" strokeLinecap="butt">
              <g transform="translate(-6.2 -3.7) rotate(-34)">
                <line x1="-1.9" y1="-1.1" x2="1.9" y2="-1.1" />
                <line x1="-1.9" y1="0" x2="1.9" y2="0" />
                <line x1="-1.9" y1="1.1" x2="1.9" y2="1.1" />
              </g>
              <g transform="translate(6.2 -3.7) rotate(34)">
                <line x1="-1.9" y1="-1.1" x2="1.9" y2="-1.1" />
                <line x1="-1.9" y1="0" x2="1.9" y2="0" />
                <line x1="-1.9" y1="1.1" x2="1.9" y2="1.1" />
              </g>
              <g transform="translate(-6.2 3.7) rotate(34)">
                <line x1="-1.9" y1="-1.1" x2="1.9" y2="-1.1" />
                <line x1="-1.9" y1="0" x2="1.9" y2="0" />
                <line x1="-1.9" y1="1.1" x2="1.9" y2="1.1" />
              </g>
              <g transform="translate(6.2 3.7) rotate(-34)">
                <line x1="-1.9" y1="-1.1" x2="1.9" y2="-1.1" />
                <line x1="-1.9" y1="0" x2="1.9" y2="0" />
                <line x1="-1.9" y1="1.1" x2="1.9" y2="1.1" />
              </g>
            </g>
          </g>
        </>
      );

    case 'SG':
      return (
        <>
          <rect width="24" height="8" fill="#E0313F" />
          <rect y="8" width="24" height="8" fill="#F8FAFC" />
          <circle cx="5.4" cy="4" r="2.45" fill="#F8FAFC" />
          <circle cx="6.35" cy="4" r="2.15" fill="#E0313F" />
          <circle cx="7.9" cy="2.6" r="0.55" fill="#F8FAFC" />
          <circle cx="9.2" cy="3.6" r="0.55" fill="#F8FAFC" />
          <circle cx="8.7" cy="5.1" r="0.55" fill="#F8FAFC" />
          <circle cx="7.1" cy="5.1" r="0.55" fill="#F8FAFC" />
          <circle cx="6.7" cy="3.6" r="0.55" fill="#F8FAFC" />
        </>
      );

    case 'MY':
      return (
        <>
          <rect width="24" height="16" fill="#F8FAFC" />
          {[0, 2.3, 4.6, 6.9, 9.2, 11.5, 13.8].map((y) => (
            <rect key={y} y={y} width="24" height="1.18" fill="#D12434" />
          ))}
          <rect width="12.2" height="9.2" fill="#182C7A" />
          <circle cx="5.2" cy="4.6" r="2.55" fill="#F6C945" />
          <circle cx="6.1" cy="4.6" r="2.15" fill="#182C7A" />
          <circle cx="8.4" cy="4.6" r="1.25" fill="#F6C945" />
        </>
      );

    case 'TH':
      return (
        <>
          <rect width="24" height="16" fill="#B52236" />
          <rect y="2.65" width="24" height="10.7" fill="#F8FAFC" />
          <rect y="5.35" width="24" height="5.3" fill="#2A2F5D" />
        </>
      );

    case 'VN':
      return (
        <>
          <rect width="24" height="16" fill="#D92720" />
          <polygon
            points="12,3.4 13.15,6.9 16.85,6.9 13.85,9.05 15.0,12.55 12,10.4 9.0,12.55 10.15,9.05 7.15,6.9 10.85,6.9"
            fill="#F8D24A"
          />
        </>
      );

    case 'PH':
      return (
        <>
          <rect width="24" height="8" fill="#1D44A3" />
          <rect y="8" width="24" height="8" fill="#D12334" />
          <polygon points="0,0 10.2,8 0,16" fill="#F8FAFC" />
          <circle cx="3.7" cy="8" r="1.9" fill="#F6C945" />
          <circle cx="1.6" cy="3.1" r="0.65" fill="#F6C945" />
          <circle cx="1.6" cy="12.9" r="0.65" fill="#F6C945" />
          <circle cx="7.4" cy="8" r="0.65" fill="#F6C945" />
        </>
      );

    case 'ID':
      return (
        <>
          <rect width="24" height="8" fill="#D12334" />
          <rect y="8" width="24" height="8" fill="#F8FAFC" />
        </>
      );

    case 'IN':
      return (
        <>
          <rect width="24" height="5.35" fill="#F29433" />
          <rect y="5.35" width="24" height="5.3" fill="#F8FAFC" />
          <rect y="10.65" width="24" height="5.35" fill="#1D8A3E" />
          <circle cx="12" cy="8" r="1.75" fill="none" stroke="#1E3A8A" strokeWidth="0.65" />
          <circle cx="12" cy="8" r="0.45" fill="#1E3A8A" />
        </>
      );

    case 'AU':
      return (
        <>
          <rect width="24" height="16" fill="#142C7A" />
          {renderUnionJackCanton(12, 8)}
          <circle cx="6" cy="12.2" r="1.45" fill="#F8FAFC" />
          <circle cx="18" cy="4.2" r="0.8" fill="#F8FAFC" />
          <circle cx="15.8" cy="7.3" r="0.8" fill="#F8FAFC" />
          <circle cx="20.4" cy="6.9" r="0.8" fill="#F8FAFC" />
          <circle cx="18.2" cy="12.2" r="0.9" fill="#F8FAFC" />
          <circle cx="19.5" cy="9.4" r="0.55" fill="#F8FAFC" />
        </>
      );

    case 'NZ':
      return (
        <>
          <rect width="24" height="16" fill="#142C7A" />
          {renderUnionJackCanton(12, 8)}
          {[
            [18.2, 4.1],
            [15.8, 7.6],
            [20.4, 7.2],
            [18.2, 12.2],
          ].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.05" fill="#D92638" stroke="#F8FAFC" strokeWidth="0.45" />
          ))}
        </>
      );

    /* ── Europe ────────────────────────────────────────────────────── */
    case 'GB':
      return renderUnionJackCanton(24, 16);

    case 'IE':
      return (
        <>
          <rect width="8" height="16" fill="#1D945E" />
          <rect x="8" width="8" height="16" fill="#F8FAFC" />
          <rect x="16" width="8" height="16" fill="#F28C38" />
        </>
      );

    case 'NL':
      return (
        <>
          <rect width="24" height="5.35" fill="#BC2633" />
          <rect y="5.35" width="24" height="5.3" fill="#F8FAFC" />
          <rect y="10.65" width="24" height="5.35" fill="#234890" />
        </>
      );

    case 'DE':
      return (
        <>
          <rect width="24" height="5.35" fill="#1E2026" />
          <rect y="5.35" width="24" height="5.3" fill="#D62429" />
          <rect y="10.65" width="24" height="5.35" fill="#F5C431" />
        </>
      );

    case 'FR':
      return (
        <>
          <rect width="8" height="16" fill="#1E3B96" />
          <rect x="8" width="8" height="16" fill="#F8FAFC" />
          <rect x="16" width="8" height="16" fill="#DE2B3A" />
        </>
      );

    case 'BE':
      return (
        <>
          <rect width="8" height="16" fill="#1E2026" />
          <rect x="8" width="8" height="16" fill="#F5D342" />
          <rect x="16" width="8" height="16" fill="#DE2B3A" />
        </>
      );

    case 'LU':
      return (
        <>
          <rect width="24" height="5.35" fill="#DE2B3A" />
          <rect y="5.35" width="24" height="5.3" fill="#F8FAFC" />
          <rect y="10.65" width="24" height="5.35" fill="#24A1DF" />
        </>
      );

    case 'CH':
      return (
        <>
          <rect width="24" height="16" fill="#D42929" />
          <rect x="10.3" y="3.4" width="3.4" height="9.2" rx="0.3" fill="#F8FAFC" />
          <rect x="7.4" y="6.3" width="9.2" height="3.4" rx="0.3" fill="#F8FAFC" />
        </>
      );

    case 'AT':
      return (
        <>
          <rect width="24" height="5.35" fill="#DE2B3A" />
          <rect y="5.35" width="24" height="5.3" fill="#F8FAFC" />
          <rect y="10.65" width="24" height="5.35" fill="#DE2B3A" />
        </>
      );

    case 'IT':
      return (
        <>
          <rect width="8" height="16" fill="#1A8E4B" />
          <rect x="8" width="8" height="16" fill="#F8FAFC" />
          <rect x="16" width="8" height="16" fill="#D62C38" />
        </>
      );

    case 'ES':
      return (
        <>
          <rect width="24" height="16" fill="#BA2029" />
          <rect y="4" width="24" height="8" fill="#F3C12D" />
          <rect x="5.5" y="6.1" width="2.5" height="3.8" rx="0.8" fill="#BA2029" />
          <rect x="6.1" y="6.8" width="1.3" height="1.5" rx="0.3" fill="#F3C12D" />
        </>
      );

    case 'PT':
      return (
        <>
          <rect width="9.6" height="16" fill="#146C38" />
          <rect x="9.6" width="14.4" height="16" fill="#D9242C" />
          <circle cx="9.6" cy="8" r="2.7" fill="#F4C737" />
          <rect x="8.5" y="6.8" width="2.2" height="2.4" rx="0.5" fill="#D9242C" />
        </>
      );

    case 'PL':
      return (
        <>
          <rect width="24" height="8" fill="#F8FAFC" />
          <rect y="8" width="24" height="8" fill="#D6233E" />
        </>
      );

    case 'CZ':
      return (
        <>
          <rect width="24" height="8" fill="#F8FAFC" />
          <rect y="8" width="24" height="8" fill="#D4232A" />
          <polygon points="0,0 11.4,8 0,16" fill="#1C4682" />
        </>
      );

    case 'SE':
      return (
        <>
          <rect width="24" height="16" fill="#1668A8" />
          <rect x="7" width="3.2" height="16" fill="#F6CA36" />
          <rect y="6.4" width="24" height="3.2" fill="#F6CA36" />
        </>
      );

    case 'NO':
      return (
        <>
          <rect width="24" height="16" fill="#C4223A" />
          <rect x="6.6" width="4.4" height="16" fill="#F8FAFC" />
          <rect y="5.8" width="24" height="4.4" fill="#F8FAFC" />
          <rect x="7.6" width="2.4" height="16" fill="#1B316B" />
          <rect y="6.8" width="24" height="2.4" fill="#1B316B" />
        </>
      );

    case 'FI':
      return (
        <>
          <rect width="24" height="16" fill="#F8FAFC" />
          <rect x="6.8" width="3.4" height="16" fill="#16428A" />
          <rect y="6.3" width="24" height="3.4" fill="#16428A" />
        </>
      );

    case 'DK':
      return (
        <>
          <rect width="24" height="16" fill="#C81E38" />
          <rect x="7" width="2.8" height="16" fill="#F8FAFC" />
          <rect y="6.6" width="24" height="2.8" fill="#F8FAFC" />
        </>
      );

    case 'RO':
      return (
        <>
          <rect width="8" height="16" fill="#183684" />
          <rect x="8" width="8" height="16" fill="#F6CA36" />
          <rect x="16" width="8" height="16" fill="#D12432" />
        </>
      );

    case 'BG':
      return (
        <>
          <rect width="24" height="5.35" fill="#F8FAFC" />
          <rect y="5.35" width="24" height="5.3" fill="#168D6A" />
          <rect y="10.65" width="24" height="5.35" fill="#D42E22" />
        </>
      );

    case 'UA':
      return (
        <>
          <rect width="24" height="8" fill="#1D64BA" />
          <rect y="8" width="24" height="8" fill="#F6CE3B" />
        </>
      );

    case 'RU':
      return (
        <>
          <rect width="24" height="5.35" fill="#F8FAFC" />
          <rect y="5.35" width="24" height="5.3" fill="#1D44A2" />
          <rect y="10.65" width="24" height="5.35" fill="#D42B27" />
        </>
      );

    case 'TR':
      return (
        <>
          <rect width="24" height="16" fill="#DC2028" />
          <circle cx="9.8" cy="8" r="3.6" fill="#F8FAFC" />
          <circle cx="10.8" cy="8" r="2.9" fill="#DC2028" />
          <polygon
            points="15.1,6.3 15.6,7.6 17.0,7.6 15.9,8.4 16.3,9.7 15.1,8.9 14.0,9.7 14.4,8.4 13.3,7.6 14.7,7.6"
            fill="#F8FAFC"
          />
        </>
      );

    /* ── Americas ──────────────────────────────────────────────────── */
    case 'US':
      return (
        <>
          <rect width="24" height="16" fill="#F8FAFC" />
          {[0, 2.5, 5.0, 7.5, 10.0, 12.5, 14.8].map((y) => (
            <rect key={y} y={y} width="24" height="1.25" fill="#C42B3B" />
          ))}
          <rect width="10.8" height="8.7" fill="#2A396E" />
          {[2.0, 4.4, 6.8].map((cy) =>
            [2.0, 4.3, 6.6, 8.9].map((cx) => (
              <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="0.52" fill="#F8FAFC" />
            )),
          )}
        </>
      );

    case 'CA':
      return (
        <>
          <rect width="6.2" height="16" fill="#D42430" />
          <rect x="6.2" width="11.6" height="16" fill="#F8FAFC" />
          <rect x="17.8" width="6.2" height="16" fill="#D42430" />
          <path
            d="M12,3.4 L13.1,6.2 L15.4,5.7 L14.5,7.8 L16.2,8.8 L13.8,9.9 L14.1,11.1 L12.4,10.6 L12.4,12.8 L11.6,12.8 L11.6,10.6 L9.9,11.1 L10.2,9.9 L7.8,8.8 L9.5,7.8 L8.6,5.7 L10.9,6.2 Z"
            fill="#D42430"
          />
        </>
      );

    case 'MX':
      return (
        <>
          <rect width="8" height="16" fill="#176C4A" />
          <rect x="8" width="8" height="16" fill="#F8FAFC" />
          <rect x="16" width="8" height="16" fill="#D12432" />
          <circle cx="12" cy="8.1" r="1.5" fill="#8C6239" />
          <path d="M10.4,9.1 A2,2 0 0,0 13.6,9.1" fill="none" stroke="#176C4A" strokeWidth="0.7" />
        </>
      );

    case 'BR':
      return (
        <>
          <rect width="24" height="16" fill="#189347" />
          <polygon points="12,2.2 21.4,8 12,13.8 2.6,8" fill="#F6D138" />
          <circle cx="12" cy="8" r="3.45" fill="#1C3985" />
          <path d="M8.7,7.5 Q12,6.5 15.3,8.5" fill="none" stroke="#F8FAFC" strokeWidth="0.9" />
        </>
      );

    case 'AR':
      return (
        <>
          <rect width="24" height="5.35" fill="#70A8DB" />
          <rect y="5.35" width="24" height="5.3" fill="#F8FAFC" />
          <rect y="10.65" width="24" height="5.35" fill="#70A8DB" />
          <circle cx="12" cy="8" r="1.65" fill="#EBB434" />
        </>
      );

    case 'CL':
      return (
        <>
          <rect width="24" height="8" fill="#F8FAFC" />
          <rect y="8" width="24" height="8" fill="#D42B27" />
          <rect width="8.5" height="8" fill="#1A429A" />
          <polygon
            points="4.25,2.2 4.75,3.7 6.3,3.7 5.05,4.6 5.5,6.1 4.25,5.2 3.0,6.1 3.45,4.6 2.2,3.7 3.75,3.7"
            fill="#F8FAFC"
          />
        </>
      );

    case 'CO':
      return (
        <>
          <rect width="24" height="8" fill="#F5CB36" />
          <rect y="8" width="24" height="4" fill="#1A4196" />
          <rect y="12" width="24" height="4" fill="#D12432" />
        </>
      );

    /* ── Middle East & Africa ──────────────────────────────────────── */
    case 'AE':
      return (
        <>
          <rect x="6" width="18" height="5.35" fill="#147A3C" />
          <rect x="6" y="5.35" width="18" height="5.3" fill="#F8FAFC" />
          <rect x="6" y="10.65" width="18" height="5.35" fill="#1E2026" />
          <rect width="6.2" height="16" fill="#D9242B" />
        </>
      );

    case 'SA':
      return (
        <>
          <rect width="24" height="16" fill="#146E3C" />
          <rect x="5.5" y="5.8" width="13" height="1.5" rx="0.75" fill="#F8FAFC" />
          <rect x="6.5" y="9.4" width="11" height="1.0" rx="0.5" fill="#F8FAFC" />
        </>
      );

    case 'IL':
      return (
        <>
          <rect width="24" height="16" fill="#F8FAFC" />
          <rect y="2" width="24" height="2" fill="#1D4CB4" />
          <rect y="12" width="24" height="2" fill="#1D4CB4" />
          <polygon points="12,5.3 14.5,9.7 9.5,9.7" fill="none" stroke="#1D4CB4" strokeWidth="0.75" />
          <polygon points="12,10.7 14.5,6.3 9.5,6.3" fill="none" stroke="#1D4CB4" strokeWidth="0.75" />
        </>
      );

    case 'ZA':
      return (
        <>
          <rect width="24" height="8" fill="#D8342F" />
          <rect y="8" width="24" height="8" fill="#1A388C" />
          <path d="M0,0 L10.5,8 L0,16" fill="#1E2026" stroke="#F6BD2E" strokeWidth="1.5" />
          <path d="M0,0 L10.5,8 L0,16 M10.5,8 H24" fill="none" stroke="#F8FAFC" strokeWidth="4.4" />
          <path d="M0,0 L10.5,8 L0,16 M10.5,8 H24" fill="none" stroke="#167B4E" strokeWidth="2.6" />
          <polygon points="0,3.2 6.2,8 0,12.8" fill="#1E2026" />
        </>
      );

    case 'EG':
      return (
        <>
          <rect width="24" height="5.35" fill="#CE2029" />
          <rect y="5.35" width="24" height="5.3" fill="#F8FAFC" />
          <rect y="10.65" width="24" height="5.35" fill="#1E2026" />
          <rect x="11.1" y="6.6" width="1.8" height="2.8" rx="0.5" fill="#C99B2E" />
        </>
      );

    /* ── Minimalist Global Fallback ────────────────────────────────── */
    default:
      return (
        <>
          <rect width="24" height="16" fill="#2E3B4E" />
          <circle cx="12" cy="8" r="5" fill="none" stroke="#CBD5E1" strokeWidth="0.95" />
          <ellipse cx="12" cy="8" rx="2.4" ry="5" fill="none" stroke="#CBD5E1" strokeWidth="0.85" />
          <line x1="7" y1="8" x2="17" y2="8" stroke="#CBD5E1" strokeWidth="0.85" />
        </>
      );
  }
}

interface RegionFlagProps {
  code?: string | null;
  size?: FlagSize;
  className?: string;
  label?: string;
}

/**
 * Crisp, flat minimalist SVG flag badge for HTML surfaces (HUD, Rack strip, Map sheet, Inspector).
 */
export function RegionFlag({ code, size = 'sm', className = '', label }: RegionFlagProps) {
  const iso = normalizeIso(code);
  const clipId = useId();
  const dims = SIZE_MAP[size];

  return (
    <svg
      className={`rflag rflag-${size}${className ? ` ${className}` : ''}`}
      width={dims.width}
      height={dims.height}
      viewBox="0 0 24 16"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <defs>
        <clipPath id={clipId}>
          <rect width="24" height="16" rx="2.6" ry="2.6" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>{renderFlagArtwork(iso)}</g>
      <rect
        x="0.45"
        y="0.45"
        width="23.1"
        height="15.1"
        rx="2.3"
        ry="2.3"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.16"
        strokeWidth="0.9"
      />
    </svg>
  );
}

interface RegionFlagGlyphProps {
  code?: string | null;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

/**
 * Nested SVG glyph for rendering crisp flat vector flags inside the World Map SVG canvas.
 */
export function RegionFlagGlyph({
  code,
  x,
  y,
  width = 14.4,
  height = 9.6,
}: RegionFlagGlyphProps) {
  const iso = normalizeIso(code);
  const clipId = useId();

  return (
    <svg x={x} y={y} width={width} height={height} viewBox="0 0 24 16" overflow="hidden">
      <defs>
        <clipPath id={clipId}>
          <rect width="24" height="16" rx="2.6" ry="2.6" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>{renderFlagArtwork(iso)}</g>
      <rect
        x="0.5"
        y="0.5"
        width="23"
        height="15"
        rx="2.2"
        ry="2.2"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.18"
        strokeWidth="1"
      />
    </svg>
  );
}
