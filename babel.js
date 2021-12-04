'use strict';

var t = require('@babel/types');
var helperModuleImports = require('@babel/helper-module-imports');

function _interopNamespace(e) {
    if (e && e.__esModule) return e;
    var n = Object.create(null);
    if (e) {
        Object.keys(e).forEach(function (k) {
            if (k !== 'default') {
                var d = Object.getOwnPropertyDescriptor(e, k);
                Object.defineProperty(n, k, d.get ? d : {
                    enumerable: true,
                    get: function () {
                        return e[k];
                    }
                });
            }
        });
    }
    n['default'] = e;
    return Object.freeze(n);
}

var t__namespace = /*#__PURE__*/_interopNamespace(t);

function isComponentishName(name) {
    return typeof name === 'string' && name[0] >= 'A' && name[0] <= 'Z';
}
function getSolidRefreshIdentifier(hooks, path, name) {
    const current = hooks.get(name);
    if (current) {
        return current;
    }
    const newID = helperModuleImports.addNamed(path, name, 'solid-refresh');
    hooks.set(name, newID);
    return newID;
}
function getHotIdentifier(bundler) {
    if (bundler === 'esm') {
        return t__namespace.memberExpression(t__namespace.memberExpression(t__namespace.identifier('import'), t__namespace.identifier('meta')), t__namespace.identifier('hot'));
    }
    return t__namespace.memberExpression(t__namespace.identifier("module"), t__namespace.identifier("hot"));
}
function getStatementPath(path) {
    if (t__namespace.isStatement(path.node)) {
        return path;
    }
    if (path.parentPath) {
        return getStatementPath(path.parentPath);
    }
    return null;
}
function createRegistrationMap(hooks, path) {
    const current = hooks.get('$$registrations');
    if (current) {
        return current;
    }
    const newID = t__namespace.identifier('$$registrations');
    path.insertBefore(t__namespace.exportNamedDeclaration(t__namespace.variableDeclaration('const', [t__namespace.variableDeclarator(newID, t__namespace.objectExpression([]))])));
    hooks.set('$$registrations', newID);
    return newID;
}
function createStandardHot(path, hooks, opts, HotComponent, rename) {
    const HotImport = getSolidRefreshIdentifier(hooks, path, opts.bundler || 'standard');
    const pathToHot = getHotIdentifier(opts.bundler);
    const statementPath = getStatementPath(path);
    if (statementPath) {
        statementPath.insertBefore(rename);
    }
    return t__namespace.callExpression(HotImport, [
        HotComponent,
        t__namespace.stringLiteral(HotComponent.name),
        pathToHot,
    ]);
}
function createESMHot(path, hooks, opts, HotComponent, rename) {
    const HotImport = getSolidRefreshIdentifier(hooks, path, opts.bundler || 'standard');
    const pathToHot = getHotIdentifier(opts.bundler);
    const handlerId = path.scope.generateUidIdentifier("handler");
    const componentId = path.scope.generateUidIdentifier("Component");
    const statementPath = getStatementPath(path);
    if (statementPath) {
        const registrationMap = createRegistrationMap(hooks, statementPath);
        statementPath.insertBefore(rename);
        statementPath.insertBefore(t__namespace.assignmentExpression('=', t__namespace.memberExpression(registrationMap, HotComponent), HotComponent));
        statementPath.insertBefore(t__namespace.variableDeclaration("const", [
            t__namespace.variableDeclarator(t__namespace.objectPattern([
                t__namespace.objectProperty(t__namespace.identifier('handler'), handlerId, false, true),
                t__namespace.objectProperty(t__namespace.identifier('Component'), componentId, false, true)
            ]), t__namespace.callExpression(HotImport, [
                HotComponent,
                t__namespace.stringLiteral(HotComponent.name),
                t__namespace.unaryExpression("!", t__namespace.unaryExpression("!", pathToHot))
            ]))
        ]));
        statementPath.insertBefore(t__namespace.ifStatement(pathToHot, t__namespace.expressionStatement(t__namespace.callExpression(t__namespace.memberExpression(pathToHot, t__namespace.identifier("accept")), [handlerId]))));
    }
    return componentId;
}
function createHot(path, hooks, opts, expression) {
    if (opts.bundler === "vite")
        opts.bundler = "esm";
    const HotComponent = path.scope.generateUidIdentifier('HotComponent');
    const rename = t__namespace.variableDeclaration("const", [
        t__namespace.variableDeclarator(HotComponent, expression),
    ]);
    if (opts.bundler === "esm") {
        return createESMHot(path, hooks, opts, HotComponent, rename);
    }
    return createStandardHot(path, hooks, opts, HotComponent, rename);
}
function solidRefreshPlugin() {
    return {
        name: 'Solid Refresh',
        pre() {
            this.hooks = new Map();
        },
        visitor: {
            Program(path, { opts }) {
                // const comments = path.hub.file.ast.comments;
                // for (let i = 0; i < comments.length; i++) {
                //   const comment = comments[i];
                //   const index = comment.value.indexOf("@refresh");
                //   if (index > -1) {
                //     if (comment.value.slice(index).includes("skip")) {
                //       path.hub.file.metadata.processedHot = true;
                //       return;
                //     }
                //     if (comment.value.slice(index).includes("reload")) {
                //       if (opts.bundler === "vite") opts.bundler = "esm";
                //       path.hub.file.metadata.processedHot = true;
                //       const pathToHot = getHotIdentifier(opts.bundler);
                //       path.pushContainer(
                //         "body",
                //         t.ifStatement(
                //           pathToHot,
                //           t.expressionStatement(
                //             t.callExpression(t.memberExpression(pathToHot, t.identifier("decline")), [])
                //           )
                //         )
                //       );
                //       return;
                //     }
                //   }
                // }
            },
            ExportNamedDeclaration(path, { opts, hooks }) {
                const decl = path.node.declaration;
                // Check if declaration is FunctionDeclaration
                if (t__namespace.isFunctionDeclaration(decl) && !(decl.generator || decl.async)) {
                    // Check if the declaration has an identifier, and then check 
                    // if the name is component-ish
                    if (decl.id && isComponentishName(decl.id.name)) {
                        path.node.declaration = t__namespace.variableDeclaration('const', [
                            t__namespace.variableDeclarator(decl.id, createHot(path, hooks, opts, t__namespace.functionExpression(decl.id, decl.params, decl.body)))
                        ]);
                    }
                }
            },
            VariableDeclarator(path, { opts, hooks }) {
                var _a, _b;
                const grandParentNode = (_b = (_a = path.parentPath) === null || _a === void 0 ? void 0 : _a.parentPath) === null || _b === void 0 ? void 0 : _b.node;
                // Check if the parent of the VariableDeclaration
                // is either a Program or an ExportNamedDeclaration
                if (t__namespace.isProgram(grandParentNode)
                    || t__namespace.isExportNamedDeclaration(grandParentNode)) {
                    const identifier = path.node.id;
                    const init = path.node.init;
                    if (t__namespace.isIdentifier(identifier)
                        && isComponentishName(identifier.name)
                        && (
                        // Check for valid FunctionExpression
                        (t__namespace.isFunctionExpression(init) && !(init.async || init.generator))
                            // Check for valid ArrowFunctionExpression
                            || (t__namespace.isArrowFunctionExpression(init) && !(init.async || init.generator)))) {
                        path.node.init = createHot(path, hooks, opts, init);
                    }
                }
            },
            FunctionDeclaration(path, { opts, hooks }) {
                // if (path.hub.file.metadata.processedHot) return;
                if (!(t__namespace.isProgram(path.parentPath.node)
                    || t__namespace.isExportDefaultDeclaration(path.parentPath.node))) {
                    return;
                }
                const decl = path.node;
                // Check if declaration is FunctionDeclaration
                if (!(decl.generator || decl.async)) {
                    // Check if the declaration has an identifier, and then check 
                    // if the name is component-ish
                    if (decl.id && isComponentishName(decl.id.name)) {
                        const replacement = createHot(path, hooks, opts, t__namespace.functionExpression(decl.id, decl.params, decl.body));
                        if (t__namespace.isExportDefaultDeclaration(path.parentPath.node)) {
                            path.replaceWith(replacement);
                        }
                        else {
                            path.replaceWith(t__namespace.variableDeclaration('var', [
                                t__namespace.variableDeclarator(decl.id, replacement),
                            ]));
                        }
                    }
                    else if (!decl.id
                        && decl.params.length === 1
                        && t__namespace.isIdentifier(decl.params[0])
                        && decl.params[0].name === 'props'
                        && t__namespace.isExportDefaultDeclaration(path.parentPath.node)) {
                        const replacement = createHot(path, hooks, opts, t__namespace.functionExpression(null, decl.params, decl.body));
                        path.replaceWith(replacement);
                    }
                }
            }
        },
    };
}

module.exports = solidRefreshPlugin;
