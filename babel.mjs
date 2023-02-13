import * as t from '@babel/types';
import generator from '@babel/generator';
import { addNamed } from '@babel/helper-module-imports';
import crypto from 'crypto';

function forEach(arr, callback) {
    for (let i = 0, len = arr.length; i < len; i += 1) {
        if (callback(arr[i], i)) {
            break;
        }
    }
}

function isComponentishName(name) {
    return name[0] >= "A" && name[0] <= "Z";
}
function isESMHMR(bundler) {
    // The currently known ESM HMR implementations
    // esm - the original ESM HMR Spec
    // vite - Vite's implementation
    return bundler === "esm" || bundler === "vite";
}
const SOLID_REFRESH_MODULE = 'solid-refresh';
const IMPORTS = {
    registry: '$$registry',
    refresh: '$$refresh',
    component: '$$component',
    context: '$$context',
};
function getSolidRefreshIdentifier(state, path, name) {
    const target = `${name}`;
    const current = state.hooks.get(target);
    if (current) {
        return current;
    }
    const newID = addNamed(path, name, SOLID_REFRESH_MODULE);
    state.hooks.set(target, newID);
    return newID;
}
function getHotIdentifier(state) {
    const bundler = state.opts.bundler;
    // vite/esm uses `import.meta.hot`
    if (isESMHMR(bundler)) {
        return t.memberExpression(t.memberExpression(t.identifier("import"), t.identifier("meta")), t.identifier("hot"));
    }
    // webpack 5 uses `import.meta.webpackHot`
    if (bundler === "webpack5") {
        return t.memberExpression(t.memberExpression(t.identifier("import"), t.identifier("meta")), t.identifier("webpackHot"));
    }
    // `module.hot` is the default.
    return t.memberExpression(t.identifier("module"), t.identifier("hot"));
}
function getWindowReloadCall() {
    return t.callExpression(t.memberExpression(t.memberExpression(t.identifier("window"), t.identifier("location")), t.identifier("reload")), []);
}
function getHMRDeclineCall(state) {
    const pathToHot = getHotIdentifier(state);
    const hmrDecline = t.memberExpression(pathToHot, t.identifier("decline"));
    const hmrDeclineCall = t.callExpression(hmrDecline, []);
    if (isESMHMR(state.opts.bundler) || state.opts.bundler === 'webpack5') {
        // if (import.meta.hot) {
        //   import.meta.hot.decline();
        // }
        // if (import.meta.webpackHot) {
        //   import.meta.webpackHot.decline();
        // }
        return t.ifStatement(pathToHot, t.blockStatement([
            t.expressionStatement(hmrDeclineCall)
        ]));
    }
    return t.ifStatement(pathToHot, t.blockStatement([
        t.expressionStatement(t.conditionalExpression(hmrDecline, hmrDeclineCall, getWindowReloadCall())),
    ]));
}
function getStatementPath(path) {
    if (t.isStatement(path.node)) {
        return path;
    }
    if (path.parentPath) {
        return getStatementPath(path.parentPath);
    }
    return null;
}
const REGISTRY = 'REGISTRY';
function createRegistry(state, path) {
    var _a;
    const current = state.hooks.get(REGISTRY);
    if (current) {
        return current;
    }
    const program = path.scope.getProgramParent();
    const identifier = program.generateUidIdentifier(REGISTRY);
    program.push({
        id: identifier,
        kind: 'const',
        init: t.callExpression(getSolidRefreshIdentifier(state, path, IMPORTS.registry), []),
    });
    const hotPath = getHotIdentifier(state);
    program.path.pushContainer('body', [
        t.ifStatement(hotPath, t.blockStatement([
            t.expressionStatement(t.callExpression(getSolidRefreshIdentifier(state, path, IMPORTS.refresh), [
                t.objectExpression([
                    t.objectProperty(t.identifier('type'), t.stringLiteral((_a = state.opts.bundler) !== null && _a !== void 0 ? _a : 'standard')),
                    t.objectProperty(t.identifier('hot'), hotPath),
                ]),
                identifier,
            ])),
        ])),
    ]);
    state.hooks.set(REGISTRY, identifier);
    return identifier;
}
function createSignatureValue(node) {
    const code = generator(node);
    const result = crypto.createHash("sha256").update(code.code).digest("base64");
    return result;
}
function isForeignBinding(source, current, name) {
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
function getBindings(path) {
    const identifiers = new Set();
    path.traverse({
        Expression(p) {
            if (t.isIdentifier(p.node) &&
                !t.isTypeScript(p.parentPath.node) &&
                isForeignBinding(path, p, p.node.name)) {
                identifiers.add(p.node.name);
            }
            if (t.isJSXElement(p.node) && t.isJSXMemberExpression(p.node.openingElement.name)) {
                let base = p.node.openingElement.name;
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
const IMPORT_IDENTITIES = [
    { name: 'createContext', source: 'solid-js' },
    { name: 'createContext', source: 'solid-js/web' },
    { name: 'render', source: 'solid-js/web' },
    { name: 'hydrate', source: 'solid-js/web' },
];
function isValidSpecifier(specifier, keyword) {
    return ((t.isIdentifier(specifier.imported) && specifier.imported.name === keyword) ||
        (t.isStringLiteral(specifier.imported) && specifier.imported.value === keyword));
}
function captureIdentifiers(state, path) {
    path.traverse({
        ImportDeclaration(p) {
            forEach(IMPORT_IDENTITIES, (id) => {
                if (p.node.source.value === id.source) {
                    forEach(p.node.specifiers, (specifier) => {
                        if (t.isImportSpecifier(specifier)
                            && isValidSpecifier(specifier, id.name)) {
                            state.imports.identifiers.set(specifier.local, id);
                        }
                        else if (t.isImportNamespaceSpecifier(specifier)) {
                            state.imports.namespaces.set(specifier.local, id);
                        }
                    });
                }
            });
        }
    });
}
function isValidCallee(state, path, { callee }, target) {
    if (t.isIdentifier(callee)) {
        const binding = path.scope.getBindingIdentifier(callee.name);
        if (binding) {
            const result = state.imports.identifiers.get(binding);
            if (result && result.name === target) {
                return true;
            }
        }
        return false;
    }
    if (t.isMemberExpression(callee) &&
        !callee.computed &&
        t.isIdentifier(callee.object) &&
        t.isIdentifier(callee.property)) {
        const binding = path.scope.getBinding(callee.object.name);
        return (binding
            && state.imports.namespaces.has(binding.identifier)
            && callee.property.name === target);
    }
    return false;
}
function checkValidRenderCall(path) {
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
function fixRenderCalls(state, path) {
    path.traverse({
        ExpressionStatement(p) {
            if (t.isCallExpression(p.node.expression) &&
                checkValidRenderCall(p) &&
                (isValidCallee(state, p, p.node.expression, 'render') ||
                    isValidCallee(state, p, p.node.expression, 'hydrate'))) {
                // Replace with variable declaration
                const id = p.scope.generateUidIdentifier("cleanup");
                p.replaceWith(t.variableDeclaration("const", [t.variableDeclarator(id, p.node.expression)]));
                const pathToHot = getHotIdentifier(state);
                p.insertAfter(t.ifStatement(pathToHot, t.expressionStatement(t.callExpression(t.memberExpression(pathToHot, t.identifier("dispose")), [id]))));
                p.skip();
            }
        }
    });
}
function wrapComponent(state, path, identifier, component) {
    const statementPath = getStatementPath(path);
    if (statementPath) {
        const registry = createRegistry(state, statementPath);
        const hotID = identifier ? `Component$$${identifier.name}` : `HotComponent`;
        const hotComponent = path.scope.generateUidIdentifier(hotID);
        const hotName = t.stringLiteral(hotComponent.name);
        const componentCall = getSolidRefreshIdentifier(state, statementPath, IMPORTS.component);
        if (state.granular) {
            return t.callExpression(componentCall, [
                registry,
                hotName,
                component,
                t.objectExpression([
                    t.objectProperty(t.identifier('signature'), t.stringLiteral(createSignatureValue(component))),
                    t.objectProperty(t.identifier('dependencies'), t.arrayExpression(getBindings(path))),
                ]),
            ]);
        }
        return t.callExpression(componentCall, [
            registry,
            hotName,
            component,
        ]);
    }
    return component;
}
function wrapContext(state, path, identifier, context) {
    const statementPath = getStatementPath(path);
    if (statementPath) {
        const registry = createRegistry(state, statementPath);
        const hotID = identifier ? `Context$$${identifier.name}` : `HotContext`;
        const hotContext = path.scope.generateUidIdentifier(hotID);
        const hotName = t.stringLiteral(hotContext.name);
        const contextCall = getSolidRefreshIdentifier(state, statementPath, IMPORTS.context);
        return t.callExpression(contextCall, [
            registry,
            hotName,
            context,
        ]);
    }
    return context;
}
function solidRefreshPlugin() {
    return {
        name: "Solid Refresh",
        pre() {
            this.hooks = new Map();
            this.processed = false;
            this.granular = false;
            this.imports = {
                identifiers: new Map(),
                namespaces: new Map(),
            };
        },
        visitor: {
            Program(path, state) {
                var _a;
                let shouldReload = false;
                const comments = state.file.ast.comments;
                if (comments) {
                    for (let i = 0; i < comments.length; i++) {
                        const comment = comments[i].value;
                        if (/^\s*@refresh granular\s*$/.test(comment)) {
                            state.granular = true;
                            break;
                        }
                        if (/^\s*@refresh skip\s*$/.test(comment)) {
                            state.processed = true;
                            break;
                        }
                        if (/^\s*@refresh reload\s*$/.test(comment)) {
                            state.processed = true;
                            shouldReload = true;
                            path.pushContainer("body", getHMRDeclineCall(state));
                            break;
                        }
                    }
                }
                captureIdentifiers(state, path);
                if (!shouldReload && ((_a = state.opts.fixRender) !== null && _a !== void 0 ? _a : true)) {
                    fixRenderCalls(state, path);
                }
            },
            ExportNamedDeclaration(path, state) {
                if (state.processed) {
                    return;
                }
                const decl = path.node.declaration;
                // Check if declaration is FunctionDeclaration
                if (t.isFunctionDeclaration(decl) &&
                    !(decl.generator || decl.async) &&
                    // Might be component-like, but the only valid components
                    // have zero or one parameter
                    decl.params.length < 2) {
                    // Check if the declaration has an identifier, and then check
                    // if the name is component-ish
                    if (decl.id && isComponentishName(decl.id.name)) {
                        path.node.declaration = t.variableDeclaration("const", [
                            t.variableDeclarator(decl.id, wrapComponent(state, path, decl.id, t.functionExpression(decl.id, decl.params, decl.body)))
                        ]);
                    }
                }
            },
            VariableDeclarator(path, state) {
                var _a, _b;
                if (state.processed) {
                    return;
                }
                const grandParentNode = (_b = (_a = path.parentPath) === null || _a === void 0 ? void 0 : _a.parentPath) === null || _b === void 0 ? void 0 : _b.node;
                // Check if the parent of the VariableDeclaration
                // is either a Program or an ExportNamedDeclaration
                if (t.isProgram(grandParentNode) || t.isExportNamedDeclaration(grandParentNode)) {
                    const identifier = path.node.id;
                    const init = path.node.init;
                    if (t.isIdentifier(identifier) &&
                        isComponentishName(identifier.name) &&
                        // Check for valid FunctionExpression
                        ((t.isFunctionExpression(init) && !(init.async || init.generator)) ||
                            // Check for valid ArrowFunctionExpression
                            (t.isArrowFunctionExpression(init) && !(init.async || init.generator))) &&
                        // Might be component-like, but the only valid components
                        // have zero or one parameter
                        init.params.length < 2) {
                        path.node.init = wrapComponent(state, path, identifier, init);
                    }
                    if (t.isCallExpression(init) && isValidCallee(state, path, init, 'createContext')) {
                        path.node.init = wrapContext(state, path, t.isIdentifier(identifier) ? identifier : undefined, init);
                    }
                }
            },
            FunctionDeclaration(path, state) {
                if (state.processed) {
                    return;
                }
                if (!(t.isProgram(path.parentPath.node) || t.isExportDefaultDeclaration(path.parentPath.node))) {
                    return;
                }
                const decl = path.node;
                // Check if declaration is FunctionDeclaration
                if (!(decl.generator || decl.async) &&
                    // Might be component-like, but the only valid components
                    // have zero or one parameter
                    decl.params.length < 2) {
                    // Check if the declaration has an identifier, and then check
                    // if the name is component-ish
                    if (decl.id && isComponentishName(decl.id.name)) {
                        const replacement = wrapComponent(state, path, decl.id, t.functionExpression(decl.id, decl.params, decl.body));
                        if (t.isExportDefaultDeclaration(path.parentPath.node)) {
                            path.replaceWith(replacement);
                        }
                        else {
                            path.replaceWith(t.variableDeclaration("var", [t.variableDeclarator(decl.id, replacement)]));
                        }
                    }
                    else if (!decl.id &&
                        decl.params.length === 1 &&
                        t.isIdentifier(decl.params[0]) &&
                        decl.params[0].name === "props" &&
                        t.isExportDefaultDeclaration(path.parentPath.node)) {
                        const replacement = wrapComponent(state, path, undefined, t.functionExpression(null, decl.params, decl.body));
                        path.replaceWith(replacement);
                    }
                }
            }
        }
    };
}

export { solidRefreshPlugin as default };
