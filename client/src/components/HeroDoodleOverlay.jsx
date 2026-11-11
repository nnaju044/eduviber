import React from "react";

/*
  EduViber Hero Doodle Overlay Component
  Provides beautiful, hand-drawn educational doodles, handwritten taglines,
  and feature pills layered seamlessly around the EDUVIBER title.
  Scaled synchronously in a responsive SVG/HTML coordinate space (1555 x 947).
*/

const PlaySquare = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2" /><path d="m10 8 6 4-6 4V8Z" /></svg>
);
const Award = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="6" /><path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526" /></svg>
);
const Users = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
);
const TrendingUp = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg>
);

const AMBER = "#C68A06";
const YELLOW = "#F5B50A";
const INK = "#1a1a1a";

const Sparkle = ({ x, y, className = "anim-doodle-sparkle" }) => (
  <g className={className} transform={`translate(${x} ${y})`} pointerEvents="none">
    <path
      d="M0 -15 Q2 -3 15 0 Q2 3 0 15 Q-2 3 -15 0 Q-2 -3 0 -15Z"
      fill={YELLOW}
      stroke={INK}
      strokeWidth="2"
      strokeLinejoin="round"
    />
  </g>
);

const Star = ({ x, y, size = 8, className = "anim-doodle-sparkle" }) => (
  <g className={className} transform={`translate(${x} ${y})`} pointerEvents="none">
    <polygon
      points={`0,-${size} ${size * 0.3},-${size * 0.3} ${size},0 ${size * 0.3},${size * 0.3} 0,${size} -${size * 0.3},${size * 0.3} -${size},0 -${size * 0.3},-${size * 0.3}`}
      fill={YELLOW}
      stroke={INK}
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </g>
);

const ticks = [
  // cap
  [208, 230, 238, 243], [241, 207, 251, 227], [205, 262, 233, 260],
  // tagline
  [1035, 188, 1046, 208], [1044, 205, 1066, 215], [1049, 231, 1071, 231],
  // together
  [1148, 578, 1158, 598], [1160, 598, 1184, 596], [1162, 624, 1186, 625],
  // bulb
  [1161, 140, 1163, 156], [1196, 140, 1191, 156], [1131, 163, 1145, 174],
  // open book
  [1441, 605, 1448, 625], [1456, 615, 1475, 631], [1466, 641, 1487, 640],
];

const dashes = [
  "M447 247 C 500 195, 560 165, 640 221",
  "M255 325 C 215 335, 195 372, 188 428",
  "M142 572 C 112 612, 126 662, 170 696",
  "M1088 337 C 1095 300, 1140 285, 1210 283 C 1262 276, 1300 238, 1332 272",
  "M1385 436 C 1430 462, 1446 502, 1420 546 C 1397 580, 1365 590, 1358 620",
  "M1097 825 C 1160 800, 1250 790, 1300 806 C 1330 800, 1340 782, 1346 765",
  "M335 450 C 370 410, 420 405, 455 425",
  "M1115 515 C 1145 528, 1175 522, 1215 480",
];

const pos = (x, y) => ({ left: `${(x / 1555) * 100}%`, top: `${((y - 68) / 947) * 100}%` });

export default function HeroDoodleOverlay() {
  const pills = [
    [PlaySquare, "Online Courses"],
    [Award, "Certificates"],
    [Users, "Learning Community"],
    [TrendingUp, "Skill Growth"],
  ];

  return (
    <div
      className="absolute inset-0 pointer-events-none z-20 flex items-center justify-center overflow-hidden"
      style={{ opacity: "var(--gp-caption, 1)" }}
      aria-hidden="true"
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;500;600;700&display=swap');

        .doodle-hero-box {
          position: relative;
          width: 100%;
          max-width: 1400px;
          aspect-ratio: 1555 / 800;
          container-type: inline-size;
        }

        .doodle-abs {
          position: absolute;
          transform: translate(-50%, -50%);
          pointer-events: none;
        }

        .doodle-tagline {
          font-family: 'Caveat', cursive;
          font-weight: 600;
          font-size: 2.8cqw;
          line-height: 1.05;
          text-align: center;
          color: #222;
          transform: translate(-50%, -50%) rotate(-5deg);
          white-space: nowrap;
        }

        .doodle-sub {
          display: flex;
          align-items: center;
          gap: 2.2cqw;
          font-family: 'Caveat', cursive;
          font-weight: 500;
          font-size: 3.1cqw;
          color: #1a1a1a;
          white-space: nowrap;
        }
        .doodle-sub .doodle-dot {
          width: .6cqw;
          height: .6cqw;
          border-radius: 50%;
          background: #1a1a1a;
        }

        .doodle-pills {
          display: flex;
          gap: .9cqw;
          white-space: nowrap;
        }
        .doodle-pill {
          display: flex;
          align-items: center;
          gap: .8cqw;
          background: #FCF0D2;
          border-radius: 99px;
          padding: 0 1.35cqw 0 1.3cqw;
          height: 3.35cqw;
          font-family: 'Caveat', cursive;
          font-weight: 600;
          font-size: 1.6cqw;
          color: #2a2a2a;
        }
        .doodle-pill svg {
          width: 2.4cqw;
          height: 2.4cqw;
          stroke: ${AMBER};
          stroke-width: 1.6;
        }

        @keyframes doodleFloatBooks {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-7px); }
        }

        @keyframes doodleFlightRocket {
          0%, 100% { transform: translate(0px, 0px) rotate(0deg); }
          50% { transform: translate(3px, -7px) rotate(1.5deg); }
        }

        @keyframes doodleTiltLaptop {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-6px) rotate(-1deg); }
        }

        @keyframes doodlePulseSparkle {
          0%, 100% { opacity: 0.4; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.1); }
        }

        .anim-doodle-books {
          transform-box: fill-box;
          transform-origin: center;
          animation: doodleFloatBooks 5s ease-in-out infinite;
        }

        .anim-doodle-rocket {
          transform-box: fill-box;
          transform-origin: center;
          animation: doodleFlightRocket 4.5s ease-in-out infinite;
        }

        .anim-doodle-laptop {
          transform-box: fill-box;
          transform-origin: center;
          animation: doodleTiltLaptop 5.5s ease-in-out infinite;
        }

        .anim-doodle-sparkle {
          transform-box: fill-box;
          transform-origin: center;
          animation: doodlePulseSparkle 3s ease-in-out infinite;
        }

        .anim-doodle-sparkle-alt {
          transform-box: fill-box;
          transform-origin: center;
          animation: doodlePulseSparkle 3s ease-in-out 1.5s infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .anim-doodle-books,
          .anim-doodle-rocket,
          .anim-doodle-laptop,
          .anim-doodle-sparkle,
          .anim-doodle-sparkle-alt {
            animation: none !important;
          }
        }
      `}</style>

      <div className="doodle-hero-box">
        {/* SVG Doodle Art Layer */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 68 1555 947"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Soft cream blobs */}
          {[[130, 380, 48], [110, 770, 62], [1420, 380, 52], [1195, 225, 28], [1392, 770, 46]].map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} fill="#FEF6E0" />
          ))}

          {/* Tagline brush blob */}
          <path
            d="M545 262 C550 235 700 232 1010 220 C1032 224 1032 262 1022 288 C1010 322 900 326 700 340 C610 352 546 352 540 312 C536 292 540 275 545 262Z"
            fill="#FDF0C8"
          />

          {/* Dashed paths */}
          {dashes.map((d, i) => (
            <path key={i} d={d} fill="none" stroke={INK} strokeWidth="2.2" strokeDasharray="9 9" strokeLinecap="round" />
          ))}

          {/* Yellow burst ticks */}
          {ticks.map(([a, b, c, d], i) => (
            <line key={i} x1={a} y1={b} x2={c} y2={d} stroke={YELLOW} strokeWidth="5" strokeLinecap="round" />
          ))}

          {/* Underline for "Together" */}
          <path d="M966 652 C1040 642 1100 646 1143 640" fill="none" stroke={YELLOW} strokeWidth="5" strokeLinecap="round" />

          {/* Graduation Cap - Moved up & left out of the 'E' / 'D' letter path */}
          <g transform="translate(-18, -45)" stroke={INK} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round">
            <path d="M318 262 L320 292 Q368 312 418 288 L414 240Z" fill="#E9E9E9" />
            <polygon points="266,246 356,190 445,198 441,216 352,258" fill="#fff" />
            <path d="M410 232 L414 262" fill="none" />
            <line x1="293" y1="262" x2="293" y2="302" />
            <path d="M293 300 L283 340 Q293 346 301 340 Z" fill={YELLOW} />
            <circle cx="352" cy="222" r="5" fill={YELLOW} strokeWidth="2" />
          </g>

          {/* Light Bulb */}
          <g stroke={INK} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round">
            <path d="M1150 205 a28 32 0 1 1 56 0 c0 16 -13 22 -17 34 h-22 c-4 -12 -17 -18 -17 -34z" fill="#FDE68A" />
            <rect x="1160" y="239" width="36" height="9" rx="3" fill="#cfcfcf" />
            <rect x="1164" y="248" width="28" height="8" rx="4" fill="#9a9a9a" />
            <path d="M1166 200 q6 -10 12 0 q6 -10 12 0 M1178 200 v22" fill="none" stroke="#B7791F" strokeWidth="3" />
          </g>

          {/* Laptop Doodle - shifted right & up away from 'E' and 'R' */}
          <g className="anim-doodle-laptop" transform="translate(18, -25)">
            <circle cx="1335" cy="350" r="45" fill="#FEF6E0" opacity="0.6" />
            <g stroke={INK} strokeWidth="3.8" strokeLinejoin="round" strokeLinecap="round">
              <polygon points="1284,296 1406,316 1386,392 1262,372" fill="#fff" />
              <polygon points="1295,307 1395,324 1378,382 1276,365" fill="#FDF7E7" strokeWidth="2" />
              <polygon points="1322,333 1322,365 1354,349" fill={YELLOW} stroke={INK} strokeWidth="2" />
              <polygon points="1228,386 1386,392 1372,414 1240,404" fill="#EDEDED" strokeWidth="3.5" />
              <path d="M1292,400 L1320,402" stroke={INK} strokeWidth="2.5" />
            </g>
            <line x1="1418" y1="305" x2="1434" y2="295" stroke={YELLOW} strokeWidth="3.5" strokeLinecap="round" />
            <line x1="1428" y1="328" x2="1446" y2="326" stroke={YELLOW} strokeWidth="3.5" strokeLinecap="round" />
          </g>

          {/* Stacked & Open Books - Shifted Stacked Books left (-120px) to clear 'E' entirely */}
          <g className="anim-doodle-books">
            <g transform="translate(-110, 0)" stroke={INK} strokeWidth="3.5" strokeLinejoin="round">
              <rect x="68" y="505" width="148" height="36" rx="7" fill={YELLOW} />
              <rect x="92" y="512" width="118" height="14" rx="3" fill="#fff" strokeWidth="2.5" />
              <polygon points="82,483 200,490 212,510 70,505" fill="#fff" />
              <rect x="78" y="478" width="132" height="30" rx="6" fill="#F8C533" transform="rotate(2 144 493)" />
              <polygon points="84,472 140,452 198,462 202,486 142,496 86,486" fill="#fff" />
              <polygon points="86,466 142,449 202,458 198,470 142,462 86,478" fill={YELLOW} />
              <path d="M152 496 L152 522 L158 516 L164 522 L164 496" fill={YELLOW} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
            </g>

            {/* Open Book - pushed slightly down and right (+20px, +10px) */}
            <g transform="translate(15, 10)" stroke={INK} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round">
              <polygon points="1264,660 1356,640 1356,722 1268,740" fill="#fff" />
              <polygon points="1356,640 1442,650 1464,726 1356,722" fill="#fff" />
              <path d="M1268 744 L1356 726 L1460 732" fill="none" stroke={YELLOW} strokeWidth="6" />
              <path d="M1356 724 Q1352 752 1362 764 L1368 756 L1374 764 Q1364 748 1358 724" fill={YELLOW} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
              <g strokeWidth="2.5" stroke={INK} fill="none">
                <path d="M1282 670 q32 -8 58 -12 M1284 688 q32 -8 58 -12 M1286 706 q32 -8 54 -12" />
                <path d="M1372 660 q32 0 56 8 M1374 678 q32 0 58 9 M1376 696 q32 2 60 10" />
              </g>
            </g>
          </g>

          {/* Rocket - Shifted left (-60px) and down (+15px) to stay comfortably clear of 'E' */}
          <g className="anim-doodle-rocket" transform="translate(-60, 15)">
            <g stroke={INK} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" fill="none">
              <path d="M105 782 q8 -34 44 -30 q18 -30 56 -10 q30 -8 42 16 q24 -4 48 20" />
              <path d="M140 762 q12 -18 32 -10" />
            </g>
            <path d="M205 722 l-24 30 l15 6 z" fill={YELLOW} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
            <path d="M210 712 l-5 34 l22 -17z" fill="#FBBF24" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
            <path d="M202 728 l-10 14 l8 2 z" fill="#fff" stroke="none" />
            <g transform="rotate(38 255 665)">
              <path d="M228 696 l-24 22 l26 -2z" fill="#E2E8F0" stroke={INK} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" />
              <path d="M282 696 l24 22 l-26 -2z" fill="#E2E8F0" stroke={INK} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" />
              <path d="M255 615 C292 638 294 688 280 715 H230 C216 688 218 638 255 615Z" fill="#fff" stroke={INK} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" />
              <path d="M255 615 C270 626 276 642 278 650 H232 C234 642 240 626 255 615Z" fill={YELLOW} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
              <circle cx="255" cy="672" r="13" fill="#fff" stroke={INK} strokeWidth="3.5" />
              <circle cx="255" cy="672" r="9" fill={YELLOW} stroke={INK} strokeWidth="2" />
              <circle cx="252" cy="669" r="3" fill="#fff" />
              <path d="M236 715 h38 l-4 8 h-30 z" fill="#4B5563" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
            </g>
          </g>

          {/* Sparkles & Stars */}
          <Sparkle x={155} y={392} className="anim-doodle-sparkle" />
          <Sparkle x={1367} y={493} className="anim-doodle-sparkle-alt" />
          <Sparkle x={295} y={430} className="anim-doodle-sparkle-alt" />
          <Sparkle x={1220} y={470} className="anim-doodle-sparkle" />
          <Star x={1240} y={260} size={7} className="anim-doodle-sparkle" />
          <Star x={230} y={710} size={8} className="anim-doodle-sparkle-alt" />
          <Star x={1450} y={420} size={6} className="anim-doodle-sparkle" />
        </svg>

        {/* Handwritten Tagline above Title */}
        <div className="doodle-abs doodle-tagline" style={pos(782, 280)}>
          A Modern Learning Platform<br />for Students &amp; Teachers
        </div>

        {/* Handwritten Subtitle below Title */}
        <div className="doodle-abs doodle-sub" style={pos(778, 620)}>
          <span>Learn</span><i className="doodle-dot" />
          <span>Practice</span><i className="doodle-dot" />
          <span>Grow</span><i className="doodle-dot" />
          <span>Together</span>
        </div>

        {/* Floating Feature Pills */}
        <div className="doodle-abs doodle-pills" style={pos(777, 740)}>
          {pills.map(([Icon, label]) => (
            <div className="doodle-pill" key={label}>
              <Icon />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
