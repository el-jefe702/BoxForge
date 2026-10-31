/**
 * BoxForge Pro — Production AutoCAD R12/2000 ASCII DXF Exporter
 * Generates universally compatible DXF files with standard laser CAD/CAM layers:
 *  - 0_OUTER_CUT   (Color: 7 White/Black) - Perimeter cuts
 *  - 1_INNER_CUT   (Color: 5 Blue)        - Cutouts & mortises
 *  - 2_LIVING_HINGE (Color: 1 Red)        - Living hinge lattice
 *  - 3_VECTOR_SCORE (Color: 3 Green)      - Witness marks & labels
 */

export function generateProductionDXF(model, options = {}) {
  const { kerfMode = 'baked' } = options;
  const isLayerKerf = kerfMode === 'lightburn-layer';

  const lines = [];
  const add = (code, val) => {
    lines.push(typeof code === 'number' ? code.toString() : code);
    lines.push(val.toString());
  };

  // 1. HEADER SECTION (Units = mm, AutoCAD R12)
  add(0, 'SECTION');
  add(2, 'HEADER');
  add(9, '$ACADVER');
  add(1, 'AC1009'); // AutoCAD R12 ASCII standard
  add(9, '$INSUNITS');
  add(70, 4);      // Millimeters
  add(0, 'ENDSEC');

  // 2. TABLES SECTION (Standard Layers)
  add(0, 'SECTION');
  add(2, 'TABLES');
  add(0, 'TABLE');
  add(2, 'LAYER');
  add(70, 4);

  const layers = [
    { name: '0_OUTER_CUT', color: 7 },
    { name: '1_INNER_CUT', color: 5 },
    { name: '2_LIVING_HINGE', color: 1 },
    { name: '3_VECTOR_SCORE', color: 3 }
  ];

  for (const l of layers) {
    add(0, 'LAYER');
    add(2, l.name);
    add(70, 0);
    add(62, l.color);
    add(6, 'CONTINUOUS');
  }

  add(0, 'ENDTAB');
  add(0, 'ENDSEC');

  // 3. ENTITIES SECTION
  add(0, 'SECTION');
  add(2, 'ENTITIES');

  const emitPolyline = (pts, offsetX, offsetY, layerName, closed = true) => {
    if (!pts || pts.length < 2) return;

    // Use lightweight 2-point LINE entities or full POLYLINE
    add(0, 'POLYLINE');
    add(8, layerName);
    add(66, 1); // Vertices follow flag
    add(70, closed ? 1 : 0); // 1 = closed polygon, 0 = open path

    for (const p of pts) {
      add(0, 'VERTEX');
      add(8, layerName);
      add(10, (p.x + offsetX).toFixed(4));
      add(20, -(p.y + offsetY).toFixed(4)); // DXF +Y is upward, SVG/Screen +Y is downward
      add(30, '0.0000');
    }

    add(0, 'SEQEND');
    add(8, layerName);
  };

  const emitCircle = (cx, cy, radius, layerName) => {
    add(0, 'CIRCLE');
    add(8, layerName);
    add(10, cx.toFixed(4));
    add(20, (-cy).toFixed(4));
    add(30, '0.0000');
    add(40, radius.toFixed(4));
  };

  const emitText = (text, cx, cy, height, layerName) => {
    add(0, 'TEXT');
    add(8, layerName);
    add(10, cx.toFixed(4));
    add(20, (-cy).toFixed(4));
    add(30, '0.0000');
    add(40, height.toFixed(4));
    add(1, text);
    add(72, 1); // Horizontally centered
    add(11, cx.toFixed(4));
    add(21, (-cy).toFixed(4));
    add(31, '0.0000');
  };

  for (const panel of model.panels) {
    const ox = panel.bedPosition?.x ?? 0;
    const oy = panel.bedPosition?.y ?? 0;

    // Vector Score labels & silkscreens (3_VECTOR_SCORE)
    for (const ann of panel.scoreAnnotations || []) {
      emitText(ann.text, ox + ann.x, oy + ann.y, 3.5, '3_VECTOR_SCORE');
    }
    for (const sp of panel.scorePaths || []) {
      emitPolyline(sp.points, ox, oy, '3_VECTOR_SCORE', sp.closed !== false);
    }

    // Living Hinge Lattice (2_LIVING_HINGE)
    for (const lhp of panel.livingHingePaths || []) {
      emitPolyline(lhp.points, ox, oy, '2_LIVING_HINGE', Boolean(lhp.closed));
    }

    // Inner Cutouts & Mortises (1_INNER_CUT)
    const holesToExport = isLayerKerf && panel.nominalHoles ? panel.nominalHoles : panel.holes;
    for (const h of holesToExport) {
      if (h.type === 'circle') {
        emitCircle(ox + h.x, oy + h.y, h.radius, '1_INNER_CUT');
      } else if (h.points) {
        emitPolyline(h.points, ox, oy, '1_INNER_CUT', true);
      }
    }

    // Outer Perimeter Cut (0_OUTER_CUT)
    const outlineToExport = isLayerKerf && panel.nominalOutline ? panel.nominalOutline : panel.outline;
    emitPolyline(outlineToExport, ox, oy, '0_OUTER_CUT', true);
  }

  add(0, 'ENDSEC');
  add(0, 'EOF');

  return lines.join('\r\n') + '\r\n';
}
