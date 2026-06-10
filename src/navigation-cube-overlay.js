import {
  NAVIGATION_CUBE_VIEW_IDS,
  getNavigationCubeIconPath,
  getNavigationCubeItems,
} from './navigation-cube.js';

const NAVIGATION_CUBE_LAYOUT = Object.freeze({
  [NAVIGATION_CUBE_VIEW_IDS.top]: 'top',
  [NAVIGATION_CUBE_VIEW_IDS.left]: 'left',
  [NAVIGATION_CUBE_VIEW_IDS.home]: 'home',
  [NAVIGATION_CUBE_VIEW_IDS.right]: 'right',
  [NAVIGATION_CUBE_VIEW_IDS.bottom]: 'bottom',
  [NAVIGATION_CUBE_VIEW_IDS.front]: 'front',
  [NAVIGATION_CUBE_VIEW_IDS.back]: 'back',
});

function createButton(item, options, viewApi, setActiveViewId, onWarn) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'navigation-cube-button';
  button.dataset.viewId = item.id;
  button.dataset.kind = item.kind;
  button.dataset.slot = NAVIGATION_CUBE_LAYOUT[item.id] ?? item.id;
  button.setAttribute('aria-label', item.label);
  button.title = item.label;

  const icon = document.createElement('img');
  icon.className = 'navigation-cube-button-icon';
  icon.alt = '';
  icon.draggable = false;
  icon.decoding = 'async';
  icon.src = getNavigationCubeIconPath(item);
  icon.addEventListener('error', () => {
    onWarn?.(`Navigation cube icon introuvable: ${item.id}`);
  }, { once: true });

  const stopPointer = (event) => {
    event.stopPropagation();
  };
  button.addEventListener('pointerdown', stopPointer);
  button.addEventListener('pointerup', stopPointer);
  button.addEventListener('dblclick', stopPointer);
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    viewApi.activate(item.id);
    const activeViewId = viewApi.getActiveViewId?.() ?? null;
    setActiveViewId(activeViewId === item.id || item.id === 'home' ? activeViewId : item.id);
  });
  if (item.id === 'home') {
    button.addEventListener('dblclick', (event) => {
      event.preventDefault();
      event.stopPropagation();
      viewApi.resetView();
      setActiveViewId(viewApi.getActiveViewId?.() ?? null);
    });
  }

  button.append(icon);
  return button;
}

export function createNavigationCubeOverlay(options) {
  const {
    container,
    viewApi,
    onWarn = console.warn,
  } = options ?? {};

  if (!(container instanceof HTMLElement)) {
    throw new Error('Navigation cube overlay invalide : container HTMLElement requis.');
  }
  if (!viewApi || typeof viewApi.activate !== 'function') {
    throw new Error('Navigation cube overlay invalide : viewApi.activate(...) requis.');
  }

  const root = document.createElement('div');
  root.className = 'navigation-cube-overlay';
  root.setAttribute('role', 'toolbar');
  root.setAttribute('aria-label', 'Navigation cube');

  const card = document.createElement('div');
  card.className = 'navigation-cube-card';
  const stopCardPointer = (event) => {
    event.stopPropagation();
  };
  card.addEventListener('pointerdown', stopCardPointer);
  card.addEventListener('pointerup', stopCardPointer);
  card.addEventListener('click', stopCardPointer);
  card.addEventListener('dblclick', stopCardPointer);

  const header = document.createElement('button');
  header.type = 'button';
  header.className = 'panel-toggle navigation-cube-toggle';
  header.setAttribute('aria-expanded', 'false');
  header.setAttribute('aria-controls', 'navigationCubeBody');

  const headerTitle = document.createElement('span');
  headerTitle.className = 'panel-toggle-title';
  headerTitle.textContent = 'Cube de navigation';

  const headerIcon = document.createElement('span');
  headerIcon.className = 'panel-toggle-icon';
  headerIcon.textContent = '[+]';

  header.append(headerTitle, headerIcon);

  const grid = document.createElement('div');
  grid.className = 'navigation-cube-grid';

  const body = document.createElement('div');
  body.className = 'navigation-cube-body';
  body.id = 'navigationCubeBody';
  body.hidden = true;

  let activeViewId = viewApi.getActiveViewId?.() ?? null;
  const buttonMap = new Map();
  const syncActiveClasses = () => {
    for (const [viewId, button] of buttonMap.entries()) {
      const isActive = viewId === activeViewId;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    }
  };
  const setActiveViewId = (nextViewId) => {
    activeViewId = nextViewId ?? null;
    syncActiveClasses();
  };

  for (const item of getNavigationCubeItems()) {
    const button = createButton(item, {}, viewApi, setActiveViewId, onWarn);
    buttonMap.set(item.id, button);
    grid.append(button);
  }
  body.append(grid);

  header.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const collapsed = !body.hidden;
    body.hidden = collapsed;
    card.classList.toggle('is-collapsed', collapsed);
    header.setAttribute('aria-expanded', String(!collapsed));
    headerIcon.textContent = collapsed ? '[+]' : '[-]';
  });

  card.classList.add('is-collapsed');
  card.append(header, body);
  root.append(card);

  return Object.freeze({
    element: root,
    mount() {
      container.append(root);
      syncActiveClasses();
      return root;
    },
    destroy() {
      root.remove();
      buttonMap.clear();
    },
    setActiveViewId,
    getActiveViewId() {
      return activeViewId;
    },
    getButton(viewId) {
      return buttonMap.get(viewId) ?? null;
    },
    getBodyElement() {
      return body;
    },
  });
}
