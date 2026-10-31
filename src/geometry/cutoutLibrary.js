/**
 * BoxForge Pro — Phase 2: Hardware & Ergonomic Panel Cutout Library
 * Generates kerf-compensated inner holes (Layer C01) and vector-score silkscreen guides (Layer C03)
 * for any face of the enclosure.
 */

export const CUTOUT_TEMPLATES = [
  {
    id: 'fan-40mm',
    name: '40mm Cooling Fan Grille + M3 Mounts',
    category: 'Thermal',
    defaultW: 40,
    defaultH: 40,
    description: '32.0mm M3 screw centers + 4-quadrant concentric intake louver rings'
  },
  {
    id: 'fan-80mm',
    name: '80mm Cooling Fan Grille + M4 Mounts',
    category: 'Thermal',
    defaultW: 80,
    defaultH: 80,
    description: '71.5mm M4 screw centers + concentric high-airflow intake rings'
  },
  {
    id: 'vent-slots',
    name: 'Ventilation Stadium Slot Array (5×)',
    category: 'Thermal',
    defaultW: 38,
    defaultH: 26,
    description: '5 parallel stadium airflow slots with rounded stress-relief ends'
  },
  {
    id: 'usb-c',
    name: 'USB-C Panel Mount + M2 Ears',
    category: 'Electronics I/O',
    defaultW: 22,
    defaultH: 8,
    description: '9.2×3.4mm stadium receptacle cutout + 16.0mm M2 screw holes'
  },
  {
    id: 'dc-barrel',
    name: 'DC Barrel Jack (5.5×2.1mm Panel Mount)',
    category: 'Electronics I/O',
    defaultW: 12,
    defaultH: 12,
    description: 'Ø8.2mm threaded bushing cutout + Ø12mm hex nut score ring'
  },
  {
    id: 'rocker-kcd1',
    name: 'KCD1 Mini Rocker Power Switch',
    category: 'Electronics I/O',
    defaultW: 19.2,
    defaultH: 13.0,
    description: '19.2×13.0mm snap-in rectangular panel switch cutout'
  },
  {
    id: 'db9-dsub',
    name: 'DB9 D-Sub Serial / CAN Connector',
    category: 'Electronics I/O',
    defaultW: 31,
    defaultH: 13,
    description: 'Keystone 10° trapezoidal shell cutout + 25.0mm 4-40 jackscrew holes'
  },
  {
    id: 'nema17',
    name: 'NEMA 17 Stepper Motor Faceplate',
    category: 'Mechatronics',
    defaultW: 42.3,
    defaultH: 42.3,
    description: 'Ø22.5mm pilot boss + 31.0mm square M3 pattern + 42.3mm score frame'
  },
  {
    id: 'rpi-mount',
    name: 'Raspberry Pi 4/5 PCB Standoff Grid',
    category: 'Mechatronics',
    defaultW: 85,
    defaultH: 56,
    description: '58.0×49.0mm M2.5 standoff holes + 85×56mm C03 vector-scored PCB silkscreen'
  },
  {
    id: 'custom-rect',
    name: 'Custom Rectangular / Slot Cutout',
    category: 'Custom',
    defaultW: 24,
    defaultH: 14,
    description: 'User-defined W × H window cutout'
  },
  {
    id: 'custom-circle',
    name: 'Custom Circular Port (Ø W)',
    category: 'Custom',
    defaultW: 16,
    defaultH: 16,
    description: 'User-defined circular through-hole of diameter W'
  }
];

/**
 * Helper to create a clockwise-wound polygon (for Three.js Shape hole compatibility)
 */
function rotateAndTranslatePt(px, py, cx, cy, rotDeg = 0) {
  const rad = (rotDeg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return {
    x: cx + px * c - py * s,
    y: cy + px * s + py * c
  };
}

function makeRotatedRectHole(cx, cy, w, h, rotDeg = 0) {
  const hw = Math.max(0.5, w * 0.5);
  const hh = Math.max(0.5, h * 0.5);
  // Clockwise winding in 2D
  const localPts = [
    { x: -hw, y: -hh },
    { x: -hw, y: hh },
    { x: hw, y: hh },
    { x: hw, y: -hh }
  ];
  return {
    type: 'polygon',
    x: cx,
    y: cy,
    points: localPts.map(p => rotateAndTranslatePt(p.x, p.y, cx, cy, rotDeg))
  };
}

function makeStadiumHole(cx, cy, w, h, rotDeg = 0) {
  const r = Math.min(w, h) * 0.5;
  const straightHalf = Math.max(0, (Math.max(w, h) - 2 * r) * 0.5);
  const isHorizontal = w >= h;
  const steps = 10;
  const localPts = [];

  // Build clockwise stadium contour
  if (isHorizontal) {
    for (let i = 0; i <= steps; i++) {
      const a = Math.PI * 0.5 - (i / steps) * Math.PI; // +90 deg -> -90 deg (right cap)
      localPts.push({ x: straightHalf + Math.cos(a) * r, y: Math.sin(a) * r });
    }
    for (let i = 0; i <= steps; i++) {
      const a = -Math.PI * 0.5 - (i / steps) * Math.PI; // -90 deg -> -270 deg (left cap)
      localPts.push({ x: -straightHalf + Math.cos(a) * r, y: Math.sin(a) * r });
    }
  } else {
    for (let i = 0; i <= steps; i++) {
      const a = Math.PI - (i / steps) * Math.PI; // 180 -> 0 (top cap)
      localPts.push({ x: Math.cos(a) * r, y: straightHalf + Math.sin(a) * r });
    }
    for (let i = 0; i <= steps; i++) {
      const a = 0 - (i / steps) * Math.PI; // 0 -> -180 (bottom cap)
      localPts.push({ x: Math.cos(a) * r, y: -straightHalf + Math.sin(a) * r });
    }
  }

  return {
    type: 'polygon',
    x: cx,
    y: cy,
    points: localPts.map(p => rotateAndTranslatePt(p.x, p.y, cx, cy, rotDeg))
  };
}

function makeFanGrilleArcs(cx, cy, outerDia, ringsCount, kerfDelta) {
  const holes = [];
  const bridgeWidth = 3.4;
  const slotRadialThickness = Math.max(2.2, (outerDia * 0.42) / (ringsCount + 0.5) - 2.0);

  // Center hub hole
  holes.push({
    type: 'circle',
    x: cx,
    y: cy,
    radius: Math.max(2.5, outerDia * 0.12 - kerfDelta)
  });

  // 4 quadrants of concentric arc slots
  for (let ring = 1; ring <= ringsCount; ring++) {
    const rMid = outerDia * 0.14 + ring * (slotRadialThickness + 2.2);
    const rIn = Math.max(2, rMid - slotRadialThickness * 0.5 + kerfDelta);
    const rOut = Math.max(rIn + 0.8, rMid + slotRadialThickness * 0.5 - kerfDelta);
    const angularGap = Math.asin(Math.min(0.45, bridgeWidth / (2 * rMid)));

    for (let q = 0; q < 4; q++) {
      const aStart = q * (Math.PI / 2) + angularGap;
      const aEnd = (q + 1) * (Math.PI / 2) - angularGap;
      if (aEnd <= aStart + 0.12) continue;

      const arcSteps = 8;
      const pts = [];
      // Clockwise winding: inner arc from aStart -> aEnd, then outer arc from aEnd -> aStart
      for (let i = 0; i <= arcSteps; i++) {
        const a = aStart + (i / arcSteps) * (aEnd - aStart);
        pts.push({ x: cx + Math.cos(a) * rIn, y: cy + Math.sin(a) * rIn });
      }
      for (let i = arcSteps; i >= 0; i--) {
        const a = aStart + (i / arcSteps) * (aEnd - aStart);
        pts.push({ x: cx + Math.cos(a) * rOut, y: cy + Math.sin(a) * rOut });
      }
      holes.push({
        type: 'polygon',
        x: cx,
        y: cy,
        points: pts
      });
    }
  }
  return holes;
}

/**
 * Instantiate geometric holes (Layer C01) and score annotations/frames (Layer C03)
 * for a single cutout item on a panel.
 *
 * @param {object} item - { id, type, x, y, width, height, rotation }
 * @param {number} kerfDelta - Half-kerf offset (mm)
 */
export function buildCutoutGeometry(item, kerfDelta = 0) {
  const {
    type,
    x: cx,
    y: cy,
    width = 24,
    height = 14,
    rotation = 0
  } = item;

  const holes = [];
  const scorePaths = [];
  const scoreLabels = [];

  const addCircle = (lx, ly, dia) => {
    const pt = rotateAndTranslatePt(lx, ly, cx, cy, rotation);
    holes.push({
      type: 'circle',
      x: pt.x,
      y: pt.y,
      radius: Math.max(0.5, dia * 0.5 - kerfDelta)
    });
  };

  const addScoreFrame = (w, h, labelText) => {
    const hw = w * 0.5;
    const hh = h * 0.5;
    const corners = [
      { x: -hw, y: -hh },
      { x: hw, y: -hh },
      { x: hw, y: hh },
      { x: -hw, y: hh }
    ].map(p => rotateAndTranslatePt(p.x, p.y, cx, cy, rotation));
    scorePaths.push({ points: corners, closed: true, layer: 'C03' });
    if (labelText) {
      scoreLabels.push({ type: 'label', text: labelText, x: cx, y: cy });
    }
  };

  switch (type) {
    case 'fan-40mm': {
      // 4 x M3 holes at 32.0mm square centers
      const hs = 16.0;
      addCircle(-hs, -hs, 3.2);
      addCircle(hs, -hs, 3.2);
      addCircle(hs, hs, 3.2);
      addCircle(-hs, hs, 3.2);
      holes.push(...makeFanGrilleArcs(cx, cy, 36.5, 2, kerfDelta));
      addScoreFrame(40, 40, '');
      break;
    }

    case 'fan-80mm': {
      // 4 x M4 holes at 71.5mm square centers
      const hs = 35.75;
      addCircle(-hs, -hs, 4.3);
      addCircle(hs, -hs, 4.3);
      addCircle(hs, hs, 4.3);
      addCircle(-hs, hs, 4.3);
      holes.push(...makeFanGrilleArcs(cx, cy, 75.0, 3, kerfDelta));
      addScoreFrame(80, 80, '');
      break;
    }

    case 'vent-slots': {
      const slotCount = 5;
      const totalSpanX = Math.max(16, width);
      const slotH = Math.max(6, height);
      const slotW = Math.max(2.6, totalSpanX / (slotCount * 2 - 1) - 2 * kerfDelta);
      const stepX = (totalSpanX - slotW) / (slotCount - 1);
      for (let i = 0; i < slotCount; i++) {
        const lx = -totalSpanX * 0.5 + slotW * 0.5 + i * stepX;
        const pos = rotateAndTranslatePt(lx, 0, cx, cy, rotation);
        holes.push(makeStadiumHole(pos.x, pos.y, slotW, Math.max(3, slotH - 2 * kerfDelta), rotation));
      }
      break;
    }

    case 'usb-c': {
      holes.push(makeStadiumHole(cx, cy, 9.2 - 2 * kerfDelta, 3.4 - 2 * kerfDelta, rotation));
      addCircle(-8.0, 0, 2.2);
      addCircle(8.0, 0, 2.2);
      break;
    }

    case 'dc-barrel': {
      addCircle(0, 0, 8.2);
      addScoreFrame(12, 12, '');
      break;
    }

    case 'rocker-kcd1': {
      holes.push(makeRotatedRectHole(cx, cy, 19.2 - 2 * kerfDelta, 13.0 - 2 * kerfDelta, rotation));
      break;
    }

    case 'db9-dsub': {
      // Keystone trapezoid (top width 19.6mm, bottom width 18.0mm, height 10.8mm)
      const tw = 9.8 - kerfDelta;
      const bw = 9.0 - kerfDelta;
      const hh = 5.4 - kerfDelta;
      const localTrap = [
        { x: -bw, y: -hh },
        { x: -tw, y: hh },
        { x: tw, y: hh },
        { x: bw, y: -hh }
      ];
      holes.push({
        type: 'polygon',
        x: cx,
        y: cy,
        points: localTrap.map(p => rotateAndTranslatePt(p.x, p.y, cx, cy, rotation))
      });
      addCircle(-12.5, 0, 3.2);
      addCircle(12.5, 0, 3.2);
      break;
    }

    case 'nema17': {
      // Center Ø22.5mm pilot boss + 4 x M3 holes on 31.0mm square pitch
      addCircle(0, 0, 22.5);
      const hs = 15.5;
      addCircle(-hs, -hs, 3.2);
      addCircle(hs, -hs, 3.2);
      addCircle(hs, hs, 3.2);
      addCircle(-hs, hs, 3.2);
      addScoreFrame(42.3, 42.3, 'NEMA17');
      break;
    }

    case 'rpi-mount': {
      // 58.0 x 49.0mm M2.5 mounting holes
      const hx = 29.0;
      const hy = 24.5;
      addCircle(-hx, -hy, 2.75);
      addCircle(hx, -hy, 2.75);
      addCircle(hx, hy, 2.75);
      addCircle(-hx, hy, 2.75);
      addScoreFrame(85.0, 56.0, 'RPi 4/5');
      break;
    }

    case 'custom-circle': {
      addCircle(0, 0, Math.max(2, width));
      break;
    }

    case 'custom-rect':
    default: {
      holes.push(
        makeRotatedRectHole(
          cx,
          cy,
          Math.max(2, width - 2 * kerfDelta),
          Math.max(2, height - 2 * kerfDelta),
          rotation
        )
      );
      break;
    }
  }

  return {
    holes,
    scorePaths,
    scoreLabels
  };
}
