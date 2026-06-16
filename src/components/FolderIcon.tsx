import React from "react";

interface FolderIconProps {
  className?: string;
}

export const FolderIcon: React.FC<FolderIconProps> = ({
  className = "w-28 h-28",
}) => {
  // A beautiful rounded macOS-style blue folder matching the attached image exactly
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <svg
        viewBox="0 0 128 128"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-[0_4px_12px_rgba(0,0,0,0.18)] select-none pointer-events-none"
      >
        <defs>
          <linearGradient id="folderBack" x1="64" y1="12" x2="64" y2="108" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#25a5f0" />
            <stop offset="100%" stopColor="#045ca6" />
          </linearGradient>
          <linearGradient id="folderFront" x1="64" y1="38" x2="64" y2="114" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#55bef0" />
            <stop offset="12%" stopColor="#41aff0" />
            <stop offset="100%" stopColor="#106da6" />
          </linearGradient>
        </defs>
        
        {/* Back Flap / Tab of the folder */}
        <path
          d="M8 24C8 19.58 11.58 16 16 16H48C50.5 16 52.8 17.1 54.3 19.0L63.7 30.0C65.2 31.9 67.5 33 70 33H112C116.42 33 120 36.58 120 41V104C120 108.42 116.42 112 112 112H16C11.58 112 8 108.42 8 104V24Z"
          fill="url(#folderBack)"
        />
        
        {/* Interior sheet (mac style) */}
        <rect x="20" y="28" width="88" height="64" rx="4" fill="#FFFFFF" fillOpacity="0.95" />
        <rect x="28" y="38" width="48" height="3" rx="1.5" fill="#C5CCD6" />
        <rect x="28" y="47" width="72" height="2" rx="1" fill="#E6EAF0" />
        <rect x="28" y="55" width="64" height="2" rx="1" fill="#E6EAF0" />
        <rect x="28" y="63" width="72" height="2" rx="1" fill="#E6EAF0" />

        {/* Front flap with beautiful gradient and top border lighting */}
        <path
          d="M8 41C8 36.58 11.58 33 16 33H112C116.42 33 120 36.58 120 41V104C120 108.42 116.42 112 112 112H16C11.58 112 8 108.42 8 104V41Z"
          fill="url(#folderFront)"
        />
        
        {/* Folder texture highlight sheen / subtle white reflection bar on top edge */}
        <path
          d="M16 34H112C115.86 34 119 37.14 119 41V103C119 106.86 115.86 110 112 110H16C12.14 110 9 106.86 9 103V41C9 37.14 12.14 34 16 34Z"
          stroke="#9ADCFD"
          strokeWidth="1.2"
          strokeOpacity="0.55"
          fill="none"
        />

        {/* Centered Image placeholder card inlaid into front cover matching the uploaded mockup */}
        <g transform="translate(1, -1)">
          {/* Main card box outline */}
          <rect 
            x="38" 
            y="48" 
            width="50" 
            height="38" 
            rx="8" 
            fill="#104A75" 
            fillOpacity="0.16" 
            stroke="#104A75" 
            strokeWidth="2.5" 
            strokeOpacity="0.22" 
          />
          
          {/* Sun circle */}
          <circle 
            cx="50" 
            cy="58" 
            r="4.5" 
            fill="#104A75" 
            fillOpacity="0.26" 
          />

          {/* Overlapping Mountains */}
          <path
            d="M40 83 L51 71 C52.5 69.2 54.8 69.2 56.3 71 L63 79"
            stroke="#104A75" 
            strokeWidth="2.5" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            fill="#104A75"
            fillOpacity="0.18"
          />
          <path
            d="M54 83 L66 67 C67.5 65 70.2 65 71.7 67 L86 83"
            stroke="#104A75" 
            strokeWidth="2.5" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            fill="#104A75"
            fillOpacity="0.24"
          />
        </g>
      </svg>
    </div>
  );
};
