/**
 * BoxForge Pro — Phase 1, Phase 2, Phase 3A & Phase 3B Main Controller
 * Connects Parametric Core, Living Hinge Calculator, Hardware Panel Cutout Studio,
 * 1-Minute Kerf Calibration Wizard Modal, Dogbone Reliefs, Assembly Witness Marks,
 * 3D Kinematic Fold Viewport, 2D Laser Sheet Canvas, and Dual-Mode LightBurn Exporter.
 */

import { LASER_MACHINES, MATERIALS, FIT_PRESETS, TSLOT_HARDWARE } from './presets.js';
import { LIVING_HINGE_PATTERNS } from './geometry/livingHinge.js';
import { CUTOUT_TEMPLATES } from './geometry/cutoutLibrary.js';
import { generateParametricBox } from './geometry/parametricCore.js';
import { BoxScene3D } from './viewport/scene3D.js';
import { LaserSheet2D } from './viewport/sheet2D.js';
import { KerfWizardModal } from './ui/kerfWizardModal.js';
import {
  generateLightBurnLbrn2,
  generateKerfCalibrationCombLbrn2,
  generateCleanSVG,
  downloadFile
} from './exporters/exportEngine.js';

class BoxForgeApp {
  constructor() {
    this.state = {
      machineId: 'co2-50w',
      materialId: 'baltic-birch-3mm',
      fitPresetId: 'friction',

      boxStyle: 'living-hinge',   // 'living-hinge' | 'closed' | 'open' | 'hinged-top'
      jointType: 'finger',        // 'finger' | 'tslot'
      hardwareId: 'M3',
      dimensionMode: 'outer',     // 'outer' | 'inner'

      width: 145,
      depth: 105,
      height: 68,

      thickness: 2.92,
      kerf: 0.14,
      fitInterference: 0.04,
      fingerWidth: 14,
      kerfMode: 'baked',          // 'baked' | 'lightburn-layer'
      dogboneRelief: false,       // Phase 3B: Dogbone corner micro-reliefs
      assemblyMarks: true,        // Phase 3B: Layer C03 edge-matching witness marks

      // Phase 2: Living Hinge parameters
      hingePattern: 'straight',
      hingeRadius: 18,
      hingeColSpacing: 2.2,
      hingeBridgeGap: 3.2,
      hingeSlitsPerCol: 3,

      // Phase 2: Panel Cutouts
      panelCutouts: [
        {
          id: 'cut-1',
          panelId: 'front',
          type: 'usb-c',
          name: 'USB-C Port',
          x: 42,
          y: 22,
          width: 22,
          height: 8,
          rotation: 0
        },
        {
          id: 'cut-2',
          panelId: 'front',
          type: 'rocker-kcd1',
          name: 'Rocker Switch',
          x: 105,
          y: 24,
          width: 19.2,
          height: 13.0,
          rotation: 0
        },
        {
          id: 'cut-3',
          panelId: 'left',
          type: 'fan-40mm',
          name: '40mm Fan Grille',
          x: 56,
          y: 34,
          width: 40,
          height: 40,
          rotation: 0
        }
      ],
      nextCutoutSeq: 4,

      dividersX: 0,
      dividersY: 0,
      thumbNotch: true,
      partSpacing: 5,

      // Viewport controls
      viewMode: 'split',
      foldProgress: 0.90,
      explodeDistance: 0,
      lidOpenProgress: 0,
      isPlayingFold: false,
      playDirection: -1
    };

    this._initDOMRefs();
    this._populateSelectPresets();
    this._initViewports();
    this._initKerfWizard();
    this._bindEvents();
    this.recompute(true);
    this._renderCutoutList();
    this._startFoldAnimationLoop();
  }

  _initDOMRefs() {
    this.el = {
      machineSelect: document.getElementById('select-machine'),
      materialSelect: document.getElementById('select-material'),
      fitSelect: document.getElementById('select-fit'),
      selectKerfMode: document.getElementById('select-kerf-mode'),
      boxStyleSelect: document.getElementById('select-box-style'),
      jointTypeSelect: document.getElementById('select-joint-type'),
      hardwareSelect: document.getElementById('select-hardware'),
      hardwareRow: document.getElementById('row-hardware'),
      dimModeButtons: document.querySelectorAll('[data-dim-mode]'),
      chkDogbone: document.getElementById('chk-dogbone'),
      chkWitnessMarks: document.getElementById('chk-witness-marks'),

      inputWidth: document.getElementById('input-width'),
      valWidth: document.getElementById('val-width'),
      inputDepth: document.getElementById('input-depth'),
      valDepth: document.getElementById('val-depth'),
      inputHeight: document.getElementById('input-height'),
      valHeight: document.getElementById('val-height'),

      inputThickness: document.getElementById('input-thickness'),
      inputKerf: document.getElementById('input-kerf'),
      inputInterference: document.getElementById('input-interference'),
      inputFingerWidth: document.getElementById('input-finger-width'),
      valFingerWidth: document.getElementById('val-finger-width'),

      // Phase 2: Living Hinge refs
      sectionLivingHinge: document.getElementById('section-living-hinge'),
      selectHingePattern: document.getElementById('select-hinge-pattern'),
      inputHingeRadius: document.getElementById('input-hinge-radius'),
      valHingeRadius: document.getElementById('val-hinge-radius'),
      inputHingeSpacing: document.getElementById('input-hinge-spacing'),
      valHingeSpacing: document.getElementById('val-hinge-spacing'),
      hudHingeArc: document.getElementById('hud-hinge-arc'),
      hudHingeStrain: document.getElementById('hud-hinge-strain'),
      hudHingeBadge: document.getElementById('hud-hinge-badge'),

      // Phase 2: Panel Cutout Studio refs
      selectCutoutPanel: document.getElementById('select-cutout-panel'),
      selectCutoutTemplate: document.getElementById('select-cutout-template'),
      btnAddCutout: document.getElementById('btn-add-cutout'),
      btnLoadDemoCutouts: document.getElementById('btn-load-demo-cutouts'),
      cutoutListContainer: document.getElementById('cutout-list-container'),

      inputDivX: document.getElementById('input-div-x'),
      valDivX: document.getElementById('val-div-x'),
      inputDivY: document.getElementById('input-div-y'),
      valDivY: document.getElementById('val-div-y'),

      // Kinematic controls
      sliderFold: document.getElementById('slider-fold'),
      valFold: document.getElementById('val-fold'),
      btnPlayFold: document.getElementById('btn-play-fold'),
      sliderExplode: document.getElementById('slider-explode'),
      valExplode: document.getElementById('val-explode'),
      sliderLid: document.getElementById('slider-lid'),
      valLid: document.getElementById('val-lid'),

      // Viewport containers & view mode buttons
      viewportGrid: document.getElementById('viewport-grid'),
      pane3D: document.getElementById('pane-3d'),
      pane2D: document.getElementById('pane-2d'),
      canvas3DContainer: document.getElementById('canvas-3d-container'),
      canvas2D: document.getElementById('canvas-2d'),
      viewModeButtons: document.querySelectorAll('[data-view-mode]'),

      // 3D toggles
      btnWireframe: document.getElementById('btn-toggle-wireframe'),
      btnXRay: document.getElementById('btn-toggle-xray'),
      btnResetCam: document.getElementById('btn-reset-cam'),

      // 2D toggles
      btnZoomFit: document.getElementById('btn-zoom-fit'),
      btnZoomKerf: document.getElementById('btn-zoom-kerf'),
      btnToggleNominal: document.getElementById('btn-toggle-nominal'),

      // Telemetry HUD
      hudOuterDims: document.getElementById('hud-outer-dims'),
      hudInnerDims: document.getElementById('hud-inner-dims'),
      hudKerfDelta: document.getElementById('hud-kerf-delta'),
      hudCutLength: document.getElementById('hud-cut-length'),
      hudCutTime: document.getElementById('hud-cut-time'),
      hudBedStatus: document.getElementById('hud-bed-status'),
      selectedPartCard: document.getElementById('selected-part-card'),
      selectedPartTitle: document.getElementById('selected-part-title'),
      selectedPartMeta: document.getElementById('selected-part-meta'),

      // Export buttons & Wizard trigger
      btnOpenKerfWizard: document.getElementById('btn-open-kerf-wizard'),
      btnExportLbrn2: document.getElementById('btn-export-lbrn2'),
      btnExportSvg: document.getElementById('btn-export-svg'),
      btnExportComb: document.getElementById('btn-export-comb')
    };
  }

  _populateSelectPresets() {
    this.el.machineSelect.innerHTML = LASER_MACHINES.map(
      m => `<option value="${m.id}" ${m.id === this.state.machineId ? 'selected' : ''}>${m.name} (${m.bedWidth}×${m.bedHeight}mm)</option>`
    ).join('');

    this.el.materialSelect.innerHTML = MATERIALS.map(
      m => `<option value="${m.id}" ${m.id === this.state.materialId ? 'selected' : ''}>${m.name} — Caliper ${m.caliperThickness}mm</option>`
    ).join('');

    this.el.fitSelect.innerHTML = Object.values(FIT_PRESETS).map(
      f => `<option value="${f.id}" ${f.id === this.state.fitPresetId ? 'selected' : ''}>${f.name}</option>`
    ).join('');

    this.el.hardwareSelect.innerHTML = Object.values(TSLOT_HARDWARE).map(
      h => `<option value="${h.id}" ${h.id === this.state.hardwareId ? 'selected' : ''}>${h.label}</option>`
    ).join('');

    this.el.selectHingePattern.innerHTML = LIVING_HINGE_PATTERNS.map(
      p => `<option value="${p.id}" ${p.id === this.state.hingePattern ? 'selected' : ''}>${p.name}</option>`
    ).join('');

    this.el.selectCutoutTemplate.innerHTML = CUTOUT_TEMPLATES.map(
      c => `<option value="${c.id}">[${c.category}] ${c.name}</option>`
    ).join('');
  }

  _initViewports() {
    this.scene3D = new BoxScene3D(this.el.canvas3DContainer, (panel) => {
      this._onPanelSelected(panel, '3d');
    });

    this.sheet2D = new LaserSheet2D(this.el.canvas2D, (panel) => {
      this._onPanelSelected(panel, '2d');
    });
  }

  _initKerfWizard() {
    this.kerfWizard = new KerfWizardModal({
      onApplyCalibration: ({ thickness, kerf, kerfMode }) => {
        this.state.thickness = thickness;
        this.state.kerf = kerf;
        this.state.kerfMode = kerfMode;

        this.el.inputThickness.value = thickness;
        this.el.inputKerf.value = kerf;
        if (this.el.selectKerfMode) this.el.selectKerfMode.value = kerfMode;

        this.recompute(false);
      },
      onDownloadComb: () => {
        const xml = generateKerfCalibrationCombLbrn2(
          this._getCurrentMaterial(),
          this._getCurrentMachine()
        );
        downloadFile(`BoxForge_Kerf_Calibration_Comb_${this.state.thickness}mm.lbrn2`, xml, 'application/xml');
      }
    });
  }

  _onPanelSelected(panel, source) {
    const id = panel ? panel.id : null;
    if (source !== '3d') this.scene3D.selectPanel(id, false);
    if (source !== '2d') this.sheet2D.selectPanel(id);

    if (id && ['front', 'back', 'left', 'right', 'bottom', 'top'].includes(id)) {
      this.el.selectCutoutPanel.value = id;
    }

    if (!panel) {
      this.el.selectedPartCard.classList.add('hidden');
      return;
    }

    this.el.selectedPartCard.classList.remove('hidden');
    this.el.selectedPartTitle.textContent = `${panel.code} — ${panel.name}`;
    const lhCount = panel.livingHingePaths ? panel.livingHingePaths.length : 0;
    this.el.selectedPartMeta.textContent =
      `Blank: ${panel.width.toFixed(1)}×${panel.height.toFixed(1)}×${panel.thickness.toFixed(2)}mm | ` +
      `Cut: ${(panel.cutLengthMm / 1000).toFixed(2)}m | Holes: ${panel.holes.length}` +
      (lhCount > 0 ? ` | Hinge Slits: ${lhCount}` : '');
  }

  _bindEvents() {
    this.el.machineSelect.addEventListener('change', (e) => {
      this.state.machineId = e.target.value;
      const machine = this._getCurrentMachine();
      const material = this._getCurrentMaterial();
      this.state.kerf = Number((machine.baseKerf * (material?.kerfMultiplier ?? 1)).toFixed(3));
      this.el.inputKerf.value = this.state.kerf;
      this.recompute(true);
    });

    this.el.materialSelect.addEventListener('change', (e) => {
      this.state.materialId = e.target.value;
      const machine = this._getCurrentMachine();
      const material = this._getCurrentMaterial();
      this.state.thickness = material.caliperThickness;
      this.state.kerf = Number((machine.baseKerf * material.kerfMultiplier).toFixed(3));
      this.el.inputThickness.value = this.state.thickness;
      this.el.inputKerf.value = this.state.kerf;
      this.recompute(false);
    });

    this.el.fitSelect.addEventListener('change', (e) => {
      this.state.fitPresetId = e.target.value;
      const fit = FIT_PRESETS[this.state.fitPresetId];
      if (fit) {
        this.state.fitInterference = fit.interferenceMm;
        this.el.inputInterference.value = this.state.fitInterference;
      }
      this.recompute(false);
    });

    if (this.el.selectKerfMode) {
      this.el.selectKerfMode.addEventListener('change', (e) => {
        this.state.kerfMode = e.target.value;
      });
    }

    if (this.el.btnOpenKerfWizard) {
      this.el.btnOpenKerfWizard.addEventListener('click', () => {
        this.kerfWizard.open(this.state.thickness, this.state.kerf, this.state.kerfMode);
      });
    }

    if (this.el.chkDogbone) {
      this.el.chkDogbone.addEventListener('change', (e) => {
        this.state.dogboneRelief = Boolean(e.target.checked);
        this.recompute(false);
      });
    }

    if (this.el.chkWitnessMarks) {
      this.el.chkWitnessMarks.addEventListener('change', (e) => {
        this.state.assemblyMarks = Boolean(e.target.checked);
        this.recompute(false);
      });
    }

    this.el.boxStyleSelect.addEventListener('change', (e) => {
      this.state.boxStyle = e.target.value;
      this.recompute(true);
    });

    this.el.jointTypeSelect.addEventListener('change', (e) => {
      this.state.jointType = e.target.value;
      this.el.hardwareRow.classList.toggle('hidden', this.state.jointType !== 'tslot');
      this.recompute(false);
    });

    this.el.hardwareSelect.addEventListener('change', (e) => {
      this.state.hardwareId = e.target.value;
      this.recompute(false);
    });

    this.el.dimModeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.state.dimensionMode = btn.dataset.dimMode;
        this.el.dimModeButtons.forEach(b => {
          const active = b.dataset.dimMode === this.state.dimensionMode;
          b.className = active
            ? 'flex-1 py-1 px-2 text-xs font-semibold rounded bg-sky-500/20 text-sky-300 border border-sky-500/40'
            : 'flex-1 py-1 px-2 text-xs font-medium rounded text-slate-400 hover:text-slate-200';
        });
        this.recompute(false);
      });
    });

    const bindRange = (inputEl, valEl, stateKey, suffix = ' mm', isFloat = false) => {
      inputEl.addEventListener('input', (e) => {
        const val = isFloat ? parseFloat(e.target.value) : parseInt(e.target.value, 10);
        this.state[stateKey] = val;
        if (valEl) valEl.textContent = `${val}${suffix}`;
        this.recompute(false);
      });
    };

    bindRange(this.el.inputWidth, this.el.valWidth, 'width');
    bindRange(this.el.inputDepth, this.el.valDepth, 'depth');
    bindRange(this.el.inputHeight, this.el.valHeight, 'height');
    bindRange(this.el.inputFingerWidth, this.el.valFingerWidth, 'fingerWidth');
    bindRange(this.el.inputDivX, this.el.valDivX, 'dividersX', '');
    bindRange(this.el.inputDivY, this.el.valDivY, 'dividersY', '');

    // Phase 2: Living Hinge controls
    this.el.selectHingePattern.addEventListener('change', (e) => {
      this.state.hingePattern = e.target.value;
      this.recompute(false);
    });
    bindRange(this.el.inputHingeRadius, this.el.valHingeRadius, 'hingeRadius');
    bindRange(this.el.inputHingeSpacing, this.el.valHingeSpacing, 'hingeColSpacing', ' mm', true);

    // Phase 2: Panel Cutout Studio controls
    this.el.btnAddCutout.addEventListener('click', () => {
      this._addCutoutFromSelector();
    });

    this.el.btnLoadDemoCutouts.addEventListener('click', () => {
      this._loadDemoCutouts();
    });

    // Numeric caliper & kerf inputs
    this.el.inputThickness.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      if (!isNaN(v) && v >= 0.8 && v <= 25) {
        this.state.thickness = v;
        this.recompute(false);
      }
    });

    this.el.inputKerf.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      if (!isNaN(v) && v >= 0 && v <= 2.0) {
        this.state.kerf = v;
        this.recompute(false);
      }
    });

    this.el.inputInterference.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      if (!isNaN(v) && v >= -0.5 && v <= 0.5) {
        this.state.fitInterference = v;
        this.recompute(false);
      }
    });

    // 3D Kinematic Sliders
    this.el.sliderFold.addEventListener('input', (e) => {
      this.state.isPlayingFold = false;
      this._updatePlayFoldButton();
      const pct = parseFloat(e.target.value);
      this.state.foldProgress = pct / 100;
      this.el.valFold.textContent = `${Math.round(pct)}%`;
      this.scene3D.setFoldProgress(this.state.foldProgress);
    });

    this.el.btnPlayFold.addEventListener('click', () => {
      this.state.isPlayingFold = !this.state.isPlayingFold;
      this._updatePlayFoldButton();
    });

    this.el.sliderExplode.addEventListener('input', (e) => {
      const mm = parseFloat(e.target.value);
      this.state.explodeDistance = mm;
      this.el.valExplode.textContent = `${Math.round(mm)} mm`;
      this.scene3D.setExplodeDistance(mm);
    });

    this.el.sliderLid.addEventListener('input', (e) => {
      const pct = parseFloat(e.target.value);
      this.state.lidOpenProgress = pct / 100;
      this.el.valLid.textContent = `${Math.round((pct / 100) * 100)}°`;
      this.scene3D.setLidOpenProgress(this.state.lidOpenProgress);
    });

    this.el.viewModeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.setViewMode(btn.dataset.viewMode);
      });
    });

    this.el.btnWireframe.addEventListener('click', () => {
      const next = !this.scene3D.showWireframe;
      this.scene3D.setWireframe(next);
      this.el.btnWireframe.classList.toggle('bg-sky-500/20', next);
      this.el.btnWireframe.classList.toggle('text-sky-300', next);
    });

    this.el.btnXRay.addEventListener('click', () => {
      const next = !this.scene3D.xRayMode;
      this.scene3D.setXRayMode(next);
      this.el.btnXRay.classList.toggle('bg-sky-500/20', next);
      this.el.btnXRay.classList.toggle('text-sky-300', next);
    });

    this.el.btnResetCam.addEventListener('click', () => {
      this.scene3D.resetCamera('iso');
    });

    this.el.btnZoomFit.addEventListener('click', () => {
      this.sheet2D.fitToBed();
    });

    this.el.btnZoomKerf.addEventListener('click', () => {
      this.sheet2D.zoomToKerfDetail();
    });

    this.el.btnToggleNominal.addEventListener('click', () => {
      this.sheet2D.showNominalOverlay = !this.sheet2D.showNominalOverlay;
      this.el.btnToggleNominal.classList.toggle('bg-amber-500/20', this.sheet2D.showNominalOverlay);
      this.el.btnToggleNominal.classList.toggle('text-amber-300', this.sheet2D.showNominalOverlay);
      this.sheet2D.render();
    });

    // Export Actions
    this.el.btnExportLbrn2.addEventListener('click', () => {
      const xml = generateLightBurnLbrn2(
        this.currentModel,
        this._getCurrentMaterial(),
        this._getCurrentMachine(),
        { kerfMode: this.state.kerfMode }
      );
      const { outerW, outerD, outerH, thickness } = this.currentModel.dimensions;
      const fname = `BoxForge_${Math.round(outerW)}x${Math.round(outerD)}x${Math.round(outerH)}_${thickness}mm_${this.state.kerfMode}.lbrn2`;
      downloadFile(fname, xml, 'application/xml');
    });

    this.el.btnExportSvg.addEventListener('click', () => {
      const svg = generateCleanSVG(this.currentModel);
      const { outerW, outerD, outerH } = this.currentModel.dimensions;
      const fname = `BoxForge_${Math.round(outerW)}x${Math.round(outerD)}x${Math.round(outerH)}.svg`;
      downloadFile(fname, svg, 'image/svg+xml');
    });

    this.el.btnExportComb.addEventListener('click', () => {
      const xml = generateKerfCalibrationCombLbrn2(
        this._getCurrentMaterial(),
        this._getCurrentMachine()
      );
      downloadFile(`BoxForge_Kerf_Calibration_Comb_${this.state.thickness}mm.lbrn2`, xml, 'application/xml');
    });
  }

  _addCutoutFromSelector() {
    const panelId = this.el.selectCutoutPanel.value;
    const tplId = this.el.selectCutoutTemplate.value;
    const tpl = CUTOUT_TEMPLATES.find(t => t.id === tplId) || CUTOUT_TEMPLATES[0];

    const targetPanel = this.currentModel?.panels.find(p => p.id === panelId);
    const defaultX = targetPanel ? Math.round(targetPanel.width * 0.5) : Math.round(this.state.width * 0.5);
    const defaultY = targetPanel
      ? Math.round((targetPanel.livingHingeMeta ? targetPanel.livingHingeMeta.straightBackH : targetPanel.height) * 0.5)
      : Math.round(this.state.height * 0.5);

    this.state.panelCutouts.push({
      id: `cut-${this.state.nextCutoutSeq++}`,
      panelId,
      type: tpl.id,
      name: tpl.name.split(' (')[0].split(' +')[0],
      x: defaultX,
      y: defaultY,
      width: tpl.defaultW,
      height: tpl.defaultH,
      rotation: 0
    });

    this.recompute(false);
    this._renderCutoutList();
  }

  _loadDemoCutouts() {
    const W = this.state.width;
    const D = this.state.depth;
    const H = this.state.height;
    this.state.panelCutouts = [
      {
        id: `cut-${this.state.nextCutoutSeq++}`,
        panelId: 'front',
        type: 'usb-c',
        name: 'USB-C Port',
        x: Math.round(W * 0.28),
        y: Math.round(H * 0.35),
        width: 22,
        height: 8,
        rotation: 0
      },
      {
        id: `cut-${this.state.nextCutoutSeq++}`,
        panelId: 'front',
        type: 'db9-dsub',
        name: 'DB9 Serial Port',
        x: Math.round(W * 0.55),
        y: Math.round(H * 0.35),
        width: 31,
        height: 13,
        rotation: 0
      },
      {
        id: `cut-${this.state.nextCutoutSeq++}`,
        panelId: 'front',
        type: 'rocker-kcd1',
        name: 'Rocker Switch',
        x: Math.round(W * 0.80),
        y: Math.round(H * 0.35),
        width: 19.2,
        height: 13.0,
        rotation: 0
      },
      {
        id: `cut-${this.state.nextCutoutSeq++}`,
        panelId: 'left',
        type: 'fan-40mm',
        name: '40mm Fan Grille',
        x: Math.round(D * 0.52),
        y: Math.round(H * 0.48),
        width: 40,
        height: 40,
        rotation: 0
      },
      {
        id: `cut-${this.state.nextCutoutSeq++}`,
        panelId: 'right',
        type: 'vent-slots',
        name: 'Vent Louver Array',
        x: Math.round(D * 0.48),
        y: Math.round(H * 0.48),
        width: 38,
        height: 24,
        rotation: 0
      },
      {
        id: `cut-${this.state.nextCutoutSeq++}`,
        panelId: 'bottom',
        type: 'rpi-mount',
        name: 'RPi 4/5 Standoffs',
        x: Math.round(W * 0.5),
        y: Math.round(D * 0.5),
        width: 85,
        height: 56,
        rotation: 0
      }
    ];
    this.recompute(false);
    this._renderCutoutList();
  }

  _renderCutoutList() {
    const container = this.el.cutoutListContainer;
    if (!container) return;

    if (this.state.panelCutouts.length === 0) {
      container.innerHTML = `<div class="text-[11px] text-slate-500 italic py-1.5 text-center">No panel cutouts placed yet.</div>`;
      return;
    }

    container.innerHTML = this.state.panelCutouts
      .map((item) => {
        const panelObj = this.currentModel?.panels.find(p => p.id === item.panelId);
        const maxX = Math.round(panelObj ? panelObj.width - 6 : 300);
        const maxY = Math.round(panelObj ? panelObj.height - 6 : 250);
        const isCustom = item.type === 'custom-rect' || item.type === 'custom-circle' || item.type === 'vent-slots';

        return `
        <div class="bg-slate-900/95 border border-slate-800 rounded p-2 space-y-1.5 text-[11px]" data-cutout-id="${item.id}">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-1.5">
              <span class="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 font-mono text-[10px] uppercase font-bold">${item.panelId}</span>
              <span class="font-semibold text-slate-200 truncate max-w-[130px]">${item.name}</span>
            </div>
            <div class="flex items-center gap-1">
              <button data-action="center" data-id="${item.id}" title="Snap to Face Center" class="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[10px]">Center</button>
              <button data-action="rotate" data-id="${item.id}" title="Rotate 90°" class="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[10px]">${item.rotation}°</button>
              <button data-action="delete" data-id="${item.id}" title="Remove Cutout" class="px-1.5 py-0.5 rounded bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 font-mono text-[10px]">×</button>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2 items-center">
            <div>
              <div class="flex justify-between text-[10px] text-slate-400">
                <span>X Pos</span>
                <span class="font-mono text-slate-300" data-label-x="${item.id}">${item.x}mm</span>
              </div>
              <input type="range" data-slider-x="${item.id}" min="8" max="${maxX}" value="${item.x}" class="w-full h-1 bg-slate-800 rounded cursor-pointer" />
            </div>
            <div>
              <div class="flex justify-between text-[10px] text-slate-400">
                <span>Y Pos</span>
                <span class="font-mono text-slate-300" data-label-y="${item.id}">${item.y}mm</span>
              </div>
              <input type="range" data-slider-y="${item.id}" min="8" max="${maxY}" value="${item.y}" class="w-full h-1 bg-slate-800 rounded cursor-pointer" />
            </div>
          </div>
          ${isCustom ? `
          <div class="grid grid-cols-2 gap-2 pt-0.5">
            <div class="flex items-center justify-between gap-1">
              <span class="text-[10px] text-slate-400">W/Ø:</span>
              <input type="number" data-input-w="${item.id}" value="${item.width}" min="3" max="150" class="w-16 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] font-mono text-slate-200" />
            </div>
            <div class="flex items-center justify-between gap-1">
              <span class="text-[10px] text-slate-400">H:</span>
              <input type="number" data-input-h="${item.id}" value="${item.height}" min="3" max="150" class="w-16 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] font-mono text-slate-200" />
            </div>
          </div>` : ''}
        </div>`;
      })
      .join('');

    container.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const action = btn.dataset.action;
        const item = this.state.panelCutouts.find(c => c.id === id);
        if (!item) return;

        if (action === 'delete') {
          this.state.panelCutouts = this.state.panelCutouts.filter(c => c.id !== id);
          this.recompute(false);
          this._renderCutoutList();
        } else if (action === 'rotate') {
          item.rotation = (item.rotation + 90) % 360;
          this.recompute(false);
          this._renderCutoutList();
        } else if (action === 'center') {
          const p = this.currentModel?.panels.find(pl => pl.id === item.panelId);
          if (p) {
            item.x = Math.round(p.width * 0.5);
            item.y = Math.round((p.livingHingeMeta ? p.livingHingeMeta.straightBackH : p.height) * 0.5);
            this.recompute(false);
            this._renderCutoutList();
          }
        }
      });
    });

    container.querySelectorAll('[data-slider-x]').forEach((slider) => {
      slider.addEventListener('input', (e) => {
        const id = slider.dataset.sliderX;
        const item = this.state.panelCutouts.find(c => c.id === id);
        if (!item) return;
        item.x = parseInt(e.target.value, 10);
        const lbl = container.querySelector(`[data-label-x="${id}"]`);
        if (lbl) lbl.textContent = `${item.x}mm`;
        this.recompute(false);
      });
    });

    container.querySelectorAll('[data-slider-y]').forEach((slider) => {
      slider.addEventListener('input', (e) => {
        const id = slider.dataset.sliderY;
        const item = this.state.panelCutouts.find(c => c.id === id);
        if (!item) return;
        item.y = parseInt(e.target.value, 10);
        const lbl = container.querySelector(`[data-label-y="${id}"]`);
        if (lbl) lbl.textContent = `${item.y}mm`;
        this.recompute(false);
      });
    });

    container.querySelectorAll('[data-input-w]').forEach((inp) => {
      inp.addEventListener('input', (e) => {
        const id = inp.dataset.inputW;
        const item = this.state.panelCutouts.find(c => c.id === id);
        const val = parseFloat(e.target.value);
        if (item && !isNaN(val) && val >= 2) {
          item.width = val;
          this.recompute(false);
        }
      });
    });

    container.querySelectorAll('[data-input-h]').forEach((inp) => {
      inp.addEventListener('input', (e) => {
        const id = inp.dataset.inputH;
        const item = this.state.panelCutouts.find(c => c.id === id);
        const val = parseFloat(e.target.value);
        if (item && !isNaN(val) && val >= 2) {
          item.height = val;
          this.recompute(false);
        }
      });
    });
  }

  _updatePlayFoldButton() {
    this.el.btnPlayFold.textContent = this.state.isPlayingFold ? 'Pause' : 'Animate Fold';
  }

  _startFoldAnimationLoop() {
    const step = () => {
      if (this.state.isPlayingFold) {
        let next = this.state.foldProgress + this.state.playDirection * 0.008;
        if (next <= 0) {
          next = 0;
          this.state.playDirection = 1;
        } else if (next >= 1) {
          next = 1;
          this.state.playDirection = -1;
        }
        this.state.foldProgress = next;
        const pct = Math.round(next * 100);
        this.el.sliderFold.value = pct;
        this.el.valFold.textContent = `${pct}%`;
        this.scene3D.setFoldProgress(next);
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  setViewMode(mode) {
    this.state.viewMode = mode;
    this.el.viewModeButtons.forEach((b) => {
      const active = b.dataset.viewMode === mode;
      b.className = active
        ? 'px-3 py-1 text-xs font-semibold rounded bg-sky-500 text-slate-950 shadow-sm'
        : 'px-3 py-1 text-xs font-medium rounded text-slate-300 hover:text-white';
    });

    if (mode === '3d') {
      this.el.pane3D.classList.remove('hidden');
      this.el.pane2D.classList.add('hidden');
      this.el.viewportGrid.className = 'flex-1 grid grid-cols-1 min-h-0';
    } else if (mode === '2d') {
      this.el.pane3D.classList.add('hidden');
      this.el.pane2D.classList.remove('hidden');
      this.el.viewportGrid.className = 'flex-1 grid grid-cols-1 min-h-0';
    } else {
      this.el.pane3D.classList.remove('hidden');
      this.el.pane2D.classList.remove('hidden');
      this.el.viewportGrid.className = 'flex-1 grid grid-cols-1 lg:grid-cols-2 min-h-0 divide-x divide-slate-800';
    }

    setTimeout(() => {
      this.scene3D.resize();
      this.sheet2D.resize();
      this.sheet2D.fitToBed();
    }, 30);
  }

  _getCurrentMachine() {
    return LASER_MACHINES.find(m => m.id === this.state.machineId) || LASER_MACHINES[0];
  }

  _getCurrentMaterial() {
    return MATERIALS.find(m => m.id === this.state.materialId) || MATERIALS[0];
  }

  recompute(fit2D = false) {
    const machine = this._getCurrentMachine();
    const material = this._getCurrentMaterial();

    const effectiveCutSpeed = (material.cutSpeed || 20) * (machine.cutSpeedMultiplier || 1);

    this.currentModel = generateParametricBox({
      width: this.state.width,
      depth: this.state.depth,
      height: this.state.height,
      dimensionMode: this.state.dimensionMode,
      boxStyle: this.state.boxStyle,
      jointType: this.state.jointType,
      hardwareId: this.state.hardwareId,
      thickness: this.state.thickness,
      kerf: this.state.kerf,
      fitInterference: this.state.fitInterference,
      fingerWidth: this.state.fingerWidth,
      dividersX: this.state.dividersX,
      dividersY: this.state.dividersY,
      thumbNotch: this.state.thumbNotch,
      hingePattern: this.state.hingePattern,
      hingeRadius: this.state.hingeRadius,
      hingeColSpacing: this.state.hingeColSpacing,
      hingeBridgeGap: this.state.hingeBridgeGap,
      hingeSlitsPerCol: this.state.hingeSlitsPerCol,
      materialCategory: material.category,
      panelCutouts: this.state.panelCutouts,
      dogboneRelief: this.state.dogboneRelief,
      assemblyMarks: this.state.assemblyMarks,
      bedWidth: machine.bedWidth,
      bedHeight: machine.bedHeight,
      partSpacing: this.state.partSpacing,
      cutSpeed: effectiveCutSpeed
    });

    this.scene3D.updateModel(this.currentModel, material);
    this.sheet2D.updateModel(this.currentModel, fit2D);
    this._updateTelemetryHUD();
  }

  _updateTelemetryHUD() {
    const { outerW, outerD, outerH, innerW, innerD, innerH, kerfDelta } = this.currentModel.dimensions;
    const { totalCutLengthMm, totalCutTimeSec, fitsOnBed } = this.currentModel.telemetry;
    const { boundingWidth, boundingHeight, bedWidth, bedHeight } = this.currentModel.nesting;
    const hp = this.currentModel.hingePhysics;

    this.el.hudOuterDims.textContent = `${outerW.toFixed(1)} × ${outerD.toFixed(1)} × ${outerH.toFixed(1)} mm`;
    this.el.hudInnerDims.textContent = `${innerW.toFixed(1)} × ${innerD.toFixed(1)} × ${innerH.toFixed(1)} mm`;

    const sign = kerfDelta >= 0 ? '+' : '';
    this.el.hudKerfDelta.textContent = `${sign}${kerfDelta.toFixed(3)} mm (${Math.round(kerfDelta * 1000)} µm)`;

    this.el.hudCutLength.textContent = `${(totalCutLengthMm / 1000).toFixed(2)} m (${this.currentModel.panels.length} parts)`;

    const mins = Math.floor(totalCutTimeSec / 60);
    const secs = Math.round(totalCutTimeSec % 60);
    this.el.hudCutTime.textContent = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

    if (hp) {
      this.el.hudHingeArc.textContent = `${hp.arcLength.toFixed(1)} mm (R=${hp.bendRadius.toFixed(0)}mm @ 90°)`;
      this.el.hudHingeStrain.textContent = `${hp.numCols} cols | ε=${(hp.estimatedStrain * 100).toFixed(1)}% / ${(hp.maxStrain * 100).toFixed(1)}%`;
      this.el.hudHingeBadge.textContent = hp.message;
      if (hp.status === 'danger') {
        this.el.hudHingeBadge.className =
          'mt-1 px-2 py-1 rounded text-[11px] font-mono font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/40';
      } else if (hp.status === 'warning') {
        this.el.hudHingeBadge.className =
          'mt-1 px-2 py-1 rounded text-[11px] font-mono font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40';
      } else {
        this.el.hudHingeBadge.className =
          'mt-1 px-2 py-1 rounded text-[11px] font-mono font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30';
      }
    }

    if (fitsOnBed) {
      this.el.hudBedStatus.textContent = `Fits ${Math.ceil(boundingWidth)}×${Math.ceil(boundingHeight)} mm on ${bedWidth}×${bedHeight} mm bed`;
      this.el.hudBedStatus.className = 'text-xs font-mono text-emerald-400';
    } else {
      this.el.hudBedStatus.textContent = `Exceeds ${bedWidth}×${bedHeight} mm bed (${Math.ceil(boundingWidth)}×${Math.ceil(boundingHeight)} mm)`;
      this.el.hudBedStatus.className = 'text-xs font-mono text-rose-400';
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.boxForgeApp = new BoxForgeApp();
});
