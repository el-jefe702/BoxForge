/**
 * BoxForge Pro — Phase 2: Parametric Living Hinge & Bend-Stress Physics Engine
 * Supports:
 *  - Straight Alternating Kerf Lattice (classic torsion-link living hinge)
 *  - Wave / Serpentine Lattice (low stress concentration)
 *  - Diamond / Lozenge Cutout Lattice (high compliance & visual appeal)
 * Computes neutral-axis arc length, torsion link count, strain per link, and fracture safety status.
 */

export const LIVING_HINGE_PATTERNS = [
  {
    id: 'straight',
    name: 'Straight Alternating Kerf Slits',
    description: 'Classic torsion-beam lattice; fastest laser cut time and minimal char.',
    strainFactor: 1.0
  },
  {
    id: 'wave',
    name: 'Sinusoidal Wave Lattice',
    description: 'Curved serpentine slits distribute torsional shear without sharp corner stress risers.',
    strainFactor: 0.85
  },
  {
    id: 'diamond',
    name: 'Diamond Lozenge Micro-Lattice',
    description: 'Closed diamond cutouts on Layer C02; high flexibility and decorative aesthetic.',
    strainFactor: 0.90
  }
];

/**
 * Compute living hinge physical parameters and bend-stress telemetry.
 *
 * @param {object} opts
 * @param {number} opts.bendRadius - Inner or center-line bend radius r (mm)
 * @param {number} opts.bendAngleDeg - Total bend angle in degrees (default 90)
 * @param {number} opts.thickness - Material caliper thickness t (mm)
 * @param {number} opts.hingeSpanWidth - Width of panel across the hinge axis (mm)
 * @param {number} opts.colSpacing - Center-to-center distance between slit columns along arc (mm)
 * @param {number} opts.bridgeGap - Solid material bridge gap between collinear slits (mm)
 * @param {number} opts.slitsPerCol - Number of slits across the width per column (2..6)
 * @param {string} opts.pattern - 'straight' | 'wave' | 'diamond'
 * @param {string} opts.materialCategory - 'Plywood' | 'MDF' | 'Hardwood' | 'Acrylic'
 */
export function calculateLivingHingePhysics(opts) {
  const {
    bendRadius = 18,
    bendAngleDeg = 90,
    thickness = 2.92,
    hingeSpanWidth = 140,
    colSpacing = 2.2,
    bridgeGap = 3.2,
    slitsPerCol = 3,
    pattern = 'straight',
    materialCategory = 'Plywood'
  } = opts;

  const r = Math.max(thickness * 1.8, Number(bendRadius));
  const thetaRad = (Number(bendAngleDeg) * Math.PI) / 180;
  // Neutral axis sits roughly at r + t/2
  const neutralRadius = r + thickness * 0.5;
  const arcLength = neutralRadius * thetaRad;

  const spacing = Math.max(1.2, Number(colSpacing));
  let numCols = Math.max(5, Math.ceil(arcLength / spacing));
  if (numCols % 2 === 0) numCols += 1; // Odd column count for symmetric entry/exit

  const actualColSpacing = arcLength / (numCols + 1);
  const torsionBeamWidth = Math.max(0.6, actualColSpacing);

  // Allowable strain threshold by material category
  const maxAllowableStrainMap = {
    Plywood: 0.088,
    MDF: 0.078,
    Hardwood: 0.068,
    Acrylic: 0.026
  };
  const maxStrain = maxAllowableStrainMap[materialCategory] ?? 0.08;

  const patternMeta = LIVING_HINGE_PATTERNS.find(p => p.id === pattern) || LIVING_HINGE_PATTERNS[0];

  // Torsional strain approximation per serial link:
  // strain ~ (t * thetaRad) / (2 * numCols * torsionBeamWidth) * patternFactor
  const estimatedStrain =
    ((thickness * thetaRad) / (2 * numCols * torsionBeamWidth)) * patternMeta.strainFactor;

  const safetyRatio = estimatedStrain / maxStrain;
  // Minimum recommended bend radius where safetyRatio <= 1.0
  const minSafeRadius = Math.max(
    thickness * 2.5,
    (thickness * thetaRad * spacing * patternMeta.strainFactor) / (2 * maxStrain * torsionBeamWidth)
  );

  let status = 'safe'; // 'safe' | 'warning' | 'danger'
  let message = 'Optimal elastic bend compliance';

  if (materialCategory === 'Acrylic' && safetyRatio > 0.85) {
    status = 'danger';
    message = 'Acrylic is brittle cold — increase radius or heat-form';
  } else if (safetyRatio > 1.15) {
    status = 'danger';
    message = `High fracture risk! Increase radius ≥ ${Math.ceil(minSafeRadius)}mm`;
  } else if (safetyRatio > 0.85) {
    status = 'warning';
    message = 'Tight bend — mist wood lightly or reduce col spacing';
  }

  return {
    bendRadius: r,
    neutralRadius,
    bendAngleDeg,
    thetaRad,
    arcLength,
    numCols,
    actualColSpacing,
    torsionBeamWidth,
    bridgeGap,
    slitsPerCol,
    pattern,
    estimatedStrain,
    maxStrain,
    safetyRatio,
    minSafeRadius,
    status,
    message
  };
}

/**
 * Generate 2D vector cut paths (Layer C02) for a Living Hinge zone embedded in a panel.
 *
 * Coordinate system:
 *  - Hinge spans horizontally from x = xStart to x = xEnd (width W_span = xEnd - xStart)
 *  - Hinge spans vertically along the bend direction from y = yStart to y = yStart + arcLength
 *
 * Returns { paths: Array<{ points: Array<{x,y}>, closed: boolean }>, cutLengthMm: number }
 */
export function generateLivingHingeLatticePaths({
  xStart,
  xEnd,
  yStart,
  physics
}) {
  const {
    arcLength,
    numCols,
    actualColSpacing,
    bridgeGap = 3.2,
    slitsPerCol = 3,
    pattern = 'straight'
  } = physics;

  const spanW = xEnd - xStart;
  const paths = [];
  let totalLen = 0;

  const addPath = (pts, closed = false) => {
    if (pts.length < 2) return;
    paths.push({ points: pts, closed, layer: 'C02' });
    for (let i = 0; i < pts.length - 1; i++) {
      totalLen += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    }
    if (closed && pts.length > 2) {
      totalLen += Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y);
    }
  };

  const nInteriorSlits = Math.max(2, Math.min(6, slitsPerCol));
  const segW = (spanW - (nInteriorSlits + 1) * bridgeGap) / nInteriorSlits;

  for (let col = 0; col < numCols; col++) {
    const y = yStart + (col + 1) * actualColSpacing;
    const isEvenCol = col % 2 === 0;

    if (pattern === 'diamond') {
      // Closed diamond lozenges along the row
      const halfH = Math.min(actualColSpacing * 0.38, 0.95);
      if (isEvenCol) {
        for (let s = 0; s < nInteriorSlits; s++) {
          const sx0 = xStart + bridgeGap + s * (segW + bridgeGap);
          const sx1 = sx0 + segW;
          const smid = (sx0 + sx1) * 0.5;
          addPath([
            { x: sx0, y },
            { x: smid, y: y - halfH },
            { x: sx1, y },
            { x: smid, y: y + halfH }
          ], true);
        }
      } else {
        // Staggered column including edge half-diamonds
        for (let s = 0; s <= nInteriorSlits; s++) {
          const center = xStart + bridgeGap * 0.5 + s * (segW + bridgeGap);
          const x0 = Math.max(xStart + 0.6, center - segW * 0.45);
          const x1 = Math.min(xEnd - 0.6, center + segW * 0.45);
          if (x1 - x0 > 3) {
            const smid = (x0 + x1) * 0.5;
            addPath([
              { x: x0, y },
              { x: smid, y: y - halfH },
              { x: x1, y },
              { x: smid, y: y + halfH }
            ], true);
          }
        }
      }
      continue;
    }

    // Helper for straight or sinusoidal wave segment from [xa .. xb] at row y
    const emitSegment = (xa, xb) => {
      if (xb - xa < 1.5) return;
      if (pattern === 'wave') {
        const amp = Math.min(actualColSpacing * 0.28, 0.65);
        const steps = 10;
        const pts = [];
        for (let k = 0; k <= steps; k++) {
          const u = k / steps;
          const px = xa + u * (xb - xa);
          const py = y + Math.sin(u * Math.PI * 2) * amp * (isEvenCol ? 1 : -1);
          pts.push({ x: px, y: py });
        }
        addPath(pts, false);
      } else {
        addPath([{ x: xa, y }, { x: xb, y }], false);
      }
    };

    if (isEvenCol) {
      // Even column: interior slits with solid bridges at outer edges (xStart, xEnd)
      for (let s = 0; s < nInteriorSlits; s++) {
        const sx0 = xStart + bridgeGap + s * (segW + bridgeGap);
        const sx1 = sx0 + segW;
        emitSegment(sx0, sx1);
      }
    } else {
      // Odd column: slits cut all the way to the outer edges (or 0.25mm micro-tab) and bridge the centers
      const edgeInset = 0.35; // leaves tiny outer skin so outer perimeter cut C00 remains a single closed path
      for (let s = 0; s <= nInteriorSlits; s++) {
        const center = xStart + bridgeGap * 0.5 + s * (segW + bridgeGap);
        const xa = Math.max(xStart + edgeInset, center - segW * 0.5);
        const xb = Math.min(xEnd - edgeInset, center + segW * 0.5);
        emitSegment(xa, xb);
      }
    }
  }

  return {
    paths,
    cutLengthMm: totalLen
  };
}
