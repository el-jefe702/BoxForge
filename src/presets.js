/**
 * BoxForge Pro — Machine, Material & Fastener Presets
 * Phase 1: Parametric Core & 3D Fold Viewport
 */

export const LASER_MACHINES = [
  {
    id: 'co2-80w',
    name: '80W CO2 Industrial Laser (Ruida)',
    type: 'CO2',
    wattage: 80,
    bedWidth: 700,
    bedHeight: 500,
    baseKerf: 0.16,
    cutSpeedMultiplier: 1.25,
    description: '2.0" ZnSe lens, standard air assist'
  },
  {
    id: 'co2-50w',
    name: '50W CO2 Desktop (xTool P2 / OMTech)',
    type: 'CO2',
    wattage: 50,
    bedWidth: 600,
    bedHeight: 305,
    baseKerf: 0.14,
    cutSpeedMultiplier: 1.0,
    description: '1.5" lens, fine beam waist for tight joinery'
  },
  {
    id: 'diode-20w',
    name: '20W Quad-Diode (xTool S1 / Sculpfun)',
    type: 'Diode',
    wattage: 20,
    bedWidth: 498,
    bedHeight: 319,
    baseKerf: 0.11,
    cutSpeedMultiplier: 0.45,
    description: '0.08x0.10mm rectangular spot, slower speed, narrow kerf'
  },
  {
    id: 'diode-40w',
    name: '40W High-Power Diode Module',
    type: 'Diode',
    wattage: 40,
    bedWidth: 450,
    bedHeight: 450,
    baseKerf: 0.15,
    cutSpeedMultiplier: 0.75,
    description: '8-diode combined array, slightly wider spot'
  }
];

export const MATERIALS = [
  {
    id: 'baltic-birch-3mm',
    name: '3mm Baltic Birch Plywood (1/8")',
    category: 'Plywood',
    nominalThickness: 3.0,
    caliperThickness: 2.92,
    kerfMultiplier: 1.0,
    cutSpeed: 22,     // mm/s @ 50W CO2
    cutPower: 75,     // %
    scoreSpeed: 120,  // mm/s
    scorePower: 18,   // %
    faceColor: 0xd9b382,
    edgeColor: 0x3b2313,
    roughness: 0.72,
    metalness: 0.02,
    opacity: 1.0,
    transparent: false
  },
  {
    id: 'baltic-birch-6mm',
    name: '6mm Baltic Birch Plywood (1/4")',
    category: 'Plywood',
    nominalThickness: 6.0,
    caliperThickness: 5.85,
    kerfMultiplier: 1.25,
    cutSpeed: 11,
    cutPower: 88,
    scoreSpeed: 120,
    scorePower: 20,
    faceColor: 0xd1a773,
    edgeColor: 0x2e190b,
    roughness: 0.75,
    metalness: 0.02,
    opacity: 1.0,
    transparent: false
  },
  {
    id: 'acrylic-cast-3mm',
    name: '3mm Cast Acrylic (Matte Smoke Black)',
    category: 'Acrylic',
    nominalThickness: 3.0,
    caliperThickness: 3.12,
    kerfMultiplier: 1.15,
    cutSpeed: 16,
    cutPower: 80,
    scoreSpeed: 140,
    scorePower: 15,
    faceColor: 0x262930,
    edgeColor: 0x15171c,
    roughness: 0.18,
    metalness: 0.15,
    opacity: 0.92,
    transparent: true
  },
  {
    id: 'acrylic-clear-3mm',
    name: '3mm Cast Acrylic (Frosted Cyan)',
    category: 'Acrylic',
    nominalThickness: 3.0,
    caliperThickness: 3.08,
    kerfMultiplier: 1.15,
    cutSpeed: 16,
    cutPower: 80,
    scoreSpeed: 140,
    scorePower: 15,
    faceColor: 0x38bdf8,
    edgeColor: 0x0284c7,
    roughness: 0.15,
    metalness: 0.1,
    opacity: 0.74,
    transparent: true
  },
  {
    id: 'walnut-veneered-3mm',
    name: '3.2mm American Black Walnut MDF Core',
    category: 'Hardwood',
    nominalThickness: 3.2,
    caliperThickness: 3.18,
    kerfMultiplier: 1.05,
    cutSpeed: 20,
    cutPower: 78,
    scoreSpeed: 115,
    scorePower: 19,
    faceColor: 0x6e472b,
    edgeColor: 0x241409,
    roughness: 0.58,
    metalness: 0.04,
    opacity: 1.0,
    transparent: false
  },
  {
    id: 'mdf-draftboard-3mm',
    name: '3mm Laser Draftboard / LDF',
    category: 'MDF',
    nominalThickness: 3.0,
    caliperThickness: 3.02,
    kerfMultiplier: 0.95,
    cutSpeed: 24,
    cutPower: 72,
    scoreSpeed: 130,
    scorePower: 16,
    faceColor: 0xb8966c,
    edgeColor: 0x291a0d,
    roughness: 0.85,
    metalness: 0.0,
    opacity: 1.0,
    transparent: false
  }
];

export const FIT_PRESETS = {
  friction: {
    id: 'friction',
    name: 'Friction / Press-Fit (No Glue)',
    interferenceMm: 0.04,
    description: 'Adds +0.04mm tight interference past full kerf compensation for mallet/hand press assembly.'
  },
  neutral: {
    id: 'neutral',
    name: 'Glue / Line-to-Line Fit',
    interferenceMm: 0.0,
    description: 'Exact 100% kerf compensation (zero play, zero interference). Ideal for wood glue or solvent weld.'
  },
  slip: {
    id: 'slip',
    name: 'Slip / Dry-Fit (Removable Panels)',
    interferenceMm: -0.08,
    description: 'Leaves 0.08mm clearance for easy hand disassembly or painted parts.'
  }
};

export const TSLOT_HARDWARE = {
  M2: {
    id: 'M2',
    label: 'M2 × 10mm Socket Screw + Hex Nut',
    screwDiameter: 2.15,
    screwLength: 10.0,
    nutWidth: 4.1,      // across flats (4.0mm nominal + clearance)
    nutThickness: 1.65  // 1.6mm nominal + clearance
  },
  'M2.5': {
    id: 'M2.5',
    label: 'M2.5 × 12mm Socket Screw + Hex Nut',
    screwDiameter: 2.65,
    screwLength: 12.0,
    nutWidth: 5.1,      // 5.0mm nominal
    nutThickness: 2.1   // 2.0mm nominal
  },
  M3: {
    id: 'M3',
    label: 'M3 × 12mm Socket Screw + Hex Nut',
    screwDiameter: 3.15,
    screwLength: 12.0,
    nutWidth: 5.62,     // 5.5mm DIN 934 nominal + clearance
    nutThickness: 2.5   // 2.4mm nominal + clearance
  },
  '4-40': {
    id: '4-40',
    label: '#4-40 × 1/2" Machine Screw + Hex Nut',
    screwDiameter: 2.95,
    screwLength: 12.7,
    nutWidth: 6.45,     // 1/4" across flats
    nutThickness: 2.48
  }
};
