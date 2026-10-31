/**
 * BoxForge Pro — Native LightBurn (.lbrn2) & Production SVG Exporter (Phase 1, 2 & 3A)
 * Outputs clean closed & open paths with pre-assigned LightBurn CutSettings:
 *  - Layer C00 (Black): Outer Perimeter Cut (Priority 4 - Last)
 *  - Layer C01 (Blue):  Inner Cutouts & Mortises (Priority 3 - Third)
 *  - Layer C02 (Red):   Living Hinge Lattice Slits (Priority 2 - Second, anti-char tuning)
 *  - Layer C03 (Green): Vector Score Part Labels & Silkscreen Guides (Priority 1 - First)
 *
 * Supports Dual Kerf Compensation Mode:
 *  - 'baked': Kerf is directly offset into the CAD vertices; LightBurn <kerf Value="0.0000"/>
 *  - 'lightburn-layer': Nominal CAD paths exported; LightBurn native <kerf Value="..."/> layer tag applied
 */

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildLbrnPathShape(pts, offsetX, offsetY, cutIndex, closed = true) {
  if (!pts || pts.length < 2) return '';
  const vertStrings = pts
    .map(p => `V${(p.x + offsetX).toFixed(4)} ${(p.y + offsetY).toFixed(4)}c0x1c1x1`)
    .join('');

  const primStrings = [];
  const limit = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < limit; i++) {
    const next = (i + 1) % pts.length;
    primStrings.push(`L${i} ${next}`);
  }

  return `    <Shape Type="Path" CutIndex="${cutIndex}">
      <XForm>1 0 0 1 0 0</XForm>
      <VertList>${vertStrings}</VertList>
      <PrimList>${primStrings.join('')}</PrimList>
    </Shape>`;
}

function buildLbrnEllipseShape(cx, cy, radius, cutIndex) {
  return `    <Shape Type="Ellipse" CutIndex="${cutIndex}" Rx="${radius.toFixed(4)}" Ry="${radius.toFixed(4)}">
      <XForm>1 0 0 1 ${cx.toFixed(4)} ${cy.toFixed(4)}</XForm>
    </Shape>`;
}

function buildLbrnTextShape(text, cx, cy, cutIndex, heightMm = 4.5) {
  return `    <Shape Type="Text" CutIndex="${cutIndex}" Font="Arial,-1,100,5,50,0,0,0,0,0" Str="${escapeXml(text)}" H="${heightMm.toFixed(2)}" Ah="1" Av="1">
      <XForm>1 0 0 1 ${cx.toFixed(4)} ${cy.toFixed(4)}</XForm>
    </Shape>`;
}

/**
 * Generate a complete LightBurn .lbrn2 XML string from the parametric model
 *
 * @param {object} model - Parametric enclosure model
 * @param {object} materialPreset - Material properties
 * @param {object} machinePreset - Laser machine specs
 * @param {object} options - Export options { kerfMode: 'baked' | 'lightburn-layer' }
 */
export function generateLightBurnLbrn2(model, materialPreset, machinePreset, options = {}) {
  const { kerfMode = 'baked' } = options;
  const isLayerKerf = kerfMode === 'lightburn-layer';

  const baseCutSpeed = (materialPreset?.cutSpeed ?? 20) * (machinePreset?.cutSpeedMultiplier ?? 1);
  const cutSpeed = baseCutSpeed.toFixed(1);
  const cutPower = (materialPreset?.cutPower ?? 75).toFixed(1);
  const hingeSpeed = (baseCutSpeed * 1.15).toFixed(1);
  const hingePower = Math.max(15, (materialPreset?.cutPower ?? 75) - 4).toFixed(1);
  const scoreSpeed = (materialPreset?.scoreSpeed ?? 120).toFixed(1);
  const scorePower = (materialPreset?.scorePower ?? 18).toFixed(1);

  const { kerfDelta } = model.dimensions;
  // If lightburn-layer kerf mode: Layer C00 gets +kerfDelta (expands outer contour)
  // and Layer C01 gets -kerfDelta (shrinks inner holes)
  const layerC00KerfVal = isLayerKerf ? kerfDelta.toFixed(4) : '0.0000';
  const layerC01KerfVal = isLayerKerf ? (-kerfDelta).toFixed(4) : '0.0000';

  const shapesXml = [];

  for (const panel of model.panels) {
    const ox = panel.bedPosition?.x ?? 0;
    const oy = panel.bedPosition?.y ?? 0;

    // 1. Score annotations & silkscreen frames (CutIndex = 3 -> Green Score Layer, Priority 1)
    for (const ann of panel.scoreAnnotations || []) {
      shapesXml.push(buildLbrnTextShape(ann.text, ox + ann.x, oy + ann.y, 3, 4.2));
    }
    for (const sp of panel.scorePaths || []) {
      shapesXml.push(buildLbrnPathShape(sp.points, ox, oy, 3, sp.closed !== false));
    }

    // 2. Living Hinge Lattice Slits (CutIndex = 2 -> Red Hinge Layer, Priority 2)
    for (const lhp of panel.livingHingePaths || []) {
      shapesXml.push(buildLbrnPathShape(lhp.points, ox, oy, 2, Boolean(lhp.closed)));
    }

    // 3. Inner holes & mortises (CutIndex = 1 -> Blue Inner Cut Layer, Priority 3)
    const holesToExport = isLayerKerf && panel.nominalHoles ? panel.nominalHoles : panel.holes;
    for (const h of holesToExport) {
      if (h.type === 'circle') {
        shapesXml.push(buildLbrnEllipseShape(ox + h.x, oy + h.y, h.radius, 1));
      } else if (h.points) {
        shapesXml.push(buildLbrnPathShape(h.points, ox, oy, 1, true));
      }
    }

    // 4. Outer perimeter contour (CutIndex = 0 -> Black Outer Cut Layer, Priority 4)
    const outlineToExport = isLayerKerf && panel.nominalOutline ? panel.nominalOutline : panel.outline;
    shapesXml.push(buildLbrnPathShape(outlineToExport, ox, oy, 0, true));
  }

  const { outerW, outerD, outerH, thickness, kerf } = model.dimensions;
  const noteText = `Generated by BoxForge Pro | Outer: ${outerW.toFixed(1)}x${outerD.toFixed(1)}x${outerH.toFixed(1)}mm | Caliper t=${thickness}mm | Kerf=${kerf}mm | Mode=${kerfMode} (δ=${(kerfDelta >= 0 ? '+' : '')}${kerfDelta.toFixed(3)}mm)`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<LightBurnProject AppVersion="1.6.00" FormatVersion="1" MaterialHeight="${thickness.toFixed(2)}" MirrorX="False" MirrorY="False">
  <Notes ShowOnLoad="0" Notes="${escapeXml(noteText)}"/>
  <CutSetting type="Cut">
    <index Value="0"/>
    <name Value="C00 - Outer Perimeter Cut"/>
    <minPower Value="${Math.max(10, cutPower - 10)}"/>
    <maxPower Value="${cutPower}"/>
    <speed Value="${cutSpeed}"/>
    <kerf Value="${layerC00KerfVal}"/>
    <priority Value="4"/>
    <numPasses Value="1"/>
  </CutSetting>
  <CutSetting type="Cut">
    <index Value="1"/>
    <name Value="C01 - Inner Cutouts &amp; Mortises"/>
    <minPower Value="${Math.max(10, cutPower - 10)}"/>
    <maxPower Value="${cutPower}"/>
    <speed Value="${cutSpeed}"/>
    <kerf Value="${layerC01KerfVal}"/>
    <priority Value="3"/>
    <numPasses Value="1"/>
  </CutSetting>
  <CutSetting type="Cut">
    <index Value="2"/>
    <name Value="C02 - Living Hinge Lattice (Low-Char)"/>
    <minPower Value="${Math.max(10, hingePower - 10)}"/>
    <maxPower Value="${hingePower}"/>
    <speed Value="${hingeSpeed}"/>
    <kerf Value="0.0000"/>
    <priority Value="2"/>
    <numPasses Value="1"/>
  </CutSetting>
  <CutSetting type="Cut">
    <index Value="3"/>
    <name Value="C03 - Vector Score Labels &amp; Silkscreens"/>
    <minPower Value="${scorePower}"/>
    <maxPower Value="${scorePower}"/>
    <speed Value="${scoreSpeed}"/>
    <kerf Value="0.0000"/>
    <priority Value="1"/>
    <numPasses Value="1"/>
  </CutSetting>
  <Shape Type="Group">
    <XForm>1 0 0 1 0 0</XForm>
    <Children>
${shapesXml.join('\n')}
    </Children>
  </Shape>
</LightBurnProject>
`;
}

/**
 * Generate a 1-Minute Kerf Calibration Test Comb (.lbrn2)
 */
export function generateKerfCalibrationCombLbrn2(materialPreset, machinePreset) {
  const t = materialPreset?.caliperThickness ?? 3.0;
  const offsets = [-0.05, 0.0, 0.05, 0.10, 0.14, 0.18, 0.22];
  const combW = 92;
  const combH = 28;
  const slotDepth = 14;

  const pts = [{ x: 0, y: 0 }, { x: combW, y: 0 }, { x: combW, y: combH }];
  const startX = 12;
  const stepX = 11;

  for (let i = offsets.length - 1; i >= 0; i--) {
    const cx = startX + i * stepX;
    const slotW = Math.max(0.8, t - offsets[i]);
    const hw = slotW * 0.5;
    pts.push({ x: cx + hw, y: combH });
    pts.push({ x: cx + hw, y: combH - slotDepth });
    pts.push({ x: cx - hw, y: combH - slotDepth });
    pts.push({ x: cx - hw, y: combH });
  }
  pts.push({ x: 0, y: combH });

  const labelsXml = offsets.map((off, i) => {
    const cx = startX + i * stepX;
    const sign = off >= 0 ? `+${off.toFixed(2)}` : off.toFixed(2);
    return buildLbrnTextShape(sign, cx, combH - slotDepth - 4.5, 3, 2.6);
  });

  labelsXml.push(
    buildLbrnTextShape(`BOXFORGE KERF COMB (t=${t.toFixed(2)}mm)`, combW * 0.5, 5.5, 3, 3.2)
  );

  const cutSpeed = ((materialPreset?.cutSpeed ?? 20) * (machinePreset?.cutSpeedMultiplier ?? 1)).toFixed(1);
  const cutPower = (materialPreset?.cutPower ?? 75).toFixed(1);

  return `<?xml version="1.0" encoding="UTF-8"?>
<LightBurnProject AppVersion="1.6.00" FormatVersion="1" MaterialHeight="${t.toFixed(2)}" MirrorX="False" MirrorY="False">
  <Notes ShowOnLoad="1" Notes="Cut two copies and press the reference tab into each slot. Enter the best-fitting slot number (+mm) as your Kerf in BoxForge Pro."/>
  <CutSetting type="Cut">
    <index Value="0"/>
    <name Value="C00 - Comb Perimeter Cut"/>
    <maxPower Value="${cutPower}"/>
    <speed Value="${cutSpeed}"/>
    <kerf Value="0.0000"/>
    <priority Value="2"/>
  </CutSetting>
  <CutSetting type="Cut">
    <index Value="3"/>
    <name Value="C03 - Slot Labels Score"/>
    <maxPower Value="18"/>
    <speed Value="120"/>
    <kerf Value="0.0000"/>
    <priority Value="1"/>
  </CutSetting>
  <Shape Type="Group">
    <XForm>1 0 0 1 0 0</XForm>
    <Children>
${labelsXml.join('\n')}
${buildLbrnPathShape(pts, 0, 0, 0, true)}
    </Children>
  </Shape>
</LightBurnProject>
`;
}

/**
 * Generate clean millimeter-accurate SVG string
 */
export function generateCleanSVG(model) {
  const { boundingWidth, boundingHeight } = model.nesting;
  const svgW = Math.ceil(boundingWidth + 10);
  const svgH = Math.ceil(boundingHeight + 10);

  const elements = [];

  for (const panel of model.panels) {
    const ox = panel.bedPosition?.x ?? 0;
    const oy = panel.bedPosition?.y ?? 0;

    // Score labels & silkscreens (#00aa00)
    for (const ann of panel.scoreAnnotations || []) {
      elements.push(
        `  <text x="${(ox + ann.x).toFixed(3)}" y="${(oy + ann.y).toFixed(3)}" fill="#00aa00" font-family="monospace" font-size="4.2" text-anchor="middle" dominant-baseline="middle">${escapeXml(ann.text)}</text>`
      );
    }
    for (const sp of panel.scorePaths || []) {
      const d = sp.points
        .map((p, idx) => `${idx === 0 ? 'M' : 'L'}${(ox + p.x).toFixed(4)} ${(oy + p.y).toFixed(4)}`)
        .join(' ') + (sp.closed !== false ? ' Z' : '');
      elements.push(`  <path d="${d}" fill="none" stroke="#00aa00" stroke-width="0.15"/>`);
    }

    // Living Hinge Lattice Slits (#ff0000)
    for (const lhp of panel.livingHingePaths || []) {
      const d = lhp.points
        .map((p, idx) => `${idx === 0 ? 'M' : 'L'}${(ox + p.x).toFixed(4)} ${(oy + p.y).toFixed(4)}`)
        .join(' ') + (lhp.closed ? ' Z' : '');
      elements.push(`  <path d="${d}" fill="none" stroke="#ff0000" stroke-width="0.15"/>`);
    }

    // Inner cutouts (#0000ff)
    for (const h of panel.holes) {
      if (h.type === 'circle') {
        elements.push(
          `  <circle cx="${(ox + h.x).toFixed(3)}" cy="${(oy + h.y).toFixed(3)}" r="${h.radius.toFixed(4)}" fill="none" stroke="#0000ff" stroke-width="0.15"/>`
        );
      } else if (h.points) {
        const d = h.points
          .map((p, idx) => `${idx === 0 ? 'M' : 'L'}${(ox + p.x).toFixed(4)} ${(oy + p.y).toFixed(4)}`)
          .join(' ') + ' Z';
        elements.push(`  <path d="${d}" fill="none" stroke="#0000ff" stroke-width="0.15"/>`);
      }
    }

    // Outer cut contour (#000000)
    const dOut = panel.outline
      .map((p, idx) => `${idx === 0 ? 'M' : 'L'}${(ox + p.x).toFixed(4)} ${(oy + p.y).toFixed(4)}`)
      .join(' ') + ' Z';
    elements.push(`  <path id="${panel.id}" d="${dOut}" fill="none" stroke="#000000" stroke-width="0.15"/>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}mm" height="${svgH}mm" viewBox="0 0 ${svgW} ${svgH}">
  <!-- Generated by BoxForge Pro Parametric Enclosure Engine -->
${elements.join('\n')}
</svg>
`;
}

export function downloadFile(filename, content, mimeType = 'application/xml') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
