import * as babel from "@babel/core";
import { describe, it, expect } from "vitest";
import plugin from "../src/babel";

async function transform(code: string) {
  const result = await babel.transformAsync(code, {
    plugins: [[plugin, { bundler: "vite" }]],
    parserOpts: {
      plugins: ["jsx", "typescript"]
    }
  });

  if (result && result.code) {
    return result.code;
  }
  throw new Error("Missing code");
}

describe("fix render", () => {
  describe("import specifiers", () => {
    it("should work with ImportSpecifier + Identifier", async () => {
      expect(
        await transform(`
        import { render } from 'solid-js/web';
  
        render(() => <App />, root);
      `)
      ).toMatchSnapshot();
    });
    it("should work with ImportSpecifier + aliased Identifier", async () => {
      expect(
        await transform(`
        import { render as Render } from 'solid-js/web';
  
        Render(() => <App />, root);
      `)
      ).toMatchSnapshot();
    });
    it("should work with ImportSpecifier + aliased Identifier from StringLiteral", async () => {
      expect(
        await transform(`
        import { 'render' as Render } from 'solid-js/web';
  
        Render(() => <App />, root);
      `)
      ).toMatchSnapshot();
    });
    it("should work with ImportNamespaceSpecifier", async () => {
      expect(
        await transform(`
        import * as solidWeb from 'solid-js/web';
  
        solidWeb.render(() => <App />, root);
      `)
      ).toMatchSnapshot();
    });
  });
  describe("top-level statements", async () => {
    it("should work with IfStatement", async () => {
      expect(
        await transform(`
        import { render } from 'solid-js/web';

        if (root) {
          render(() => <App />, root);
        }
      `)
      ).toMatchSnapshot();
    });
  });
});
