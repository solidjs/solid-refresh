import * as babel from "@babel/core";
import * as t from "@babel/types";
import generator from "@babel/generator";
import { addNamed } from "@babel/helper-module-imports";
import crypto from "crypto";

type ImportHook = Map<string, t.Identifier>;

interface Options {
  bundler?: "esm" | "standard" | "vite" | "webpack5";
  fixRender?: boolean;
}

interface Ref<T> {
  value: T;
}

interface State extends babel.PluginPass {
  hooks: ImportHook;
  opts: Options;
  processed: Ref<boolean>;
  granular: Ref<boolean>;
}

function isComponentishName(name: string) {
  return typeof name === "string" && name[0] >= "A" && name[0] <= "Z";
}

function getModuleIdentifier(hooks: ImportHook, path: babel.NodePath, name: string, mod: string) {
  const target = `${mod}[${name}]`;
  const current = hooks.get(target);
  if (current) {
    return current;
  }
  const newID = addNamed(path, name, mod);
  hooks.set(target, newID);
  return newID;
}

function getSolidRefreshIdentifier(
  hooks: ImportHook,
  path: babel.NodePath,
  name: string
): t.Identifier {
  return getModuleIdentifier(hooks, path, name, "solid-refresh");
}

function isESMHMR(bundler: Options["bundler"]) {
  // The currently known ESM HMR implementations
  // esm - the original ESM HMR Spec
  // vite - Vite's implementation
  return bundler === "esm" || bundler === "vite";
}

function getHotIdentifier(bundler: Options["bundler"]): t.MemberExpression {
  // vite/esm uses `import.meta.hot`
  if (isESMHMR(bundler)) {
    return t.memberExpression(
      t.memberExpression(t.identifier("import"), t.identifier("meta")),
      t.identifier("hot")
    );
  }
  // webpack 5 uses `import.meta.webpackHot`
  if (bundler === "webpack5") {
    return t.memberExpression(
      t.memberExpression(t.identifier("import"), t.identifier("meta")),
      t.identifier("webpackHot")
    );
  }
  // `module.hot` is the default.
  return t.memberExpression(t.identifier("module"), t.identifier("hot"));
}

function getStatementPath(path: babel.NodePath): babel.NodePath | null {
  if (t.isStatement(path.node)) {
    return path;
  }
  if (path.parentPath) {
    return getStatementPath(path.parentPath);
  }
  return null;
}

function createHotMap(hooks: ImportHook, path: babel.NodePath, name: string): t.Identifier {
  const current = hooks.get(name);
  if (current) {
    return current;
  }
  const newID = t.identifier(name);
  path.insertBefore(
    t.exportNamedDeclaration(
      t.variableDeclaration("const", [t.variableDeclarator(newID, t.objectExpression([]))])
    )
  );
  hooks.set(name, newID);
  return newID;
}

function createSignatureValue(node: t.Node): string {
  const code = generator(node);
  const result = crypto.createHash("sha256").update(code.code).digest("base64");
  return result;
}

function isForeignBinding(source: babel.NodePath, current: babel.NodePath, name: string): boolean {
  if (source === current) {
    return true;
  }
  if (current.scope.hasOwnBinding(name)) {
    return false;
  }
  if (current.parentPath) {
    return isForeignBinding(source, current.parentPath, name);
  }
  return true;
}

function createHotSignature(component: t.Identifier, sign?: t.Expression, deps?: t.Identifier[]) {
  if (sign && deps) {
    return t.objectExpression([
      t.objectProperty(t.identifier("component"), component),
      t.objectProperty(t.identifier("id"), t.stringLiteral(component.name)),
      t.objectProperty(t.identifier("signature"), sign),
      t.objectProperty(t.identifier("dependencies"), t.arrayExpression(deps))
    ]);
  }
  return t.objectExpression([
    t.objectProperty(t.identifier("component"), component),
    t.objectProperty(t.identifier("id"), t.stringLiteral(component.name))
  ]);
}

function getBindings(path: babel.NodePath): t.Identifier[] {
  const identifiers = new Set<string>();
  path.traverse({
    Expression(p) {
      if (
        t.isIdentifier(p.node) &&
        !t.isTypeScript(p.parentPath.node) &&
        isForeignBinding(path, p, p.node.name)
      ) {
        identifiers.add(p.node.name);
      }
      if (t.isJSXElement(p.node) && t.isJSXMemberExpression(p.node.openingElement.name)) {
        let base: t.JSXMemberExpression | t.JSXIdentifier = p.node.openingElement.name;
        while (t.isJSXMemberExpression(base)) {
          base = base.object;
        }
        if (isForeignBinding(path, p, base.name)) {
          identifiers.add(base.name);
        }
      }
    }
  });
  return [...identifiers].map(value => t.identifier(value));
}

function createStandardHot(
  path: babel.NodePath,
  state: State,
  HotComponent: t.Identifier,
  rename: t.VariableDeclaration
) {
  const HotImport = getSolidRefreshIdentifier(state.hooks, path, "standard");
  const pathToHot = getHotIdentifier(state.opts.bundler);
  const statementPath = getStatementPath(path);
  if (statementPath) {
    statementPath.insertBefore(rename);
  }
  return t.callExpression(HotImport, [
    createHotSignature(
      HotComponent,
      state.granular.value ? t.stringLiteral(createSignatureValue(rename)) : undefined,
      state.granular.value ? getBindings(path) : undefined
    ),
    pathToHot
  ]);
}

function createESMHot(
  path: babel.NodePath,
  state: State,
  HotComponent: t.Identifier,
  rename: t.VariableDeclaration
) {
  const HotImport = getSolidRefreshIdentifier(state.hooks, path, "esm");
  const pathToHot = getHotIdentifier(state.opts.bundler);
  const handlerId = path.scope.generateUidIdentifier("handler");
  const componentId = path.scope.generateUidIdentifier("Component");
  const statementPath = getStatementPath(path);
  if (statementPath) {
    const registrationMap = createHotMap(state.hooks, statementPath, "$$registrations");
    statementPath.insertBefore(rename);

    statementPath.insertBefore(
      t.expressionStatement(
        t.assignmentExpression(
          "=",
          t.memberExpression(registrationMap, HotComponent),
          createHotSignature(
            HotComponent,
            state.granular.value ? t.stringLiteral(createSignatureValue(rename)) : undefined,
            state.granular.value ? getBindings(path) : undefined
          )
        )
      )
    );
    statementPath.insertBefore(
      t.variableDeclaration("const", [
        t.variableDeclarator(
          t.objectPattern([
            t.objectProperty(t.identifier("handler"), handlerId, false, true),
            t.objectProperty(t.identifier("Component"), componentId, false, true)
          ]),
          t.callExpression(HotImport, [
            t.memberExpression(registrationMap, HotComponent),
            pathToHot
          ])
        )
      ])
    );
    const mod = path.scope.generateUidIdentifier("mod");
    statementPath.insertBefore(
      t.ifStatement(
        pathToHot,
        t.expressionStatement(
          t.callExpression(t.memberExpression(pathToHot, t.identifier("accept")), [
            t.arrowFunctionExpression(
              [mod],
              t.blockStatement([
                t.expressionStatement(
                  t.logicalExpression(
                    "&&",
                    t.callExpression(handlerId, [
                      // Vite interprets this differently
                      state.opts.bundler === "esm"
                        ? t.memberExpression(mod, t.identifier("module"))
                        : mod
                    ]),
                    t.callExpression(t.memberExpression(pathToHot, t.identifier("invalidate")), [])
                  )
                )
              ])
            )
          ])
        )
      )
    );
  }
  return componentId;
}

function createHot(
  path: babel.NodePath,
  state: State,
  name: t.Identifier | undefined,
  expression: t.Expression
) {
  const HotComponent = name
    ? path.scope.generateUidIdentifier(`Hot$$${name.name}`)
    : path.scope.generateUidIdentifier("HotComponent");
  const rename = t.variableDeclaration("const", [t.variableDeclarator(HotComponent, expression)]);
  if (isESMHMR(state.opts.bundler)) {
    return createESMHot(path, state, HotComponent, rename);
  }
  return createStandardHot(path, state, HotComponent, rename);
}

const SOURCE_MODULE = "solid-js/web";

function isValidSpecifier(specifier: t.ImportSpecifier, keyword: string): boolean {
  return (
    (t.isIdentifier(specifier.imported) && specifier.imported.name === keyword) ||
    (t.isStringLiteral(specifier.imported) && specifier.imported.value === keyword)
  );
}

function captureValidIdentifiers(path: babel.NodePath): Set<t.Identifier> {
  const validIdentifiers = new Set<t.Identifier>();

  path.traverse({
    ImportDeclaration(p) {
      if (p.node.source.value === SOURCE_MODULE) {
        for (let i = 0, len = p.node.specifiers.length; i < len; i += 1) {
          const specifier = p.node.specifiers[i];
          if (
            t.isImportSpecifier(specifier) &&
            (isValidSpecifier(specifier, "render") || isValidSpecifier(specifier, "hydrate"))
          ) {
            validIdentifiers.add(specifier.local);
          }
        }
      }
    }
  });

  return validIdentifiers;
}

function captureValidNamespaces(path: babel.NodePath): Set<t.Identifier> {
  const validNamespaces = new Set<t.Identifier>();

  path.traverse({
    ImportDeclaration(p) {
      if (p.node.source.value === SOURCE_MODULE) {
        for (let i = 0, len = p.node.specifiers.length; i < len; i += 1) {
          const specifier = p.node.specifiers[i];
          if (t.isImportNamespaceSpecifier(specifier)) {
            validNamespaces.add(specifier.local);
          }
        }
      }
    }
  });

  return validNamespaces;
}

function isValidCallee(
  path: babel.NodePath,
  { callee }: t.CallExpression,
  validIdentifiers: Set<t.Identifier>,
  validNamespaces: Set<t.Identifier>
) {
  if (t.isIdentifier(callee)) {
    const binding = path.scope.getBinding(callee.name);
    return binding && validIdentifiers.has(binding.identifier);
  }

  if (
    t.isMemberExpression(callee) &&
    !callee.computed &&
    t.isIdentifier(callee.object) &&
    t.isIdentifier(callee.property)
  ) {
    const binding = path.scope.getBinding(callee.object.name);
    return (
      binding &&
      validNamespaces.has(binding.identifier) &&
      (callee.property.name === "render" || callee.property.name === "hydrate")
    );
  }

  return false;
}

function checkValidRenderCall(path: babel.NodePath): boolean {
  let currentPath = path.parentPath;

  while (currentPath) {
    if (t.isProgram(currentPath.node)) {
      return true;
    }
    if (!t.isStatement(currentPath.node)) {
      return false;
    }
    currentPath = currentPath.parentPath;
  }

  return false;
}

function fixRenderCalls(path: babel.NodePath<t.Program>, opts: Options) {
  const validIdentifiers = captureValidIdentifiers(path);
  const validNamespaces = captureValidNamespaces(path);

  path.traverse({
    ExpressionStatement(p) {
      if (
        t.isCallExpression(p.node.expression) &&
        checkValidRenderCall(p) &&
        isValidCallee(p, p.node.expression, validIdentifiers, validNamespaces)
      ) {
        // Replace with variable declaration
        const id = p.scope.generateUidIdentifier("cleanup");
        p.replaceWith(
          t.variableDeclaration("const", [t.variableDeclarator(id, p.node.expression)])
        );
        const pathToHot = getHotIdentifier(opts.bundler);
        p.insertAfter(
          t.ifStatement(
            pathToHot,
            t.expressionStatement(
              t.callExpression(t.memberExpression(pathToHot, t.identifier("dispose")), [id])
            )
          )
        );
        p.skip();
      }
    }
  });
}

function getHMRDecline(opts: Options, pathToHot: t.Expression) {
  if (isESMHMR(opts.bundler)) {
    return t.ifStatement(
      pathToHot,
      t.expressionStatement(
        t.callExpression(t.memberExpression(pathToHot, t.identifier("decline")), [])
      )
    );
  }
  if (opts.bundler === "webpack5") {
    return t.ifStatement(
      pathToHot,
      t.expressionStatement(
        t.callExpression(t.memberExpression(pathToHot, t.identifier("decline")), [])
      )
    );
  }

  return t.ifStatement(
    pathToHot,
    t.expressionStatement(
      t.conditionalExpression(
        t.memberExpression(pathToHot, t.identifier("decline")),
        t.callExpression(t.memberExpression(pathToHot, t.identifier("decline")), []),
        t.callExpression(
          t.memberExpression(
            t.memberExpression(t.identifier("window"), t.identifier("location")),
            t.identifier("reload")
          ),
          []
        )
      )
    )
  );
}

function createDevWarning(path: babel.NodePath<t.Program>, hooks: ImportHook, opts: Options) {
  path.pushContainer(
    "body",
    t.ifStatement(
      t.callExpression(
        getModuleIdentifier(hooks, path, "shouldWarnAndDecline", "solid-refresh"),
        []
      ),
      getHMRDecline(opts, getHotIdentifier(opts.bundler))
    )
  );
}

export default function solidRefreshPlugin(): babel.PluginObj<State> {
  return {
    name: "Solid Refresh",
    pre() {
      this.hooks = new Map();
      this.processed = {
        value: false
      };
      this.granular = {
        value: false
      };
    },
    visitor: {
      Program(path, { file, opts, processed, granular, hooks }) {
        let shouldReload = false;
        let shouldSkip = false;
        const comments = file.ast.comments;
        if (comments) {
          for (let i = 0; i < comments.length; i++) {
            const comment = comments[i].value;
            if (/^\s*@refresh granular\s*$/.test(comment)) {
              granular.value = true;
              break;
            }
            if (/^\s*@refresh skip\s*$/.test(comment)) {
              processed.value = true;
              shouldSkip = true;
              break;
            }
            if (/^\s*@refresh reload\s*$/.test(comment)) {
              processed.value = true;
              shouldReload = true;
              const pathToHot = getHotIdentifier(opts.bundler);
              path.pushContainer("body", getHMRDecline(opts, pathToHot));
              break;
            }
          }
        }

        if (!shouldReload && (opts.fixRender ?? true)) {
          fixRenderCalls(path, opts);
        }
        if (!shouldSkip) {
          createDevWarning(path, hooks, opts);
        }
      },
      ExportNamedDeclaration(path, state) {
        if (state.processed.value) {
          return;
        }
        const decl = path.node.declaration;
        // Check if declaration is FunctionDeclaration
        if (
          t.isFunctionDeclaration(decl) &&
          !(decl.generator || decl.async) &&
          // Might be component-like, but the only valid components
          // have zero or one parameter
          decl.params.length < 2
        ) {
          // Check if the declaration has an identifier, and then check
          // if the name is component-ish
          if (decl.id && isComponentishName(decl.id.name)) {
            path.node.declaration = t.variableDeclaration("const", [
              t.variableDeclarator(
                decl.id,
                createHot(
                  path,
                  state,
                  decl.id,
                  t.functionExpression(decl.id, decl.params, decl.body)
                )
              )
            ]);
          }
        }
      },
      VariableDeclarator(path, state) {
        if (state.processed.value) {
          return;
        }
        const grandParentNode = path.parentPath?.parentPath?.node;
        // Check if the parent of the VariableDeclaration
        // is either a Program or an ExportNamedDeclaration
        if (t.isProgram(grandParentNode) || t.isExportNamedDeclaration(grandParentNode)) {
          const identifier = path.node.id;
          const init = path.node.init;

          if (
            t.isIdentifier(identifier) &&
            isComponentishName(identifier.name) &&
            // Check for valid FunctionExpression
            ((t.isFunctionExpression(init) && !(init.async || init.generator)) ||
              // Check for valid ArrowFunctionExpression
              (t.isArrowFunctionExpression(init) && !(init.async || init.generator))) &&
            // Might be component-like, but the only valid components
            // have zero or one parameter
            init.params.length < 2
          ) {
            path.node.init = createHot(path, state, identifier, init);
          }
        }
      },
      FunctionDeclaration(path, state) {
        if (state.processed.value) {
          return;
        }
        if (
          !(t.isProgram(path.parentPath.node) || t.isExportDefaultDeclaration(path.parentPath.node))
        ) {
          return;
        }
        const decl = path.node;
        // Check if declaration is FunctionDeclaration
        if (
          !(decl.generator || decl.async) &&
          // Might be component-like, but the only valid components
          // have zero or one parameter
          decl.params.length < 2
        ) {
          // Check if the declaration has an identifier, and then check
          // if the name is component-ish
          if (decl.id && isComponentishName(decl.id.name)) {
            const replacement = createHot(
              path,
              state,
              decl.id,
              t.functionExpression(decl.id, decl.params, decl.body)
            );
            if (t.isExportDefaultDeclaration(path.parentPath.node)) {
              path.replaceWith(replacement);
            } else {
              path.replaceWith(
                t.variableDeclaration("var", [t.variableDeclarator(decl.id, replacement)])
              );
            }
          } else if (
            !decl.id &&
            decl.params.length === 1 &&
            t.isIdentifier(decl.params[0]) &&
            decl.params[0].name === "props" &&
            t.isExportDefaultDeclaration(path.parentPath.node)
          ) {
            const replacement = createHot(
              path,
              state,
              undefined,
              t.functionExpression(null, decl.params, decl.body)
            );
            path.replaceWith(replacement);
          }
        }
      }
    }
  };
}
