import * as t from '@babel/types';

// This is just a Pascal heuristic
// we only assume a function is a component
// if the first character is in uppercase
export function isComponentishName(name: string) {
  return name[0] >= 'A' && name[0] <= 'Z';
}

export function getImportSpecifierName(specifier: t.ImportSpecifier): string {
  if (t.isIdentifier(specifier.imported)) {
    return specifier.imported.name;
  }
  return specifier.imported.value;
}
