/**
 * BoxForge Pro — Commercial SaaS Tier & License Management Modal
 * Handles plan tier comparisons (Hobbyist Free vs Shop Pro $19/mo vs Makerspace Lab $49/mo),
 * header license badge status, and local demonstration license toggle.
 */

export class ProUpgradeModal {
  constructor({ onLicenseChange } = {}) {
    this.onLicenseChange = onLicenseChange || (() => {});

    this.modalEl = document.getElementById('modal-pro-upgrade');
    this.btnOpen = document.getElementById('btn-open-pro-upgrade');
    this.btnClose = document.getElementById('btn-pro-close');
    this.proBadge = document.getElementById('pro-badge');
    this.btnToggleLicense = document.getElementById('btn-toggle-demo-license');
    this.statusEl = document.getElementById('pro-license-status');

    this._initLicenseState();
    this._bindEvents();
    this._updateUI();
  }

  _initLicenseState() {
    try {
      const stored = localStorage.getItem('boxforge_pro_licensed');
      // Default to true for full demo capability inspection
      this.isLicensed = stored === null ? true : stored === 'true';
    } catch {
      this.isLicensed = true;
    }
  }

  isPro() {
    return Boolean(this.isLicensed);
  }

  _bindEvents() {
    if (this.btnOpen) {
      this.btnOpen.addEventListener('click', () => this.open());
    }

    if (this.btnClose) {
      this.btnClose.addEventListener('click', () => this.close());
    }

    if (this.modalEl) {
      this.modalEl.addEventListener('click', (e) => {
        if (e.target === this.modalEl) {
          this.close();
        }
      });
    }

    if (this.btnToggleLicense) {
      this.btnToggleLicense.addEventListener('click', () => {
        this.toggleLicense();
      });
    }
  }

  toggleLicense() {
    this.isLicensed = !this.isLicensed;
    try {
      localStorage.setItem('boxforge_pro_licensed', String(this.isLicensed));
    } catch (err) {
      console.warn('Could not persist license to localStorage:', err);
    }
    this._updateUI();
    this.onLicenseChange(this.isLicensed);
  }

  _updateUI() {
    if (this.proBadge) {
      this.proBadge.textContent = this.isLicensed ? 'PRO ACTIVE' : 'HOBBYIST';
      if (this.btnOpen) {
        if (this.isLicensed) {
          this.btnOpen.className =
            'px-2.5 py-1.5 rounded-md text-xs font-semibold bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:from-emerald-500/30 hover:to-teal-500/30 text-emerald-300 border border-emerald-500/40 transition flex items-center gap-1.5 shadow-sm';
        } else {
          this.btnOpen.className =
            'px-2.5 py-1.5 rounded-md text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition flex items-center gap-1.5 shadow-sm';
        }
      }
    }

    if (this.statusEl) {
      if (this.isLicensed) {
        this.statusEl.textContent = 'PRO ACTIVE';
        this.statusEl.className =
          'text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
      } else {
        this.statusEl.textContent = 'HOBBYIST (FREE)';
        this.statusEl.className =
          'text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30';
      }
    }
  }

  open() {
    if (this.modalEl) {
      this._updateUI();
      this.modalEl.classList.remove('hidden');
    }
  }

  close() {
    if (this.modalEl) {
      this.modalEl.classList.add('hidden');
    }
  }
}
