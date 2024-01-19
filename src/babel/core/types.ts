import type * as t from '@babel/types';
import type { RuntimeType } from '../../shared/types';

export interface NamedImportDefinition {
  kind: 'named';
  name: string;
  source: string;
}

export interface DefaultImportDefinition {
  kind: 'default';
  source: string;
}

export type ImportDefinition = DefaultImportDefinition | NamedImportDefinition;

export interface Options {
  bundler?: RuntimeType;
  fixRender?: boolean;
  imports?: {
    createContext: ImportDefinition[];
    render: ImportDefinition[];
  };
}

export type ImportIdentifierType = 'render' | 'createContext';

export interface ImportIdentifierSpecifier {
  type: ImportIdentifierType;
  definition: ImportDefinition;
}

export interface StateContext {
  opts: Options;
  specifiers: ImportIdentifierSpecifier[];
  imports: Map<string, t.Identifier>;
  registrations: {
    identifiers: Map<t.Identifier, ImportIdentifierSpecifier>;
    namespaces: Map<t.Identifier, ImportIdentifierSpecifier[]>;
  };
  processed: boolean;
  filename: string | undefined;
  bundler: RuntimeType;
  fixRender: boolean;
}
