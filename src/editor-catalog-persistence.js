export const EDITOR_PENDING_CATALOG_STORAGE_KEY = 'spacecraft.editor.catalog.pending.v1';

function canUseStorage() {
  try {
    return typeof globalThis.localStorage !== 'undefined';
  } catch {
    return false;
  }
}

export function loadPendingEditorCatalogBackup() {
  if (!canUseStorage()) return null;
  try {
    const raw = globalThis.localStorage.getItem(EDITOR_PENDING_CATALOG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.catalog || typeof parsed.savedAt !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function savePendingEditorCatalogBackup(catalog, meta = {}) {
  if (!canUseStorage()) return false;
  try {
    const payload = {
      catalog,
      reason: meta.reason ?? 'autosave_failed',
      savedAt: meta.savedAt ?? new Date().toISOString(),
    };
    globalThis.localStorage.setItem(EDITOR_PENDING_CATALOG_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function clearPendingEditorCatalogBackup() {
  if (!canUseStorage()) return false;
  try {
    globalThis.localStorage.removeItem(EDITOR_PENDING_CATALOG_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function createEditorCatalogAutosaveController({
  getCatalog,
  writeCatalog,
  onStateChange = () => {},
  debounceMs = 500,
  now = () => new Date().toISOString(),
}) {
  const snapshot = {
    dirty: false,
    saving: false,
    lastSavedAt: null,
    lastError: null,
    autosaveTimer: null,
    lastReason: null,
  };

  function emit() {
    onStateChange({ ...snapshot });
  }

  function clearTimer() {
    if (!snapshot.autosaveTimer) return;
    globalThis.clearTimeout(snapshot.autosaveTimer);
    snapshot.autosaveTimer = null;
  }

  function markDirty(reason = 'edit') {
    snapshot.dirty = true;
    snapshot.lastReason = reason;
    emit();
  }

  async function saveNow(reason = snapshot.lastReason ?? 'manual_save') {
    clearTimer();
    snapshot.saving = true;
    snapshot.lastReason = reason;
    snapshot.lastError = null;
    emit();

    try {
      await writeCatalog(getCatalog(), reason);
      snapshot.dirty = false;
      snapshot.saving = false;
      snapshot.lastSavedAt = now();
      snapshot.lastError = null;
      clearPendingEditorCatalogBackup();
      emit();
      return { ok: true };
    } catch (error) {
      snapshot.dirty = true;
      snapshot.saving = false;
      snapshot.lastError = error;
      savePendingEditorCatalogBackup(getCatalog(), { reason, savedAt: now() });
      emit();
      return { ok: false, error };
    }
  }

  function schedule(reason = snapshot.lastReason ?? 'edit') {
    markDirty(reason);
    clearTimer();
    snapshot.autosaveTimer = globalThis.setTimeout(() => {
      saveNow(reason);
    }, debounceMs);
    emit();
  }

  function setState(nextState = {}) {
    clearTimer();
    Object.assign(snapshot, nextState, { autosaveTimer: null });
    emit();
  }

  function dispose() {
    clearTimer();
  }

  emit();

  return {
    markDirty,
    schedule,
    saveNow,
    setState,
    dispose,
    getState() {
      return { ...snapshot };
    },
  };
}
