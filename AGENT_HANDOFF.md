# BoxForge Pro — Autonomous Agent Runbook & Handoff Specification

> **CRITICAL READ FOR INCOMING AI AGENTS:**
> Before running any commands or editing any files, read this entire runbook and inspect `STATE_CHECKPOINT.json`. This document is structured so that if a previous agent errored out, timed out, or ran out of credits mid-task, you can resume in under 30 seconds with zero wasted turns.

---

## 0. Mandatory Environment & Recovery Protocol

### A. System Environment Facts (DO NOT PROBE FOR NODE/NPM)
- **OS & Shell:** Windows PowerShell (`c:\Users\El Jefe\Desktop\BoxForge`)
- **Node / npm / bun / deno:** **NOT INSTALLED.** Never run `npm`, `node`, `npx`, or `vite` — they will fail with `CommandNotFoundException`.
- **Python 3.12 (`python`):** **INSTALLED AND AVAILABLE.** Use `python` for all verification scripts and local HTTP serving.
- **Application Architecture:** Zero-build native browser ES Modules (`<script type="module" src="./src/main.js">`). Three.js `0.169.0` is resolved via `<script type="importmap">` in `index.html`, and styling uses Tailwind CDN + inline rules in `index.html`.

### B. 3-Step Startup & Recovery Check (Run First in Every Session)
1. **Read `STATE_CHECKPOINT.json`** to identify the first checkpoint whose `"status"` is `"PENDING"` or `"IN_PROGRESS"`.
2. **Run the existing verification suite** to confirm whether the workspace is currently clean or mid-edit:
   ```powershell
   python tests/verify_phase1.py
   ```
   - If `verify_phase1.py` fails, inspect the assertion error first! A previous agent likely edited `src/main.js` without finishing the corresponding `index.html` DOM IDs (or vice versa). Fix the broken checkpoint before starting the next one.
3. **After completing each sub-phase below:**
   - Append the sub-phase's test function to `tests/verify_phase1.py` and run `python tests/verify_phase1.py`.
   - Only when it exits with code `0` (`ALL VERIFICATION CHECKS PASSED`), update that checkpoint's `"status"` to `"DONE"` in `STATE_CHECKPOINT.json`.

---

## 1. Current Codebase Map (Completed Phases 1 & 2)

| File | Responsibility & Key Exports |
| :--- | :--- |
| `index.html` | Studio UI layout, Tailwind dark theme, Three.js importmap, 66 bound DOM IDs. |
| `src/presets.js` | `LASER_MACHINES`, `MATERIALS`, `FIT_PRESETS`, `TSLOT_HARDWARE`. |
| `src/geometry/parametricCore.js` | `computeFingerDistribution`, `buildEdgeProfile`, `generateParametricBox`, `packPanelsOnBed`. |
| `src/geometry/livingHinge.js` | `LIVING_HINGE_PATTERNS` (`straight`, `wave`, `diamond`), `calculateLivingHingePhysics`, `generateLivingHingeLatticePaths`. |
| `src/geometry/cutoutLibrary.js` | `CUTOUT_TEMPLATES` (11 hardware templates), `buildCutoutGeometry`. |
| `src/viewport/scene3D.js` | `BoxScene3D` — Dual-material extruded meshes, 14-link articulated living hinge chain, raycast picking, fold/explode/lid-peek kinematics. |
| `src/viewport/sheet2D.js` | `LaserSheet2D` — 2D canvas with pan/zoom, LightBurn layer colors (`C00`, `C01`, `C02`, `C03`), nominal dashed reference overlay, 16× kerf zoom. |
| `src/exporters/exportEngine.js` | `generateLightBurnLbrn2`, `generateKerfCalibrationCombLbrn2`, `generateCleanSVG`, `downloadFile`. |
| `src/main.js` | `BoxForgeApp` — Reactive state store, DOM event bindings, fold animation loop, cutout list editor. |
| `tests/verify_phase1.py` | Automated verification suite (DOM ID integrity, odd-finger symmetry, kerf math, living hinge & cutout checks). |

---

## 2. Execution Blueprint: `phase_3a_kerf_calibration_wizard`

### Objective
Build an interactive **1-Minute Kerf Calibration Wizard Modal** (`src/ui/kerfWizardModal.js`) and add **Dual Kerf Compensation Mode** (`baked` vs. `lightburn-native`) to `src/exporters/exportEngine.js`.

### Step-by-Step Implementation Instructions

1. **Update `src/exporters/exportEngine.js` — Support Dual Kerf Mode in `.lbrn2`**:
   - Modify `generateLightBurnLbrn2(model, materialPreset, machinePreset, options = {})`:
     - Accept `options.kerfMode = 'baked' | 'lightburn-layer'` (default `'baked'`).
     - When `kerfMode === 'lightburn-layer'`:
       - Use `panel.nominalOutline` instead of `panel.outline` for Layer `C00`, and `panel.nominalHoles` instead of `panel.holes` for Layer `C01`.
       - Inside `<CutSetting type="Cut">` for `C00` (`index Value="0"`), inject `<kerf Value="${model.dimensions.kerfDelta.toFixed(4)}"/>`.
       - Inside `<CutSetting type="Cut">` for `C01` (`index Value="1"`), inject `<kerf Value="${(-model.dimensions.kerfDelta).toFixed(4)}"/>`.
     - When `kerfMode === 'baked'` (default):
       - Keep existing pre-compensated `panel.outline` and `panel.holes`, and emit `<kerf Value="0.0000"/>` inside `C00` and `C01` so LightBurn does not double-offset.

2. **Create `src/ui/kerfWizardModal.js`**:
   - Export `class KerfWizardModal`:
     - Constructor: `constructor({ onApplyCalibration, onDownloadComb })`
     - Renders and controls the modal element `#modal-kerf-wizard` in `index.html`.
     - Displays the 7 interactive comb slots matching `generateKerfCalibrationCombLbrn2`:
       `[-0.05, 0.00, +0.05, +0.10, +0.14, +0.18, +0.22]` mm.
     - Clicking any slot button (`data-comb-slot="<val>"`) highlights that slot, previews the calculated `kerf` and `caliperThickness`, and clicking `#btn-apply-kerf-wizard` invokes `onApplyCalibration({ thickness, kerf, kerfMode })`, saves to `localStorage.setItem('boxforge_custom_calibration', JSON.stringify(...))`, and closes the modal.

3. **Update `index.html`**:
   - Add a button `#btn-open-kerf-wizard` next to `#btn-export-comb` in the header (or make `#btn-export-comb` open the wizard modal which contains both the **Download `.lbrn2` Test Comb** button `#btn-modal-download-comb` and the 7 interactive slot selectors).
   - Add `<select id="select-kerf-mode">` in Section 1 of the sidebar with options:
     - `<option value="baked" selected>Baked Geometry Offset (Recommended)</option>`
     - `<option value="lightburn-layer">LightBurn Native &lt;kerf&gt; Tag</option>`
   - Add the modal markup `<div id="modal-kerf-wizard" class="hidden fixed inset-0 ...">` at the bottom of `<body>`.

4. **Update `src/main.js`**:
   - Import `KerfWizardModal` from `./ui/kerfWizardModal.js`.
   - Add `this.state.kerfMode = 'baked'`.
   - Bind `select-kerf-mode`, `btn-open-kerf-wizard`, and pass `{ kerfMode: this.state.kerfMode }` into `generateLightBurnLbrn2(...)`.

5. **Verification Gate (`tests/verify_phase1.py`)**:
   - Add `test_phase_3a_kerf_wizard()` verifying that `src/ui/kerfWizardModal.js` exists, `<kerf Value=` is present in `src/exporters/exportEngine.js`, and all new DOM IDs match `index.html`.
   - Run `python tests/verify_phase1.py` and mark `phase_3a_kerf_calibration_wizard` as `"DONE"` in `STATE_CHECKPOINT.json`.

---

## 3. Execution Blueprint: `phase_3b_dogbones_and_witness_marks`

### Objective
Add optional **Corner Overcut / Dogbone Reliefs** on inner finger-joint corners and auto-generated **Layer `C03` Assembly Witness Marks (`A↔A`, `B↔B`, etc.)** on mating panel edges.

### Step-by-Step Implementation Instructions

1. **Update `src/geometry/parametricCore.js` — Dogbone Corner Reliefs**:
   - In `buildEdgeProfile(opts)`:
     - Accept `dogboneRelief = false` and `dogboneRadius = 0.45` (mm).
     - When `dogboneRelief === true`, at each recessed inner corner of a finger joint (where a tab wall transitions perpendicularly into the shoulder line at `y = yShoulder`), insert a 5-point semicircular relief arc of radius `r_db = Math.max(0.25, dogboneRadius)` angled at $45^\circ$ into the solid shoulder material so sharp $90^\circ$ mating corners never bind on laser beam radius or thick acrylic.
   - In `generateParametricBox(params)`:
     - Accept `dogboneRelief = false` and pass it into `buildPanelOutline` -> `buildEdgeProfile`.

2. **Update `src/geometry/parametricCore.js` — Layer `C03` Edge-Matching Witness Marks**:
   - In `generateParametricBox(params)`:
     - Accept `assemblyMarks = true`.
     - When `assemblyMarks === true`, append edge-matching score labels (`scoreAnnotations`) inset $4.5\text{ mm}$ from each panel's 4 edges:
       - `BOTTOM` edges: `N:B` (North->Back), `S:F` (South->Front), `W:L` (West->Left), `E:R` (East->Right)
       - `FRONT` bottom edge: `S:F`; left edge: `FL`; right edge: `FR`
       - `BACK` bottom edge: `N:B`; left/right edges matching `LEFT` and `RIGHT`
       - `LEFT` & `RIGHT` edges matching their respective `BOTTOM`, `FRONT`, `BACK` mating edges.

3. **Update `index.html` & `src/main.js`**:
   - In Section 2 of `index.html`, add two checkboxes:
     - `id="chk-dogbone"` (`Corner Dogbone Reliefs`)
     - `id="chk-witness-marks"` (`Layer C03 Assembly Marks`, checked by default)
   - Bind both checkboxes in `src/main.js` (`this.state.dogboneRelief`, `this.state.assemblyMarks`) and pass them into `generateParametricBox`.

4. **Verification Gate (`tests/verify_phase1.py`)**:
   - Add `test_phase_3b_dogbones_and_witness_marks()` checking `dogboneRelief` and `assemblyMarks` in `parametricCore.js` and DOM IDs in `index.html`.
   - Run `python tests/verify_phase1.py` and mark `phase_3b_dogbones_and_witness_marks` as `"DONE"` in `STATE_CHECKPOINT.json`.

---

## 4. Execution Blueprint: `phase_3c_dxf_exporter_and_rotation_nesting`

### Objective
Create a production **AutoCAD R12/2000 `.DXF` Exporter** (`src/exporters/dxfExporter.js`) with named laser layers and upgrade `packPanelsOnBed` in `src/geometry/parametricCore.js` to support $90^\circ$ panel rotation when beneficial.

### Step-by-Step Implementation Instructions

1. **Create `src/exporters/dxfExporter.js`**:
   - Export `function generateProductionDXF(model)`:
     - Emit a universal ASCII DXF file containing:
       - `SECTION` / `HEADER` (`$INSUNITS` = `4` for millimeters)
       - `SECTION` / `TABLES` / `LAYER` defining 4 layers with standard AutoCAD Color Index (ACI):
         - `0_OUTER_CUT` (ACI `7` White/Black)
         - `1_INNER_CUT` (ACI `5` Blue)
         - `2_LIVING_HINGE` (ACI `1` Red)
         - `3_VECTOR_SCORE` (ACI `3` Green)
       - `SECTION` / `ENTITIES`:
         - Helper `emitDxfPolyline(pts, offsetX, offsetY, layerName, closed)`: emits `POLYLINE` + `VERTEX` + `SEQEND` (or `LINE` segments for 2-point slits) so 100% of CAD/CAM programs (LightBurn, RDWorks, AutoCAD, Fusion 360, Illustrator) open it without version errors.
         - Helper `emitDxfCircle(cx, cy, radius, layerName)`: emits `CIRCLE` entity on `1_INNER_CUT`.
         - Helper `emitDxfText(text, cx, cy, height, layerName)`: emits `TEXT` entity on `3_VECTOR_SCORE`.
       - `ENDSEC` and `EOF`.

2. **Update `src/geometry/parametricCore.js` — Smart $90^\circ$ Rotation in `packPanelsOnBed`**:
   - Accept `allowRotation = true` in `packPanelsOnBed(panels, bedWidth, bedHeight, spacing, allowRotation)`.
   - If a panel's `width > height` and rotating it $90^\circ$ prevents a shelf wrap or reduces shelf height without overflowing `bedWidth`, rotate its 2D outline/holes/paths in `bedPosition` (or pack panels sorted by decreasing max-dimension first for tighter utilization).

3. **Update `index.html` & `src/main.js`**:
   - Add button `#btn-export-dxf` (`Export .DXF`) in the top header bar next to `#btn-export-svg`.
   - Bind `#btn-export-dxf` in `src/main.js` to call `generateProductionDXF(this.currentModel)` and `downloadFile('...dxf', dxf, 'application/dxf')`.

4. **Verification Gate (`tests/verify_phase1.py`)**:
   - Add `test_phase_3c_dxf_exporter()` verifying `src/exporters/dxfExporter.js` exists, outputs valid DXF section headers (`0_OUTER_CUT`, `1_INNER_CUT`, `2_LIVING_HINGE`, `3_VECTOR_SCORE`), and `#btn-export-dxf` is bound.
   - Run `python tests/verify_phase1.py` and mark `phase_3c_dxf_exporter_and_rotation_nesting` as `"DONE"` in `STATE_CHECKPOINT.json`.

---

## 5. Execution Blueprint: `phase_4a_persistence_and_share_urls`

### Objective
Create `src/storage/projectStore.js` so users can save/load `.boxforge.json` project files, copy a **Shareable Design URL** (encoded in `window.location.hash`), and save custom Machine/Material presets to `localStorage`.

### Step-by-Step Implementation Instructions

1. **Create `src/storage/projectStore.js`**:
   - Export `serializeStateToHash(state)`: serializes parametric state keys into compact JSON and base64url-encodes them into `#design=<base64>`.
   - Export `deserializeStateFromHash()`: reads `window.location.hash`, validates keys, and returns the partial state object (or `null` if none/invalid).
   - Export `exportProjectJson(state)` and `importProjectJson(file, callback)`.
   - Export `saveCustomMaterialPreset(preset)` and `loadCustomMaterialPresets()` using `localStorage.getItem('boxforge_custom_materials')`.

2. **Update `index.html` & `src/main.js`**:
   - Add `#btn-share-url` (`Share Link`), `#btn-save-json` (`Save .JSON`), and `#btn-load-json` (`Load`) + hidden `<input id="input-file-json" type="file" accept=".json">` in the header or sidebar footer.
   - On startup in `BoxForgeApp.constructor()`, check `deserializeStateFromHash()` and merge into `this.state` before `this.recompute(true)` so shared URLs restore the exact 3D enclosure, living hinge settings, and panel cutouts!

3. **Verification Gate (`tests/verify_phase1.py`)**:
   - Add `test_phase_4a_persistence()` verifying `src/storage/projectStore.js` exports all required functions and DOM IDs match `index.html`.
   - Run `python tests/verify_phase1.py` and mark `phase_4a_persistence_and_share_urls` as `"DONE"` in `STATE_CHECKPOINT.json`.

---

## 6. Execution Blueprint: `phase_4b_pro_tier_and_saas_polish`

### Objective
Add the **Custom Shop Logo / Part Stamp Score Feature**, **Keyboard Shortcuts (`Space` to toggle Fold Animation, `R` to reset camera, `1/2/3` for Split/3D/2D views)**, and the **BoxForge Pro Subscription / License Modal** (`src/ui/proUpgradeModal.js`).

### Step-by-Step Implementation Instructions

1. **Create `src/ui/proUpgradeModal.js`**:
   - Renders a sleek SaaS pricing & license modal (`#modal-pro-upgrade`) comparing:
     - **Hobbyist Free Tier** (3D Fold Studio + Free Kerf Calibration Comb `.lbrn2`)
     - **Shop Pro ($19/mo)** (Unlimited `.lbrn2` / `.DXF` / `.SVG` Exports, Custom Shop Stamp, Saved Material Library)
     - **Makerspace ($49/mo)** (5 Seats + Shared Calibration Presets)
   - Includes an instant **"Activate Demo Pro License"** toggle persisted in `localStorage` so evaluators can test both gated and unlocked states.

2. **Add Custom Shop Stamp Input (`#input-shop-stamp`)**:
   - Allows shops to enter a custom engraving stamp (e.g., `"MADE BY ACME LASER CO. • SKU-104"`) that automatically scores onto the interior center of the `BOTTOM` panel on Layer `C03`.

3. **Verification Gate (`tests/verify_phase1.py`)**:
   - Add `test_phase_4b_saas_polish()` verifying `src/ui/proUpgradeModal.js`, `#input-shop-stamp`, and all DOM IDs.
   - Run `python tests/verify_phase1.py` and mark `phase_4b_pro_tier_and_saas_polish` as `"DONE"` in `STATE_CHECKPOINT.json`.

---

## 7. Execution Blueprint: `phase_5_multi_sheet_and_assembly_guide`

### Objectives
1. **Phase 5A — Multi-Sheet Bed Pagination & Multi-Bed Layout**:
   - Automatic overflow bin-packing across `Sheet 1`, `Sheet 2`, etc. in `src/geometry/parametricCore.js` (`packPanelsOnBed`).
   - Side-by-side bed layout with global coordinates (`globalX = sheetIndex * (bedWidth + 40) + x`).
   - Interactive 2D sheet selector tab bar (`#bar-sheet-pagination` / `#sheet-tabs-container`) with `[All Sheets]`, `[Sheet 1]`, `[Sheet 2]`.
   - Dual-mode multi-sheet export in `.lbrn2` and AutoCAD `.DXF` with framed sheet bounding boxes on Layer `C03` / `3_VECTOR_SCORE`.

2. **Phase 5B — 3D Step-by-Step Assembly Visualizer & Sequence Stepper**:
   - 4-step progressive assembly in `src/viewport/scene3D.js` (`setAssemblyStep(step)`):
     - `Step 0`: All parts assembled
     - `Step 1`: Base panel & Internal egg-crate dividers
     - `Step 2`: Side walls (`left`, `right`)
     - `Step 3`: Front & Back walls (`front`, `back`)
     - `Step 4`: Top lid & living hinge wrap (`top`, `wrap`)
   - Stepper controls (`#btn-assembly-step-prev`, `#btn-assembly-step-next`, `#select-assembly-step`, `#val-assembly-step`).

3. **Verification Gate (`tests/verify_phase1.py`)**:
   - `test_phase_5a_multi_sheet_pagination()` and `test_phase_5b_assembly_guide()`.
   - Update `STATE_CHECKPOINT.json` (`phase_5a` and `phase_5b` -> `DONE`).
