/**
 * BoxForge Pro — Interactive 3D Kinematic Fold & Explode Viewport (Three.js)
 * Phase 1 + Phase 2:
 * - True-thickness 3D extrusion with dual materials (surface finish + laser-charred cut edges)
 * - Articulated 3D Living-Hinge Kinematic Chain (curls smoothly from 0 deg flat to 90 deg radius R)
 * - Hardware Panel Cutouts (Layer C01 holes) & Vector-Scored Silkscreens (Layer C03 green lines)
 * - Raycast hover/selection with part telemetry HUD & dimension gizmos
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class BoxScene3D {
  constructor(containerEl, onSelectPanel) {
    this.container = containerEl;
    this.onSelectPanel = onSelectPanel || (() => {});

    this.foldProgress = 0.85;   // 0.0 (flat) -> 1.0 (folded)
    this.explodeDistance = 0;   // 0mm -> 80mm
    this.lidOpenProgress = 0;   // 0.0 (closed) -> 1.0 (open)
    this.showWireframe = true;
    this.showDimensions = true;
    this.xRayMode = false;

    this.selectedPanelId = null;
    this.hoveredPanelId = null;
    this.panelNodes = new Map();
    this.currentModel = null;
    this.currentMaterialPreset = null;

    this._initThree();
    this._initLightsAndEnvironment();
    this._initInteraction();
    this._animate = this._animate.bind(this);
    requestAnimationFrame(this._animate);
  }

  _initThree() {
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 600;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b0f17);

    this.camera = new THREE.PerspectiveCamera(38, width / height, 1, 5000);
    this.camera.position.set(250, 210, 280);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;

    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.target.set(0, 35, 0);
    this.controls.maxDistance = 1600;
    this.controls.minDistance = 40;

    this.rootGroup = new THREE.Group();
    this.scene.add(this.rootGroup);

    this.dimensionGroup = new THREE.Group();
    this.scene.add(this.dimensionGroup);

    this._resizeObserver = new ResizeObserver(() => this.resize());
    this._resizeObserver.observe(this.container);
  }

  _initLightsAndEnvironment() {
    const hemiLight = new THREE.HemisphereLight(0xe2e8f0, 0x1e293b, 0.85);
    hemiLight.position.set(0, 400, 0);
    this.scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfffbeb, 1.45);
    keyLight.position.set(220, 360, 260);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 20;
    keyLight.shadow.camera.far = 1200;
    const d = 320;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.55);
    rimLight.position.set(-260, 180, -220);
    this.scene.add(rimLight);

    const fillLight = new THREE.DirectionalLight(0x94a3b8, 0.4);
    fillLight.position.set(-180, 90, 240);
    this.scene.add(fillLight);

    const grid = new THREE.GridHelper(700, 35, 0x334155, 0x1e293b);
    grid.position.y = -0.2;
    this.scene.add(grid);

    const shadowFloorGeo = new THREE.PlaneGeometry(1000, 1000);
    const shadowFloorMat = new THREE.ShadowMaterial({ opacity: 0.32 });
    const shadowFloor = new THREE.Mesh(shadowFloorGeo, shadowFloorMat);
    shadowFloor.rotation.x = -Math.PI / 2;
    shadowFloor.position.y = -0.15;
    shadowFloor.receiveShadow = true;
    this.scene.add(shadowFloor);
  }

  _initInteraction() {
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    let downPos = { x: 0, y: 0 };

    this.renderer.domElement.addEventListener('pointerdown', (e) => {
      downPos = { x: e.clientX, y: e.clientY };
    });

    this.renderer.domElement.addEventListener('pointermove', (e) => {
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this._updateHover();
    });

    this.renderer.domElement.addEventListener('pointerup', (e) => {
      if (Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > 5) return;
      this._handleClick();
    });
  }

  _updateHover() {
    const meshes = [];
    this.panelNodes.forEach((node) => {
      if (node.meshes) {
        meshes.push(...node.meshes);
      } else if (node.mesh) {
        meshes.push(node.mesh);
      }
    });
    if (meshes.length === 0) return;

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(meshes, false);
    const nextHoverId = hits.length > 0 ? hits[0].object.userData.panelId : null;

    if (nextHoverId !== this.hoveredPanelId) {
      this.hoveredPanelId = nextHoverId;
      this.renderer.domElement.style.cursor = nextHoverId ? 'pointer' : 'grab';
      this._refreshHighlightStates();
    }
  }

  _handleClick() {
    const nextSelected = this.hoveredPanelId === this.selectedPanelId ? null : this.hoveredPanelId;
    this.selectPanel(nextSelected, true);
  }

  selectPanel(panelId, emitCallback = false) {
    this.selectedPanelId = panelId;
    this._refreshHighlightStates();
    if (emitCallback) {
      const node = panelId ? this.panelNodes.get(panelId) : null;
      this.onSelectPanel(node ? node.panelData : null);
    }
  }

  _refreshHighlightStates() {
    this.panelNodes.forEach((node, id) => {
      const isSelected = id === this.selectedPanelId;
      const isHovered = id === this.hoveredPanelId;

      for (const edgeLines of node.edgeLinesList || []) {
        if (isSelected) {
          edgeLines.material.color.setHex(0x38bdf8);
          edgeLines.material.opacity = 1.0;
        } else if (isHovered) {
          edgeLines.material.color.setHex(0xfbbf24);
          edgeLines.material.opacity = 0.95;
        } else {
          edgeLines.material.color.setHex(0x0f172a);
          edgeLines.material.opacity = this.showWireframe ? 0.55 : 0.0;
        }
      }

      if (node.faceMaterial) {
        node.faceMaterial.emissive.setHex(
          isSelected ? 0x0c4a6e : isHovered ? 0x422006 : 0x000000
        );
        node.faceMaterial.emissiveIntensity = isSelected ? 0.55 : isHovered ? 0.35 : 0;
      }
    });
  }

  _buildMaterialPair(materialPreset) {
    const faceColor = new THREE.Color(materialPreset?.faceColor ?? 0xd9b382);
    const edgeColor = new THREE.Color(materialPreset?.edgeColor ?? 0x3b2313);
    const isTransparent = Boolean(materialPreset?.transparent);
    const effectiveOpacity = this.xRayMode ? 0.38 : (materialPreset?.opacity ?? 1.0);

    const faceMaterial = new THREE.MeshStandardMaterial({
      color: faceColor,
      roughness: materialPreset?.roughness ?? 0.7,
      metalness: materialPreset?.metalness ?? 0.04,
      transparent: isTransparent || this.xRayMode,
      opacity: effectiveOpacity,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1
    });

    const charredEdgeMaterial = new THREE.MeshStandardMaterial({
      color: edgeColor,
      roughness: 0.88,
      metalness: 0.02,
      transparent: isTransparent || this.xRayMode,
      opacity: this.xRayMode ? 0.55 : Math.min(1.0, effectiveOpacity + 0.08)
    });

    return { faceMaterial, charredEdgeMaterial };
  }

  _buildExtrudedPanelGeometry(panel) {
    const shape = new THREE.Shape();
    const pts = panel.outline;
    if (pts.length > 0) {
      shape.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        shape.lineTo(pts[i].x, pts[i].y);
      }
      shape.closePath();
    }

    for (const h of panel.holes) {
      const holePath = new THREE.Path();
      if (h.type === 'circle') {
        holePath.absarc(h.x, h.y, h.radius, 0, Math.PI * 2, true);
      } else if (h.points && h.points.length > 2) {
        holePath.moveTo(h.points[0].x, h.points[0].y);
        for (let i = 1; i < h.points.length; i++) {
          holePath.lineTo(h.points[i].x, h.points[i].y);
        }
        holePath.closePath();
      }
      shape.holes.push(holePath);
    }

    return new THREE.ExtrudeGeometry(shape, {
      depth: panel.thickness,
      bevelEnabled: false,
      curveSegments: 20
    });
  }

  /**
   * Build Layer C03 green vector-score lines on top & bottom surfaces of a panel mesh
   */
  _attachScoreLines(parentMesh, scorePaths, thickness) {
    if (!scorePaths || scorePaths.length === 0) return;
    const scoreMat = new THREE.LineBasicMaterial({ color: 0x10b981 });
    for (const sp of scorePaths) {
      if (!sp.points || sp.points.length < 2) continue;
      for (const zOff of [-0.08, thickness + 0.08]) {
        const pts3D = sp.points.map(p => new THREE.Vector3(p.x, p.y, zOff));
        if (sp.closed) pts3D.push(pts3D[0].clone());
        const geo = new THREE.BufferGeometry().setFromPoints(pts3D);
        parentMesh.add(new THREE.Line(geo, scoreMat));
      }
    }
  }

  /**
   * Build an Articulated 3D Living-Hinge Wrap Assembly:
   *  1. Lower vertical back wall section (0 -> straightBackH)
   *  2. 14 articulated torsion links across arcLength with charred lattice kerf lines
   *  3. Upper top lid section (straightTopD) with male finger joints along its front edge
   */
  _buildArticulatedLivingHingeNode(panel, materialPreset) {
    const { faceMaterial, charredEdgeMaterial } = this._buildMaterialPair(materialPreset);
    const { straightBackH, arcLength, straightTopD } = panel.kinematics;
    const W = panel.width;
    const t = panel.thickness;

    const pivotGroup = new THREE.Group();
    const meshes = [];
    const edgeLinesList = [];

    const addDecoratedMesh = (geo, targetGroup) => {
      const m = new THREE.Mesh(geo, [faceMaterial, charredEdgeMaterial]);
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData.panelId = panel.id;
      const edgesGeo = new THREE.EdgesGeometry(geo, 18);
      const edgesMat = new THREE.LineBasicMaterial({
        color: 0x0f172a,
        transparent: true,
        opacity: this.showWireframe ? 0.55 : 0.0
      });
      const el = new THREE.LineSegments(edgesGeo, edgesMat);
      m.add(el);
      targetGroup.add(m);
      meshes.push(m);
      edgeLinesList.push(el);
      return m;
    };

    // 1. Lower Back Wall Mesh (clipped to y <= straightBackH)
    const lowerOutline = panel.outline.filter(p => p.y <= straightBackH + 0.5);
    const lowerHoles = panel.holes.filter(h => (h.y ?? h.points?.[0]?.y ?? 0) <= straightBackH);
    const lowerGeo = this._buildExtrudedPanelGeometry({
      outline: lowerOutline.length >= 4
        ? lowerOutline
        : [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: straightBackH }, { x: 0, y: straightBackH }],
      holes: lowerHoles,
      thickness: t
    });

    const baseWallGroup = new THREE.Group();
    const lowerMesh = addDecoratedMesh(lowerGeo, baseWallGroup);
    this._attachScoreLines(
      lowerMesh,
      (panel.scorePaths || []).filter(sp => sp.points?.[0]?.y <= straightBackH),
      t
    );
    pivotGroup.add(baseWallGroup);

    // 2. Articulated Torsion Links (N = 14 links across arcLength)
    const numLinks = 14;
    const linkLen = arcLength / numLinks;
    const linkPivots = [];
    let parentLinkGroup = baseWallGroup;

    // Charred slit line material (Layer C02 dark kerf lines)
    const slitMat = new THREE.LineBasicMaterial({ color: 0x1c1008 });

    for (let i = 0; i < numLinks; i++) {
      const linkPivot = new THREE.Group();
      if (i === 0) {
        // First hinge joint starts at top of straightBackH (local x = W/2, y = straightBackH, z = 0)
        linkPivot.position.set(0, straightBackH, 0);
      } else {
        linkPivot.position.set(0, linkLen, 0);
      }

      // Build rectangular segment [0..W] x [0..linkLen]
      const segShape = new THREE.Shape();
      segShape.moveTo(0, 0);
      segShape.lineTo(W, 0);
      segShape.lineTo(W, linkLen + 0.08);
      segShape.lineTo(0, linkLen + 0.08);
      segShape.closePath();

      const segGeo = new THREE.ExtrudeGeometry(segShape, { depth: t, bevelEnabled: false });
      const segMesh = addDecoratedMesh(segGeo, linkPivot);

      // Draw visible laser-cut lattice slit lines across each link face
      for (const zOff of [-0.06, t + 0.06]) {
        const slitPts = [
          new THREE.Vector3(2, linkLen * 0.5, zOff),
          new THREE.Vector3(W - 2, linkLen * 0.5, zOff)
        ];
        const slitGeo = new THREE.BufferGeometry().setFromPoints(slitPts);
        segMesh.add(new THREE.Line(slitGeo, slitMat));
      }

      parentLinkGroup.add(linkPivot);
      linkPivots.push(linkPivot);
      parentLinkGroup = linkPivot;
    }

    // 3. Upper Top Lid Section attached to the end of the last torsion link!
    const topStartY = straightBackH + arcLength;
    const topOutline = panel.outline
      .filter(p => p.y >= topStartY - 0.5)
      .map(p => ({ x: p.x, y: p.y - topStartY }));
    const topHoles = panel.holes
      .filter(h => (h.y ?? h.points?.[0]?.y ?? 0) > topStartY)
      .map(h => {
        if (h.type === 'circle') {
          return { ...h, y: h.y - topStartY };
        }
        return {
          ...h,
          points: h.points.map(pt => ({ x: pt.x, y: pt.y - topStartY }))
        };
      });

    const lidPivot = new THREE.Group();
    lidPivot.position.set(0, linkLen, 0);

    const topGeo = this._buildExtrudedPanelGeometry({
      outline: topOutline.length >= 4
        ? topOutline
        : [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: straightTopD }, { x: 0, y: straightTopD }],
      holes: topHoles,
      thickness: t
    });
    addDecoratedMesh(topGeo, lidPivot);
    parentLinkGroup.add(lidPivot);

    return {
      pivotGroup,
      baseWallGroup,
      linkPivots,
      meshes,
      edgeLinesList,
      faceMaterial,
      charredEdgeMaterial,
      panelData: panel
    };
  }

  /**
   * Rebuild the entire 3D enclosure from parametric model & material preset
   */
  updateModel(model, materialPreset) {
    this.currentModel = model;
    this.currentMaterialPreset = materialPreset;

    // Dispose old meshes
    this.panelNodes.forEach((node) => {
      for (const m of node.meshes || []) {
        m.geometry.dispose();
      }
      if (node.faceMaterial) node.faceMaterial.dispose();
      if (node.charredEdgeMaterial) node.charredEdgeMaterial.dispose();
      for (const el of node.edgeLinesList || []) {
        el.geometry.dispose();
        el.material.dispose();
      }
    });
    this.panelNodes.clear();
    this.rootGroup.clear();

    this.backPivotGroup = null;
    this.topPivotGroup = null;

    for (const panel of model.panels) {
      if (panel.kinematics.role === 'living-hinge-wrap') {
        const lhNode = this._buildArticulatedLivingHingeNode(panel, materialPreset);
        this.panelNodes.set(panel.id, lhNode);
        this.rootGroup.add(lhNode.pivotGroup);
        continue;
      }

      const geometry = this._buildExtrudedPanelGeometry(panel);
      const { faceMaterial, charredEdgeMaterial } = this._buildMaterialPair(materialPreset);

      const mesh = new THREE.Mesh(geometry, [faceMaterial, charredEdgeMaterial]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.panelId = panel.id;

      this._attachScoreLines(mesh, panel.scorePaths, panel.thickness);

      const edgesGeo = new THREE.EdgesGeometry(geometry, 18);
      const edgesMat = new THREE.LineBasicMaterial({
        color: 0x0f172a,
        transparent: true,
        opacity: this.showWireframe ? 0.55 : 0.0
      });
      const edgeLines = new THREE.LineSegments(edgesGeo, edgesMat);
      mesh.add(edgeLines);

      const pivotGroup = new THREE.Group();
      pivotGroup.add(mesh);

      this.panelNodes.set(panel.id, {
        pivotGroup,
        mesh,
        meshes: [mesh],
        edgeLines,
        edgeLinesList: [edgeLines],
        faceMaterial,
        charredEdgeMaterial,
        panelData: panel
      });

      if (panel.id === 'back') {
        this.backPivotGroup = pivotGroup;
        this.rootGroup.add(pivotGroup);
      } else if (panel.id === 'top') {
        this.topPivotGroup = pivotGroup;
      } else {
        this.rootGroup.add(pivotGroup);
      }
    }

    if (this.topPivotGroup) {
      if (this.backPivotGroup) {
        this.backPivotGroup.add(this.topPivotGroup);
      } else {
        this.rootGroup.add(this.topPivotGroup);
      }
    }

    this._applyKinematics();
    this._rebuildDimensionGizmos();
    this._refreshHighlightStates();
  }

  /**
   * Apply real-time fold progress (0..1), lid open angle, and explode distance (mm)
   */
  _applyKinematics() {
    if (!this.currentModel) return;

    const { outerW: W, outerD: D, outerH: H, thickness: t } = this.currentModel.dimensions;
    const f = Math.max(0, Math.min(1, this.foldProgress));
    const unfold = 1 - f;
    const explode = this.explodeDistance;
    const flatGap = unfold * (t * 0.65);

    this.panelNodes.forEach((node) => {
      const { pivotGroup, mesh, panelData } = node;
      const role = panelData.kinematics.role;

      pivotGroup.position.set(0, 0, 0);
      pivotGroup.rotation.set(0, 0, 0);
      if (mesh) {
        mesh.position.set(0, 0, 0);
        mesh.rotation.set(0, 0, 0);
      }

      switch (role) {
        case 'base': {
          mesh.rotation.x = -Math.PI / 2;
          mesh.position.set(-W / 2, 0, D / 2);
          pivotGroup.position.y = -explode * 0.45;
          break;
        }

        case 'wall-front': {
          pivotGroup.position.set(0, 0, D / 2 + flatGap + explode);
          pivotGroup.rotation.x = unfold * (Math.PI / 2);
          mesh.position.set(-W / 2, 0, -t);
          break;
        }

        case 'wall-back': {
          pivotGroup.position.set(0, 0, -D / 2 - flatGap - explode);
          pivotGroup.rotation.x = -unfold * (Math.PI / 2);
          mesh.rotation.y = Math.PI;
          mesh.position.set(W / 2, 0, t);
          break;
        }

        case 'living-hinge-wrap': {
          // 1. Pivot the back wall section from flat on the bed (-90 deg) up to vertical (0 deg)
          pivotGroup.position.set(0, 0, -D / 2 - flatGap - explode);
          pivotGroup.rotation.x = -unfold * (Math.PI / 2);
          node.baseWallGroup.rotation.set(0, Math.PI, 0);
          node.baseWallGroup.position.set(W / 2, 0, t);

          // 2. Articulate each of the 14 living-hinge torsion links!
          // Total bend angle is f * (PI / 2) minus lidOpenProgress * (PI * 0.55)
          const lidPeekRad = this.lidOpenProgress * (Math.PI * 0.55);
          const totalBendRad = Math.max(0, f * (Math.PI / 2) - lidPeekRad);
          const perLinkRad = totalBendRad / node.linkPivots.length;

          for (const lp of node.linkPivots) {
            // Because baseWallGroup is rotated 180 deg around Y, local -X rotation bends forward toward +Z!
            lp.rotation.x = -perLinkRad;
          }
          break;
        }

        case 'wall-left': {
          pivotGroup.position.set(-W / 2 - flatGap - explode, 0, 0);
          pivotGroup.rotation.z = unfold * (Math.PI / 2);
          mesh.rotation.y = -Math.PI / 2;
          mesh.position.set(t, 0, -D / 2);
          break;
        }

        case 'wall-right': {
          pivotGroup.position.set(W / 2 + flatGap + explode, 0, 0);
          pivotGroup.rotation.z = -unfold * (Math.PI / 2);
          mesh.rotation.y = Math.PI / 2;
          mesh.position.set(-t, 0, D / 2);
          break;
        }

        case 'top-lid': {
          const lidPeekRad = this.lidOpenProgress * (Math.PI * 0.58);
          pivotGroup.position.set(0, H + flatGap + explode * 0.9, 0);
          pivotGroup.rotation.x = Math.max(0, f * (Math.PI / 2) - lidPeekRad);
          mesh.rotation.x = -Math.PI / 2;
          mesh.position.set(-W / 2, -t, D);
          break;
        }

        case 'divider-x': {
          const xPos = -W / 2 + panelData.kinematics.xOffset;
          const dropLift = unfold * (H * 1.35) + explode * 0.65;
          pivotGroup.position.set(xPos, dropLift, 0);
          mesh.rotation.y = -Math.PI / 2;
          mesh.position.set(t * 0.5, 0, -panelData.width * 0.5);
          break;
        }

        case 'divider-y': {
          const zPos = D / 2 - panelData.kinematics.yOffset;
          const dropLift = unfold * (H * 1.65) + explode * 0.95;
          pivotGroup.position.set(0, dropLift, zPos);
          mesh.position.set(-panelData.width * 0.5, 0, -t * 0.5);
          break;
        }
      }
    });
  }

  _rebuildDimensionGizmos() {
    this.dimensionGroup.clear();
    if (!this.showDimensions || !this.currentModel) return;

    const { outerW: W, outerD: D, outerH: H } = this.currentModel.dimensions;
    const offset = 18;
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.65
    });

    const addMeasureLine = (p1, p2) => {
      const geo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
      this.dimensionGroup.add(new THREE.Line(geo, lineMat));
    };

    addMeasureLine(
      new THREE.Vector3(-W / 2, 0.5, D / 2 + offset),
      new THREE.Vector3(W / 2, 0.5, D / 2 + offset)
    );
    addMeasureLine(
      new THREE.Vector3(W / 2 + offset, 0.5, -D / 2),
      new THREE.Vector3(W / 2 + offset, 0.5, D / 2)
    );
    addMeasureLine(
      new THREE.Vector3(W / 2 + offset, 0, D / 2 + offset),
      new THREE.Vector3(W / 2 + offset, H, D / 2 + offset)
    );
  }

  setFoldProgress(val) {
    this.foldProgress = Math.max(0, Math.min(1, Number(val)));
    this._applyKinematics();
  }

  setExplodeDistance(val) {
    this.explodeDistance = Math.max(0, Number(val));
    this._applyKinematics();
  }

  setLidOpenProgress(val) {
    this.lidOpenProgress = Math.max(0, Math.min(1, Number(val)));
    this._applyKinematics();
  }

  setWireframe(enabled) {
    this.showWireframe = Boolean(enabled);
    this._refreshHighlightStates();
  }

  setXRayMode(enabled) {
    this.xRayMode = Boolean(enabled);
    if (this.currentModel && this.currentMaterialPreset) {
      this.updateModel(this.currentModel, this.currentMaterialPreset);
    }
  }

  setShowDimensions(enabled) {
    this.showDimensions = Boolean(enabled);
    this._rebuildDimensionGizmos();
  }

  resetCamera(view = 'iso') {
    if (!this.currentModel) return;
    const { outerW: W, outerD: D, outerH: H } = this.currentModel.dimensions;
    const maxDim = Math.max(W, D, H, 100);
    const dist = maxDim * 2.15;

    this.controls.target.set(0, H * 0.4, 0);
    if (view === 'top') {
      this.camera.position.set(0, dist * 1.4, 0.01);
    } else if (view === 'front') {
      this.camera.position.set(0, H * 0.5, dist * 1.3);
    } else {
      this.camera.position.set(dist * 0.95, dist * 0.78, dist * 1.05);
    }
    this.controls.update();
  }

  resize() {
    if (!this.container) return;
    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 600;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  _animate() {
    requestAnimationFrame(this._animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
