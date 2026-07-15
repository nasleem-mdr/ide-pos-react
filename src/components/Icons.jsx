import React from 'react';

export const HomeIcon = ({ size = 18, className = '', ...props }) => (
  <svg 
    width={size}
    height={size}
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
    <polyline points="9 22 9 12 15 12 15 22"></polyline>
  </svg>
);

export const PartnerIcon = ({ size = 18, className = '', ...props }) => (
  <svg 
    width={size}
    height={size}
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
    <circle cx="9" cy="7" r="4"></circle>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
  </svg>
);

export const BoxIcon = ({ size = 18, className = '', ...props }) => (
  <svg 
    width={size}
    height={size}
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
    <line x1="12" y1="22.08" x2="12" y2="12"></line>
  </svg>
);

export const ShoppingCartIcon = ({ size = 24, className = '', ...props }) => (
  <svg 
    width={size}
    height={size}
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round">
    <circle cx="9" cy="21" r="1"></circle>
    <circle cx="20" cy="21" r="1"></circle>
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
  </svg>
);

export const ListIconR = ({ size = 24, className = '', ...props }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      fill="none"
      viewBox="0 0 24 24"
      className={className}
      {...props}
    >
      {/* Tanda Centang / Checkmark */}
      <path
        id="path1"
        stroke="currentColor"
        d="m14.628 16.187 2.481 2.954 4.609-5.908"
        style={{
          strokeWidth: 1.65425,
          strokeDasharray: 'none',
        }}
      />
      
      {/* Garis Bawah Kiri */}
      <path
        id="path3"
        stroke="currentColor"
        d="M9.901 18.55h-8.27"
        style={{
          strokeWidth: 1.65425,
          strokeDasharray: 'none',
        }}
      />
      
      {/* Garis Atas */}
      <path
        id="path4"
        stroke="currentColor"
        d="M1.63 4.371h12.778m7.91 0h-2.739"
        style={{
          strokeWidth: 1.67875,
          strokeDasharray: 'none',
        }}
      />
      
      {/* Garis Pendek Tengah-Bawah */}
      <path
        id="path6"
        d="M1.63 13.824h2.645"
        style={{
          fill: 'currentColor',
          fillOpacity: 1,
          stroke: 'currentColor',
          strokeWidth: 1.65425,
          strokeLinecap: 'butt',
          strokeLinejoin: 'round',
          strokeDasharray: 'none',
          strokeOpacity: 1,
        }}
      />
      
      {/* Garis Pendek Tengah-Atas */}
      <path
        id="path7"
        d="M1.63 9.098h2.645"
        style={{
          fill: 'currentColor',
          fillOpacity: 1,
          stroke: 'currentColor',
          strokeWidth: 1.65425,
          strokeLinecap: 'butt',
          strokeLinejoin: 'round',
          strokeDasharray: 'none',
          strokeOpacity: 1,
        }}
      />
      
      {/* Garis Panjang Tengah-Kanan */}
      <path
        id="path8"
        d="M12.512 9.098h9.806"
        style={{
          fill: 'currentColor',
          fillOpacity: 1,
          stroke: 'currentColor',
          strokeWidth: 1.70732,
          strokeLinecap: 'butt',
          strokeLinejoin: 'round',
          strokeDasharray: 'none',
          strokeOpacity: 1,
        }}
      />
      
      {/* Karakter "R" */}
      <text
        xmlSpace="preserve"
        id="text8"
        x="3.821"
        y="16.295"
        style={{
          fontWeight: 700,
          fontSize: '15.702px',
          fontFamily: 'Calibri, sans-serif',
          textAlign: 'start',
          letterSpacing: '0.0642354px',
          writingMode: 'lr-tb',
          direction: 'ltr',
          textAnchor: 'start',
          fill: 'currentColor',
          stroke: 'none',
          strokeWidth: 1.53187,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          strokeDasharray: 'none',
        }}
      >
        <tspan
          id="tspan8"
          x="3.821"
          y="16.295"
          style={{
            fontStyle: 'normal',
            fontVariant: 'normal',
            fontWeight: 700,
            fontStretch: 'normal',
            fontFamily: 'Calibri, sans-serif',
            fill: 'currentColor',
            stroke: 'none',
            strokeWidth: 1.53187,
            strokeDasharray: 'none',
          }}
        >
          R
        </tspan>
      </text>
      
      {/* Elemen Atas Kanan (Grup) */}
      <g
        id="path9"
        style={{
          strokeWidth: 1.4,
          strokeDasharray: 'none',
        }}
        transform="matrix(1.1816 0 0 1.7356 -1.915 -10.474)"
      >
        <path
          id="path10"
          d="M11.959 14h2.238"
          style={{
            fill: 'currentColor',
            strokeWidth: 1.4,
            strokeLinejoin: 'round',
            strokeDasharray: 'none',
          }}
        />
        <path
          id="path11"
          d="m11.959 13.523.4.954h1.838v-.954z"
          style={{
            color: 'currentColor',
            fontStyle: 'normal',
            fontVariant: 'normal',
            fontWeight: 400,
            fontStretch: 'normal',
            fontSize: 'medium',
            lineHeight: 'normal',
            fontFamily: 'sans-serif',
            textIndent: 0,
            textAlign: 'start',
            textDecorationLine: 'none',
            textDecorationStyle: 'solid',
            letterSpacing: 'normal',
            wordSpacing: 'normal',
            textTransform: 'none',
            writingMode: 'lr-tb',
            direction: 'ltr',
            textOrientation: 'mixed',
            dominantBaseline: 'auto',
            baselineShift: 'baseline',
            textAnchor: 'start',
            whiteSpace: 'normal',
            clipRule: 'nonzero',
            display: 'inline',
            overflow: 'visible',
            visibility: 'visible',
            isolation: 'auto',
            mixBlendMode: 'normal',
            fill: 'currentColor',
            fillOpacity: 1,
            fillRule: 'nonzero',
            stroke: 'none',
            strokeWidth: 1.4,
            strokeLinecap: 'butt',
            strokeLinejoin: 'round',
            strokeMiterlimit: 4,
            strokeDasharray: 'none',
            strokeDashoffset: 0,
            strokeOpacity: 1,
            stopColor: 'currentColor',
          }}
        />
      </g>
    </svg>
  );
};
export const ListIconP = ({ size = 24, className = '', ...props }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      fill="none"
      viewBox="0 0 24 24"
      className={className}
      {...props}
    >
      {/* Tanda Centang / Checkmark */}
      <path
        id="path1"
        stroke="currentColor"
        d="m14.628 16.187 2.481 2.954 4.609-5.908"
        style={{
          strokeWidth: 1.65425,
          strokeDasharray: 'none',
        }}
      />
      
      {/* Garis Bawah Kiri */}
      <path
        id="path3"
        stroke="currentColor"
        d="M9.901 18.55h-8.27"
        style={{
          strokeWidth: 1.65425,
          strokeDasharray: 'none',
        }}
      />
      
      {/* Garis Atas */}
      <path
        id="path4"
        stroke="currentColor"
        d="M1.63 4.371h12.778m7.91 0h-2.739"
        style={{
          strokeWidth: 1.67875,
          strokeDasharray: 'none',
        }}
      />
      
      {/* Garis Pendek Tengah-Bawah */}
      <path
        id="path6"
        d="M1.63 13.824h2.645"
        style={{
          fill: 'currentColor',
          fillOpacity: 1,
          stroke: 'currentColor',
          strokeWidth: 1.65425,
          strokeLinecap: 'butt',
          strokeLinejoin: 'round',
          strokeDasharray: 'none',
          strokeOpacity: 1,
        }}
      />
      
      {/* Garis Pendek Tengah-Atas */}
      <path
        id="path7"
        d="M1.63 9.098h2.645"
        style={{
          fill: 'currentColor',
          fillOpacity: 1,
          stroke: 'currentColor',
          strokeWidth: 1.65425,
          strokeLinecap: 'butt',
          strokeLinejoin: 'round',
          strokeDasharray: 'none',
          strokeOpacity: 1,
        }}
      />
      
      {/* Garis Panjang Tengah-Kanan */}
      <path
        id="path8"
        d="M12.512 9.098h9.806"
        style={{
          fill: 'currentColor',
          fillOpacity: 1,
          stroke: 'currentColor',
          strokeWidth: 1.70732,
          strokeLinecap: 'butt',
          strokeLinejoin: 'round',
          strokeDasharray: 'none',
          strokeOpacity: 1,
        }}
      />
      
      {/* Karakter "P" */}
      <text
        xmlSpace="preserve"
        id="text8"
        x="3.821"
        y="16.295"
        style={{
          fontWeight: 700,
          fontSize: '15.702px',
          fontFamily: 'Calibri, sans-serif',
          textAlign: 'start',
          letterSpacing: '0.0642354px',
          writingMode: 'lr-tb',
          direction: 'ltr',
          textAnchor: 'start',
          fill: 'currentColor',
          stroke: 'none',
          strokeWidth: 1.53187,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          strokeDasharray: 'none',
        }}
      >
        <tspan
          id="tspan8"
          x="3.821"
          y="16.295"
          style={{
            fontStyle: 'normal',
            fontVariant: 'normal',
            fontWeight: 700,
            fontStretch: 'normal',
            fontFamily: 'Calibri, sans-serif',
            fill: 'currentColor',
            stroke: 'none',
            strokeWidth: 1.53187,
            strokeDasharray: 'none',
          }}
        >
          P
        </tspan>
      </text>
      
      {/* Elemen Atas Kanan (Grup) */}
      <g
        id="path9"
        style={{
          strokeWidth: 1.4,
          strokeDasharray: 'none',
        }}
        transform="matrix(1.1816 0 0 1.7356 -1.915 -10.474)"
      >
        <path
          id="path10"
          d="M11.959 14h2.238"
          style={{
            fill: 'currentColor',
            strokeWidth: 1.4,
            strokeLinejoin: 'round',
            strokeDasharray: 'none',
          }}
        />
        <path
          id="path11"
          d="m11.959 13.523.4.954h1.838v-.954z"
          style={{
            color: 'currentColor',
            fontStyle: 'normal',
            fontVariant: 'normal',
            fontWeight: 400,
            fontStretch: 'normal',
            fontSize: 'medium',
            lineHeight: 'normal',
            fontFamily: 'sans-serif',
            textIndent: 0,
            textAlign: 'start',
            textDecorationLine: 'none',
            textDecorationStyle: 'solid',
            letterSpacing: 'normal',
            wordSpacing: 'normal',
            textTransform: 'none',
            writingMode: 'lr-tb',
            direction: 'ltr',
            textOrientation: 'mixed',
            dominantBaseline: 'auto',
            baselineShift: 'baseline',
            textAnchor: 'start',
            whiteSpace: 'normal',
            clipRule: 'nonzero',
            display: 'inline',
            overflow: 'visible',
            visibility: 'visible',
            isolation: 'auto',
            mixBlendMode: 'normal',
            fill: 'currentColor',
            fillOpacity: 1,
            fillRule: 'nonzero',
            stroke: 'none',
            strokeWidth: 1.4,
            strokeLinecap: 'butt',
            strokeLinejoin: 'round',
            strokeMiterlimit: 4,
            strokeDasharray: 'none',
            strokeDashoffset: 0,
            strokeOpacity: 1,
            stopColor: 'currentColor',
          }}
        />
      </g>
    </svg>
  );
};

export const ListIcon32 = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 16L16.1 18.5L20 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M10 14H3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M10 18H3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M3 6L13.5 6M20 6L17.75 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M20 10L9.5 10M3 10H5.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
export function UserIcon() {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    );
  }

  export const UserTake  = ({ size = 24, color = 'currentColor', ...props }) => {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 6.35 6.35"
        xmlSpace="preserve"
        {...props}
      >
        <path
          id="rect10"
          d="M1.617 2.6h2.711v2.711H1.617z"
          style={{
            fill: 'none',
            stroke: color,
            strokeWidth: 0.396875,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            strokeDasharray: 'none',
          }}
          transform="rotate(-15)"
        />
        <path
          id="path11"
          d="M.412.96c.251.04.43.117.632.181l1.014 3.433"
          style={{
            fill: 'none',
            stroke: color,
            strokeWidth: 0.396875,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            strokeDasharray: 'none',
          }}
        />
        <path
          id="path13"
          d="m2.321 4.997-.02.002-.035.003-.035.007-.035.009-.034.01-.034.015-.031.015-.031.019-.03.02-.028.022-.026.025-.025.026-.022.028-.021.03-.018.03-.017.032-.013.033-.012.035-.009.034-.006.036-.004.035-.002.02h0v.01h0v.022l.002.025.003.035.007.036.009.034.012.035.013.033.017.031.018.032.02.029.023.028.025.026.026.025.028.022.03.02.03.018.033.017.032.013.035.012.034.008.036.007.036.003.024.003h.023l.049-.004h0l.07-.013h0l.067-.023.003-.002.06-.031.003-.002.056-.04.003-.002.05-.047.002-.003.042-.053.003-.004.033-.058.002-.004.026-.063v-.003l.017-.067v-.002l.007-.07h0v-.024h0v-.01h0v-.001l-.007-.069V5.41l-.018-.068v-.001l-.028-.065h0l-.036-.062h0l-.044-.055-.002-.002-.05-.047-.003-.002-.056-.04-.004-.001-.06-.03-.004-.002-.064-.022-.004-.001L2.395 5h-.004l-.037-.003H2.32"
          style={{
            fill: 'none',
            stroke: color,
            strokeWidth: 0.396875,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            strokeDasharray: 'none',
          }}
        />
        <path
          id="path14"
          d="m3.272 5.358 2.745-.724"
          style={{
            fill: 'none',
            stroke: color,
            strokeWidth: 0.396875,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            strokeDasharray: 'none',
          }}
        />
        <path
          id="path15"
          d="m4.13 3.711-.372-1.304"
          style={{
            fill: 'none',
            stroke: color,
            strokeWidth: 0.396875,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            strokeDasharray: 'none',
          }}
        />
        <path
          id="path16"
          d="m3.307 2.981.295-.776.839.466"
          style={{
            fill: 'none',
            stroke: color,
            strokeWidth: 0.396875,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            strokeDasharray: 'none',
          }}
        />
      </svg>
    );
  };

  
export  function ClientIcon() {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2"/>
        <path d="M8 21h8M12 17v4"/>
      </svg>
    );
  }
  
export  function RoleIcon() {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    );
  }
  export function LogoSMA() {
    return (
      <svg width="80" height="48" viewBox="0 0 39.687 23.813" xmlns="http://www.w3.org/2000/svg">
        <g transform="translate(0 -3.9111)">
          <g transform="matrix(.81511 0 0 .81511 5.5898 3.757)">
            <path
              d="m18.405 9.3341c5.7093-4.665 13.135-0.097258 11.077 4.9796-3.1133 7.681-18.099 7.4839-22.117 2.2965 8.6887 3.4129 15.146-0.016114 16.343-2.0055 0.60998-1.0135 2.3813-4.6259-5.3037-5.2705z"
              fill="#fff"
            />
            <path d="m16.569 15.041c-5.7093 4.665-13.135 0.097257-11.077-4.9796 3.1133-7.681 18.099-7.4839 22.117-2.2965-8.6887-3.4129-15.146 0.016111-16.343 2.0055-0.60998 1.0135-2.3813 4.6259 5.3037 5.2705z" 
              fill="#fff"
            />
          </g>
          <text
            x="2.5865272"
            y="25.477083"
            fill="#fff"
            fontFamily="Calibri, sans-serif"
            fontSize="3.2px"
            fontWeight="bold"
            fontStyle="italic"
            letterSpacing=".013943px"
            stroke="#fff"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth=".1"
          >
            SEKUPANG LOGISTICS
          </text>
        </g>
      </svg>
    );
  }
  export const DeliveryIcon = ({ size = 24, className = '', ...props }) => {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 6.35 6.35"
        className={className}
        {...props}
      >
        {/* Roda Depan */}
        <path
          id="path13"
          d="m2.607 4.231-.013.002-.023.002-.023.004-.024.006-.022.008-.023.009-.02.01-.021.012-.02.014-.018.015-.018.016-.016.017-.015.019-.014.02-.012.02-.01.021-.01.022-.007.023-.006.023-.005.023-.002.023-.002.014h.001v.006h0v.031l.003.024.005.024.005.022.008.023.01.022.01.021.012.021.014.02.015.018.016.017.018.016.018.015.02.014.02.012.022.01.021.01.023.007.023.006.024.004.023.003.017.001h.015l.032-.002h0l.047-.01h0l.044-.014.002-.001.04-.021.002-.001.037-.027.002-.001.033-.031.002-.002.027-.035.002-.003.023-.039v-.002l.018-.042v-.002l.011-.045v-.001l.005-.046h0V4.56h0v-.007h0v-.002l-.005-.045v-.001l-.012-.045v0l-.018-.044h0l-.024-.04h0l-.03-.037v-.001l-.035-.032h0l-.038-.027-.002-.001-.04-.02-.003-.001-.043-.015H2.7l-.044-.009h-.003l-.024-.002z"
          style={{
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 0.264643,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            strokeDasharray: 'none',
          }}
        />
        
        {/* Badan Truk */}
        <path
          id="path9"
          d="m1.052 1.564.1.26h3.004V3.3s.175.209.104.871h-.94c-.325-.613-1.264-.4-1.4 0h-.364v-.542l-.225.003v.84l.693-.001c.036-.656 1.148-.688 1.17.001l1.188-.001c.021-.666 1.103-.683 1.172 0l.362.001c.062-.277.053-.525.008-.862-.081-.05-.103-.308-.008-.355l-.052-.123c-.024-.313-.277-.707-.512-.981l-.1-.092H4.4v-.495Zm3.348.705h.76c.206.189.339.56.398.731l-.005.16H4.4Z"
          style={{
            fontStyle: 'normal',
            fontVariant: 'normal',
            fontWeight: 400,
            fontStretch: 'normal',
            fontSize: 'medium',
            lineHeight: 'normal',
            fontFamily: 'sans-serif',
            textIndent: 0,
            textAlign: 'start',
            textDecorationLine: 'none',
            textDecorationStyle: 'solid',
            letterSpacing: 'normal',
            wordSpacing: 'normal',
            textTransform: 'none',
            writingMode: 'lr-tb',
            direction: 'ltr',
            textOrientation: 'mixed',
            dominantBaseline: 'auto',
            baselineShift: 'baseline',
            textAnchor: 'start',
            whiteSpace: 'normal',
            clipRule: 'nonzero',
            display: 'inline',
            overflow: 'visible',
            visibility: 'visible',
            isolation: 'auto',
            mixBlendMode: 'normal',
            vectorEffect: 'none',
            fill: 'currentColor',
            fillOpacity: 1,
            fillRule: 'nonzero',
            stroke: 'none',
            strokeWidth: 1.09016,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            strokeMiterlimit: 4,
            strokeDasharray: 'none',
            strokeDashoffset: 0,
            strokeOpacity: 1,
          }}
        />
        
        {/* Garis Kecepatan (Kiri) */}
        <path
          id="path12"
          d="M.305 2.182h2.08"
          style={{
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 0.348913,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            strokeDasharray: 'none',
          }}
        />
        <path
          id="path14"
          d="M.62 2.776h2.05"
          style={{
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 0.348913,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            strokeDasharray: 'none',
          }}
        />
        <path
          id="path16"
          d="M.936 3.37h2.05"
          style={{
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 0.348913,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            strokeDasharray: 'none',
          }}
        />
        
        {/* Detail Lampu / Titik Kecil Belakang */}
        <path
          id="path18"
          d="M5.99 3.43a.053.148 0 0 1-.051.15.053.148 0 0 1-.054-.144.053.148 0 0 1 .05-.151.053.148 0 0 1 .055.142l-.052.005z"
          style={{
            fill: 'currentColor',
            stroke: 'none',
            strokeWidth: 0.100539,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            strokeDasharray: 'none',
          }}
        />
        
        {/* Roda Belakang */}
        <path
          id="path19"
          d="m4.947 4.231-.013.002-.024.002-.023.004-.024.006-.022.008-.022.009-.021.01-.021.012-.02.014-.018.015-.018.016-.016.017-.015.019-.013.02-.013.02-.01.021-.01.022-.007.023-.006.023-.005.023-.002.023-.002.014h.001v.006h0v.015l.001.016.002.024.005.024.006.022.008.023.009.022.01.021.012.021.014.02.015.018.017.017.017.016.018.015.02.014.02.012.022.01.022.01.023.007.022.006.024.004.024.003.016.001h.015l.033-.002h0l.046-.01h0l.044-.014.002-.001.04-.021.002-.001.037-.027.002-.001.033-.031.002-.002.028-.035.001-.003.023-.039.001-.002.017-.042v-.002l.012-.045v-.001l.004-.046h0V4.56h0v-.007h0v-.002l-.005-.045v-.001l-.012-.045v0l-.018-.044h0l-.024-.04h0l-.03-.037v-.001l-.034-.032h-.002l-.037-.027-.002-.001-.04-.02-.003-.001-.042-.015H5.04l-.044-.009h-.003l-.025-.002z"
          style={{
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 0.264643,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            strokeDasharray: 'none',
          }}
        />
      </svg>
    );
  };
  export function RequisitionIconR() {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" xmlSpace="preserve" id="svg12" width="24" height="24" viewBox="0 0 6.35 6.35">
        <rect 
          id="rect16" 
          width=".414" 
          height="1.09" 
          x="-.06" 
          y="4.426" 
          ry=".024" 
          fill="currentColor"
          stroke="none"
          strokeWidth=".259668"
          strokeLinecap="round"
          strokeLinejoin="round"
          transform="matrix(.98666 -.16281 .1194 .99285 0 0)"
        />
        <path 
          id="path16" 
          d="m1.008 4.356.117.954c.53-.328 1.65-.226 2.46-.158.18.015.3-.005.454-.078.724-.345 1.291-.664 1.886-.988.05-.174-.098-.37-.384-.307l-.414.148-.234.093-.227.046c-.138.008-.228.045-.331.075.106.636-.278.554-1.543.44.045-.04.16-.057.257-.074.257-.045.608-.036.847-.027.096.003.193.024.27-.038a.28.28 0 0 0 .106-.182c.011-.087-.037-.161-.085-.21-.057-.056-.124-.07-.207-.083-.372-.059-.64-.015-1.056-.132-.129-.036-.247-.054-.345-.082-.254-.072-.397-.067-.67.127a3.4 3.4 0 0 1-.901.476" 
          fill="none"
          stroke="currentColor"
          strokeWidth=".2549715"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect 
          id="rect27" 
          width="3.624" 
          height="2.571" 
          x="1.327" 
          y=".9" 
          ry=".101" 
          fill="none"
          stroke="currentColor"
          strokeWidth=".2549715"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path 
          id="text27" 
          d="M4.067 2.873q0 .013-.008.023-.006.01-.024.016t-.047.01-.075.003q-.044 0-.074-.004-.03-.003-.047-.01-.017-.006-.024-.015-.008-.01-.008-.023V1.578h-.002l-.461 1.294q-.005.016-.016.027t-.031.016-.048.008-.071.002q-.042 0-.072-.004-.03-.002-.049-.008-.018-.008-.03-.017-.01-.01-.014-.024L2.52 1.578h-.002v1.295q0 .013-.007.023t-.025.016-.048.01q-.028.003-.074.003-.044 0-.074-.004-.03-.003-.048-.01-.017-.006-.024-.015-.006-.01-.006-.023V1.455q0-.063.033-.096t.088-.033h.212q.057 0 .097.01.04.008.07.03t.05.057.034.086l.344.949h.005l.357-.946q.016-.052.035-.088t.044-.057.06-.031.08-.01h.218q.033 0 .056.009.025.008.04.025.016.016.023.041.009.023.009.054z" 
          aria-label="M" 
          fill="none"
          stroke="currentColor"
          strokeWidth=".2549715"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            fontWeight: 700,
            fontSize: '6.82848px',
            fontFamily: 'Calibri',
            letterSpacing: '0.0279346px'
          }}
        />
      </svg>
    );
  }
  
  export const RequisitionIcon = ({ size = 24, color = 'currentColor', ...props }) => {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 6.35 6.35"
        xmlSpace="preserve"
        {...props}
      >
        {/* Elemen Dekorasi / Stempel Kecil di Kiri Bawah */}
        <rect
          id="rect16"
          width={0.474}
          height={1.246}
          x={-0.305}
          y={4.854}
          ry={0.027}
          style={{
            fill: color,
            stroke: 'none',
          }}
          transform="matrix(.98666 -.16281 .1194 .99285 0 0)"
        />
  
        {/* Bagian Bawah / Aksen Dokumen */}
        <path
          id="path16"
          d="m1.008 4.885.117.954c.53-.328 1.616-.168 2.426-.1.181.015.35.012.504-.061.724-.346 1.275-.739 1.87-1.063.05-.174-.085-.374-.371-.31l-.415.147-.233.093-.194.038c-.093.032-.06.016-.162.045.006.673-.528.76-1.745.477.044-.038.147-.052.244-.07.257-.044.544.006.783.015.096.003.225.015.333-.079.08-.069.091-.216.083-.256-.019-.086-.046-.095-.094-.143a.7.7 0 0 0-.302-.134c-.373-.059-.511.043-.928-.074-.129-.036-.247-.053-.345-.081-.254-.073-.397-.068-.67.126a3.4 3.4 0 0 1-.901.476"
          style={{
            fill: color,
            stroke: color,
            strokeWidth: 0.064583,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            strokeDasharray: 'none',
          }}
        />
  
        {/* Sisi Kanan Kotak/Berkas (Perspektif 3D) */}
        <rect
          id="rect27"
          width={1.93}
          height={1.954}
          x={1.942}
          y={0.525}
          ry={0.077}
          style={{
            fill: 'none',
            stroke: color,
            strokeWidth: 0.168351,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            strokeDasharray: 'none',
          }}
          transform="scale(.90526 1) skewY(23.018)"
        />
  
        {/* Sisi Kiri Kotak/Berkas (Perspektif 3D) */}
        <rect
          id="rect1"
          width={1.93}
          height={1.954}
          x={-5.843}
          y={3.82}
          ry={0.077}
          style={{
            fill: 'none',
            stroke: color,
            strokeWidth: 0.168351,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            strokeDasharray: 'none',
          }}
          transform="scale(-.90526 1) skewY(23.018)"
        />
  
        {/* Bagian Atas / Lipatan Dokumen */}
        <path
          id="path2"
          d="M2.011 1.242s1.295.626 1.494.584 1.644-.678 1.644-.678L3.69.804Z"
          style={{
            fill: 'none',
            stroke: color,
            strokeWidth: 0.145878,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            strokeDasharray: 'none',
          }}
        />
      </svg>
    );
  };
  export const RequisitionIcon32 = ({ size = 32, color = 'currentColor', ...props }) => {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 6.35 6.35"
        xmlSpace="preserve"
        {...props}
      >
        {/* Elemen Dekorasi / Stempel Kecil di Kiri Bawah */}
        <rect
          id="rect16"
          width={0.474}
          height={1.246}
          x={-0.305}
          y={4.854}
          ry={0.027}
          style={{
            fill: color,
            stroke: 'none',
          }}
          transform="matrix(.98666 -.16281 .1194 .99285 0 0)"
        />
  
        {/* Bagian Bawah / Aksen Dokumen */}
        <path
          id="path16"
          d="m1.008 4.885.117.954c.53-.328 1.616-.168 2.426-.1.181.015.35.012.504-.061.724-.346 1.275-.739 1.87-1.063.05-.174-.085-.374-.371-.31l-.415.147-.233.093-.194.038c-.093.032-.06.016-.162.045.006.673-.528.76-1.745.477.044-.038.147-.052.244-.07.257-.044.544.006.783.015.096.003.225.015.333-.079.08-.069.091-.216.083-.256-.019-.086-.046-.095-.094-.143a.7.7 0 0 0-.302-.134c-.373-.059-.511.043-.928-.074-.129-.036-.247-.053-.345-.081-.254-.073-.397-.068-.67.126a3.4 3.4 0 0 1-.901.476"
          style={{
            fill: color,
            stroke: color,
            strokeWidth: 0.084583,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            strokeDasharray: 'none',
          }}
        />
  
        {/* Sisi Kanan Kotak/Berkas (Perspektif 3D) */}
        <rect
          id="rect27"
          width={1.93}
          height={1.954}
          x={1.942}
          y={0.525}
          ry={0.077}
          style={{
            fill: 'none',
            stroke: color,
            strokeWidth: 0.168351,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            strokeDasharray: 'none',
          }}
          transform="scale(.90526 1) skewY(23.018)"
        />
  
        {/* Sisi Kiri Kotak/Berkas (Perspektif 3D) */}
        <rect
          id="rect1"
          width={1.93}
          height={1.954}
          x={-5.843}
          y={3.82}
          ry={0.077}
          style={{
            fill: 'none',
            stroke: color,
            strokeWidth: 0.168351,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            strokeDasharray: 'none',
          }}
          transform="scale(-.90526 1) skewY(23.018)"
        />
  
        {/* Bagian Atas / Lipatan Dokumen */}
        <path
          id="path2"
          d="M2.011 1.242s1.295.626 1.494.584 1.644-.678 1.644-.678L3.69.804Z"
          style={{
            fill: 'none',
            stroke: color,
            strokeWidth: 0.145878,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            strokeDasharray: 'none',
          }}
        />
      </svg>
    );
  };
  export function LogoSMAMerahHitam() {
    return (
      <svg width="80" height="48" viewBox="0 0 39.687 23.813" xmlns="http://www.w3.org/2000/svg">
        <g transform="translate(0 -3.9111)">
          <g transform="matrix(.81511 0 0 .81511 5.5898 3.757)">
            <path
              d="m18.405 9.3341c5.7093-4.665 13.135-0.097258 11.077 4.9796-3.1133 7.681-18.099 7.4839-22.117 2.2965 8.6887 3.4129 15.146-0.016114 16.343-2.0055 0.60998-1.0135 2.3813-4.6259-5.3037-5.2705z"
              fill="#FF0000"
            />
            <path d="m16.569 15.041c-5.7093 4.665-13.135 0.097257-11.077-4.9796 3.1133-7.681 18.099-7.4839 22.117-2.2965-8.6887-3.4129-15.146 0.016111-16.343 2.0055-0.60998 1.0135-2.3813 4.6259 5.3037 5.2705z" 
              fill="#000"
            />
          </g>
          <text
            x="2.5865272"
            y="25.477083"
            fill="#000"
            fontFamily="Calibri, sans-serif"
            fontSize="3.2px"
            fontWeight="bold"
            fontStyle="italic"
            letterSpacing=".013943px"
            stroke="#000"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth=".1"
          >
            SEKUPANG LOGISTICS
          </text>
        </g>
      </svg>
    );
  }

  export function LogoSMAWarna() {
    return (
      <svg width="65" height="65"  viewBox="0 0 23.812 23.813" xmlns="http://www.w3.org/2000/svg">
        <g transform="matrix(.81511 0 0 .81511 -2.3477 1.9722)">
          <path d="m18.405 9.3341c5.7093-4.665 13.135-0.097258 11.077 4.9796-3.1133 7.681-18.099 7.4839-22.117 2.2965 8.6887 3.4129 15.146-0.016114 16.343-2.0055 0.60998-1.0135 2.3813-4.6259-5.3037-5.2705z" fill="#fff"/>
          <path d="m16.569 15.041c-5.7093 4.665-13.135 0.097257-11.077-4.9796 3.1133-7.681 18.099-7.4839 22.117-2.2965-8.6887-3.4129-15.146 0.016111-16.343 2.0055-0.60998 1.0135-2.3813 4.6259 5.3037 5.2705z" fill="#fff"/>
        </g>
      </svg>
    );
  }
  export function LogoSMA20() {
    return (
      <svg width="20" height="20"  viewBox="0 0 23.812 23.813" xmlns="http://www.w3.org/2000/svg">
        <g transform="matrix(.81511 0 0 .81511 -2.3477 1.9722)">
          <path d="m18.405 9.3341c5.7093-4.665 13.135-0.097258 11.077 4.9796-3.1133 7.681-18.099 7.4839-22.117 2.2965 8.6887 3.4129 15.146-0.016114 16.343-2.0055 0.60998-1.0135 2.3813-4.6259-5.3037-5.2705z" fill="#fff"/>
          <path d="m16.569 15.041c-5.7093 4.665-13.135 0.097257-11.077-4.9796 3.1133-7.681 18.099-7.4839 22.117-2.2965-8.6887-3.4129-15.146 0.016111-16.343 2.0055-0.60998 1.0135-2.3813 4.6259 5.3037 5.2705z" fill="#fff"/>
        </g>
      </svg>
    );
  }
  export  function LogoutIcon() {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
        <polyline points="16 17 21 12 16 7"/>
        <line x1="21" y1="12" x2="9" y2="12"/>
      </svg>
    );
  }

export function EyeIcon({ show }) {
  return show ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}
export function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}
export function ArrowIcon({ left }) {
  return left ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
    </svg>
  );
}
export function AlertIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  );
}
export function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="16" x2="12" y2="12"/>
      <line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
  );
}

export function WelcomeIcon(){
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>     
  );
}

export const CashierIcon = (props) => (
  <svg
    width="48"
    height="48"
    viewBox="0 0 122.88 81.32"
  >
    <path
      fillRule="evenodd"
      fill="#FFFFFF"
      d="M72.19 24.89a7.5 7.5 0 0 0 1.5 3.65l3.14 5a26.9 26.9 0 0 0 4.23 5.54 9 9 0 0 0 12.4-.1 27.8 27.8 0 0 0 4.34-5.93l3.54-5.83a5.66 5.66 0 0 0 .75-3.1c-.2-1.22-2.53-.49-3.31-.6l1.22-5.35c-9 1.42-15.72-5.26-25.22-1.33l.68 6.32c-1.3.06-3.33-.33-3.27 1.73M26.25 36.21v29.14H31v-8.1A1.25 1.25 0 0 1 32.27 56H83a1.25 1.25 0 0 1 1.24 1.24v7.88h3.69V53.45a1.36 1.36 0 0 0-1.35-1.35h-1.53l.58-2.74a3 3 0 0 1-.5-1.61 14.8 14.8 0 0 1-4.43 1.71c-1.59-1.8-1.72-3.69 0-5.69a16.7 16.7 0 0 1 5.48 2.53 2.5 2.5 0 0 1 1.19-.2c1.75-1.23 4-1.73 5.91-2.66 2.32 2.26 2.07 4.34-.21 6.27a15.7 15.7 0 0 1-3.64-1.33 3.7 3.7 0 0 1-.25 1l2.53 12a53 53 0 0 0 4.44-15.73 35 35 0 0 1-2.51-3.39l-.5-.74a10.4 10.4 0 0 1-6 1.78 10.16 10.16 0 0 1-6.62-2.37 21 21 0 0 1-1.92 4.49.8.8 0 0 1-.18.18 65 65 0 0 0 1.43 6.5H56.68a26.4 26.4 0 0 1 4.71-3.19c3.39-1.89 12.13-2.53 15.94-5A32 32 0 0 0 79 39.65v-.12a33 33 0 0 1-3.65-5l-3.14-5a9.07 9.07 0 0 1-1.78-4.57 3.5 3.5 0 0 1 .31-1.63 2.9 2.9 0 0 1 1.08-1.25 3 3 0 0 1 .76-.39 79 79 0 0 1-.15-9 12.3 12.3 0 0 1 .39-2c1.18-4.15 4.67-7.11 8.7-8.5 2-.68 1.2-2.29 3.18-2.18 4.69.25 11.93 3.27 14.71 6.48 3.89 4.49 2.89 10 2.76 15.5a2.28 2.28 0 0 1 1.66 1.71c.75 3-3.23 8.19-4.5 10.29a29.2 29.2 0 0 1-4.65 6.3l-.09.09.57.84c.62.91 1.33 2 2 2.76 3.88 2.42 12.45 3.07 15.79 4.93 8.35 4.66 6.49 8.51 7 16.44h1.7a1.25 1.25 0 0 1 1.24 1.24v14.73H.07V66.59a1.25 1.25 0 0 1 1.24-1.24h16.48V36.21H1.61A1.62 1.62 0 0 1 0 34.6V14.14a1.61 1.61 0 0 1 1.61-1.61h38.6a1.62 1.62 0 0 1 1.6 1.61V34.6a1.62 1.62 0 0 1-1.6 1.61ZM6.43 17.85h29a1.61 1.61 0 0 1 1.6 1.6v6.77a1.63 1.63 0 0 1-1.6 1.61h-29a1.63 1.63 0 0 1-1.61-1.61v-6.77a1.61 1.61 0 0 1 1.61-1.6"
    ></path>
  </svg>
);
export const DetailIcon = (props) => (
  <svg width="16" 
    height= "16"
    viewBox="0 0 1024 1024" 
  >
    <path d="M917.251764 802.39026L786.571232 671.643176c-2.964148-2.993841-10.321788 0.260067-18.916281 6.447406l-10.6781-10.6781c54.596637-70.942966 51.407234-171.245844-8.531013-239.190875v-36.821988l0.130034 0.456653c0-70.649111-67.455613-136.867871-103.689891-172.419217l-8.270946-8.204393C529.76441 104.382037 485.22847 95.460924 448.830371 95.460924l-12.371606-0.063481H150.778377c-16.995473 0-47.336266 12.89174-47.336267 38.675221v756.025661c0 21.3562 17.31902 38.741773 38.675221 38.741773h567.587758c21.3562 0 38.741773-17.385573 38.741773-38.741773V753.360488c37.278641 37.308333 108.900443 108.934231 108.900443 108.934231 12.958293 12.89174 72.926232-46.882685 59.904459-59.904459z" fill="#00" />
    <path d="M707.231382 652.173997c-54.856704 54.890492-144.259299 54.957045-199.149791 0-54.887421-54.953973-54.887421-144.352473 0-199.242965 26.566753-26.566753 61.924584-41.151999 99.559537-41.151999 37.698434 0 73.022477 14.585246 99.58923 41.151999 54.891516 54.953973 54.891516 144.288992 0.001024 199.242965z" fill="#FFFFFF" />
    <path d="M603.214872 244.570368l8.657974 8.527941c15.171933 14.848385 36.464652 35.944518 54.53418 59.447806-35.521654-13.28184-75.11018-15.8221-110.333882-17.252468-1.10682-23.442878-5.600653-71.299278-21.486234-112.841378 18.683859 14.651799 41.14688 34.57456 68.627962 62.118099z" fill="#79CCBF" />
    <path d="M150.648343 881.633865V142.800262c0.130033-0.066553 0.650167-0.263139 0.650168-0.263138h285.03022l12.371607 0.066552c6.25082 0 14.518694 0.130033 26.436719 4.100661l5.990753 6.25082c32.36092 31.970819 44.015806 111.604524 44.015806 157.377318 0 8.400979 6.64092 15.368519 15.10538 15.692066l6.510887 0.263139c48.899739 1.887021 109.844465 4.230694 146.863039 37.764986l3.383941 3.383941c2.377462 7.487673 3.940935 14.911866 4.201002 22.269506-72.045691-41.412066-165.287856-32.100853-226.853057 29.497112-73.642952 73.642952-73.642952 193.058697 0 266.70165 61.597965 61.594893 154.84013 70.972659 226.886845 29.49404v166.23495H150.648343z" fill="#F4CE73" />
  </svg>
);


