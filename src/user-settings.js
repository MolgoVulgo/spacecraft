const STORAGE_KEY = 'spacecraft.user_settings.v1';

const THEMES = new Set(['dark', 'light']);
const LANGUAGES = new Set(['fr', 'en']);
const RIGHT_MOUSE_MODES = new Set(['moveScene', 'orbitCamera']);
const KEYBOARD_LAYOUTS = new Set(['auto', 'azerty', 'qwerty', 'custom']);
const KEYBOARD_INPUT_MODES = new Set(['physical', 'character']);

export const DEFAULT_USER_SETTINGS = {
  interface: {
    theme: 'dark',
    language: 'fr',
  },
  viewport: {
    edgeColor: '#000000',
  },
  camera: {
    rightMouseMode: 'moveScene',
    rotationSensitivity: 1,
    panSensitivity: 1,
    depthSensitivity: 1,
    zoomSensitivity: 1,
    invertY: false,
    keyboardLayout: 'auto',
    keyboardInputMode: 'physical',
    bindings: {
      moveForward: 'KeyW',
      moveBackward: 'KeyS',
      moveLeft: 'KeyA',
      moveRight: 'KeyD',
      moveDown: 'KeyQ',
      moveUp: 'KeyE',
    },
  },
  selection: {
    selectionColor: '#2f80ff',
    collisionColor: '#ff2d2d',
  },
  editor: {
    undoLimit: 10,
    autoSaveEnabled: true,
    autoSaveInterval: 5,
  },
  paths: {
    defaultImportDir: '',
    defaultExportDir: '',
  },
};

export const DEFAULT_ADVANCED_SETTINGS = {
  advanced: {
    snapEnabled: true,
  },
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function sanitizeColor(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(String(value ?? '')) ? String(value).toLowerCase() : fallback;
}

function sanitizeString(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function sanitizeBoolean(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

function sanitizeEnum(value, allowed, fallback) {
  return allowed.has(value) ? value : fallback;
}

export function normalizeAdvancedSettings(input = {}) {
  const advanced = input?.advanced ?? {};
  return {
    advanced: {
      snapEnabled: sanitizeBoolean(advanced.snapEnabled, true),
    },
  };
}

export function normalizeUserSettings(input = {}) {
  const settings = input ?? {};
  const defaults = DEFAULT_USER_SETTINGS;
  const cameraBindings = settings.camera?.bindings ?? {};
  const legacyControlPreset = settings.camera?.controlPreset;
  const migratedRightMouseMode = legacyControlPreset === 'orbitLeft_keyboardMove'
    ? 'orbitCamera'
    : 'moveScene';
  return {
    interface: {
      theme: sanitizeEnum(settings.interface?.theme, THEMES, defaults.interface.theme),
      language: sanitizeEnum(settings.interface?.language, LANGUAGES, defaults.interface.language),
    },
    viewport: {
      edgeColor: sanitizeColor(settings.viewport?.edgeColor, defaults.viewport.edgeColor),
    },
    camera: {
      rightMouseMode: sanitizeEnum(settings.camera?.rightMouseMode, RIGHT_MOUSE_MODES, migratedRightMouseMode),
      rotationSensitivity: clampNumber(settings.camera?.rotationSensitivity, defaults.camera.rotationSensitivity, 0.1, 5),
      panSensitivity: clampNumber(settings.camera?.panSensitivity, defaults.camera.panSensitivity, 0.1, 5),
      depthSensitivity: clampNumber(settings.camera?.depthSensitivity, defaults.camera.depthSensitivity, 0.1, 5),
      zoomSensitivity: clampNumber(settings.camera?.zoomSensitivity, defaults.camera.zoomSensitivity, 0.1, 5),
      invertY: sanitizeBoolean(settings.camera?.invertY, defaults.camera.invertY),
      keyboardLayout: sanitizeEnum(settings.camera?.keyboardLayout, KEYBOARD_LAYOUTS, defaults.camera.keyboardLayout),
      keyboardInputMode: sanitizeEnum(settings.camera?.keyboardInputMode, KEYBOARD_INPUT_MODES, defaults.camera.keyboardInputMode),
      bindings: {
        moveForward: sanitizeString(cameraBindings.moveForward, defaults.camera.bindings.moveForward),
        moveBackward: sanitizeString(cameraBindings.moveBackward, defaults.camera.bindings.moveBackward),
        moveLeft: sanitizeString(cameraBindings.moveLeft, defaults.camera.bindings.moveLeft),
        moveRight: sanitizeString(cameraBindings.moveRight, defaults.camera.bindings.moveRight),
        moveDown: sanitizeString(cameraBindings.moveDown, defaults.camera.bindings.moveDown),
        moveUp: sanitizeString(cameraBindings.moveUp, defaults.camera.bindings.moveUp),
      },
    },
    selection: {
      selectionColor: sanitizeColor(settings.selection?.selectionColor, defaults.selection.selectionColor),
      collisionColor: sanitizeColor(settings.selection?.collisionColor, defaults.selection.collisionColor),
    },
    editor: {
      undoLimit: Math.round(clampNumber(settings.editor?.undoLimit, defaults.editor.undoLimit, 1, 200)),
      autoSaveEnabled: sanitizeBoolean(settings.editor?.autoSaveEnabled, defaults.editor.autoSaveEnabled),
      autoSaveInterval: Math.round(clampNumber(settings.editor?.autoSaveInterval, defaults.editor.autoSaveInterval, 1, 300)),
    },
    paths: {
      defaultImportDir: sanitizeString(settings.paths?.defaultImportDir, defaults.paths.defaultImportDir),
      defaultExportDir: sanitizeString(settings.paths?.defaultExportDir, defaults.paths.defaultExportDir),
    },
  };
}

export function loadUserSettings() {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return clone(DEFAULT_USER_SETTINGS);
    return normalizeUserSettings(JSON.parse(raw));
  } catch {
    return clone(DEFAULT_USER_SETTINGS);
  }
}

export function saveUserSettings(settings) {
  const normalized = normalizeUserSettings(settings);
  globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function getDefaultUserSettings() {
  return clone(DEFAULT_USER_SETTINGS);
}
