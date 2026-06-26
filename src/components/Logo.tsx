import { useId } from 'react';

interface Props {
  size?: number;
  className?: string;
  title?: string;
}

/** Logo RFID TRACER — hexágono, señal y flecha de trazabilidad. */
export default function Logo({ size = 36, className = '', title = 'RFID TRACER' }: Props) {
  const g = useId().replace(/:/g, '');

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fill="none"
      role="img"
      aria-label={title}
      className={`flex-shrink-0 ${className}`}
    >
      <title>{title}</title>
      <defs>
        <linearGradient id={`${g}-grad`} x1="6" y1="58" x2="58" y2="6" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1e40af" />
          <stop offset="1" stopColor="#0d9488" />
        </linearGradient>
      </defs>

      <polygon
        points="8,32 20,11 44,11 56,32 44,53 20,53"
        stroke={`url(#${g}-grad)`}
        strokeWidth="2.8"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
      />

      <g stroke={`url(#${g}-grad)`} strokeWidth="2.2" strokeLinecap="round" fill="none">
        <path d="M38.85 33.46A7 7 0 0 1 33.46 38.85" />
        <path d="M30.54 38.85A7 7 0 0 1 25.15 33.46" />
        <path d="M25.15 30.54A7 7 0 0 1 30.54 25.15" />
        <path d="M33.46 25.15A7 7 0 0 1 38.85 30.54" />
        <path d="M43.74 34.5A12 12 0 0 1 34.5 43.74" />
        <path d="M29.5 43.74A12 12 0 0 1 20.26 34.5" />
        <path d="M20.26 29.5A12 12 0 0 1 29.5 20.26" />
        <path d="M34.5 20.26A12 12 0 0 1 43.74 29.5" />
        <path d="M48.63 35.54A17 17 0 0 1 35.54 48.63" />
        <path d="M28.46 48.63A17 17 0 0 1 15.37 35.54" />
        <path d="M15.37 28.46A17 17 0 0 1 28.46 15.37" />
        <path d="M35.54 15.37A17 17 0 0 1 48.63 28.46" />
        <path d="M53.52 36.58A22 22 0 0 1 36.58 53.52" />
        <path d="M27.42 53.52A22 22 0 0 1 10.48 36.58" />
        <path d="M10.48 27.42A22 22 0 0 1 27.42 10.48" />
        <path d="M36.58 10.48A22 22 0 0 1 53.52 27.42" />
      </g>

      <rect x="28.25" y="28.25" width="7.5" height="7.5" rx="1.75" fill={`url(#${g}-grad)`} />
      <circle cx="32" cy="32" r="1.75" fill="#fff" />

      <path
        d="M32 35.8C34.5 37.2 38 36.8 41.2 32.5 44.5 28 47.5 22 51.5 15.5"
        stroke={`url(#${g}-grad)`}
        strokeWidth="3.4"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M51.5 15.5 56.5 11.5 52.5 19.5Z"
        fill={`url(#${g}-grad)`}
        stroke={`url(#${g}-grad)`}
        strokeWidth="0.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
