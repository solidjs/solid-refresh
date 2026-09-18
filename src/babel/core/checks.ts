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

// A component receives at most one argument (its props), so a
// function with more than one parameter isn't a component.
// A rest parameter accepts any number of arguments, so a function
// declaring one isn't a component either: it's a plain function
// that happens to have a Pascal-cased name, and wrapping it in the
// HMR proxy would drop every argument after the first.
export function isComponentishParams(
  params: (t.Identifier | t.Pattern | t.RestElement)[],
): boolean {
  return params.length < 2 && !params.some(param => t.isRestElement(param));
}
