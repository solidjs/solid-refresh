import type { ImportDefinition, ImportIdentifierSpecifier } from './types';

// Source of solid-refresh (for import)
const SOLID_REFRESH_MODULE = 'solid-refresh';

// Exported names from solid-refresh that will be imported
export const IMPORT_REGISTRY: ImportDefinition = {
  kind: 'named',
  name: '$$registry',
  source: SOLID_REFRESH_MODULE,
};

export const IMPORT_REFRESH: ImportDefinition = {
  kind: 'named',
  name: '$$refresh',
  source: SOLID_REFRESH_MODULE,
};

export const IMPORT_COMPONENT: ImportDefinition = {
  kind: 'named',
  name: '$$component',
  source: SOLID_REFRESH_MODULE,
};

export const IMPORT_CONTEXT: ImportDefinition = {
  kind: 'named',
  name: '$$context',
  source: SOLID_REFRESH_MODULE,
};

export const IMPORT_DECLINE: ImportDefinition = {
  kind: 'named',
  name: '$$decline',
  source: SOLID_REFRESH_MODULE,
};

export const IMPORT_SPECIFIERS: ImportIdentifierSpecifier[] = [
  {
    type: 'render',
    definition: { name: 'render', kind: 'named', source: 'solid-js/web' },
  },
  {
    type: 'render',
    definition: { name: 'hydrate', kind: 'named', source: 'solid-js/web' },
  },
  {
    type: 'createContext',
    definition: {
      name: 'createContext',
      kind: 'named',
      source: 'solid-js',
    },
  },
  {
    type: 'createContext',
    definition: {
      name: 'createContext',
      kind: 'named',
      source: 'solid-js/web',
    },
  },
];
