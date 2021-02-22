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
        path.hub.file.metadata.processedHot = true;
        const decl = path.node.declaration;
        const HotComponent = t.identifier("$HotComponent");
        const HotImport = t.identifier("_$hot");
        const pathToHot =
          opts.bundler !== "vite"
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
        const HotIdentifier =
          opts.bundler !== "vite"
            ? pathToHot
            : t.logicalExpression(
                "&&",
                pathToHot,
                t.memberExpression(pathToHot, t.identifier("accept"))
              );

        path.replaceWithMultiple([
          t.importDeclaration(
            [t.importSpecifier(HotImport, t.identifier(opts.bundler || "standard"))],
            t.stringLiteral("solid-refresh")
          ),
          opts.bundler !== "vite" ? rename : t.exportNamedDeclaration(rename),
          t.exportDefaultDeclaration(t.callExpression(HotImport, [HotComponent, HotIdentifier]))
        ]);
      }
    }
  };
};
