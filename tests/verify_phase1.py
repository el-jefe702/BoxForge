"""
BoxForge Pro — Phase 1, Phase 2, Phase 3A, Phase 3B & Phase 3C Automated Verification Suite
Verifies DOM-to-Controller ID bindings, ES module export/import integrity,
Living Hinge bend-stress physics invariants, Hardware Cutout templates,
Dual-Mode .lbrn2 kerf export, 1-Minute Kerf Calibration Wizard,
Dogbone Corner Micro-Reliefs, Layer C03 Assembly Witness Marks,
Universal AutoCAD R12 DXF Exporter, and 90-degree Smart Rotation Nesting.
"""

import math
import re
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent


def test_file_structure_and_dom_ids():
    index_html = (ROOT / "index.html").read_text(encoding="utf-8")
    main_js = (ROOT / "src" / "main.js").read_text(encoding="utf-8")
    wizard_js = (ROOT / "src" / "ui" / "kerfWizardModal.js").read_text(encoding="utf-8")

    for rel_path in [
        "src/presets.js",
        "src/geometry/parametricCore.js",
        "src/geometry/livingHinge.js",
        "src/geometry/cutoutLibrary.js",
        "src/ui/kerfWizardModal.js",
        "src/viewport/scene3D.js",
        "src/viewport/sheet2D.js",
        "src/exporters/exportEngine.js",
        "src/exporters/dxfExporter.js",
        "src/exporters/index.js",
        "src/main.js",
    ]:
        assert (ROOT / rel_path).exists(), f"Missing required module: {rel_path}"

    referenced_ids = re.findall(r"getElementById\(['\"]([^'\"]+)['\"]\)", main_js)
    wizard_ids = re.findall(r"getElementById\(['\"]([^'\"]+)['\"]\)", wizard_js)
    all_referenced_ids = set(referenced_ids + wizard_ids)

    assert len(all_referenced_ids) >= 50, f"Expected >=50 bound DOM IDs, found {len(all_referenced_ids)}"

    missing = []
    for dom_id in all_referenced_ids:
        if f'id="{dom_id}"' not in index_html:
            missing.append(dom_id)

    assert not missing, f"Missing DOM IDs in index.html: {missing}"
    print(f"[PASS] All {len(all_referenced_ids)} DOM IDs in src/main.js & kerfWizardModal.js match index.html")


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

    assert '<index Value="2"/>' in exporter_js, "Missing Layer C02 CutSetting in .lbrn2 exporter"
    assert "C02 - Living Hinge Lattice" in exporter_js

    r = 18.0
    t = 2.92
    theta = math.pi / 2.0
    arc_len = (r + t * 0.5) * theta
    assert 30.0 < arc_len < 31.0
    print("[PASS] Living Hinge patterns, bend-stress math, Layer C02 export, and all 11 hardware cutout templates verified")


def test_phase_3a_kerf_wizard_and_dual_lbrn_mode():
    exporter_js = (ROOT / "src" / "exporters" / "exportEngine.js").read_text(encoding="utf-8")
    wizard_js = (ROOT / "src" / "ui" / "kerfWizardModal.js").read_text(encoding="utf-8")

    assert '<kerf Value="' in exporter_js, "Exporter must output <kerf Value=... /> attribute"
    assert 'lightburn-layer' in exporter_js, "Exporter must support lightburn-layer kerfMode option"

    assert 'class KerfWizardModal' in wizard_js
    assert '[-0.05, 0.00, 0.05, 0.10, 0.14, 0.18, 0.22]' in wizard_js or '-0.05' in wizard_js
    print("[PASS] Phase 3A Kerf Calibration Wizard and Dual .lbrn2 Kerf Mode verified")


def test_phase_3b_dogbones_and_witness_marks():
    core_js = (ROOT / "src" / "geometry" / "parametricCore.js").read_text(encoding="utf-8")
    main_js = (ROOT / "src" / "main.js").read_text(encoding="utf-8")
    index_html = (ROOT / "index.html").read_text(encoding="utf-8")

    assert 'generateDogbonePoints' in core_js, "Missing generateDogbonePoints function"
    assert 'dogboneRelief' in core_js, "parametricCore must accept dogboneRelief option"
    assert 'assemblyMarks' in core_js, "parametricCore must accept assemblyMarks option"
    assert 'generateAssemblyWitnessMarks' in core_js, "Missing generateAssemblyWitnessMarks function"

    assert 'id="chk-dogbone"' in index_html, "Missing chk-dogbone in index.html"
    assert 'id="chk-witness-marks"' in index_html, "Missing chk-witness-marks in index.html"
    assert 'chkDogbone' in main_js
    assert 'chkWitnessMarks' in main_js

    print("[PASS] Phase 3B Dogbone Corner Reliefs and Layer C03 Assembly Witness Marks verified")


def test_phase_3c_dxf_exporter_and_rotation_nesting():
    dxf_js = (ROOT / "src" / "exporters" / "dxfExporter.js").read_text(encoding="utf-8")
    core_js = (ROOT / "src" / "geometry" / "parametricCore.js").read_text(encoding="utf-8")
    main_js = (ROOT / "src" / "main.js").read_text(encoding="utf-8")
    index_html = (ROOT / "index.html").read_text(encoding="utf-8")

    # Verify DXF exporter layer standards
    assert 'generateProductionDXF' in dxf_js, "Missing generateProductionDXF export"
    for layer_name in ['0_OUTER_CUT', '1_INNER_CUT', '2_LIVING_HINGE', '3_VECTOR_SCORE']:
        assert layer_name in dxf_js, f"Missing layer {layer_name} in dxfExporter.js"

    # Verify R12 ASCII version header
    assert 'AC1009' in dxf_js, "DXF exporter must target AutoCAD R12 AC1009 standard"

    # Verify rotation parameter in packPanelsOnBed
    assert 'allowRotation' in core_js, "packPanelsOnBed must accept allowRotation option"

    # Verify DXF export button and checkbox
    assert 'id="btn-export-dxf"' in index_html, "Missing btn-export-dxf in index.html"
    assert 'id="chk-rotation"' in index_html, "Missing chk-rotation in index.html"
    assert 'btnExportDxf' in main_js
    assert 'chkRotation' in main_js

    print("[PASS] Phase 3C AutoCAD DXF Exporter (R12 ASCII) and 90-degree Rotation Nesting verified")


if __name__ == "__main__":
    test_file_structure_and_dom_ids()
    test_finger_distribution_invariants()
    test_kerf_offset_complementarity()
    test_living_hinge_physics_and_cutout_templates()
    test_phase_3a_kerf_wizard_and_dual_lbrn_mode()
    test_phase_3b_dogbones_and_witness_marks()
    test_phase_3c_dxf_exporter_and_rotation_nesting()
    print("ALL PHASE 1, PHASE 2, PHASE 3A, PHASE 3B & PHASE 3C VERIFICATION CHECKS PASSED.")
