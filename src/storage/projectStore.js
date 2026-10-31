/**
 * BoxForge Pro — Project Persistence & Shareable Permalinks
 * Supports:
 *  - URL Hash Permalinks (#design=<base64url>)
 *  - .boxforge.json File Export & Import
 *  - Custom Shop Machine & Material Preset Manager (localStorage)
 */

export function serializeStateToHash(state) {
  try {
    const compact = {
      m: state.machineId,
      mat: state.materialId,
      fit: state.fitPresetId,
      km: state.kerfMode,
      style: state.boxStyle,
      jt: state.jointType,
      hw: state.hardwareId,
      dm: state.dimensionMode,
      w: state.width,
      d: state.depth,
      h: state.height,
      t: state.thickness,
      k: state.kerf,
      fi: state.fitInterference,
      fw: state.fingerWidth,
      hp: state.hingePattern,
      hr: state.hingeRadius,
      hcs: state.hingeColSpacing,
      hbg: state.hingeBridgeGap,
      hsp: state.hingeSlitsPerCol,
      db: state.dogboneRelief ? 1 : 0,
      wm: state.assemblyMarks ? 1 : 0,
      rot: state.allowRotation ? 1 : 0,
      stamp: state.shopStamp || '',
      dx: state.dividersX,
      dy: state.dividersY,
      cuts: (state.panelCutouts || []).map(c => ({
        id: c.id,
        pid: c.panelId,
        t: c.type,
        n: c.name,
        x: c.x,
        y: c.y,
        w: c.width,
        h: c.height,
        r: c.rotation
      }))
    };

    const jsonStr = JSON.stringify(compact);
    // Base64URL safe encoding
    const b64 = btoa(encodeURIComponent(jsonStr).replace(/%([0-9A-F]{2})/g, (match, p1) => {
      return String.fromCharCode('0x' + p1);
    }));
    return `design=${encodeURIComponent(b64)}`;
  } catch (err) {
    console.warn('Failed to serialize state to hash:', err);
    return '';
  }
}

export function deserializeStateFromHash() {
  try {
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash || !hash.includes('design=')) return null;

    const b64 = decodeURIComponent(hash.split('design=')[1].split('&')[0]);
    const jsonStr = decodeURIComponent(Array.prototype.map.call(atob(b64), (c) => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    const c = JSON.parse(jsonStr);
    return {
      machineId: c.m,
      materialId: c.mat,
      fitPresetId: c.fit,
      kerfMode: c.km || 'baked',
      boxStyle: c.style,
      jointType: c.jt,
      hardwareId: c.hw,
      dimensionMode: c.dm,
      width: c.w,
      depth: c.d,
      height: c.h,
      thickness: c.t,
      kerf: c.k,
      fitInterference: c.fi,
      fingerWidth: c.fw,
      hingePattern: c.hp,
      hingeRadius: c.hr,
      hingeColSpacing: c.hcs,
      hingeBridgeGap: c.hbg,
      hingeSlitsPerCol: c.hsp,
      dogboneRelief: Boolean(c.db),
      assemblyMarks: Boolean(c.wm ?? 1),
      allowRotation: Boolean(c.rot ?? 1),
      shopStamp: c.stamp || '',
      dividersX: c.dx ?? 0,
      dividersY: c.dy ?? 0,
      panelCutouts: (c.cuts || []).map(item => ({
        id: item.id,
        panelId: item.pid,
        type: item.t,
        name: item.n,
        x: item.x,
        y: item.y,
        width: item.w,
        height: item.h,
        rotation: item.r
      }))
    };
  } catch (err) {
    console.warn('Could not deserialize state from hash:', err);
    return null;
  }
}

export function exportProjectJson(state) {
  const exportData = {
    schema: 'boxforge-project-v1',
    timestamp: new Date().toISOString(),
    state: {
      ...state,
      // exclude runtime ephemeral view fields
      isPlayingFold: false
    }
  };
  return JSON.stringify(exportData, null, 2);
}

export function importProjectJson(file, callback) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (parsed.state) {
        callback(null, parsed.state);
      } else {
        callback(new Error('Invalid BoxForge project file format'));
      }
    } catch (err) {
      callback(err);
    }
  };
  reader.readAsText(file);
}

export function saveCustomMaterialPreset(preset) {
  try {
    const list = loadCustomMaterialPresets();
    const existingIdx = list.findIndex(p => p.id === preset.id);
    if (existingIdx >= 0) {
      list[existingIdx] = preset;
    } else {
      list.push(preset);
    }
    localStorage.setItem('boxforge_custom_materials', JSON.stringify(list));
    return list;
  } catch (err) {
    console.warn('Could not save custom material preset:', err);
    return [];
  }
}

export function loadCustomMaterialPresets() {
  try {
    const raw = localStorage.getItem('boxforge_custom_materials');
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn('Could not load custom material presets:', err);
    return [];
  }
}
