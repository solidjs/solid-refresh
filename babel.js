module.exports = ({ types: t }) => {
  return {
    name: "Solid Refresh",
    visitor: {
      ExportDefaultDeclaration(path, { opts }) {
        const decl = path.node.declaration;
        const HotComponent = t.identifier("$HotComponent");
        const HotImport = t.identifier("_$hot");
        const pathToHot = t.memberExpression(
          t.memberExpression(t.identifier("import"), t.identifier("meta")),
          t.identifier("hot")
        );
        path.replaceWithMultiple([
          t.importDeclaration(
            [t.importSpecifier(HotImport, t.identifier(opts.bundler || "vite"))],
            t.stringLiteral("solid-refresh")
          ),
          t.exportNamedDeclaration(
            t.variableDeclaration("const", [
              t.variableDeclarator(
                HotComponent,
                t.isFunctionDeclaration(decl)
                  ? t.functionExpression(decl.id, decl.params, decl.body)
                  : decl
              )
            ])
          ),
          t.exportDefaultDeclaration(
            t.callExpression(HotImport, [
              HotComponent,
              t.logicalExpression(
                "&&",
                pathToHot,
                t.memberExpression(pathToHot, t.identifier("accept"))
              )
            ])
          )
        ]);
        path.stop();
      }
    }
  };
};
