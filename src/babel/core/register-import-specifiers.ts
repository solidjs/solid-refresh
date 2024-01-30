import type * as babel from '@babel/core';
import * as t from '@babel/types';
import { getImportSpecifierName } from './checks';
import type { ImportIdentifierSpecifier, StateContext } from './types';

function registerImportSpecifier(
  state: StateContext,
  id: ImportIdentifierSpecifier,
  specifier:
    | t.ImportDefaultSpecifier
    | t.ImportNamespaceSpecifier
    | t.ImportSpecifier,
) {
  if (t.isImportDefaultSpecifier(specifier)) {
    if (id.definition.kind === 'default') {
      state.registrations.identifiers.set(specifier.local, id);
    }
    return;
  }
  if (t.isImportSpecifier(specifier)) {
    if (specifier.importKind === 'type' || specifier.importKind === 'typeof') {
      return;
    }
    const name = getImportSpecifierName(specifier);
    if (
      (id.definition.kind === 'named' && name === id.definition.name) ||
      (id.definition.kind === 'default' && name === 'default')
    ) {
      state.registrations.identifiers.set(specifier.local, id);
    }
    return;
  }
  let current = state.registrations.namespaces.get(specifier.local);
  if (!current) {
    current = [];
  }
  current.push(id);
  state.registrations.namespaces.set(specifier.local, current);
}

export function registerImportSpecifiers(
  state: StateContext,
  path: babel.NodePath<t.ImportDeclaration>,
  definitions: ImportIdentifierSpecifier[],
) {
  for (let i = 0, len = definitions.length; i < len; i++) {
    const id = definitions[i];
    if (path.node.source.value === id.definition.source) {
      for (let k = 0, klen = path.node.specifiers.length; k < klen; k++) {
        registerImportSpecifier(state, id, path.node.specifiers[k]);
      }
    }
  }
}
