/**
 * BoxForge Pro — 1-Minute Kerf Calibration Wizard Modal
 * Interactive simulator for the 7-slot interlocking test comb.
 * Lets users calibrate their laser kerf by selecting the snug-fitting slot,
 * previewing the real-time fit bias, and saving custom profiles to localStorage.
 */

export class KerfWizardModal {
  constructor({ onApplyCalibration, onDownloadComb }) {
    this.onApplyCalibration = onApplyCalibration || (() => {});
    this.onDownloadComb = onDownloadComb || (() => {});

    // Slots match generateKerfCalibrationCombLbrn2
    this.slots = [-0.05, 0.00, 0.05, 0.10, 0.14, 0.18, 0.22];
    this.selectedOffset = 0.14; // Default standard kerf offset
    this.caliperThickness = 2.92;
    this.kerfMode = 'baked';

    this.modalEl = document.getElementById('modal-kerf-wizard');
    this.slotsContainer = document.getElementById('wizard-comb-slots');
    this.labelPreviewKerf = document.getElementById('wizard-preview-kerf');
    this.labelPreviewFit = document.getElementById('wizard-preview-fit');
    this.inputCaliper = document.getElementById('wizard-input-caliper');
    this.selectKerfMode = document.getElementById('wizard-select-kerf-mode');
    this.btnDownloadComb = document.getElementById('btn-wizard-download-comb');
    this.btnApply = document.getElementById('btn-wizard-apply');
    this.btnClose = document.getElementById('btn-wizard-close');

    this._bindEvents();
    this._renderSlots();
  }

  _bindEvents() {
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

    if (this.btnDownloadComb) {
      this.btnDownloadComb.addEventListener('click', () => {
        this.onDownloadComb();
      });
    }

    if (this.inputCaliper) {
      this.inputCaliper.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (!isNaN(val) && val >= 0.5 && val <= 25.0) {
          this.caliperThickness = val;
          this._updateSummary();
        }
      });
    }

    if (this.selectKerfMode) {
      this.selectKerfMode.addEventListener('change', (e) => {
        this.kerfMode = e.target.value;
      });
    }

    if (this.btnApply) {
      this.btnApply.addEventListener('click', () => {
        const result = {
          thickness: this.caliperThickness,
          kerf: Math.max(0, this.selectedOffset),
          kerfMode: this.kerfMode
        };

        // Persist to localStorage
        try {
          localStorage.setItem('boxforge_custom_calibration', JSON.stringify(result));
        } catch (err) {
          console.warn('Could not save calibration to localStorage', err);
        }

        this.onApplyCalibration(result);
        this.close();
      });
    }
  }

  _renderSlots() {
    if (!this.slotsContainer) return;

    this.slotsContainer.innerHTML = this.slots.map((offset, idx) => {
      const isSelected = Math.abs(offset - this.selectedOffset) < 0.001;
      const signStr = offset >= 0 ? `+${offset.toFixed(2)}` : offset.toFixed(2);
      const slotNum = idx + 1;

      return `
        <button type="button" data-comb-slot="${offset}"
          class="flex-1 min-w-[50px] p-2 rounded flex flex-col items-center justify-between transition border ${
            isSelected
              ? 'bg-amber-500/20 border-amber-400 text-amber-300 ring-2 ring-amber-500/50'
              : 'bg-slate-900 border-slate-700 hover:border-slate-500 text-slate-300'
          }">
          <span class="text-[10px] font-mono text-slate-400">#${slotNum}</span>
          <div class="h-10 w-full flex items-center justify-center py-1">
            <div class="bg-amber-400/80 rounded-sm" style="width: ${Math.max(4, 20 - idx * 2)}px; height: 100%;"></div>
          </div>
          <span class="font-mono text-xs font-semibold mt-1">${signStr}</span>
          <span class="text-[9px] text-slate-400">mm</span>
        </button>
      `;
    }).join('');

    this.slotsContainer.querySelectorAll('[data-comb-slot]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.selectedOffset = parseFloat(btn.dataset.combSlot);
        this._renderSlots();
        this._updateSummary();
      });
    });

    this._updateSummary();
  }

  _updateSummary() {
    if (this.labelPreviewKerf) {
      this.labelPreviewKerf.textContent = `${this.selectedOffset.toFixed(2)} mm (${Math.round(this.selectedOffset * 1000)} µm)`;
    }
    if (this.labelPreviewFit) {
      if (this.selectedOffset <= 0.05) {
        this.labelPreviewFit.textContent = 'Loose / Slip Fit (for sliding lids or thick lacquer)';
      } else if (this.selectedOffset <= 0.14) {
        this.labelPreviewFit.textContent = 'Optimal Friction Press-Fit (snug assembly without glue)';
      } else {
        this.labelPreviewFit.textContent = 'Very Tight / Mallet Fit (high-wattage or wide beam spot)';
      }
    }
  }

  open(currentThickness = 2.92, currentKerf = 0.14, currentMode = 'baked') {
    this.caliperThickness = currentThickness;
    this.selectedOffset = currentKerf;
    this.kerfMode = currentMode;

    if (this.inputCaliper) this.inputCaliper.value = currentThickness;
    if (this.selectKerfMode) this.selectKerfMode.value = currentMode;

    this._renderSlots();
    if (this.modalEl) {
      this.modalEl.classList.remove('hidden');
    }
  }

  close() {
    if (this.modalEl) {
      this.modalEl.classList.add('hidden');
    }
  }
}
