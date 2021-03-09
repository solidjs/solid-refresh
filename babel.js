module.exports = ({ types: t }) => {
  return {
    name: "Solid Refresh",
    visitor: {
      ExportDefaultDeclaration(path, { opts }) {
        if (path.hub.file.metadata.processedHot) return;
        if (
          path.hub.file.opts.parserOpts.sourceFileName &&
          !path.hub.file.opts.parserOpts.sourceFileName.endsWith(".jsx") &&
          !path.hub.file.opts.parserOpts.sourceFileName.endsWith(".tsx")
        )
          return;
        if (opts.bundler === "vite") opts.bundler = "esm";
        path.hub.file.metadata.processedHot = true;
        const decl = path.node.declaration;
        const HotComponent = t.identifier("$HotComponent");
        const HotImport = t.identifier("_$hot");
        const pathToHot =
          opts.bundler !== "esm"
            ? t.memberExpression(t.identifier("module"), t.identifier("hot"))
            : t.memberExpression(
                t.memberExpression(t.identifier("import"), t.identifier("meta")),
                t.identifier("hot")
              );
        const rename = t.variableDeclaration("const", [
          t.variableDeclarator(
            HotComponent,
            t.isFunctionDeclaration(decl)
              ? t.functionExpression(decl.id, decl.params, decl.body)
              : decl
          )
        ]);
        let replacement;
        if (opts.bundler === "esm") {
          const handlerId = t.identifier("_$handler");
          const componentId = t.identifier("_$Component");
          replacement = [
            t.importDeclaration(
              [t.importSpecifier(HotImport, t.identifier(opts.bundler || "standard"))],
              t.stringLiteral("solid-refresh")
            ),
            t.exportNamedDeclaration(rename),
            t.variableDeclaration("const", [
              t.variableDeclarator(
                t.objectPattern([
                  t.objectProperty(handlerId, handlerId, false, true),
                  t.objectProperty(componentId, componentId, false, true)
                ]),
                t.callExpression(HotImport, [
                  HotComponent,
                  t.unaryExpression("!", t.unaryExpression("!", pathToHot))
                ])
              )
            ]),
            t.ifStatement(
              pathToHot,
              t.expressionStatement(
                t.callExpression(t.memberExpression(pathToHot, t.identifier("accept")), [handlerId])
              )
            ),
            t.exportDefaultDeclaration(componentId)
          ];
        } else {
          replacement = [
            t.importDeclaration(
              [t.importSpecifier(HotImport, t.identifier(opts.bundler || "standard"))],
              t.stringLiteral("solid-refresh")
            ),
            rename,
            t.exportDefaultDeclaration(t.callExpression(HotImport, [HotComponent, pathToHot]))
          ];
        }

        path.replaceWithMultiple(replacement).forEach(declaration => path.scope.registerDeclaration(declaration));
      }
    }
  };
};
