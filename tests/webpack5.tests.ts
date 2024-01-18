import * as babel from '@babel/core';
import { describe, it, expect } from 'vitest';
import solid from 'babel-preset-solid';
import plugin from '../src/babel';

async function transform(
  code: string,
  mode: 'server' | 'client',
  hydratable: boolean,
) {
  const result = await babel.transformAsync(code, {
    plugins: [[plugin, { bundler: 'webpack5' }]],
    presets: [
      [solid, { generate: mode === 'server' ? 'ssr' : 'dom', hydratable }],
    ],
    parserOpts: {
      plugins: ['jsx', 'typescript'],
    },
    filename: 'example.jsx',
  });

  if (result && result.code) {
    return result.code;
  }
  throw new Error('Missing code');
}

describe('webpack5 (client, non-hydratable)', () => {
  describe('FunctionDeclaration', () => {
    it('should transform FunctionDeclaration with valid Component name and params', async () => {
      expect(
        await transform(
          `
      function Foo() {
        return <h1>Foo</h1>;
      }
      `,
          'client',
          false,
        ),
      ).toMatchSnapshot();
      expect(
        await transform(
          `
      function Foo(props) {
      return <h1>Foo</h1>;
      }
      `,
          'client',
          false,
        ),
      ).toMatchSnapshot();
    });
    it('should skip FunctionDeclaration with valid Component name and >1 params', async () => {
      expect(
        await transform(
          `
      function Foo(a, b) {
        return <h1>Foo</h1>;
      }
      `,
          'client',
          false,
        ),
      ).toMatchSnapshot();
    });
    it('should skip FunctionDeclaration with invalid Component name', async () => {
      expect(
        await transform(
          `
      function foo() {
        return <h1>Foo</h1>;
      }
      `,
          'client',
          false,
        ),
      ).toMatchSnapshot();
    });
    it('should skip FunctionDeclaration with @refresh skip', async () => {
      expect(
        await transform(
          `
      // @refresh skip
      function Foo() {
        return <h1>Foo</h1>;
      }
      `,
          'client',
          false,
        ),
      ).toMatchSnapshot();
    });
    it('should skip FunctionDeclaration with @refresh reload', async () => {
      expect(
        await transform(
          `
      // @refresh reload
      function Foo() {
        return <h1>Foo</h1>;
      }
      `,
          'client',
          false,
        ),
      ).toMatchSnapshot();
    });
    it('should transform FunctionDeclaration with @refresh granular', async () => {
      expect(
        await transform(
          `
      // @refresh granular
      function Foo() {
        return <h1>Foo</h1>;
      }
      `,
          'client',
          false,
        ),
      ).toMatchSnapshot();
      expect(
        await transform(
          `
      // @refresh granular
      const example = 'Foo';
      function Foo() {
        return <h1>{example}</h1>;
      }
      `,
          'client',
          false,
        ),
      ).toMatchSnapshot();
      expect(
        await transform(
          `
      // @refresh granular
      const Example = createContext();
      function Foo() {
        return <Example.Provider>Foo</Example.Provider>;
      }
      `,
          'client',
          false,
        ),
      ).toMatchSnapshot();
    });
  });
  describe('VariableDeclarator', () => {
    describe('FunctionExpression', () => {
      it('should transform VariableDeclarator w/ FunctionExpression with valid Component name and params', async () => {
        expect(
          await transform(
            `
        const Foo = function () {
          return <h1>Foo</h1>;
        }
        `,
            'client',
            false,
          ),
        ).toMatchSnapshot();
        expect(
          await transform(
            `
        const Foo = function (props) {
          return <h1>Foo</h1>;
        }
        `,
            'client',
            false,
          ),
        ).toMatchSnapshot();
      });
      it('should skip VariableDeclarator w/ FunctionExpression with valid Component name and >1 params', async () => {
        expect(
          await transform(
            `
        const Foo = function (a, b) {
          return <h1>Foo</h1>;
        }
        `,
            'client',
            false,
          ),
        ).toMatchSnapshot();
      });
      it('should skip VariableDeclarator w/ FunctionExpression with invalid Component name', async () => {
        expect(
          await transform(
            `
        const foo = function () {
          return <h1>Foo</h1>;
        }
        `,
            'client',
            false,
          ),
        ).toMatchSnapshot();
      });
      it('should skip VariableDeclarator w/ FunctionExpression with @refresh skip', async () => {
        expect(
          await transform(
            `
        // @refresh skip
        const Foo = function() {
          return <h1>Foo</h1>;
        }
        `,
            'client',
            false,
          ),
        ).toMatchSnapshot();
      });
      it('should skip VariableDeclarator w/ FunctionExpression with @refresh reload', async () => {
        expect(
          await transform(
            `
        // @refresh reload
        const Foo = function() {
          return <h1>Foo</h1>;
        }
        `,
            'client',
            false,
          ),
        ).toMatchSnapshot();
      });
      it('should transform VariableDeclarator w/ FunctionExpression with @refresh granular', async () => {
        expect(
          await transform(
            `
        // @refresh granular
        const Foo = function() {
          return <h1>Foo</h1>;
        }
        `,
            'client',
            false,
          ),
        ).toMatchSnapshot();
        expect(
          await transform(
            `
        // @refresh granular
        const example = 'Foo';
        const Foo = function() {
          return <h1>{example}</h1>;
        }
        `,
            'client',
            false,
          ),
        ).toMatchSnapshot();
        expect(
          await transform(
            `
        // @refresh granular
        const Example = createContext();
        const Foo = function() {
          return <Example.Provider>Foo</Example.Provider>;
        }
        `,
            'client',
            false,
          ),
        ).toMatchSnapshot();
      });
    });
    describe('ArrowFunctionExpression', () => {
      it('should transform VariableDeclarator w/ ArrowFunctionExpression with valid Component name and params', async () => {
        expect(
          await transform(
            `
        const Foo = () => {
          return <h1>Foo</h1>;
        }
        `,
            'client',
            false,
          ),
        ).toMatchSnapshot();
        expect(
          await transform(
            `
        const Foo = (props) => {
          return <h1>Foo</h1>;
        }
        `,
            'client',
            false,
          ),
        ).toMatchSnapshot();
      });
      it('should skip VariableDeclarator w/ ArrowFunctionExpression with valid Component name and >1 params', async () => {
        expect(
          await transform(
            `
        const Foo = (a, b) => {
          return <h1>Foo</h1>;
        }
        `,
            'client',
            false,
          ),
        ).toMatchSnapshot();
      });
      it('should skip VariableDeclarator w/ ArrowFunctionExpression with invalid Component name', async () => {
        expect(
          await transform(
            `
        const foo = () => {
          return <h1>Foo</h1>;
        }
        `,
            'client',
            false,
          ),
        ).toMatchSnapshot();
      });
      it('should skip VariableDeclarator w/ ArrowFunctionExpression with @refresh skip', async () => {
        expect(
          await transform(
            `
        // @refresh skip
        const Foo = () => {
          return <h1>Foo</h1>;
        }
        `,
            'client',
            false,
          ),
        ).toMatchSnapshot();
      });
      it('should skip VariableDeclarator w/ ArrowFunctionExpression with @refresh reload', async () => {
        expect(
          await transform(
            `
        // @refresh reload
        const Foo = () => {
          return <h1>Foo</h1>;
        }
        `,
            'client',
            false,
          ),
        ).toMatchSnapshot();
      });
      it('should transform VariableDeclarator w/ ArrowFunctionExpression with @refresh granular', async () => {
        expect(
          await transform(
            `
        // @refresh granular
        const Foo = () => {
          return <h1>Foo</h1>;
        }
        `,
            'client',
            false,
          ),
        ).toMatchSnapshot();
        expect(
          await transform(
            `
        // @refresh granular
        const example = 'Foo';
        const Foo = () => {
          return <h1>{example}</h1>;
        }
        `,
            'client',
            false,
          ),
        ).toMatchSnapshot();
        expect(
          await transform(
            `
        // @refresh granular
        const Example = createContext();
        const Foo = () => {
          return <Example.Provider>Foo</Example.Provider>;
        }
        `,
            'client',
            false,
          ),
        ).toMatchSnapshot();
      });
    });
  });
  describe('ExportNamedDeclaration w/ FunctionExpression', () => {
    it('should transform ExportNamedDeclaration w/ FunctionExpression with valid Component name and params', async () => {
      expect(
        await transform(
          `
      export function Foo() {
        return <h1>Foo</h1>;
      }
      `,
          'client',
          false,
        ),
      ).toMatchSnapshot();
      expect(
        await transform(
          `
      export function Foo(props) {
        return <h1>Foo</h1>;
      }
      `,
          'client',
          false,
        ),
      ).toMatchSnapshot();
    });
    it('should skip ExportNamedDeclaration w/ FunctionExpression with valid Component name and >1 params', async () => {
      expect(
        await transform(
          `
      export function Foo(a, b) {
        return <h1>Foo</h1>;
      }
      `,
          'client',
          false,
        ),
      ).toMatchSnapshot();
    });
    it('should skip ExportNamedDeclaration w/ FunctionExpression with invalid Component name', async () => {
      expect(
        await transform(
          `
      export function Foo() {
        return <h1>Foo</h1>;
      }
      `,
          'client',
          false,
        ),
      ).toMatchSnapshot();
    });
    it('should skip ExportNamedDeclaration w/ FunctionExpression with @refresh skip', async () => {
      expect(
        await transform(
          `
      // @refresh skip
      export function Foo() {
        return <h1>Foo</h1>;
      }
      `,
          'client',
          false,
        ),
      ).toMatchSnapshot();
    });
    it('should skip ExportNamedDeclaration w/ FunctionExpression with @refresh reload', async () => {
      expect(
        await transform(
          `
      // @refresh reload
      export function Foo() {
        return <h1>Foo</h1>;
      }
      `,
          'client',
          false,
        ),
      ).toMatchSnapshot();
    });
    it('should transform ExportNamedDeclaration w/ FunctionExpression with @refresh granular', async () => {
      expect(
        await transform(
          `
      // @refresh granular
      export function Foo() {
        return <h1>Foo</h1>;
      }
      `,
          'client',
          false,
        ),
      ).toMatchSnapshot();
      expect(
        await transform(
          `
      // @refresh granular
      const example = 'Foo';
      export function Foo() {
        return <h1>{example}</h1>;
      }
      `,
          'client',
          false,
        ),
      ).toMatchSnapshot();
      expect(
        await transform(
          `
      // @refresh granular
      const Example = createContext();
      export function Foo() {
        return <Example.Provider>Foo</Example.Provider>;
      }
      `,
          'client',
          false,
        ),
      ).toMatchSnapshot();
    });
  });
  describe('ExportDefaultDeclaration w/ FunctionExpression', () => {
    it('should transform ExportDefaultDeclaration w/ FunctionExpression with valid Component name and params', async () => {
      expect(
        await transform(
          `
      export default function Foo() {
        return <h1>Foo</h1>;
      }
      `,
          'client',
          false,
        ),
      ).toMatchSnapshot();
      expect(
        await transform(
          `
      export default function Foo(props) {
        return <h1>Foo</h1>;
      }
      `,
          'client',
          false,
        ),
      ).toMatchSnapshot();
    });
    it('should skip ExportDefaultDeclaration w/ FunctionExpression with valid Component name and >1 params', async () => {
      expect(
        await transform(
          `
      export default function Foo(a, b) {
        return <h1>Foo</h1>;
      }
      `,
          'client',
          false,
        ),
      ).toMatchSnapshot();
    });
    it('should skip ExportDefaultDeclaration w/ FunctionExpression with invalid Component name', async () => {
      expect(
        await transform(
          `
      export default function foo() {
        return <h1>Foo</h1>;
      }
      `,
          'client',
          false,
        ),
      ).toMatchSnapshot();
    });
    it('should skip ExportDefaultDeclaration w/ FunctionExpression with @refresh skip', async () => {
      expect(
        await transform(
          `
      // @refresh skip
      export default function Foo() {
        return <h1>Foo</h1>;
      }
      `,
          'client',
          false,
        ),
      ).toMatchSnapshot();
    });
    it('should skip ExportDefaultDeclaration w/ FunctionExpression with @refresh reload', async () => {
      expect(
        await transform(
          `
      // @refresh reload
      export default function Foo() {
        return <h1>Foo</h1>;
      }
      `,
          'client',
          false,
        ),
      ).toMatchSnapshot();
    });
    it('should transform ExportDefaultDeclaration w/ FunctionExpression with @refresh granular', async () => {
      expect(
        await transform(
          `
      // @refresh granular
      export default function Foo() {
        return <h1>Foo</h1>;
      }
      `,
          'client',
          false,
        ),
      ).toMatchSnapshot();
      expect(
        await transform(
          `
      // @refresh granular
      const example = 'Foo';
      export default function Foo() {
        return <h1>{example}</h1>;
      }
      `,
          'client',
          false,
        ),
      ).toMatchSnapshot();
      expect(
        await transform(
          `
      // @refresh granular
      const Example = createContext();
      export default function Foo() {
        return <Example.Provider>Foo</Example.Provider>;
      }
      `,
          'client',
          false,
        ),
      ).toMatchSnapshot();
    });
  });
  describe('Context API', () => {
    it('should support top-level VariableDeclaration', async () => {
      expect(
        await transform(
          `
        import { createContext } from 'solid-js';
  
        const Example = createContext();
      `,
          'client',
          false,
        ),
      ).toMatchSnapshot();
    });
    it('should support ExportNamedDeclaration', async () => {
      expect(
        await transform(
          `
        import { createContext } from 'solid-js';
  
        export const Example = createContext();
      `,
          'client',
          false,
        ),
      ).toMatchSnapshot();
    });
    it('should not support VariableDeclaration that is not top-level', async () => {
      expect(
        await transform(
          `
        import { createContext } from 'solid-js';
  
        if (someCond) {
          const Example = createContext();
        }
      `,
          'client',
          false,
        ),
      ).toMatchSnapshot();
    });
  });
  describe('fix render', () => {
    describe('import specifiers', () => {
      it('should work with ImportSpecifier + Identifier', async () => {
        expect(
          await transform(
            `
          import { render } from 'solid-js/web';
    
          render(() => <App />, root);
        `,
            'client',
            false,
          ),
        ).toMatchSnapshot();
      });
      it('should work with ImportSpecifier + aliased Identifier', async () => {
        expect(
          await transform(
            `
          import { render as Render } from 'solid-js/web';
    
          Render(() => <App />, root);
        `,
            'client',
            false,
          ),
        ).toMatchSnapshot();
      });
      it('should work with ImportSpecifier + aliased Identifier from StringLiteral', async () => {
        expect(
          await transform(
            `
          import { 'render' as Render } from 'solid-js/web';
    
          Render(() => <App />, root);
        `,
            'client',
            false,
          ),
        ).toMatchSnapshot();
      });
      it('should work with ImportNamespaceSpecifier', async () => {
        expect(
          await transform(
            `
          import * as solidWeb from 'solid-js/web';
    
          solidWeb.render(() => <App />, root);
        `,
            'client',
            false,
          ),
        ).toMatchSnapshot();
      });
    });
    describe('top-level statements', () => {
      it('should work with IfStatement', async () => {
        expect(
          await transform(
            `
          import { render } from 'solid-js/web';

          if (root) {
            render(() => <App />, root);
          }
        `,
            'client',
            false,
          ),
        ).toMatchSnapshot();
      });
    });
    describe('@refresh reload', () => {
      it('should work', async () => {
        expect(
          await transform(
            `
          // @refresh reload
          import { render } from 'solid-js/web';

          if (root) {
            render(() => <App />, root);
          }
        `,
            'client',
            false,
          ),
        ).toMatchSnapshot();
      });
    });
  });
});

describe('webpack5 (client, hydratable)', () => {
  describe('FunctionDeclaration', () => {
    it('should transform FunctionDeclaration with valid Component name and params', async () => {
      expect(
        await transform(
          `
      function Foo() {
        return <h1>Foo</h1>;
      }
      `,
          'client',
          true,
        ),
      ).toMatchSnapshot();
      expect(
        await transform(
          `
      function Foo(props) {
      return <h1>Foo</h1>;
      }
      `,
          'client',
          true,
        ),
      ).toMatchSnapshot();
    });
    it('should skip FunctionDeclaration with valid Component name and >1 params', async () => {
      expect(
        await transform(
          `
      function Foo(a, b) {
        return <h1>Foo</h1>;
      }
      `,
          'client',
          true,
        ),
      ).toMatchSnapshot();
    });
    it('should skip FunctionDeclaration with invalid Component name', async () => {
      expect(
        await transform(
          `
      function foo() {
        return <h1>Foo</h1>;
      }
      `,
          'client',
          true,
        ),
      ).toMatchSnapshot();
    });
    it('should skip FunctionDeclaration with @refresh skip', async () => {
      expect(
        await transform(
          `
      // @refresh skip
      function Foo() {
        return <h1>Foo</h1>;
      }
      `,
          'client',
          true,
        ),
      ).toMatchSnapshot();
    });
    it('should skip FunctionDeclaration with @refresh reload', async () => {
      expect(
        await transform(
          `
      // @refresh reload
      function Foo() {
        return <h1>Foo</h1>;
      }
      `,
          'client',
          true,
        ),
      ).toMatchSnapshot();
    });
    it('should transform FunctionDeclaration with @refresh granular', async () => {
      expect(
        await transform(
          `
      // @refresh granular
      function Foo() {
        return <h1>Foo</h1>;
      }
      `,
          'client',
          true,
        ),
      ).toMatchSnapshot();
      expect(
        await transform(
          `
      // @refresh granular
      const example = 'Foo';
      function Foo() {
        return <h1>{example}</h1>;
      }
      `,
          'client',
          true,
        ),
      ).toMatchSnapshot();
      expect(
        await transform(
          `
      // @refresh granular
      const Example = createContext();
      function Foo() {
        return <Example.Provider>Foo</Example.Provider>;
      }
      `,
          'client',
          true,
        ),
      ).toMatchSnapshot();
    });
  });
  describe('VariableDeclarator', () => {
    describe('FunctionExpression', () => {
      it('should transform VariableDeclarator w/ FunctionExpression with valid Component name and params', async () => {
        expect(
          await transform(
            `
        const Foo = function () {
          return <h1>Foo</h1>;
        }
        `,
            'client',
            true,
          ),
        ).toMatchSnapshot();
        expect(
          await transform(
            `
        const Foo = function (props) {
          return <h1>Foo</h1>;
        }
        `,
            'client',
            true,
          ),
        ).toMatchSnapshot();
      });
      it('should skip VariableDeclarator w/ FunctionExpression with valid Component name and >1 params', async () => {
        expect(
          await transform(
            `
        const Foo = function (a, b) {
          return <h1>Foo</h1>;
        }
        `,
            'client',
            true,
          ),
        ).toMatchSnapshot();
      });
      it('should skip VariableDeclarator w/ FunctionExpression with invalid Component name', async () => {
        expect(
          await transform(
            `
        const foo = function () {
          return <h1>Foo</h1>;
        }
        `,
            'client',
            true,
          ),
        ).toMatchSnapshot();
      });
      it('should skip VariableDeclarator w/ FunctionExpression with @refresh skip', async () => {
        expect(
          await transform(
            `
        // @refresh skip
        const Foo = function() {
          return <h1>Foo</h1>;
        }
        `,
            'client',
            true,
          ),
        ).toMatchSnapshot();
      });
      it('should skip VariableDeclarator w/ FunctionExpression with @refresh reload', async () => {
        expect(
          await transform(
            `
        // @refresh reload
        const Foo = function() {
          return <h1>Foo</h1>;
        }
        `,
            'client',
            true,
          ),
        ).toMatchSnapshot();
      });
      it('should transform VariableDeclarator w/ FunctionExpression with @refresh granular', async () => {
        expect(
          await transform(
            `
        // @refresh granular
        const Foo = function() {
          return <h1>Foo</h1>;
        }
        `,
            'client',
            true,
          ),
        ).toMatchSnapshot();
        expect(
          await transform(
            `
        // @refresh granular
        const example = 'Foo';
        const Foo = function() {
          return <h1>{example}</h1>;
        }
        `,
            'client',
            true,
          ),
        ).toMatchSnapshot();
        expect(
          await transform(
            `
        // @refresh granular
        const Example = createContext();
        const Foo = function() {
          return <Example.Provider>Foo</Example.Provider>;
        }
        `,
            'client',
            true,
          ),
        ).toMatchSnapshot();
      });
    });
    describe('ArrowFunctionExpression', () => {
      it('should transform VariableDeclarator w/ ArrowFunctionExpression with valid Component name and params', async () => {
        expect(
          await transform(
            `
        const Foo = () => {
          return <h1>Foo</h1>;
        }
        `,
            'client',
            true,
          ),
        ).toMatchSnapshot();
        expect(
          await transform(
            `
        const Foo = (props) => {
          return <h1>Foo</h1>;
        }
        `,
            'client',
            true,
          ),
        ).toMatchSnapshot();
      });
      it('should skip VariableDeclarator w/ ArrowFunctionExpression with valid Component name and >1 params', async () => {
        expect(
          await transform(
            `
        const Foo = (a, b) => {
          return <h1>Foo</h1>;
        }
        `,
            'client',
            true,
          ),
        ).toMatchSnapshot();
      });
      it('should skip VariableDeclarator w/ ArrowFunctionExpression with invalid Component name', async () => {
        expect(
          await transform(
            `
        const foo = () => {
          return <h1>Foo</h1>;
        }
        `,
            'client',
            true,
          ),
        ).toMatchSnapshot();
      });
      it('should skip VariableDeclarator w/ ArrowFunctionExpression with @refresh skip', async () => {
        expect(
          await transform(
            `
        // @refresh skip
        const Foo = () => {
          return <h1>Foo</h1>;
        }
        `,
            'client',
            true,
          ),
        ).toMatchSnapshot();
      });
      it('should skip VariableDeclarator w/ ArrowFunctionExpression with @refresh reload', async () => {
        expect(
          await transform(
            `
        // @refresh reload
        const Foo = () => {
          return <h1>Foo</h1>;
        }
        `,
            'client',
            true,
          ),
        ).toMatchSnapshot();
      });
      it('should transform VariableDeclarator w/ ArrowFunctionExpression with @refresh granular', async () => {
        expect(
          await transform(
            `
        // @refresh granular
        const Foo = () => {
          return <h1>Foo</h1>;
        }
        `,
            'client',
            true,
          ),
        ).toMatchSnapshot();
        expect(
          await transform(
            `
        // @refresh granular
        const example = 'Foo';
        const Foo = () => {
          return <h1>{example}</h1>;
        }
        `,
            'client',
            true,
          ),
        ).toMatchSnapshot();
        expect(
          await transform(
            `
        // @refresh granular
        const Example = createContext();
        const Foo = () => {
          return <Example.Provider>Foo</Example.Provider>;
        }
        `,
            'client',
            true,
          ),
        ).toMatchSnapshot();
      });
    });
  });
  describe('ExportNamedDeclaration w/ FunctionExpression', () => {
    it('should transform ExportNamedDeclaration w/ FunctionExpression with valid Component name and params', async () => {
      expect(
        await transform(
          `
      export function Foo() {
        return <h1>Foo</h1>;
      }
      `,
          'client',
          true,
        ),
      ).toMatchSnapshot();
      expect(
        await transform(
          `
      export function Foo(props) {
        return <h1>Foo</h1>;
      }
      `,
          'client',
          true,
        ),
      ).toMatchSnapshot();
    });
    it('should skip ExportNamedDeclaration w/ FunctionExpression with valid Component name and >1 params', async () => {
      expect(
        await transform(
          `
      export function Foo(a, b) {
        return <h1>Foo</h1>;
      }
      `,
          'client',
          true,
        ),
      ).toMatchSnapshot();
    });
    it('should skip ExportNamedDeclaration w/ FunctionExpression with invalid Component name', async () => {
      expect(
        await transform(
          `
      export function Foo() {
        return <h1>Foo</h1>;
      }
      `,
          'client',
          true,
        ),
      ).toMatchSnapshot();
    });
    it('should skip ExportNamedDeclaration w/ FunctionExpression with @refresh skip', async () => {
      expect(
        await transform(
          `
      // @refresh skip
      export function Foo() {
        return <h1>Foo</h1>;
      }
      `,
          'client',
          true,
        ),
      ).toMatchSnapshot();
    });
    it('should skip ExportNamedDeclaration w/ FunctionExpression with @refresh reload', async () => {
      expect(
        await transform(
          `
      // @refresh reload
      export function Foo() {
        return <h1>Foo</h1>;
      }
      `,
          'client',
          true,
        ),
      ).toMatchSnapshot();
    });
    it('should transform ExportNamedDeclaration w/ FunctionExpression with @refresh granular', async () => {
      expect(
        await transform(
          `
      // @refresh granular
      export function Foo() {
        return <h1>Foo</h1>;
      }
      `,
          'client',
          true,
        ),
      ).toMatchSnapshot();
      expect(
        await transform(
          `
      // @refresh granular
      const example = 'Foo';
      export function Foo() {
        return <h1>{example}</h1>;
      }
      `,
          'client',
          true,
        ),
      ).toMatchSnapshot();
      expect(
        await transform(
          `
      // @refresh granular
      const Example = createContext();
      export function Foo() {
        return <Example.Provider>Foo</Example.Provider>;
      }
      `,
          'client',
          true,
        ),
      ).toMatchSnapshot();
    });
  });
  describe('ExportDefaultDeclaration w/ FunctionExpression', () => {
    it('should transform ExportDefaultDeclaration w/ FunctionExpression with valid Component name and params', async () => {
      expect(
        await transform(
          `
      export default function Foo() {
        return <h1>Foo</h1>;
      }
      `,
          'client',
          true,
        ),
      ).toMatchSnapshot();
      expect(
        await transform(
          `
      export default function Foo(props) {
        return <h1>Foo</h1>;
      }
      `,
          'client',
          true,
        ),
      ).toMatchSnapshot();
    });
    it('should skip ExportDefaultDeclaration w/ FunctionExpression with valid Component name and >1 params', async () => {
      expect(
        await transform(
          `
      export default function Foo(a, b) {
        return <h1>Foo</h1>;
      }
      `,
          'client',
          true,
        ),
      ).toMatchSnapshot();
    });
    it('should skip ExportDefaultDeclaration w/ FunctionExpression with invalid Component name', async () => {
      expect(
        await transform(
          `
      export default function foo() {
        return <h1>Foo</h1>;
      }
      `,
          'client',
          true,
        ),
      ).toMatchSnapshot();
    });
    it('should skip ExportDefaultDeclaration w/ FunctionExpression with @refresh skip', async () => {
      expect(
        await transform(
          `
      // @refresh skip
      export default function Foo() {
        return <h1>Foo</h1>;
      }
      `,
          'client',
          true,
        ),
      ).toMatchSnapshot();
    });
    it('should skip ExportDefaultDeclaration w/ FunctionExpression with @refresh reload', async () => {
      expect(
        await transform(
          `
      // @refresh reload
      export default function Foo() {
        return <h1>Foo</h1>;
      }
      `,
          'client',
          true,
        ),
      ).toMatchSnapshot();
    });
    it('should transform ExportDefaultDeclaration w/ FunctionExpression with @refresh granular', async () => {
      expect(
        await transform(
          `
      // @refresh granular
      export default function Foo() {
        return <h1>Foo</h1>;
      }
      `,
          'client',
          true,
        ),
      ).toMatchSnapshot();
      expect(
        await transform(
          `
      // @refresh granular
      const example = 'Foo';
      export default function Foo() {
        return <h1>{example}</h1>;
      }
      `,
          'client',
          true,
        ),
      ).toMatchSnapshot();
      expect(
        await transform(
          `
      // @refresh granular
      const Example = createContext();
      export default function Foo() {
        return <Example.Provider>Foo</Example.Provider>;
      }
      `,
          'client',
          true,
        ),
      ).toMatchSnapshot();
    });
  });
  describe('Context API', () => {
    it('should support top-level VariableDeclaration', async () => {
      expect(
        await transform(
          `
        import { createContext } from 'solid-js';
  
        const Example = createContext();
      `,
          'client',
          true,
        ),
      ).toMatchSnapshot();
    });
    it('should support ExportNamedDeclaration', async () => {
      expect(
        await transform(
          `
        import { createContext } from 'solid-js';
  
        export const Example = createContext();
      `,
          'client',
          true,
        ),
      ).toMatchSnapshot();
    });
    it('should not support VariableDeclaration that is not top-level', async () => {
      expect(
        await transform(
          `
        import { createContext } from 'solid-js';
  
        if (someCond) {
          const Example = createContext();
        }
      `,
          'client',
          true,
        ),
      ).toMatchSnapshot();
    });
  });
  describe('fix render', () => {
    describe('import specifiers', () => {
      it('should work with ImportSpecifier + Identifier', async () => {
        expect(
          await transform(
            `
          import { render } from 'solid-js/web';
    
          render(() => <App />, root);
        `,
            'client',
            true,
          ),
        ).toMatchSnapshot();
      });
      it('should work with ImportSpecifier + aliased Identifier', async () => {
        expect(
          await transform(
            `
          import { render as Render } from 'solid-js/web';
    
          Render(() => <App />, root);
        `,
            'client',
            true,
          ),
        ).toMatchSnapshot();
      });
      it('should work with ImportSpecifier + aliased Identifier from StringLiteral', async () => {
        expect(
          await transform(
            `
          import { 'render' as Render } from 'solid-js/web';
    
          Render(() => <App />, root);
        `,
            'client',
            true,
          ),
        ).toMatchSnapshot();
      });
      it('should work with ImportNamespaceSpecifier', async () => {
        expect(
          await transform(
            `
          import * as solidWeb from 'solid-js/web';
    
          solidWeb.render(() => <App />, root);
        `,
            'client',
            true,
          ),
        ).toMatchSnapshot();
      });
    });
    describe('top-level statements', () => {
      it('should work with IfStatement', async () => {
        expect(
          await transform(
            `
          import { render } from 'solid-js/web';

          if (root) {
            render(() => <App />, root);
          }
        `,
            'client',
            true,
          ),
        ).toMatchSnapshot();
      });
    });
    describe('@refresh reload', () => {
      it('should work', async () => {
        expect(
          await transform(
            `
          // @refresh reload
          import { render } from 'solid-js/web';

          if (root) {
            render(() => <App />, root);
          }
        `,
            'client',
            true,
          ),
        ).toMatchSnapshot();
      });
    });
  });
});

describe('webpack5 (server, non-hydratable)', () => {
  describe('FunctionDeclaration', () => {
    it('should transform FunctionDeclaration with valid Component name and params', async () => {
      expect(
        await transform(
          `
      function Foo() {
        return <h1>Foo</h1>;
      }
      `,
          'server',
          false,
        ),
      ).toMatchSnapshot();
      expect(
        await transform(
          `
      function Foo(props) {
      return <h1>Foo</h1>;
      }
      `,
          'server',
          false,
        ),
      ).toMatchSnapshot();
    });
    it('should skip FunctionDeclaration with valid Component name and >1 params', async () => {
      expect(
        await transform(
          `
      function Foo(a, b) {
        return <h1>Foo</h1>;
      }
      `,
          'server',
          false,
        ),
      ).toMatchSnapshot();
    });
    it('should skip FunctionDeclaration with invalid Component name', async () => {
      expect(
        await transform(
          `
      function foo() {
        return <h1>Foo</h1>;
      }
      `,
          'server',
          false,
        ),
      ).toMatchSnapshot();
    });
    it('should skip FunctionDeclaration with @refresh skip', async () => {
      expect(
        await transform(
          `
      // @refresh skip
      function Foo() {
        return <h1>Foo</h1>;
      }
      `,
          'server',
          false,
        ),
      ).toMatchSnapshot();
    });
    it('should skip FunctionDeclaration with @refresh reload', async () => {
      expect(
        await transform(
          `
      // @refresh reload
      function Foo() {
        return <h1>Foo</h1>;
      }
      `,
          'server',
          false,
        ),
      ).toMatchSnapshot();
    });
    it('should transform FunctionDeclaration with @refresh granular', async () => {
      expect(
        await transform(
          `
      // @refresh granular
      function Foo() {
        return <h1>Foo</h1>;
      }
      `,
          'server',
          false,
        ),
      ).toMatchSnapshot();
      expect(
        await transform(
          `
      // @refresh granular
      const example = 'Foo';
      function Foo() {
        return <h1>{example}</h1>;
      }
      `,
          'server',
          false,
        ),
      ).toMatchSnapshot();
      expect(
        await transform(
          `
      // @refresh granular
      const Example = createContext();
      function Foo() {
        return <Example.Provider>Foo</Example.Provider>;
      }
      `,
          'server',
          false,
        ),
      ).toMatchSnapshot();
    });
  });
  describe('VariableDeclarator', () => {
    describe('FunctionExpression', () => {
      it('should transform VariableDeclarator w/ FunctionExpression with valid Component name and params', async () => {
        expect(
          await transform(
            `
        const Foo = function () {
          return <h1>Foo</h1>;
        }
        `,
            'server',
            false,
          ),
        ).toMatchSnapshot();
        expect(
          await transform(
            `
        const Foo = function (props) {
          return <h1>Foo</h1>;
        }
        `,
            'server',
            false,
          ),
        ).toMatchSnapshot();
      });
      it('should skip VariableDeclarator w/ FunctionExpression with valid Component name and >1 params', async () => {
        expect(
          await transform(
            `
        const Foo = function (a, b) {
          return <h1>Foo</h1>;
        }
        `,
            'server',
            false,
          ),
        ).toMatchSnapshot();
      });
      it('should skip VariableDeclarator w/ FunctionExpression with invalid Component name', async () => {
        expect(
          await transform(
            `
        const foo = function () {
          return <h1>Foo</h1>;
        }
        `,
            'server',
            false,
          ),
        ).toMatchSnapshot();
      });
      it('should skip VariableDeclarator w/ FunctionExpression with @refresh skip', async () => {
        expect(
          await transform(
            `
        // @refresh skip
        const Foo = function() {
          return <h1>Foo</h1>;
        }
        `,
            'server',
            false,
          ),
        ).toMatchSnapshot();
      });
      it('should skip VariableDeclarator w/ FunctionExpression with @refresh reload', async () => {
        expect(
          await transform(
            `
        // @refresh reload
        const Foo = function() {
          return <h1>Foo</h1>;
        }
        `,
            'server',
            false,
          ),
        ).toMatchSnapshot();
      });
      it('should transform VariableDeclarator w/ FunctionExpression with @refresh granular', async () => {
        expect(
          await transform(
            `
        // @refresh granular
        const Foo = function() {
          return <h1>Foo</h1>;
        }
        `,
            'server',
            false,
          ),
        ).toMatchSnapshot();
        expect(
          await transform(
            `
        // @refresh granular
        const example = 'Foo';
        const Foo = function() {
          return <h1>{example}</h1>;
        }
        `,
            'server',
            false,
          ),
        ).toMatchSnapshot();
        expect(
          await transform(
            `
        // @refresh granular
        const Example = createContext();
        const Foo = function() {
          return <Example.Provider>Foo</Example.Provider>;
        }
        `,
            'server',
            false,
          ),
        ).toMatchSnapshot();
      });
    });
    describe('ArrowFunctionExpression', () => {
      it('should transform VariableDeclarator w/ ArrowFunctionExpression with valid Component name and params', async () => {
        expect(
          await transform(
            `
        const Foo = () => {
          return <h1>Foo</h1>;
        }
        `,
            'server',
            false,
          ),
        ).toMatchSnapshot();
        expect(
          await transform(
            `
        const Foo = (props) => {
          return <h1>Foo</h1>;
        }
        `,
            'server',
            false,
          ),
        ).toMatchSnapshot();
      });
      it('should skip VariableDeclarator w/ ArrowFunctionExpression with valid Component name and >1 params', async () => {
        expect(
          await transform(
            `
        const Foo = (a, b) => {
          return <h1>Foo</h1>;
        }
        `,
            'server',
            false,
          ),
        ).toMatchSnapshot();
      });
      it('should skip VariableDeclarator w/ ArrowFunctionExpression with invalid Component name', async () => {
        expect(
          await transform(
            `
        const foo = () => {
          return <h1>Foo</h1>;
        }
        `,
            'server',
            false,
          ),
        ).toMatchSnapshot();
      });
      it('should skip VariableDeclarator w/ ArrowFunctionExpression with @refresh skip', async () => {
        expect(
          await transform(
            `
        // @refresh skip
        const Foo = () => {
          return <h1>Foo</h1>;
        }
        `,
            'server',
            false,
          ),
        ).toMatchSnapshot();
      });
      it('should skip VariableDeclarator w/ ArrowFunctionExpression with @refresh reload', async () => {
        expect(
          await transform(
            `
        // @refresh reload
        const Foo = () => {
          return <h1>Foo</h1>;
        }
        `,
            'server',
            false,
          ),
        ).toMatchSnapshot();
      });
      it('should transform VariableDeclarator w/ ArrowFunctionExpression with @refresh granular', async () => {
        expect(
          await transform(
            `
        // @refresh granular
        const Foo = () => {
          return <h1>Foo</h1>;
        }
        `,
            'server',
            false,
          ),
        ).toMatchSnapshot();
        expect(
          await transform(
            `
        // @refresh granular
        const example = 'Foo';
        const Foo = () => {
          return <h1>{example}</h1>;
        }
        `,
            'server',
            false,
          ),
        ).toMatchSnapshot();
        expect(
          await transform(
            `
        // @refresh granular
        const Example = createContext();
        const Foo = () => {
          return <Example.Provider>Foo</Example.Provider>;
        }
        `,
            'server',
            false,
          ),
        ).toMatchSnapshot();
      });
    });
  });
  describe('ExportNamedDeclaration w/ FunctionExpression', () => {
    it('should transform ExportNamedDeclaration w/ FunctionExpression with valid Component name and params', async () => {
      expect(
        await transform(
          `
      export function Foo() {
        return <h1>Foo</h1>;
      }
      `,
          'server',
          false,
        ),
      ).toMatchSnapshot();
      expect(
        await transform(
          `
      export function Foo(props) {
        return <h1>Foo</h1>;
      }
      `,
          'server',
          false,
        ),
      ).toMatchSnapshot();
    });
    it('should skip ExportNamedDeclaration w/ FunctionExpression with valid Component name and >1 params', async () => {
      expect(
        await transform(
          `
      export function Foo(a, b) {
        return <h1>Foo</h1>;
      }
      `,
          'server',
          false,
        ),
      ).toMatchSnapshot();
    });
    it('should skip ExportNamedDeclaration w/ FunctionExpression with invalid Component name', async () => {
      expect(
        await transform(
          `
      export function Foo() {
        return <h1>Foo</h1>;
      }
      `,
          'server',
          false,
        ),
      ).toMatchSnapshot();
    });
    it('should skip ExportNamedDeclaration w/ FunctionExpression with @refresh skip', async () => {
      expect(
        await transform(
          `
      // @refresh skip
      export function Foo() {
        return <h1>Foo</h1>;
      }
      `,
          'server',
          false,
        ),
      ).toMatchSnapshot();
    });
    it('should skip ExportNamedDeclaration w/ FunctionExpression with @refresh reload', async () => {
      expect(
        await transform(
          `
      // @refresh reload
      export function Foo() {
        return <h1>Foo</h1>;
      }
      `,
          'server',
          false,
        ),
      ).toMatchSnapshot();
    });
    it('should transform ExportNamedDeclaration w/ FunctionExpression with @refresh granular', async () => {
      expect(
        await transform(
          `
      // @refresh granular
      export function Foo() {
        return <h1>Foo</h1>;
      }
      `,
          'server',
          false,
        ),
      ).toMatchSnapshot();
      expect(
        await transform(
          `
      // @refresh granular
      const example = 'Foo';
      export function Foo() {
        return <h1>{example}</h1>;
      }
      `,
          'server',
          false,
        ),
      ).toMatchSnapshot();
      expect(
        await transform(
          `
      // @refresh granular
      const Example = createContext();
      export function Foo() {
        return <Example.Provider>Foo</Example.Provider>;
      }
      `,
          'server',
          false,
        ),
      ).toMatchSnapshot();
    });
  });
  describe('ExportDefaultDeclaration w/ FunctionExpression', () => {
    it('should transform ExportDefaultDeclaration w/ FunctionExpression with valid Component name and params', async () => {
      expect(
        await transform(
          `
      export default function Foo() {
        return <h1>Foo</h1>;
      }
      `,
          'server',
          false,
        ),
      ).toMatchSnapshot();
      expect(
        await transform(
          `
      export default function Foo(props) {
        return <h1>Foo</h1>;
      }
      `,
          'server',
          false,
        ),
      ).toMatchSnapshot();
    });
    it('should skip ExportDefaultDeclaration w/ FunctionExpression with valid Component name and >1 params', async () => {
      expect(
        await transform(
          `
      export default function Foo(a, b) {
        return <h1>Foo</h1>;
      }
      `,
          'server',
          false,
        ),
      ).toMatchSnapshot();
    });
    it('should skip ExportDefaultDeclaration w/ FunctionExpression with invalid Component name', async () => {
      expect(
        await transform(
          `
      export default function foo() {
        return <h1>Foo</h1>;
      }
      `,
          'server',
          false,
        ),
      ).toMatchSnapshot();
    });
    it('should skip ExportDefaultDeclaration w/ FunctionExpression with @refresh skip', async () => {
      expect(
        await transform(
          `
      // @refresh skip
      export default function Foo() {
        return <h1>Foo</h1>;
      }
      `,
          'server',
          false,
        ),
      ).toMatchSnapshot();
    });
    it('should skip ExportDefaultDeclaration w/ FunctionExpression with @refresh reload', async () => {
      expect(
        await transform(
          `
      // @refresh reload
      export default function Foo() {
        return <h1>Foo</h1>;
      }
      `,
          'server',
          false,
        ),
      ).toMatchSnapshot();
    });
    it('should transform ExportDefaultDeclaration w/ FunctionExpression with @refresh granular', async () => {
      expect(
        await transform(
          `
      // @refresh granular
      export default function Foo() {
        return <h1>Foo</h1>;
      }
      `,
          'server',
          false,
        ),
      ).toMatchSnapshot();
      expect(
        await transform(
          `
      // @refresh granular
      const example = 'Foo';
      export default function Foo() {
        return <h1>{example}</h1>;
      }
      `,
          'server',
          false,
        ),
      ).toMatchSnapshot();
      expect(
        await transform(
          `
      // @refresh granular
      const Example = createContext();
      export default function Foo() {
        return <Example.Provider>Foo</Example.Provider>;
      }
      `,
          'server',
          false,
        ),
      ).toMatchSnapshot();
    });
  });
  describe('Context API', () => {
    it('should support top-level VariableDeclaration', async () => {
      expect(
        await transform(
          `
        import { createContext } from 'solid-js';
  
        const Example = createContext();
      `,
          'server',
          false,
        ),
      ).toMatchSnapshot();
    });
    it('should support ExportNamedDeclaration', async () => {
      expect(
        await transform(
          `
        import { createContext } from 'solid-js';
  
        export const Example = createContext();
      `,
          'server',
          false,
        ),
      ).toMatchSnapshot();
    });
    it('should not support VariableDeclaration that is not top-level', async () => {
      expect(
        await transform(
          `
        import { createContext } from 'solid-js';
  
        if (someCond) {
          const Example = createContext();
        }
      `,
          'server',
          false,
        ),
      ).toMatchSnapshot();
    });
  });
  describe('fix render', () => {
    describe('import specifiers', () => {
      it('should work with ImportSpecifier + Identifier', async () => {
        expect(
          await transform(
            `
          import { render } from 'solid-js/web';
    
          render(() => <App />, root);
        `,
            'server',
            false,
          ),
        ).toMatchSnapshot();
      });
      it('should work with ImportSpecifier + aliased Identifier', async () => {
        expect(
          await transform(
            `
          import { render as Render } from 'solid-js/web';
    
          Render(() => <App />, root);
        `,
            'server',
            false,
          ),
        ).toMatchSnapshot();
      });
      it('should work with ImportSpecifier + aliased Identifier from StringLiteral', async () => {
        expect(
          await transform(
            `
          import { 'render' as Render } from 'solid-js/web';
    
          Render(() => <App />, root);
        `,
            'server',
            false,
          ),
        ).toMatchSnapshot();
      });
      it('should work with ImportNamespaceSpecifier', async () => {
        expect(
          await transform(
            `
          import * as solidWeb from 'solid-js/web';
    
          solidWeb.render(() => <App />, root);
        `,
            'server',
            false,
          ),
        ).toMatchSnapshot();
      });
    });
    describe('top-level statements', () => {
      it('should work with IfStatement', async () => {
        expect(
          await transform(
            `
          import { render } from 'solid-js/web';

          if (root) {
            render(() => <App />, root);
          }
        `,
            'server',
            false,
          ),
        ).toMatchSnapshot();
      });
    });
    describe('@refresh reload', () => {
      it('should work', async () => {
        expect(
          await transform(
            `
          // @refresh reload
          import { render } from 'solid-js/web';

          if (root) {
            render(() => <App />, root);
          }
        `,
            'server',
            false,
          ),
        ).toMatchSnapshot();
      });
    });
  });
});

describe('webpack5 (server, hydratable)', () => {
  describe('FunctionDeclaration', () => {
    it('should transform FunctionDeclaration with valid Component name and params', async () => {
      expect(
        await transform(
          `
      function Foo() {
        return <h1>Foo</h1>;
      }
      `,
          'server',
          true,
        ),
      ).toMatchSnapshot();
      expect(
        await transform(
          `
      function Foo(props) {
      return <h1>Foo</h1>;
      }
      `,
          'server',
          true,
        ),
      ).toMatchSnapshot();
    });
    it('should skip FunctionDeclaration with valid Component name and >1 params', async () => {
      expect(
        await transform(
          `
      function Foo(a, b) {
        return <h1>Foo</h1>;
      }
      `,
          'server',
          true,
        ),
      ).toMatchSnapshot();
    });
    it('should skip FunctionDeclaration with invalid Component name', async () => {
      expect(
        await transform(
          `
      function foo() {
        return <h1>Foo</h1>;
      }
      `,
          'server',
          true,
        ),
      ).toMatchSnapshot();
    });
    it('should skip FunctionDeclaration with @refresh skip', async () => {
      expect(
        await transform(
          `
      // @refresh skip
      function Foo() {
        return <h1>Foo</h1>;
      }
      `,
          'server',
          true,
        ),
      ).toMatchSnapshot();
    });
    it('should skip FunctionDeclaration with @refresh reload', async () => {
      expect(
        await transform(
          `
      // @refresh reload
      function Foo() {
        return <h1>Foo</h1>;
      }
      `,
          'server',
          true,
        ),
      ).toMatchSnapshot();
    });
    it('should transform FunctionDeclaration with @refresh granular', async () => {
      expect(
        await transform(
          `
      // @refresh granular
      function Foo() {
        return <h1>Foo</h1>;
      }
      `,
          'server',
          true,
        ),
      ).toMatchSnapshot();
      expect(
        await transform(
          `
      // @refresh granular
      const example = 'Foo';
      function Foo() {
        return <h1>{example}</h1>;
      }
      `,
          'server',
          true,
        ),
      ).toMatchSnapshot();
      expect(
        await transform(
          `
      // @refresh granular
      const Example = createContext();
      function Foo() {
        return <Example.Provider>Foo</Example.Provider>;
      }
      `,
          'server',
          true,
        ),
      ).toMatchSnapshot();
    });
  });
  describe('VariableDeclarator', () => {
    describe('FunctionExpression', () => {
      it('should transform VariableDeclarator w/ FunctionExpression with valid Component name and params', async () => {
        expect(
          await transform(
            `
        const Foo = function () {
          return <h1>Foo</h1>;
        }
        `,
            'server',
            true,
          ),
        ).toMatchSnapshot();
        expect(
          await transform(
            `
        const Foo = function (props) {
          return <h1>Foo</h1>;
        }
        `,
            'server',
            true,
          ),
        ).toMatchSnapshot();
      });
      it('should skip VariableDeclarator w/ FunctionExpression with valid Component name and >1 params', async () => {
        expect(
          await transform(
            `
        const Foo = function (a, b) {
          return <h1>Foo</h1>;
        }
        `,
            'server',
            true,
          ),
        ).toMatchSnapshot();
      });
      it('should skip VariableDeclarator w/ FunctionExpression with invalid Component name', async () => {
        expect(
          await transform(
            `
        const foo = function () {
          return <h1>Foo</h1>;
        }
        `,
            'server',
            true,
          ),
        ).toMatchSnapshot();
      });
      it('should skip VariableDeclarator w/ FunctionExpression with @refresh skip', async () => {
        expect(
          await transform(
            `
        // @refresh skip
        const Foo = function() {
          return <h1>Foo</h1>;
        }
        `,
            'server',
            true,
          ),
        ).toMatchSnapshot();
      });
      it('should skip VariableDeclarator w/ FunctionExpression with @refresh reload', async () => {
        expect(
          await transform(
            `
        // @refresh reload
        const Foo = function() {
          return <h1>Foo</h1>;
        }
        `,
            'server',
            true,
          ),
        ).toMatchSnapshot();
      });
      it('should transform VariableDeclarator w/ FunctionExpression with @refresh granular', async () => {
        expect(
          await transform(
            `
        // @refresh granular
        const Foo = function() {
          return <h1>Foo</h1>;
        }
        `,
            'server',
            true,
          ),
        ).toMatchSnapshot();
        expect(
          await transform(
            `
        // @refresh granular
        const example = 'Foo';
        const Foo = function() {
          return <h1>{example}</h1>;
        }
        `,
            'server',
            true,
          ),
        ).toMatchSnapshot();
        expect(
          await transform(
            `
        // @refresh granular
        const Example = createContext();
        const Foo = function() {
          return <Example.Provider>Foo</Example.Provider>;
        }
        `,
            'server',
            true,
          ),
        ).toMatchSnapshot();
      });
    });
    describe('ArrowFunctionExpression', () => {
      it('should transform VariableDeclarator w/ ArrowFunctionExpression with valid Component name and params', async () => {
        expect(
          await transform(
            `
        const Foo = () => {
          return <h1>Foo</h1>;
        }
        `,
            'server',
            true,
          ),
        ).toMatchSnapshot();
        expect(
          await transform(
            `
        const Foo = (props) => {
          return <h1>Foo</h1>;
        }
        `,
            'server',
            true,
          ),
        ).toMatchSnapshot();
      });
      it('should skip VariableDeclarator w/ ArrowFunctionExpression with valid Component name and >1 params', async () => {
        expect(
          await transform(
            `
        const Foo = (a, b) => {
          return <h1>Foo</h1>;
        }
        `,
            'server',
            true,
          ),
        ).toMatchSnapshot();
      });
      it('should skip VariableDeclarator w/ ArrowFunctionExpression with invalid Component name', async () => {
        expect(
          await transform(
            `
        const foo = () => {
          return <h1>Foo</h1>;
        }
        `,
            'server',
            true,
          ),
        ).toMatchSnapshot();
      });
      it('should skip VariableDeclarator w/ ArrowFunctionExpression with @refresh skip', async () => {
        expect(
          await transform(
            `
        // @refresh skip
        const Foo = () => {
          return <h1>Foo</h1>;
        }
        `,
            'server',
            true,
          ),
        ).toMatchSnapshot();
      });
      it('should skip VariableDeclarator w/ ArrowFunctionExpression with @refresh reload', async () => {
        expect(
          await transform(
            `
        // @refresh reload
        const Foo = () => {
          return <h1>Foo</h1>;
        }
        `,
            'server',
            true,
          ),
        ).toMatchSnapshot();
      });
      it('should transform VariableDeclarator w/ ArrowFunctionExpression with @refresh granular', async () => {
        expect(
          await transform(
            `
        // @refresh granular
        const Foo = () => {
          return <h1>Foo</h1>;
        }
        `,
            'server',
            true,
          ),
        ).toMatchSnapshot();
        expect(
          await transform(
            `
        // @refresh granular
        const example = 'Foo';
        const Foo = () => {
          return <h1>{example}</h1>;
        }
        `,
            'server',
            true,
          ),
        ).toMatchSnapshot();
        expect(
          await transform(
            `
        // @refresh granular
        const Example = createContext();
        const Foo = () => {
          return <Example.Provider>Foo</Example.Provider>;
        }
        `,
            'server',
            true,
          ),
        ).toMatchSnapshot();
      });
    });
  });
  describe('ExportNamedDeclaration w/ FunctionExpression', () => {
    it('should transform ExportNamedDeclaration w/ FunctionExpression with valid Component name and params', async () => {
      expect(
        await transform(
          `
      export function Foo() {
        return <h1>Foo</h1>;
      }
      `,
          'server',
          true,
        ),
      ).toMatchSnapshot();
      expect(
        await transform(
          `
      export function Foo(props) {
        return <h1>Foo</h1>;
      }
      `,
          'server',
          true,
        ),
      ).toMatchSnapshot();
    });
    it('should skip ExportNamedDeclaration w/ FunctionExpression with valid Component name and >1 params', async () => {
      expect(
        await transform(
          `
      export function Foo(a, b) {
        return <h1>Foo</h1>;
      }
      `,
          'server',
          true,
        ),
      ).toMatchSnapshot();
    });
    it('should skip ExportNamedDeclaration w/ FunctionExpression with invalid Component name', async () => {
      expect(
        await transform(
          `
      export function Foo() {
        return <h1>Foo</h1>;
      }
      `,
          'server',
          true,
        ),
      ).toMatchSnapshot();
    });
    it('should skip ExportNamedDeclaration w/ FunctionExpression with @refresh skip', async () => {
      expect(
        await transform(
          `
      // @refresh skip
      export function Foo() {
        return <h1>Foo</h1>;
      }
      `,
          'server',
          true,
        ),
      ).toMatchSnapshot();
    });
    it('should skip ExportNamedDeclaration w/ FunctionExpression with @refresh reload', async () => {
      expect(
        await transform(
          `
      // @refresh reload
      export function Foo() {
        return <h1>Foo</h1>;
      }
      `,
          'server',
          true,
        ),
      ).toMatchSnapshot();
    });
    it('should transform ExportNamedDeclaration w/ FunctionExpression with @refresh granular', async () => {
      expect(
        await transform(
          `
      // @refresh granular
      export function Foo() {
        return <h1>Foo</h1>;
      }
      `,
          'server',
          true,
        ),
      ).toMatchSnapshot();
      expect(
        await transform(
          `
      // @refresh granular
      const example = 'Foo';
      export function Foo() {
        return <h1>{example}</h1>;
      }
      `,
          'server',
          true,
        ),
      ).toMatchSnapshot();
      expect(
        await transform(
          `
      // @refresh granular
      const Example = createContext();
      export function Foo() {
        return <Example.Provider>Foo</Example.Provider>;
      }
      `,
          'server',
          true,
        ),
      ).toMatchSnapshot();
    });
  });
  describe('ExportDefaultDeclaration w/ FunctionExpression', () => {
    it('should transform ExportDefaultDeclaration w/ FunctionExpression with valid Component name and params', async () => {
      expect(
        await transform(
          `
      export default function Foo() {
        return <h1>Foo</h1>;
      }
      `,
          'server',
          true,
        ),
      ).toMatchSnapshot();
      expect(
        await transform(
          `
      export default function Foo(props) {
        return <h1>Foo</h1>;
      }
      `,
          'server',
          true,
        ),
      ).toMatchSnapshot();
    });
    it('should skip ExportDefaultDeclaration w/ FunctionExpression with valid Component name and >1 params', async () => {
      expect(
        await transform(
          `
      export default function Foo(a, b) {
        return <h1>Foo</h1>;
      }
      `,
          'server',
          true,
        ),
      ).toMatchSnapshot();
    });
    it('should skip ExportDefaultDeclaration w/ FunctionExpression with invalid Component name', async () => {
      expect(
        await transform(
          `
      export default function foo() {
        return <h1>Foo</h1>;
      }
      `,
          'server',
          true,
        ),
      ).toMatchSnapshot();
    });
    it('should skip ExportDefaultDeclaration w/ FunctionExpression with @refresh skip', async () => {
      expect(
        await transform(
          `
      // @refresh skip
      export default function Foo() {
        return <h1>Foo</h1>;
      }
      `,
          'server',
          true,
        ),
      ).toMatchSnapshot();
    });
    it('should skip ExportDefaultDeclaration w/ FunctionExpression with @refresh reload', async () => {
      expect(
        await transform(
          `
      // @refresh reload
      export default function Foo() {
        return <h1>Foo</h1>;
      }
      `,
          'server',
          true,
        ),
      ).toMatchSnapshot();
    });
    it('should transform ExportDefaultDeclaration w/ FunctionExpression with @refresh granular', async () => {
      expect(
        await transform(
          `
      // @refresh granular
      export default function Foo() {
        return <h1>Foo</h1>;
      }
      `,
          'server',
          true,
        ),
      ).toMatchSnapshot();
      expect(
        await transform(
          `
      // @refresh granular
      const example = 'Foo';
      export default function Foo() {
        return <h1>{example}</h1>;
      }
      `,
          'server',
          true,
        ),
      ).toMatchSnapshot();
      expect(
        await transform(
          `
      // @refresh granular
      const Example = createContext();
      export default function Foo() {
        return <Example.Provider>Foo</Example.Provider>;
      }
      `,
          'server',
          true,
        ),
      ).toMatchSnapshot();
    });
  });
  describe('Context API', () => {
    it('should support top-level VariableDeclaration', async () => {
      expect(
        await transform(
          `
        import { createContext } from 'solid-js';
  
        const Example = createContext();
      `,
          'server',
          true,
        ),
      ).toMatchSnapshot();
    });
    it('should support ExportNamedDeclaration', async () => {
      expect(
        await transform(
          `
        import { createContext } from 'solid-js';
  
        export const Example = createContext();
      `,
          'server',
          true,
        ),
      ).toMatchSnapshot();
    });
    it('should not support VariableDeclaration that is not top-level', async () => {
      expect(
        await transform(
          `
        import { createContext } from 'solid-js';
  
        if (someCond) {
          const Example = createContext();
        }
      `,
          'server',
          true,
        ),
      ).toMatchSnapshot();
    });
  });
  describe('fix render', () => {
    describe('import specifiers', () => {
      it('should work with ImportSpecifier + Identifier', async () => {
        expect(
          await transform(
            `
          import { render } from 'solid-js/web';
    
          render(() => <App />, root);
        `,
            'server',
            true,
          ),
        ).toMatchSnapshot();
      });
      it('should work with ImportSpecifier + aliased Identifier', async () => {
        expect(
          await transform(
            `
          import { render as Render } from 'solid-js/web';
    
          Render(() => <App />, root);
        `,
            'server',
            true,
          ),
        ).toMatchSnapshot();
      });
      it('should work with ImportSpecifier + aliased Identifier from StringLiteral', async () => {
        expect(
          await transform(
            `
          import { 'render' as Render } from 'solid-js/web';
    
          Render(() => <App />, root);
        `,
            'server',
            true,
          ),
        ).toMatchSnapshot();
      });
      it('should work with ImportNamespaceSpecifier', async () => {
        expect(
          await transform(
            `
          import * as solidWeb from 'solid-js/web';
    
          solidWeb.render(() => <App />, root);
        `,
            'server',
            true,
          ),
        ).toMatchSnapshot();
      });
    });
    describe('top-level statements', () => {
      it('should work with IfStatement', async () => {
        expect(
          await transform(
            `
          import { render } from 'solid-js/web';

          if (root) {
            render(() => <App />, root);
          }
        `,
            'server',
            true,
          ),
        ).toMatchSnapshot();
      });
    });
    describe('@refresh reload', () => {
      it('should work', async () => {
        expect(
          await transform(
            `
          // @refresh reload
          import { render } from 'solid-js/web';

          if (root) {
            render(() => <App />, root);
          }
        `,
            'server',
            true,
          ),
        ).toMatchSnapshot();
      });
    });
  });
});