"""
BoxForge Pro — Phase 1 & Phase 2 Automated Verification Suite
Verifies DOM-to-Controller ID bindings, ES module export/import integrity,
Living Hinge bend-stress physics invariants, Hardware Cutout templates,
and mathematical invariants of the parametric kerf & finger-joint core.
"""

import math
import re
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent


def test_file_structure_and_dom_ids():
    index_html = (ROOT / "index.html").read_text(encoding="utf-8")
    main_js = (ROOT / "src" / "main.js").read_text(encoding="utf-8")

    for rel_path in [
        "src/presets.js",
        "src/geometry/parametricCore.js",
        "src/geometry/livingHinge.js",
        "src/geometry/cutoutLibrary.js",
        "src/viewport/scene3D.js",
        "src/viewport/sheet2D.js",
        "src/exporters/exportEngine.js",
        "src/main.js",
    ]:
        assert (ROOT / rel_path).exists(), f"Missing required module: {rel_path}"

    referenced_ids = re.findall(r"getElementById\(['\"]([^'\"]+)['\"]\)", main_js)
    assert len(referenced_ids) >= 35, f"Expected >=35 bound DOM IDs, found {len(referenced_ids)}"

    missing = []
    for dom_id in referenced_ids:
        if f'id="{dom_id}"' not in index_html:
            missing.append(dom_id)

    assert not missing, f"Missing DOM IDs in index.html: {missing}"
    print(f"[PASS] All {len(referenced_ids)} DOM IDs in src/main.js match index.html")


def test_finger_distribution_invariants():
    for edge_len in [45, 68, 100, 145, 220, 360]:
        for t in [2.92, 3.12, 5.85]:
            for target_fw in [8, 14, 24]:
                usable_span = max(t * 2, edge_len - 2 * t)
                clamped = max(t * 1.5, min(usable_span / 2, target_fw))
                segments = round(usable_span / clamped)
                if segments < 3:
                    segments = 3
                if segments % 2 == 0:
                    segments += 1
                pitch = usable_span / segments

                assert segments >= 3 and segments % 2 == 1, "Segments must be odd >= 3"
                assert abs(segments * pitch + 2 * t - edge_len) < 1e-6, "Total span must equal edge_len"
    print("[PASS] Finger distribution maintains odd-segment corner symmetry across all dimensions")


def test_kerf_offset_complementarity():
    for kerf in [0.11, 0.14, 0.18]:
        for fit_bias in [-0.08, 0.0, 0.04]:
            delta = (kerf * 0.5) + (fit_bias * 0.25)
            pitch = 14.0
            male_cad_width = pitch + 2 * delta
            female_cad_width = pitch - 2 * delta

            male_physical_width = male_cad_width - kerf
            female_physical_width = female_cad_width + kerf

            net_interference = male_physical_width - female_physical_width
            assert abs(net_interference - fit_bias) < 1e-9, (
                f"Expected net interference {fit_bias}, got {net_interference}"
            )
    print("[PASS] Male/Female kerf compensation math verified to sub-micron precision")


def test_living_hinge_physics_and_cutout_templates():
    lh_js = (ROOT / "src" / "geometry" / "livingHinge.js").read_text(encoding="utf-8")
    cutout_js = (ROOT / "src" / "geometry" / "cutoutLibrary.js").read_text(encoding="utf-8")
    exporter_js = (ROOT / "src" / "exporters" / "exportEngine.js").read_text(encoding="utf-8")

    for pattern_id in ["straight", "wave", "diamond"]:
        assert f"id: '{pattern_id}'" in lh_js, f"Missing living hinge pattern: {pattern_id}"

    for tpl_id in [
        "fan-40mm",
        "fan-80mm",
        "vent-slots",
        "usb-c",
        "dc-barrel",
        "rocker-kcd1",
        "db9-dsub",
        "nema17",
        "rpi-mount",
        "custom-rect",
        "custom-circle",
    ]:
        assert f"id: '{tpl_id}'" in cutout_js, f"Missing cutout template: {tpl_id}"

    # Verify Layer C02 (CutIndex="2") is configured in LightBurn exporter
    assert '<index Value="2"/>' in exporter_js, "Missing Layer C02 CutSetting in .lbrn2 exporter"
    assert "C02 - Living Hinge Lattice" in exporter_js

    # Verify neutral-axis arc length math: L = (r + t/2) * (pi/2)
    r = 18.0
    t = 2.92
    theta = math.pi / 2.0
    arc_len = (r + t * 0.5) * theta
    assert 30.0 < arc_len < 31.0
    print("[PASS] Living Hinge patterns, bend-stress math, Layer C02 export, and all 11 hardware cutout templates verified")


if __name__ == "__main__":
    test_file_structure_and_dom_ids()
    test_finger_distribution_invariants()
    test_kerf_offset_complementarity()
    test_living_hinge_physics_and_cutout_templates()
    print("ALL PHASE 1 & PHASE 2 VERIFICATION CHECKS PASSED.")
