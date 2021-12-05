'use strict';

var t = require('@babel/types');
var generator = require('@babel/generator');
var helperModuleImports = require('@babel/helper-module-imports');
var crypto = require('crypto');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

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
var generator__default = /*#__PURE__*/_interopDefaultLegacy(generator);
var crypto__default = /*#__PURE__*/_interopDefaultLegacy(crypto);

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
function createHotMap(hooks, path, name) {
    const current = hooks.get(name);
    if (current) {
        return current;
    }
    const newID = t__namespace.identifier(name);
    path.insertBefore(t__namespace.exportNamedDeclaration(t__namespace.variableDeclaration('const', [t__namespace.variableDeclarator(newID, t__namespace.objectExpression([]))])));
    hooks.set(name, newID);
    return newID;
}
function createSignature(node) {
    const code = generator__default['default'](node);
    const result = crypto__default['default'].createHash('sha256').update(code.code).digest('base64');
    return result;
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
        t__namespace.stringLiteral(createSignature(rename)),
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
        const registrationMap = createHotMap(hooks, statementPath, '$$registrations');
        statementPath.insertBefore(rename);
        statementPath.insertBefore(t__namespace.expressionStatement(t__namespace.assignmentExpression('=', t__namespace.memberExpression(registrationMap, HotComponent), t__namespace.objectExpression([
            t__namespace.objectProperty(t__namespace.identifier('component'), HotComponent),
            t__namespace.objectProperty(t__namespace.identifier('signature'), t__namespace.stringLiteral(createSignature(rename))),
        ]))));
        statementPath.insertBefore(t__namespace.variableDeclaration("const", [
            t__namespace.variableDeclarator(t__namespace.objectPattern([
                t__namespace.objectProperty(t__namespace.identifier('handler'), handlerId, false, true),
                t__namespace.objectProperty(t__namespace.identifier('Component'), componentId, false, true)
            ]), t__namespace.callExpression(HotImport, [
                HotComponent,
                t__namespace.stringLiteral(HotComponent.name),
                t__namespace.memberExpression(t__namespace.memberExpression(registrationMap, HotComponent), t__namespace.identifier('signature')),
                t__namespace.unaryExpression("!", t__namespace.unaryExpression("!", pathToHot))
            ]))
        ]));
        statementPath.insertBefore(t__namespace.ifStatement(pathToHot, t__namespace.expressionStatement(t__namespace.callExpression(t__namespace.memberExpression(pathToHot, t__namespace.identifier("accept")), [handlerId]))));
    }
    return componentId;
}
function createHot(path, hooks, opts, name, expression) {
    if (opts.bundler === "vite")
        opts.bundler = "esm";
    const HotComponent = name
        ? path.scope.generateUidIdentifier(`Hot$$${name.name}`)
        : path.scope.generateUidIdentifier('HotComponent');
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
            this.processed = {
                value: false,
            };
        },
        visitor: {
            Program(path, { opts, processed }) {
                const comments = path.hub.file.ast.comments;
                for (let i = 0; i < comments.length; i++) {
                    const comment = comments[i].value;
                    if (/^\s*@refresh skip\s*$/.test(comment)) {
                        processed.value = true;
                        return;
                    }
                    if (/^\s*@refresh reload\s*$/.test(comment)) {
                        if (opts.bundler === "vite")
                            opts.bundler = "esm";
                        processed.value = true;
                        const pathToHot = getHotIdentifier(opts.bundler);
                        path.pushContainer("body", t__namespace.ifStatement(pathToHot, t__namespace.expressionStatement(t__namespace.callExpression(t__namespace.memberExpression(pathToHot, t__namespace.identifier("decline")), []))));
                        return;
                    }
                }
            },
            ExportNamedDeclaration(path, { opts, hooks, processed }) {
                if (processed.value) {
                    return;
                }
                const decl = path.node.declaration;
                // Check if declaration is FunctionDeclaration
                if (t__namespace.isFunctionDeclaration(decl) && !(decl.generator || decl.async)) {
                    // Check if the declaration has an identifier, and then check 
                    // if the name is component-ish
                    if (decl.id && isComponentishName(decl.id.name)) {
                        path.node.declaration = t__namespace.variableDeclaration('const', [
                            t__namespace.variableDeclarator(decl.id, createHot(path, hooks, opts, decl.id, t__namespace.functionExpression(decl.id, decl.params, decl.body)))
                        ]);
                    }
                }
            },
            VariableDeclarator(path, { opts, hooks, processed }) {
                var _a, _b;
                if (processed.value) {
                    return;
                }
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
                        path.node.init = createHot(path, hooks, opts, identifier, init);
                    }
                }
            },
            FunctionDeclaration(path, { opts, hooks, processed }) {
                if (processed.value) {
                    return;
                }
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
                        const replacement = createHot(path, hooks, opts, decl.id, t__namespace.functionExpression(decl.id, decl.params, decl.body));
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
                        const replacement = createHot(path, hooks, opts, undefined, t__namespace.functionExpression(null, decl.params, decl.body));
                        path.replaceWith(replacement);
                    }
                }
            }
        },
    };
}

module.exports = solidRefreshPlugin;
