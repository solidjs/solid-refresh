import type * as babel from '@babel/core';
import * as t from '@babel/types';
import type {
  ImportIdentifierSpecifier,
  ImportIdentifierType,
  StateContext,
} from './types';
import { unwrapNode } from './unwrap';

function isIdentifierValidCallee(
  state: StateContext,
  path: babel.NodePath,
  callee: t.Identifier,
  target: ImportIdentifierType,
): boolean {
  const binding = path.scope.getBindingIdentifier(callee.name);
  if (binding) {
    const result = state.registrations.identifiers.get(binding);
    if (result && result.type === target) {
      return true;
    }
  }
  return false;
}

function isPropertyValidCallee(
  result: ImportIdentifierSpecifier[],
  target: ImportIdentifierType,
  propName: string,
): boolean {
  for (let i = 0, len = result.length; i < len; i++) {
    const registration = result[i];
    if (registration.type === target) {
      if (registration.definition.kind === 'named') {
        if (registration.definition.name === propName) {
          return true;
        }
      } else if (propName === 'default') {
        return true;
      }
    }
  }
  return false;
}

function isMemberExpressionValidCallee(
  state: StateContext,
  path: babel.NodePath,
  member: t.MemberExpression,
  target: ImportIdentifierType,
): boolean {
  if (!t.isIdentifier(member.property)) {
    return false;
  }
  const trueObject = unwrapNode(member.object, t.isIdentifier);
  if (!trueObject) {
    return false;
  }
  const binding = path.scope.getBindingIdentifier(trueObject.name);
  if (!binding) {
    return false;
  }
  const result = state.registrations.namespaces.get(binding);
  if (!result) {
    return false;
  }
  return isPropertyValidCallee(result, target, member.property.name);
}

export function isValidCallee(
  state: StateContext,
  path: babel.NodePath,
  { callee }: t.CallExpression,
  target: ImportIdentifierType,
) {
  if (t.isV8IntrinsicIdentifier(callee)) {
    return false;
  }
  const trueCallee = unwrapNode(callee, t.isIdentifier);
  if (trueCallee) {
    return isIdentifierValidCallee(state, path, trueCallee, target);
  }
  const trueMember = unwrapNode(callee, t.isMemberExpression);
  if (trueMember && !trueMember.computed) {
    return isMemberExpressionValidCallee(state, path, trueMember, target);
  }

  return false;
}
