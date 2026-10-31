/**
 * BoxForge Pro — Deterministic 2D/3D Parametric Enclosure Core (Phase 1 + Phase 2)
 * Generates kerf-compensated panel contours, internal mortises, T-slot captive-nut joints,
 * egg-crate dividers, Living Hinge curved enclosures (Layer C02), Hardware Panel Cutouts (Layer C01/C03),
 * 3D kinematic transforms, and 2D flat-bed nesting layouts.
 */

import { TSLOT_HARDWARE } from '../presets.js';
import {
  calculateLivingHingePhysics,
  generateLivingHingeLatticePaths
} from './livingHinge.js';
import { buildCutoutGeometry } from './cutoutLibrary.js';

/**
 * Compute odd count of fingers along an edge of given inner span.
 */
export function computeFingerDistribution(totalEdgeLength, thickness, targetFingerWidth) {
  const usableSpan = Math.max(thickness * 2, totalEdgeLength - 2 * thickness);
  const clampedTarget = Math.max(thickness * 1.5, Math.min(usableSpan / 2, targetFingerWidth));
  let segments = Math.round(usableSpan / clampedTarget);
  if (segments < 3) segments = 3;
  if (segments % 2 === 0) segments += 1; // Enforce odd segment count for symmetric corners
  const pitch = usableSpan / segments;
  return {
    segments,
    pitch,
    usableSpan,
    cornerInset: thickness
  };
}

/**
 * Generate a finger-jointed or T-slot edge polyline from (0, 0) to (edgeLength, 0)
 * in local edge coordinates where:
 *   +X is along the edge from start to end (0 -> edgeLength)
 *   +Y is pointing INWARD into the panel center
 */
export function buildEdgeProfile(opts) {
  const {
    edgeLength: L,
    thickness: t,
    targetFingerWidth,
    polarity,
    cornerStyle = 'corner-recessed',
    kerfDelta = 0,
    isTSlot = false,
    hardware = TSLOT_HARDWARE.M3,
    thumbNotch = false
  } = opts;

  const points = [];
  const fastenerHoles = [];

  const pushPt = (x, y) => {
    if (points.length > 0) {
      const prev = points[points.length - 1];
      if (Math.abs(prev.x - x) < 1e-5 && Math.abs(prev.y - y) < 1e-5) {
        return;
      }
    }
    points.push({ x, y });
  };

  if (polarity === 'flat') {
    const startY = cornerStyle === 'corner-recessed' ? t : 0;
    const yOut = -kerfDelta;
    if (cornerStyle === 'corner-recessed') {
      pushPt(0, startY);
      pushPt(t - kerfDelta, startY);
      pushPt(t - kerfDelta, yOut);
    } else {
      pushPt(0, yOut);
    }

    if (thumbNotch && L > t * 6) {
      const notchRadius = Math.min(14, Math.max(8, L * 0.12));
      const cx = L / 2;
      const steps = 20;
      pushPt(cx - notchRadius, yOut);
      for (let i = 1; i < steps; i++) {
        const angle = Math.PI - (i / steps) * Math.PI;
        const nx = cx + Math.cos(angle) * notchRadius;
        const ny = yOut + Math.sin(angle) * (notchRadius * 0.72);
        pushPt(nx, ny);
      }
      pushPt(cx + notchRadius, yOut);
    }

    if (cornerStyle === 'corner-recessed') {
      pushPt(L - t + kerfDelta, yOut);
      pushPt(L - t + kerfDelta, startY);
      pushPt(L, startY);
    } else {
      pushPt(L, yOut);
    }
    return { points, fastenerHoles, dist: null };
  }

  const dist = computeFingerDistribution(L, t, targetFingerWidth);
  const { segments, pitch } = dist;

  const tslotSegmentIndices = new Set();
  if (isTSlot) {
    if (segments >= 7) {
      tslotSegmentIndices.add(1);
      tslotSegmentIndices.add(segments - 2);
    } else {
      tslotSegmentIndices.add(Math.floor(segments / 2));
      if (tslotSegmentIndices.has(0) || [...tslotSegmentIndices][0] % 2 === 0) {
        tslotSegmentIndices.clear();
        tslotSegmentIndices.add(1);
      }
    }
  }

  const yOuter = -kerfDelta;
  const yShoulder = t - kerfDelta;

  const startAtOuter = cornerStyle === 'corner-flush';
  pushPt(0, startAtOuter ? yOuter : yShoulder);
  if (startAtOuter && polarity === 'male') {
    pushPt(t + kerfDelta, yOuter);
    pushPt(t + kerfDelta, yShoulder);
  } else if (!startAtOuter && polarity === 'female') {
    pushPt(t - kerfDelta, yShoulder);
    pushPt(t - kerfDelta, yOuter);
  } else {
    pushPt(t, startAtOuter ? yOuter : yShoulder);
  }

  for (let i = 0; i < segments; i++) {
    const segStart = t + i * pitch;
    const segEnd = t + (i + 1) * pitch;
    const segMid = (segStart + segEnd) * 0.5;
    const isOdd = i % 2 === 1;

    if (isTSlot && tslotSegmentIndices.has(i)) {
      if (polarity === 'male') {
        pushPt(segStart, yShoulder);
        pushPt(segEnd, yShoulder);
        fastenerHoles.push({
          type: 'circle',
          x: segMid,
          y: t * 0.5,
          radius: Math.max(0.8, hardware.screwDiameter * 0.5 - kerfDelta)
        });
      } else {
        const shaftHalf = Math.max(0.6, hardware.screwDiameter * 0.5 - kerfDelta);
        const nutHalfW = Math.max(1.2, hardware.nutWidth * 0.5 - kerfDelta);
        const nutH = Math.max(1.0, hardware.nutThickness - 2 * kerfDelta);
        const nutTopY = t + 2.8;
        const nutBotY = nutTopY + nutH;
        const totalDepth = Math.max(nutBotY + 1.8, hardware.screwLength - t + 0.8);

        pushPt(segMid - shaftHalf, yOuter);
        pushPt(segMid - shaftHalf, nutTopY);
        pushPt(segMid - nutHalfW, nutTopY);
        pushPt(segMid - nutHalfW, nutBotY);
        pushPt(segMid - shaftHalf, nutBotY);
        pushPt(segMid - shaftHalf, totalDepth);
        pushPt(segMid + shaftHalf, totalDepth);
        pushPt(segMid + shaftHalf, nutBotY);
        pushPt(segMid + nutHalfW, nutBotY);
        pushPt(segMid + nutHalfW, nutTopY);
        pushPt(segMid + shaftHalf, nutTopY);
        pushPt(segMid + shaftHalf, yOuter);
      }
      continue;
    }

    if (polarity === 'male') {
      if (isOdd) {
        const x0 = segStart - kerfDelta;
        const x1 = segEnd + kerfDelta;
        pushPt(x0, yShoulder);
        pushPt(x0, yOuter);
        pushPt(x1, yOuter);
        pushPt(x1, yShoulder);
      } else {
        pushPt(segStart + (i === 0 ? 0 : kerfDelta), yShoulder);
        pushPt(segEnd - kerfDelta, yShoulder);
      }
    } else {
      if (isOdd) {
        const x0 = segStart + kerfDelta;
        const x1 = segEnd - kerfDelta;
        pushPt(x0, yOuter);
        pushPt(x0, yShoulder);
        pushPt(x1, yShoulder);
        pushPt(x1, yOuter);
      } else {
        pushPt(segStart - (i === 0 ? 0 : kerfDelta), yOuter);
        pushPt(segEnd + kerfDelta, yOuter);
      }
    }
  }

  if (startAtOuter && polarity === 'male') {
    pushPt(L - t - kerfDelta, yShoulder);
    pushPt(L - t - kerfDelta, yOuter);
    pushPt(L, yOuter);
  } else if (!startAtOuter && polarity === 'female') {
    pushPt(L - t + kerfDelta, yOuter);
    pushPt(L - t + kerfDelta, yShoulder);
    pushPt(L, yShoulder);
  } else {
    pushPt(L, startAtOuter ? yOuter : yShoulder);
  }

  return { points, fastenerHoles, dist };
}

function mapEdgeToPanel(edgeResult, side, W, H) {
  const mapPt = (u, v) => {
    switch (side) {
      case 'bottom':
        return { x: u, y: v };
      case 'right':
        return { x: W - v, y: u };
      case 'top':
        return { x: W - u, y: H - v };
      case 'left':
        return { x: v, y: H - u };
      default:
        return { x: u, y: v };
    }
  };

  const mappedPts = edgeResult.points.map(p => mapPt(p.x, p.y));
  const mappedHoles = edgeResult.fastenerHoles.map(h => {
    const pos = mapPt(h.x, h.y);
    return {
      ...h,
      x: pos.x,
      y: pos.y
    };
  });

  return { points: mappedPts, holes: mappedHoles };
}

function buildPanelOutline({ W, H, t, fingerWidth, edgesConfig, kerfDelta, isTSlot, hardware }) {
  const sides = ['bottom', 'right', 'top', 'left'];
  const allPoints = [];
  const allHoles = [];

  for (const side of sides) {
    const cfg = edgesConfig[side];
    const edgeLen = side === 'bottom' || side === 'top' ? W : H;
    const rawEdge = buildEdgeProfile({
      edgeLength: edgeLen,
      thickness: t,
      targetFingerWidth: fingerWidth,
      polarity: cfg.polarity,
      cornerStyle: cfg.cornerStyle,
      kerfDelta,
      isTSlot: isTSlot && cfg.allowTSlot !== false,
      hardware,
      thumbNotch: Boolean(cfg.thumbNotch)
    });
    const mapped = mapEdgeToPanel(rawEdge, side, W, H);
    for (const pt of mapped.points) {
      if (allPoints.length > 0) {
        const last = allPoints[allPoints.length - 1];
        if (Math.hypot(last.x - pt.x, last.y - pt.y) < 1e-4) continue;
      }
      allPoints.push(pt);
    }
    allHoles.push(...mapped.holes);
  }

  if (allPoints.length > 2) {
    const first = allPoints[0];
    const last = allPoints[allPoints.length - 1];
    if (Math.hypot(first.x - last.x, first.y - last.y) < 1e-4) {
      allPoints.pop();
    }
  }

  return { outline: allPoints, holes: allHoles };
}

/**
 * Build a side wall (LEFT or RIGHT) with a rounded living-hinge corner of radius R
 * at its top-back corner!
 * For LEFT panel: local X=0 is Back edge, X=D is Front edge. Top-left corner (0, H) is rounded by R.
 * For RIGHT panel: local X=0 is Front edge, X=D is Back edge. Top-right corner (D, H) is rounded by R.
 */
function buildLivingHingeSideWallOutline({
  D, H, t, R, side, fingerWidth, kerfDelta, isTSlot, hardware
}) {
  const straightBackH = Math.max(t * 4, H - R);
  const straightTopD = Math.max(t * 4, D - R);
  const pts = [];
  const holes = [];

  const pushPt = (x, y) => {
    if (pts.length > 0) {
      const prev = pts[pts.length - 1];
      if (Math.hypot(prev.x - x, prev.y - y) < 1e-4) return;
    }
    pts.push({ x, y });
  };

  // 1. Bottom edge (0,0) -> (D,0) is standard female edge
  const botEdge = mapEdgeToPanel(
    buildEdgeProfile({
      edgeLength: D,
      thickness: t,
      targetFingerWidth: fingerWidth,
      polarity: 'female',
      cornerStyle: 'corner-recessed',
      kerfDelta,
      isTSlot,
      hardware
    }),
    'bottom',
    D,
    H
  );
  botEdge.points.forEach(p => pushPt(p.x, p.y));
  holes.push(...botEdge.holes);

  if (side === 'left') {
    // Right edge (x = D, y: 0 -> H) is Front edge (full height female)
    const frontEdge = mapEdgeToPanel(
      buildEdgeProfile({
        edgeLength: H,
        thickness: t,
        targetFingerWidth: fingerWidth,
        polarity: 'female',
        cornerStyle: 'corner-recessed',
        kerfDelta,
        isTSlot,
        hardware
      }),
      'right',
      D,
      H
    );
    frontEdge.points.forEach(p => pushPt(p.x, p.y));
    holes.push(...frontEdge.holes);

    // Top straight section from x = D down to x = R (y = H - t shoulder)
    pushPt(D - t, H - t + kerfDelta);
    pushPt(R, H - t + kerfDelta);

    // Quarter-circle arc at top-left corner: center at (R, H - R), radius = R - t + kerfDelta
    const arcR = Math.max(2, R - t + kerfDelta);
    const steps = 18;
    for (let i = 1; i <= steps; i++) {
      const angle = Math.PI * 0.5 + (i / steps) * (Math.PI * 0.5); // 90 deg -> 180 deg
      pushPt(R + Math.cos(angle) * arcR, (H - R) + Math.sin(angle) * arcR);
    }

    // Back straight section from y = H - R down to y = 0 along x = 0 (female fingers)
    const backRaw = buildEdgeProfile({
      edgeLength: straightBackH,
      thickness: t,
      targetFingerWidth: fingerWidth,
      polarity: 'female',
      cornerStyle: 'corner-recessed',
      kerfDelta,
      isTSlot,
      hardware
    });
    for (const p of backRaw.points) {
      pushPt(p.y, straightBackH - p.x);
    }
  } else {
    // side === 'right': Right edge (x = D) is Back edge (height = straightBackH)
    const backRaw = buildEdgeProfile({
      edgeLength: straightBackH,
      thickness: t,
      targetFingerWidth: fingerWidth,
      polarity: 'female',
      cornerStyle: 'corner-recessed',
      kerfDelta,
      isTSlot,
      hardware
    });
    for (const p of backRaw.points) {
      pushPt(D - p.y, p.x);
    }

    // Quarter-circle arc at top-right corner: center at (D - R, H - R), radius = R - t + kerfDelta
    const arcR = Math.max(2, R - t + kerfDelta);
    const steps = 18;
    for (let i = 0; i <= steps; i++) {
      const angle = (i / steps) * (Math.PI * 0.5); // 0 deg -> 90 deg
      pushPt((D - R) + Math.cos(angle) * arcR, (H - R) + Math.sin(angle) * arcR);
    }

    // Top straight section from x = D - R to x = t
    pushPt(t, H - t + kerfDelta);

    // Left edge (x = 0, y: H -> 0) is Front edge (full height female)
    const frontEdge = mapEdgeToPanel(
      buildEdgeProfile({
        edgeLength: H,
        thickness: t,
        targetFingerWidth: fingerWidth,
        polarity: 'female',
        cornerStyle: 'corner-recessed',
        kerfDelta,
        isTSlot,
        hardware
      }),
      'left',
      D,
      H
    );
    frontEdge.points.forEach(p => pushPt(p.x, p.y));
    holes.push(...frontEdge.holes);
  }

  return { outline: pts, holes, straightBackH, straightTopD };
}

/**
 * Build the one-piece Continuous Living-Hinge Wrap Panel (BACK + HINGE ARC + TOP)
 * Width = outerW, Total Unfolded Height = straightBackH + arcLength + straightTopD
 */
function buildLivingHingeWrapPanelOutline({
  W, straightBackH, arcLength, straightTopD, t, fingerWidth, kerfDelta, isTSlot, hardware, thumbNotch
}) {
  const totalH = straightBackH + arcLength + straightTopD;
  const pts = [];
  const holes = [];

  const pushPt = (x, y) => {
    if (pts.length > 0) {
      const prev = pts[pts.length - 1];
      if (Math.hypot(prev.x - x, prev.y - y) < 1e-4) return;
    }
    pts.push({ x, y });
  };

  // 1. Bottom edge (0,0 -> W,0): Female fingers mating with BOTTOM's back edge
  const botEdge = mapEdgeToPanel(
    buildEdgeProfile({
      edgeLength: W,
      thickness: t,
      targetFingerWidth: fingerWidth,
      polarity: 'female',
      cornerStyle: 'corner-flush',
      kerfDelta,
      isTSlot,
      hardware
    }),
    'bottom',
    W,
    totalH
  );
  botEdge.points.forEach(p => pushPt(p.x, p.y));
  holes.push(...botEdge.holes);

  // 2. Right lower edge (y: 0 -> straightBackH): Male fingers mating with LEFT/RIGHT back edge
  const rightLowerRaw = buildEdgeProfile({
    edgeLength: straightBackH,
    thickness: t,
    targetFingerWidth: fingerWidth,
    polarity: 'male',
    cornerStyle: 'corner-recessed',
    kerfDelta,
    isTSlot,
    hardware
  });
  for (const p of rightLowerRaw.points) {
    pushPt(W - p.y, p.x);
  }

  // 3. Right hinge + top edge (y: straightBackH -> totalH): Flush along x = W - t (or W)
  pushPt(W + kerfDelta, straightBackH);
  pushPt(W + kerfDelta, totalH - t);

  // 4. Top edge (y = totalH, x: W -> 0): Male fingers mating with FRONT wall top edge (or thumb tab)
  const topRaw = buildEdgeProfile({
    edgeLength: W,
    thickness: t,
    targetFingerWidth: fingerWidth,
    polarity: 'male',
    cornerStyle: 'corner-recessed',
    kerfDelta,
    isTSlot,
    hardware,
    thumbNotch
  });
  for (const p of topRaw.points) {
    pushPt(W - p.x, totalH - p.y);
  }

  // 5. Left top + hinge edge (y: totalH -> straightBackH)
  pushPt(-kerfDelta, totalH - t);
  pushPt(-kerfDelta, straightBackH);

  // 6. Left lower edge (y: straightBackH -> 0): Male fingers mating with side wall back edge
  const leftLowerRaw = buildEdgeProfile({
    edgeLength: straightBackH,
    thickness: t,
    targetFingerWidth: fingerWidth,
    polarity: 'male',
    cornerStyle: 'corner-recessed',
    kerfDelta,
    isTSlot,
    hardware
  });
  for (const p of leftLowerRaw.points) {
    pushPt(p.y, straightBackH - p.x);
  }

  return {
    outline: pts,
    holes,
    totalH
  };
}

function makeRectHole(cx, cy, w, h) {
  const hw = w * 0.5;
  const hh = h * 0.5;
  return {
    type: 'rect',
    x: cx,
    y: cy,
    w,
    h,
    points: [
      { x: cx - hw, y: cy - hh },
      { x: cx - hw, y: cy + hh },
      { x: cx + hw, y: cy + hh },
      { x: cx + hw, y: cy - hh }
    ]
  };
}

export function computePolygonLength(pts, closed = true) {
  if (!pts || pts.length < 2) return 0;
  let sum = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    sum += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
  }
  if (closed && pts.length > 2) {
    sum += Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y);
  }
  return sum;
}

/**
 * Main Parametric Box Generator (Phase 1 + Phase 2)
 */
export function generateParametricBox(params) {
  const {
    width = 140,
    depth = 100,
    height = 70,
    dimensionMode = 'outer',
    boxStyle = 'closed',       // 'closed' | 'open' | 'hinged-top' | 'living-hinge'
    jointType = 'finger',      // 'finger' | 'tslot'
    hardwareId = 'M3',
    thickness = 2.92,
    kerf = 0.14,
    fitInterference = 0.04,
    fingerWidth = 14,
    dividersX = 0,
    dividersY = 0,
    thumbNotch = true,
    // Phase 2: Living Hinge parameters
    hingePattern = 'straight', // 'straight' | 'wave' | 'diamond'
    hingeRadius = 18,
    hingeColSpacing = 2.2,
    hingeBridgeGap = 3.2,
    hingeSlitsPerCol = 3,
    materialCategory = 'Plywood',
    // Phase 2: User-placed panel cutouts array
    panelCutouts = [],
    bedWidth = 600,
    bedHeight = 400,
    partSpacing = 5,
    cutSpeed = 20
  } = params;

  const t = Math.max(1.0, Number(thickness));
  const hasTop = boxStyle !== 'open';
  const isLivingHinge = boxStyle === 'living-hinge';
  const isTSlot = jointType === 'tslot';
  const hardware = TSLOT_HARDWARE[hardwareId] || TSLOT_HARDWARE.M3;

  const outerW = dimensionMode === 'inner' ? width + 2 * t : Math.max(t * 6, width);
  const outerD = dimensionMode === 'inner' ? depth + 2 * t : Math.max(t * 6, depth);
  const outerH = dimensionMode === 'inner'
    ? height + (hasTop ? 2 * t : t)
    : Math.max(t * 5, height);

  const innerW = outerW - 2 * t;
  const innerD = outerD - 2 * t;
  const innerH = outerH - (hasTop ? 2 * t : t);

  // Per-edge path offset delta = kerf/2 + fitInterference/4
  const kerfDelta = (Number(kerf) * 0.5) + (Number(fitInterference) * 0.25);

  // Compute Living Hinge Physics (always computed so UI can preview or use when boxStyle === 'living-hinge')
  const clampedHingeR = Math.min(Math.min(outerH, outerD) * 0.48, Math.max(t * 2.5, Number(hingeRadius)));
  const hingePhysics = calculateLivingHingePhysics({
    bendRadius: clampedHingeR,
    bendAngleDeg: 90,
    thickness: t,
    hingeSpanWidth: outerW,
    colSpacing: hingeColSpacing,
    bridgeGap: hingeBridgeGap,
    slitsPerCol: hingeSlitsPerCol,
    pattern: hingePattern,
    materialCategory
  });

  const panels = [];

  // Helper to collect user-placed cutouts targeting a given panel id
  const getCustomCutoutsForPanel = (panelId, delta) => {
    const matching = panelCutouts.filter(c => c.panelId === panelId);
    const holes = [];
    const scorePaths = [];
    const scoreLabels = [];
    for (const item of matching) {
      const built = buildCutoutGeometry(item, delta);
      holes.push(...built.holes);
      scorePaths.push(...built.scorePaths);
      scoreLabels.push(...built.scoreLabels);
    }
    return { holes, scorePaths, scoreLabels };
  };

  const createPanelRecord = ({
    id,
    name,
    code,
    W,
    H,
    edgesConfig,
    customBuildFn,
    extraHolesFn,
    livingHingeData = null,
    scoreAnnotations = [],
    kinematics
  }) => {
    const compensated = customBuildFn
      ? customBuildFn(kerfDelta)
      : buildPanelOutline({
          W, H, t, fingerWidth, edgesConfig,
          kerfDelta,
          isTSlot,
          hardware
        });
    const nominal = customBuildFn
      ? customBuildFn(0)
      : buildPanelOutline({
          W, H, t, fingerWidth, edgesConfig,
          kerfDelta: 0,
          isTSlot,
          hardware
        });

    const extraCompHoles = extraHolesFn ? extraHolesFn(kerfDelta) : [];
    const extraNomHoles = extraHolesFn ? extraHolesFn(0) : [];

    // User-placed panel cutouts from Phase 2 Cutout Library
    const userComp = getCustomCutoutsForPanel(id, kerfDelta);
    const userNom = getCustomCutoutsForPanel(id, 0);

    const holes = [...compensated.holes, ...extraCompHoles, ...userComp.holes];
    const nominalHoles = [...nominal.holes, ...extraNomHoles, ...userNom.holes];
    const livingHingePaths = livingHingeData ? livingHingeData.paths : [];

    let cutLengthMm = computePolygonLength(compensated.outline, true);
    for (const h of holes) {
      if (h.type === 'circle') {
        cutLengthMm += 2 * Math.PI * h.radius;
      } else if (h.points) {
        cutLengthMm += computePolygonLength(h.points, true);
      }
    }
    if (livingHingeData) {
      cutLengthMm += livingHingeData.cutLengthMm;
    }

    return {
      id,
      name,
      code,
      width: W,
      height: H,
      thickness: t,
      outline: compensated.outline,
      nominalOutline: nominal.outline,
      holes,
      nominalHoles,
      livingHingePaths,
      livingHingeMeta: livingHingeData ? livingHingeData.meta : null,
      scorePaths: userComp.scorePaths,
      scoreAnnotations: [
        {
          type: 'label',
          text: `${code} (${W.toFixed(1)}×${H.toFixed(1)})`,
          x: W * 0.5,
          y: livingHingeData ? livingHingeData.meta.straightBackH * 0.5 : H * 0.5
        },
        ...scoreAnnotations,
        ...userComp.scoreLabels
      ],
      cutLengthMm,
      kinematics
    };
  };

  // Divider X and Y positions
  const divXPositions = [];
  if (dividersX > 0) {
    const stepX = innerW / (dividersX + 1);
    for (let i = 1; i <= dividersX; i++) {
      divXPositions.push(t + i * stepX);
    }
  }

  const divYPositions = [];
  if (dividersY > 0) {
    const stepY = innerD / (dividersY + 1);
    for (let i = 1; i <= dividersY; i++) {
      divYPositions.push(t + i * stepY);
    }
  }

  const divLugHeight = Math.min(innerH * 0.38, Math.max(t * 3, 12));
  const divFloorLugWidth = Math.min(innerD * 0.35, Math.max(t * 3, 16));
  const divFloorLugWidthX = Math.min(innerW * 0.35, Math.max(t * 3, 16));

  // 1. BOTTOM PANEL (outerW × outerD)
  panels.push(
    createPanelRecord({
      id: 'bottom',
      name: 'Bottom Base Plate',
      code: 'BOTTOM',
      W: outerW,
      H: outerD,
      edgesConfig: {
        bottom: { polarity: 'male', cornerStyle: 'corner-recessed' },
        right:  { polarity: 'male', cornerStyle: 'corner-recessed' },
        top:    { polarity: 'male', cornerStyle: 'corner-recessed' },
        left:   { polarity: 'male', cornerStyle: 'corner-recessed' }
      },
      extraHolesFn: (delta) => {
        const mortises = [];
        const slotThick = Math.max(0.6, t - 2 * delta);
        for (const xPos of divXPositions) {
          mortises.push(
            makeRectHole(xPos, outerD * 0.5, slotThick, Math.max(2, divFloorLugWidth - 2 * delta))
          );
        }
        for (const yPos of divYPositions) {
          mortises.push(
            makeRectHole(outerW * 0.5, yPos, Math.max(2, divFloorLugWidthX - 2 * delta), slotThick)
          );
        }
        return mortises;
      },
      kinematics: {
        role: 'base'
      }
    })
  );

  // 2. FRONT PANEL (outerW × outerH)
  panels.push(
    createPanelRecord({
      id: 'front',
      name: 'Front Wall',
      code: 'FRONT',
      W: outerW,
      H: outerH,
      edgesConfig: {
        bottom: { polarity: 'female', cornerStyle: 'corner-flush' },
        right:  { polarity: 'male',   cornerStyle: 'corner-recessed' },
        top:    hasTop
          ? { polarity: 'female', cornerStyle: 'corner-flush' }
          : { polarity: 'flat',   cornerStyle: 'corner-recessed', thumbNotch },
        left:   { polarity: 'male',   cornerStyle: 'corner-recessed' }
      },
      extraHolesFn: (delta) => {
        const mortises = [];
        const slotThick = Math.max(0.6, t - 2 * delta);
        const lugH = Math.max(2, divLugHeight - 2 * delta);
        const centerY = t + innerH * 0.5;
        for (const xPos of divXPositions) {
          mortises.push(makeRectHole(xPos, centerY, slotThick, lugH));
        }
        return mortises;
      },
      kinematics: {
        role: 'wall-front',
        hingeAngleRad: Math.PI / 2
      }
    })
  );

  if (isLivingHinge) {
    // LIVING HINGE ENCLOSURE TOPOLOGY:
    // - LEFT & RIGHT walls get a rounded R top-back corner
    // - BACK + LIVING HINGE + TOP are merged into a single continuous WRAP-LID panel!
    const straightBackH = Math.max(t * 4, outerH - clampedHingeR);
    const straightTopD = Math.max(t * 4, outerD - clampedHingeR);
    const wrapTotalH = straightBackH + hingePhysics.arcLength + straightTopD;

    const lattice = generateLivingHingeLatticePaths({
      xStart: 0,
      xEnd: outerW,
      yStart: straightBackH,
      physics: hingePhysics
    });

    // Continuous WRAP-LID panel (id = 'back' so back cutouts attach naturally, plus 'top' cutouts shifted onto lid section!)
    panels.push(
      createPanelRecord({
        id: 'back',
        name: 'Living-Hinge Wrap Lid (Back + Bend + Top)',
        code: 'WRAP-LID',
        W: outerW,
        H: wrapTotalH,
        customBuildFn: (delta) =>
          buildLivingHingeWrapPanelOutline({
            W: outerW,
            straightBackH,
            arcLength: hingePhysics.arcLength,
            straightTopD,
            t,
            fingerWidth,
            kerfDelta: delta,
            isTSlot,
            hardware,
            thumbNotch
          }),
        extraHolesFn: (delta) => {
          const mortises = [];
          const slotThick = Math.max(0.6, t - 2 * delta);
          const lugH = Math.max(2, divLugHeight - 2 * delta);
          const centerY = Math.min(straightBackH - lugH, t + innerH * 0.5);
          for (const xPos of divXPositions) {
            mortises.push(makeRectHole(outerW - xPos, centerY, slotThick, lugH));
          }
          // Also include any cutouts assigned to 'top' shifted into the top lid region!
          const topCutouts = getCustomCutoutsForPanel('top', delta);
          for (const h of topCutouts.holes) {
            const shiftY = straightBackH + hingePhysics.arcLength;
            if (h.type === 'circle') {
              mortises.push({ ...h, y: shiftY + h.y * (straightTopD / outerD) });
            } else if (h.points) {
              mortises.push({
                ...h,
                points: h.points.map(pt => ({
                  x: pt.x,
                  y: shiftY + pt.y * (straightTopD / outerD)
                }))
              });
            }
          }
          return mortises;
        },
        livingHingeData: {
          paths: lattice.paths,
          cutLengthMm: lattice.cutLengthMm,
          meta: {
            straightBackH,
            arcLength: hingePhysics.arcLength,
            straightTopD,
            bendRadius: clampedHingeR,
            physics: hingePhysics
          }
        },
        scoreAnnotations: [
          {
            type: 'label',
            text: `HINGE R=${clampedHingeR.toFixed(0)}mm (${hingePhysics.numCols} links)`,
            x: outerW * 0.5,
            y: straightBackH + hingePhysics.arcLength + straightTopD * 0.5
          }
        ],
        kinematics: {
          role: 'living-hinge-wrap',
          straightBackH,
          arcLength: hingePhysics.arcLength,
          straightTopD,
          bendRadius: clampedHingeR
        }
      })
    );

    // LEFT Wall with rounded R top-back corner
    panels.push(
      createPanelRecord({
        id: 'left',
        name: 'Left Side Wall (Curved R Profile)',
        code: 'LEFT',
        W: outerD,
        H: outerH,
        customBuildFn: (delta) =>
          buildLivingHingeSideWallOutline({
            D: outerD,
            H: outerH,
            t,
            R: clampedHingeR,
            side: 'left',
            fingerWidth,
            kerfDelta: delta,
            isTSlot,
            hardware
          }),
        extraHolesFn: (delta) => {
          const mortises = [];
          const slotThick = Math.max(0.6, t - 2 * delta);
          const lugH = Math.max(2, divLugHeight - 2 * delta);
          const centerY = t + innerH * 0.5;
          for (const yPos of divYPositions) {
            mortises.push(makeRectHole(outerD - yPos, centerY, slotThick, lugH));
          }
          return mortises;
        },
        kinematics: {
          role: 'wall-left',
          hingeAngleRad: Math.PI / 2
        }
      })
    );

    // RIGHT Wall with rounded R top-back corner
    panels.push(
      createPanelRecord({
        id: 'right',
        name: 'Right Side Wall (Curved R Profile)',
        code: 'RIGHT',
        W: outerD,
        H: outerH,
        customBuildFn: (delta) =>
          buildLivingHingeSideWallOutline({
            D: outerD,
            H: outerH,
            t,
            R: clampedHingeR,
            side: 'right',
            fingerWidth,
            kerfDelta: delta,
            isTSlot,
            hardware
          }),
        extraHolesFn: (delta) => {
          const mortises = [];
          const slotThick = Math.max(0.6, t - 2 * delta);
          const lugH = Math.max(2, divLugHeight - 2 * delta);
          const centerY = t + innerH * 0.5;
          for (const yPos of divYPositions) {
            mortises.push(makeRectHole(yPos, centerY, slotThick, lugH));
          }
          return mortises;
        },
        kinematics: {
          role: 'wall-right',
          hingeAngleRad: Math.PI / 2
        }
      })
    );
  } else {
    // STANDARD RIGID BACK, LEFT, RIGHT, TOP PANELS
    panels.push(
      createPanelRecord({
        id: 'back',
        name: 'Back Wall',
        code: 'BACK',
        W: outerW,
        H: outerH,
        edgesConfig: {
          bottom: { polarity: 'female', cornerStyle: 'corner-flush' },
          right:  { polarity: 'male',   cornerStyle: 'corner-recessed' },
          top:    hasTop
            ? { polarity: 'female', cornerStyle: 'corner-flush' }
            : { polarity: 'flat',   cornerStyle: 'corner-recessed', thumbNotch: false },
          left:   { polarity: 'male',   cornerStyle: 'corner-recessed' }
        },
        extraHolesFn: (delta) => {
          const mortises = [];
          const slotThick = Math.max(0.6, t - 2 * delta);
          const lugH = Math.max(2, divLugHeight - 2 * delta);
          const centerY = t + innerH * 0.5;
          for (const xPos of divXPositions) {
            mortises.push(makeRectHole(outerW - xPos, centerY, slotThick, lugH));
          }
          return mortises;
        },
        kinematics: {
          role: 'wall-back',
          hingeAngleRad: Math.PI / 2
        }
      })
    );

    panels.push(
      createPanelRecord({
        id: 'left',
        name: 'Left Side Wall',
        code: 'LEFT',
        W: outerD,
        H: outerH,
        edgesConfig: {
          bottom: { polarity: 'female', cornerStyle: 'corner-recessed' },
          right:  { polarity: 'female', cornerStyle: 'corner-recessed' },
          top:    hasTop
            ? { polarity: 'female', cornerStyle: 'corner-recessed' }
            : { polarity: 'flat',   cornerStyle: 'corner-recessed', thumbNotch: false },
          left:   { polarity: 'female', cornerStyle: 'corner-recessed' }
        },
        extraHolesFn: (delta) => {
          const mortises = [];
          const slotThick = Math.max(0.6, t - 2 * delta);
          const lugH = Math.max(2, divLugHeight - 2 * delta);
          const centerY = t + innerH * 0.5;
          for (const yPos of divYPositions) {
            mortises.push(makeRectHole(outerD - yPos, centerY, slotThick, lugH));
          }
          return mortises;
        },
        kinematics: {
          role: 'wall-left',
          hingeAngleRad: Math.PI / 2
        }
      })
    );

    panels.push(
      createPanelRecord({
        id: 'right',
        name: 'Right Side Wall',
        code: 'RIGHT',
        W: outerD,
        H: outerH,
        edgesConfig: {
          bottom: { polarity: 'female', cornerStyle: 'corner-recessed' },
          right:  { polarity: 'female', cornerStyle: 'corner-recessed' },
          top:    hasTop
            ? { polarity: 'female', cornerStyle: 'corner-recessed' }
            : { polarity: 'flat',   cornerStyle: 'corner-recessed', thumbNotch: false },
          left:   { polarity: 'female', cornerStyle: 'corner-recessed' }
        },
        extraHolesFn: (delta) => {
          const mortises = [];
          const slotThick = Math.max(0.6, t - 2 * delta);
          const lugH = Math.max(2, divLugHeight - 2 * delta);
          const centerY = t + innerH * 0.5;
          for (const yPos of divYPositions) {
            mortises.push(makeRectHole(yPos, centerY, slotThick, lugH));
          }
          return mortises;
        },
        kinematics: {
          role: 'wall-right',
          hingeAngleRad: Math.PI / 2
        }
      })
    );

    if (hasTop) {
      panels.push(
        createPanelRecord({
          id: 'top',
          name: boxStyle === 'hinged-top' ? 'Hinged Top Lid' : 'Top Enclosure Plate',
          code: 'TOP',
          W: outerW,
          H: outerD,
          edgesConfig: {
            bottom: { polarity: 'male', cornerStyle: 'corner-recessed' },
            right:  { polarity: 'male', cornerStyle: 'corner-recessed' },
            top:    { polarity: 'male', cornerStyle: 'corner-recessed' },
            left:   { polarity: 'male', cornerStyle: 'corner-recessed' }
          },
          kinematics: {
            role: 'top-lid',
            hingeAngleRad: Math.PI / 2
          }
        })
      );
    }
  }

  // 7. INTERNAL DIVIDERS (X-Axis & Y-Axis Egg-Crate Grid)
  const buildDividerContour = ({ span, heightVal, floorLugW, wallLugH, crossSlots, slotFromTop, delta }) => {
    const totalW = span + 2 * t;
    const divH = isLivingHinge ? Math.max(t * 3, heightVal - clampedHingeR * 0.35) : heightVal;
    const totalH = divH + t;
    const lugHalfH = wallLugH * 0.5 + delta;
    const floorHalfW = floorLugW * 0.5 + delta;
    const midY = t + heightVal * 0.5;
    const midX = totalW * 0.5;

    const pts = [];
    const add = (x, y) => pts.push({ x, y });

    add(t, t - delta);
    add(midX - floorHalfW, t - delta);
    add(midX - floorHalfW, -delta);
    add(midX + floorHalfW, -delta);
    add(midX + floorHalfW, t - delta);

    if (!slotFromTop && crossSlots.length > 0) {
      const sorted = [...crossSlots].sort((a, b) => a - b);
      const halfSlot = Math.max(0.5, t * 0.5 - delta);
      const slotTopY = t + divH * 0.5 + delta;
      for (const sx of sorted) {
        add(sx - halfSlot, t - delta);
        add(sx - halfSlot, slotTopY);
        add(sx + halfSlot, slotTopY);
        add(sx + halfSlot, t - delta);
      }
    }

    add(totalW - t, t - delta);
    add(totalW - t, midY - lugHalfH);
    add(totalW + delta, midY - lugHalfH);
    add(totalW + delta, midY + lugHalfH);
    add(totalW - t, midY + lugHalfH);
    add(totalW - t, totalH + delta);

    if (slotFromTop && crossSlots.length > 0) {
      const sortedDesc = [...crossSlots].sort((a, b) => b - a);
      const halfSlot = Math.max(0.5, t * 0.5 - delta);
      const slotBotY = t + divH * 0.5 - delta;
      for (const sx of sortedDesc) {
        add(sx + halfSlot, totalH + delta);
        add(sx + halfSlot, slotBotY);
        add(sx - halfSlot, slotBotY);
        add(sx - halfSlot, totalH + delta);
      }
    }

    add(t, totalH + delta);
    add(t, midY + lugHalfH);
    add(-delta, midY + lugHalfH);
    add(-delta, midY - lugHalfH);
    add(t, midY - lugHalfH);

    return {
      outline: pts,
      W: totalW,
      H: totalH
    };
  };

  divXPositions.forEach((xPos, idx) => {
    const comp = buildDividerContour({
      span: innerD,
      heightVal: innerH,
      floorLugW: divFloorLugWidth,
      wallLugH: divLugHeight,
      crossSlots: divYPositions,
      slotFromTop: true,
      delta: kerfDelta
    });
    const nom = buildDividerContour({
      span: innerD,
      heightVal: innerH,
      floorLugW: divFloorLugWidth,
      wallLugH: divLugHeight,
      crossSlots: divYPositions,
      slotFromTop: true,
      delta: 0
    });
    panels.push({
      id: `div-x-${idx + 1}`,
      name: `Internal Divider X${idx + 1}`,
      code: `DIV-X${idx + 1}`,
      width: comp.W,
      height: comp.H,
      thickness: t,
      outline: comp.outline,
      nominalOutline: nom.outline,
      holes: [],
      nominalHoles: [],
      livingHingePaths: [],
      scorePaths: [],
      scoreAnnotations: [
        {
          type: 'label',
          text: `DIV-X${idx + 1}`,
          x: comp.W * 0.5,
          y: comp.H * 0.3
        }
      ],
      cutLengthMm: computePolygonLength(comp.outline, true),
      kinematics: {
        role: 'divider-x',
        xOffset: xPos,
        index: idx
      }
    });
  });

  divYPositions.forEach((yPos, idx) => {
    const comp = buildDividerContour({
      span: innerW,
      heightVal: innerH,
      floorLugW: divFloorLugWidthX,
      wallLugH: divLugHeight,
      crossSlots: divXPositions,
      slotFromTop: false,
      delta: kerfDelta
    });
    const nom = buildDividerContour({
      span: innerW,
      heightVal: innerH,
      floorLugW: divFloorLugWidthX,
      wallLugH: divLugHeight,
      crossSlots: divXPositions,
      slotFromTop: false,
      delta: 0
    });
    panels.push({
      id: `div-y-${idx + 1}`,
      name: `Internal Divider Y${idx + 1}`,
      code: `DIV-Y${idx + 1}`,
      width: comp.W,
      height: comp.H,
      thickness: t,
      outline: comp.outline,
      nominalOutline: nom.outline,
      holes: [],
      nominalHoles: [],
      livingHingePaths: [],
      scorePaths: [],
      scoreAnnotations: [
        {
          type: 'label',
          text: `DIV-Y${idx + 1}`,
          x: comp.W * 0.5,
          y: comp.H * 0.72
        }
      ],
      cutLengthMm: computePolygonLength(comp.outline, true),
      kinematics: {
        role: 'divider-y',
        yOffset: yPos,
        index: idx
      }
    });
  });

  // 8. 2D LASER BED AUTO-NESTING
  const nesting = packPanelsOnBed(panels, bedWidth, bedHeight, partSpacing);

  // 9. MANUFACTURING TELEMETRY
  const totalCutLengthMm = panels.reduce((acc, p) => acc + p.cutLengthMm, 0);
  const totalCutTimeSec = totalCutLengthMm / Math.max(1, cutSpeed);
  const totalFasteners = isTSlot
    ? panels.reduce((acc, p) => acc + p.holes.filter(h => h.type === 'circle').length, 0)
    : 0;

  return {
    dimensions: {
      outerW,
      outerD,
      outerH,
      innerW,
      innerD,
      innerH,
      thickness: t,
      kerf,
      fitInterference,
      kerfDelta
    },
    hingePhysics,
    panels,
    nesting,
    telemetry: {
      panelCount: panels.length,
      totalCutLengthMm,
      totalCutTimeSec,
      totalFasteners,
      cutoutCount: panelCutouts.length,
      hardwareSpec: isTSlot ? hardware.label : 'None (Self-locking Finger Joints)',
      materialUtilizationPct: nesting.utilizationPct,
      fitsOnBed: nesting.fitsOnBed
    }
  };
}

/**
 * Shelf First-Fit Decreasing (FFD) 2D Nesting Engine
 */
export function packPanelsOnBed(panels, bedWidth, bedHeight, spacing = 5) {
  const margin = Math.max(4, spacing);
  let cursorX = margin;
  let cursorY = margin;
  let shelfHeight = 0;
  let maxUsedX = 0;
  let maxUsedY = 0;
  let totalPanelArea = 0;
  let fitsOnBed = true;

  const placements = [];

  for (const panel of panels) {
    const pw = panel.width;
    const ph = panel.height;
    totalPanelArea += pw * ph;

    if (cursorX + pw + margin > bedWidth && cursorX > margin) {
      cursorX = margin;
      cursorY += shelfHeight + spacing;
      shelfHeight = 0;
    }

    const x = cursorX;
    const y = cursorY;
    const overflow = (x + pw + margin > bedWidth) || (y + ph + margin > bedHeight);
    if (overflow) fitsOnBed = false;

    placements.push({
      panelId: panel.id,
      x,
      y,
      width: pw,
      height: ph,
      overflow
    });

    panel.bedPosition = { x, y, overflow };

    cursorX += pw + spacing;
    shelfHeight = Math.max(shelfHeight, ph);
    maxUsedX = Math.max(maxUsedX, x + pw + margin);
    maxUsedY = Math.max(maxUsedY, y + ph + margin);
  }

  const boundingArea = Math.max(1, maxUsedX * maxUsedY);
  const bedArea = Math.max(1, bedWidth * bedHeight);
  const utilizationPct = Math.min(100, (totalPanelArea / boundingArea) * 100);
  const bedUsagePct = Math.min(100, (totalPanelArea / bedArea) * 100);

  return {
    bedWidth,
    bedHeight,
    spacing,
    placements,
    boundingWidth: maxUsedX,
    boundingHeight: maxUsedY,
    utilizationPct,
    bedUsagePct,
    fitsOnBed
  };
}
