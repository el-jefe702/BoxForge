# BoxForge Pro — Parametric Laser Enclosures & Living Hinges

**BoxForge Pro** is a browser-based, parametric 3D laser enclosure and chassis designer built on **Three.js** with native **LightBurn `.lbrn2`** export.

## Core Capabilities

- **True-Fit Kerf & Caliper Calibration:** Compensates male/female finger joints and T-slots for exact laser beam kerf (`mm`), caliper-measured material thickness (`t`), and fit bias (Press-Fit, Glue/Neutral Fit, Slip-Fit).
- **Real-Time 3D Kinematic Folding & Explode Viewport:** Interactive Three.js assembly that smoothly folds flat sheets (`0%`) into the assembled 3D enclosure (`100%`), including a 14-link articulated **Living Hinge** curve and radial joint explode.
- **Parametric Living Hinge & Bend-Stress Physics Engine:** Supports Straight Alternating Slits, Sinusoidal Wave Lattice, and Diamond Lozenge Lattice on **LightBurn Layer `C02` (Red)** with real-time torsional strain & fracture risk alerts.
- **Panel Hardware Cutout Studio:** 11 built-in hardware cutouts (40mm/80mm Fan Grilles, USB-C, DB9 D-Sub, DC Barrel Jack, KCD1 Rocker Switch, NEMA 17 Stepper, Raspberry Pi 4/5 Standoffs, Vent Louvers, Custom Ports) with Layer `C01` inner cut paths and Layer `C03` vector-scored silkscreens.
- **One-Click Native LightBurn `.lbrn2` & `.svg` Export:** Pre-assigns cut priority and layer settings (`C03` Score First $\rightarrow$ `C02` Living Hinge $\rightarrow$ `C01` Inner Cutouts $\rightarrow$ `C00` Outer Perimeter Last), plus a **1-Minute Kerf Calibration Comb `.lbrn2` Generator**.

## Quickstart

No build step or bundler is required:

```powershell
# Start local development server on http://localhost:8080
python -m http.server 8080

# Run automated verification suite
python tests/verify_phase1.py
```

## Autonomous Agent Handoff

Incoming AI coding agents should read:
1. [`STATE_CHECKPOINT.json`](./STATE_CHECKPOINT.json) — Machine-readable checkpoint ledger (`DONE` vs. `PENDING`).
2. [`AGENT_HANDOFF.md`](./AGENT_HANDOFF.md) — Detailed implementation blueprints and verification gates for Phases 3A–4B.
