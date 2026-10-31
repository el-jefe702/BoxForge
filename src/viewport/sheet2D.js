/**
 * BoxForge Pro — Interactive 2D Laser Bed & Kerf Inspection Canvas (Phase 1 + Phase 2)
 * Renders nested flat panels on the target laser bed with LightBurn layer colors:
 *  - C00 (White/Black): Outer Perimeter Cut
 *  - C01 (Blue #3b82f6): Inner Cutouts & Mortises
 *  - C02 (Red #ef4444):  Living Hinge Lattice Slits
 *  - C03 (Green #10b981): Vector Score Silkscreens & Part Labels
 */

export class LaserSheet2D {
  constructor(canvasEl, onSelectPanel) {
    this.canvas = canvasEl;
    this.ctx = canvasEl.getContext('2d');
    this.onSelectPanel = onSelectPanel || (() => {});

    this.model = null;
    this.selectedPanelId = null;
    this.hoveredPanelId = null;
    this.showNominalOverlay = true;

    this.zoom = 1.0;
    this.panX = 40;
    this.panY = 40;
    this.isPanning = false;
    this.lastMouse = { x: 0, y: 0 };

    this._initEvents();
  }

  _initEvents() {
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const factor = e.deltaY < 0 ? 1.14 : 0.88;
      const nextZoom = Math.max(0.35, Math.min(35, this.zoom * factor));

      this.panX = mx - ((mx - this.panX) / this.zoom) * nextZoom;
      this.panY = my - ((my - this.panY) / this.zoom) * nextZoom;
      this.zoom = nextZoom;
      this.render();
    }, { passive: false });

    let downPos = { x: 0, y: 0 };
    this.canvas.addEventListener('pointerdown', (e) => {
      this.isPanning = true;
      this.lastMouse = { x: e.clientX, y: e.clientY };
      downPos = { x: e.clientX, y: e.clientY };
      this.canvas.setPointerCapture(e.pointerId);
    });

    this.canvas.addEventListener('pointermove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      if (this.isPanning) {
        this.panX += e.clientX - this.lastMouse.x;
        this.panY += e.clientY - this.lastMouse.y;
        this.lastMouse = { x: e.clientX, y: e.clientY };
        this.render();
        return;
      }

      const worldX = (mx - this.panX) / this.zoom;
      const worldY = (my - this.panY) / this.zoom;
      const hit = this._hitTestPanel(worldX, worldY);
      const hitId = hit ? hit.id : null;
      if (hitId !== this.hoveredPanelId) {
        this.hoveredPanelId = hitId;
        this.canvas.style.cursor = hitId ? 'pointer' : 'grab';
        this.render();
      }
    });

    this.canvas.addEventListener('pointerup', (e) => {
      this.isPanning = false;
      if (Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) < 5) {
        const rect = this.canvas.getBoundingClientRect();
        const worldX = (e.clientX - rect.left - this.panX) / this.zoom;
        const worldY = (e.clientY - rect.top - this.panY) / this.zoom;
        const hit = this._hitTestPanel(worldX, worldY);
        const nextId = hit && hit.id !== this.selectedPanelId ? hit.id : null;
        this.selectedPanelId = nextId;
        this.onSelectPanel(hit && nextId ? hit : null);
        this.render();
      }
    });

    this._resizeObserver = new ResizeObserver(() => this.resize());
    if (this.canvas.parentElement) {
      this._resizeObserver.observe(this.canvas.parentElement);
    }
  }

  _hitTestPanel(wx, wy) {
    if (!this.model) return null;
    for (const p of this.model.panels) {
      if (!p.bedPosition) continue;
      const { x, y } = p.bedPosition;
      if (wx >= x && wx <= x + p.width && wy >= y && wy <= y + p.height) {
        return p;
      }
    }
    return null;
  }

  selectPanel(panelId) {
    this.selectedPanelId = panelId;
    this.render();
  }

  updateModel(model, autoFit = false) {
    const firstLoad = !this.model;
    this.model = model;
    if (firstLoad || autoFit) {
      this.fitToBed();
    } else {
      this.render();
    }
  }

  fitToBed() {
    if (!this.model || !this.canvas.parentElement) return;
    const cw = this.canvas.parentElement.clientWidth || 600;
    const ch = this.canvas.parentElement.clientHeight || 500;
    this.canvas.width = cw * window.devicePixelRatio;
    this.canvas.height = ch * window.devicePixelRatio;

    const { bedWidth, bedHeight, boundingWidth, boundingHeight } = this.model.nesting;
    const targetW = Math.max(bedWidth, boundingWidth);
    const targetH = Math.max(bedHeight, boundingHeight);

    const pad = 48;
    const scaleX = (cw - pad * 2) / targetW;
    const scaleY = (ch - pad * 2) / targetH;
    this.zoom = Math.max(0.4, Math.min(4.5, Math.min(scaleX, scaleY)));
    this.panX = (cw - targetW * this.zoom) * 0.5;
    this.panY = (ch - targetH * this.zoom) * 0.5;
    this.render();
  }

  zoomToKerfDetail() {
    if (!this.model || this.model.panels.length === 0) return;
    const cw = this.canvas.parentElement?.clientWidth || 600;
    const ch = this.canvas.parentElement?.clientHeight || 500;
    const targetPanel = this.model.panels.find(p => p.id === this.selectedPanelId) || this.model.panels[1] || this.model.panels[0];
    const bx = targetPanel.bedPosition.x + targetPanel.width * 0.25;
    const by = targetPanel.bedPosition.y;
    this.zoom = 16;
    this.panX = cw * 0.5 - bx * this.zoom;
    this.panY = ch * 0.5 - by * this.zoom;
    this.render();
  }

  resize() {
    if (!this.canvas.parentElement) return;
    const cw = this.canvas.parentElement.clientWidth || 600;
    const ch = this.canvas.parentElement.clientHeight || 500;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = cw * dpr;
    this.canvas.height = ch * dpr;
    this.render();
  }

  render() {
    const ctx = this.ctx;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = this.canvas.width / dpr;
    const ch = this.canvas.height / dpr;

    ctx.save();
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, cw, ch);

    if (!this.model) {
      ctx.restore();
      return;
    }

    const { bedWidth, bedHeight } = this.model.nesting;

    ctx.save();
    ctx.translate(this.panX, this.panY);
    ctx.scale(this.zoom, this.zoom);

    // 1. Draw Laser Bed Surface & Grid
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, bedWidth, bedHeight);

    ctx.lineWidth = 1 / this.zoom;
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.38)';
    ctx.beginPath();
    for (let x = 0; x <= bedWidth; x += 10) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, bedHeight);
    }
    for (let y = 0; y <= bedHeight; y += 10) {
      ctx.moveTo(0, y);
      ctx.lineTo(bedWidth, y);
    }
    ctx.stroke();

    ctx.strokeStyle = 'rgba(71, 85, 105, 0.65)';
    ctx.beginPath();
    for (let x = 0; x <= bedWidth; x += 50) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, bedHeight);
    }
    for (let y = 0; y <= bedHeight; y += 50) {
      ctx.moveTo(0, y);
      ctx.lineTo(bedWidth, y);
    }
    ctx.stroke();

    ctx.lineWidth = 1.8 / this.zoom;
    ctx.strokeStyle = this.model.nesting.fitsOnBed ? '#334155' : '#ef4444';
    ctx.strokeRect(0, 0, bedWidth, bedHeight);

    ctx.fillStyle = '#64748b';
    ctx.font = `${Math.max(8, 10 / this.zoom)}px ui-monospace, monospace`;
    ctx.fillText(`BED 0,0 (${bedWidth}×${bedHeight}mm)`, 4 / this.zoom, -6 / this.zoom);

    // 2. Draw Each Nested Panel
    for (const panel of this.model.panels) {
      const pos = panel.bedPosition || { x: 0, y: 0, overflow: false };
      const isSelected = panel.id === this.selectedPanelId;
      const isHovered = panel.id === this.hoveredPanelId;

      ctx.save();
      ctx.translate(pos.x, pos.y);

      this._tracePolygon(ctx, panel.outline);
      ctx.fillStyle = pos.overflow
        ? 'rgba(239, 68, 68, 0.14)'
        : isSelected
          ? 'rgba(56, 189, 248, 0.18)'
          : isHovered
            ? 'rgba(251, 191, 36, 0.14)'
            : 'rgba(30, 41, 59, 0.65)';
      ctx.fill();

      // Nominal Reference Path (Uncompensated dashed amber overlay)
      if (this.showNominalOverlay && panel.nominalOutline) {
        ctx.save();
        ctx.setLineDash([3 / this.zoom, 3 / this.zoom]);
        ctx.lineWidth = 1.1 / this.zoom;
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.78)';
        this._tracePolygon(ctx, panel.nominalOutline);
        ctx.stroke();
        ctx.restore();
      }

      // Layer C03: Vector Score Silkscreen Frames (LightBurn Green #10b981)
      if (panel.scorePaths && panel.scorePaths.length > 0) {
        ctx.lineWidth = 1.15 / this.zoom;
        ctx.strokeStyle = '#10b981';
        for (const sp of panel.scorePaths) {
          this._tracePolyline(ctx, sp.points, sp.closed);
          ctx.stroke();
        }
      }

      // Layer C02: Living Hinge Lattice Slits (LightBurn Red #ef4444)
      if (panel.livingHingePaths && panel.livingHingePaths.length > 0) {
        ctx.lineWidth = 1.25 / this.zoom;
        ctx.strokeStyle = '#ef4444';
        for (const lhp of panel.livingHingePaths) {
          this._tracePolyline(ctx, lhp.points, lhp.closed);
          ctx.stroke();
        }
      }

      // Layer C01: Inner Cutouts & Mortises (LightBurn Blue #3b82f6)
      ctx.lineWidth = 1.35 / this.zoom;
      ctx.strokeStyle = '#3b82f6';
      ctx.fillStyle = '#090d16';
      for (const h of panel.holes) {
        ctx.beginPath();
        if (h.type === 'circle') {
          ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
        } else if (h.points && h.points.length > 2) {
          ctx.moveTo(h.points[0].x, h.points[0].y);
          for (let i = 1; i < h.points.length; i++) {
            ctx.lineTo(h.points[i].x, h.points[i].y);
          }
          ctx.closePath();
        }
        ctx.fill();
        ctx.stroke();
      }

      // Layer C00: Outer Perimeter Cut Path (Kerf-Compensated)
      this._tracePolygon(ctx, panel.outline);
      ctx.lineWidth = (isSelected ? 2.2 : 1.5) / this.zoom;
      ctx.strokeStyle = pos.overflow
        ? '#ef4444'
        : isSelected
          ? '#38bdf8'
          : isHovered
            ? '#fbbf24'
            : '#f8fafc';
      ctx.stroke();

      // Layer C03: Vector Score Part Labels (LightBurn Green #10b981)
      ctx.fillStyle = '#10b981';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const fontSize = Math.min(panel.width * 0.11, Math.max(4.5, 11 / Math.sqrt(this.zoom)));
      ctx.font = `600 ${fontSize}px ui-monospace, SFMono-Regular, Consolas, monospace`;
      for (const ann of panel.scoreAnnotations) {
        ctx.fillText(ann.text, ann.x, ann.y);
      }

      ctx.restore();
    }

    ctx.restore();
    this._drawLegendHUD(ctx, cw, ch);
    ctx.restore();
  }

  _tracePolygon(ctx, pts) {
    this._tracePolyline(ctx, pts, true);
  }

  _tracePolyline(ctx, pts, closed = false) {
    if (!pts || pts.length === 0) return;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    if (closed) ctx.closePath();
  }

  _drawLegendHUD(ctx, cw, ch) {
    const pad = 12;
    const boxW = 415;
    const boxH = 30;
    const x = pad;
    const y = ch - boxH - pad;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.8)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, boxW, boxH, 6);
    ctx.fill();
    ctx.stroke();

    ctx.font = '11px ui-monospace, monospace';
    ctx.textBaseline = 'middle';
    const cy = y + boxH / 2;

    // C00 Cut
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(x + 10, cy - 4, 8, 8);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('C00 Outer', x + 22, cy);

    // C01 Inner
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(x + 92, cy - 4, 8, 8);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('C01 Inner', x + 104, cy);

    // C02 Living Hinge
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(x + 174, cy - 4, 8, 8);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('C02 Hinge', x + 186, cy);

    // C03 Score
    ctx.fillStyle = '#10b981';
    ctx.fillRect(x + 258, cy - 4, 8, 8);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('C03 Score', x + 270, cy);

    // Nominal ref
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(x + 340, cy - 4, 8, 8);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('Nominal', x + 352, cy);
  }
}
