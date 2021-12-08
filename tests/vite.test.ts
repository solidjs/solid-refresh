import * as babel from '@babel/core';
import plugin from '../src/babel';

async function transform(code: string) {
  const result = await babel.transformAsync(code, {
    plugins: [
      [plugin, { bundler: 'vite' }],
    ],
    parserOpts: {
      plugins: [
        'jsx',
        'typescript',
      ],
    },
  });

  if (result && result.code) {
    return result.code;
  }
  throw new Error('Missing code');
}

describe('vite', () => {
  describe('FunctionDeclaration', () => {
    it('should transform FunctionDeclaration with valid Component name and params', async () => {
      expect(await transform(`
      function Foo() {
        return <h1>Foo</h1>;
      }
      `)).toMatchSnapshot();
      expect(await transform(`
      function Foo(props) {
      return <h1>Foo</h1>;
      }
      `)).toMatchSnapshot();
    });
    it('should skip FunctionDeclaration with valid Component name and >1 params', async () => {
      expect(await transform(`
      function Foo(a, b) {
        return <h1>Foo</h1>;
      }
      `)).toMatchSnapshot();
    });
    it('should skip FunctionDeclaration with invalid Component name', async () => {
      expect(await transform(`
      function foo() {
        return <h1>Foo</h1>;
      }
      `)).toMatchSnapshot();
    });
    it('should skip FunctionDeclaration with @refresh skip', async () => {
      expect(await transform(`
      // @refresh skip
      function Foo() {
        return <h1>Foo</h1>;
      }
      `)).toMatchSnapshot();
    });
    it('should skip FunctionDeclaration with @refresh local-skip', async () => {
      expect(await transform(`
      // @refresh local-skip
      function Foo() {
        return <h1>Foo</h1>;
      }
      `)).toMatchSnapshot();
    });
    it('should skip FunctionDeclaration with @refresh reload', async () => {
      expect(await transform(`
      // @refresh reload
      function Foo() {
        return <h1>Foo</h1>;
      }
      `)).toMatchSnapshot();
    });
    it('should transform FunctionDeclaration with @refresh local-reload', async () => {
      expect(await transform(`
      // @refresh local-reload
      function Foo() {
        return <h1>Foo</h1>;
      }
      `)).toMatchSnapshot();
    });
    it('should transform FunctionDeclaration with @refresh granular', async () => {
      expect(await transform(`
      // @refresh granular
      function Foo() {
        return <h1>Foo</h1>;
      }
      `)).toMatchSnapshot();
      expect(await transform(`
      // @refresh granular
      const example = 'Foo';
      function Foo() {
        return <h1>{example}</h1>;
      }
      `)).toMatchSnapshot();
      expect(await transform(`
      // @refresh granular
      const Example = createContext();
      function Foo() {
        return <Example.Provider>Foo</Example.Provider>;
      }
      `)).toMatchSnapshot();
    });
    it('should transform FunctionDeclaration with @refresh local-granular', async () => {
      expect(await transform(`
      // @refresh local-granular
      function Foo() {
        return <h1>Foo</h1>;
      }
      `)).toMatchSnapshot();
      expect(await transform(`
      const example = 'Foo';
      // @refresh local-granular
      function Foo() {
        return <h1>{example}</h1>;
      }
      `)).toMatchSnapshot();
      expect(await transform(`
      const Example = createContext();
      // @refresh local-granular
      function Foo() {
        return <Example.Provider>Foo</Example.Provider>;
      }
      `)).toMatchSnapshot();
    });
  });
  describe('VariableDeclarator', () => {
    describe('FunctionExpression', () => {
      it('should transform VariableDeclarator w/ FunctionExpression with valid Component name and params', async () => {
        expect(await transform(`
        const Foo = function () {
          return <h1>Foo</h1>;
        }
        `)).toMatchSnapshot();
        expect(await transform(`
        const Foo = function (props) {
          return <h1>Foo</h1>;
        }
        `)).toMatchSnapshot();
      });
      it('should skip VariableDeclarator w/ FunctionExpression with valid Component name and >1 params', async () => {
        expect(await transform(`
        const Foo = function (a, b) {
          return <h1>Foo</h1>;
        }
        `)).toMatchSnapshot();
      });
      it('should skip VariableDeclarator w/ FunctionExpression with invalid Component name', async () => {
        expect(await transform(`
        const foo = function () {
          return <h1>Foo</h1>;
        }
        `)).toMatchSnapshot();
      });
      it('should skip VariableDeclarator w/ FunctionExpression with @refresh skip', async () => {
        expect(await transform(`
        // @refresh skip
        const Foo = function() {
          return <h1>Foo</h1>;
        }
        `)).toMatchSnapshot();
      });
      it('should skip VariableDeclarator w/ FunctionExpression with @refresh local-skip', async () => {
        expect(await transform(`
        const Foo = /* @refresh local-skip */ function() {
          return <h1>Foo</h1>;
        }
        `)).toMatchSnapshot();
      });
      it('should skip VariableDeclarator w/ FunctionExpression with @refresh reload', async () => {
        expect(await transform(`
        // @refresh reload
        const Foo = function() {
          return <h1>Foo</h1>;
        }
        `)).toMatchSnapshot();
      });
      it('should transform VariableDeclarator w/ FunctionExpression with @refresh local-reload', async () => {
        expect(await transform(`
        const Foo = /* @refresh local-reload */ function() {
          return <h1>Foo</h1>;
        }
        `)).toMatchSnapshot();
      });
      it('should transform VariableDeclarator w/ FunctionExpression with @refresh granular', async () => {
        expect(await transform(`
        // @refresh granular
        const Foo = function() {
          return <h1>Foo</h1>;
        }
        `)).toMatchSnapshot();
        expect(await transform(`
        // @refresh granular
        const example = 'Foo';
        const Foo = function() {
          return <h1>{example}</h1>;
        }
        `)).toMatchSnapshot();
        expect(await transform(`
        // @refresh granular
        const Example = createContext();
        const Foo = function() {
          return <Example.Provider>Foo</Example.Provider>;
        }
        `)).toMatchSnapshot();
      });
      it('should transform VariableDeclarator w/ FunctionExpression with @refresh local-granular', async () => {
        expect(await transform(`
        const Foo = /* @refresh local-granular */ function() {
          return <h1>Foo</h1>;
        }
        `)).toMatchSnapshot();
        expect(await transform(`
        const example = 'Foo';
        const Foo = /* @refresh local-granular */ function() {
          return <h1>{example}</h1>;
        }
        `)).toMatchSnapshot();
        expect(await transform(`
        const Example = createContext();
        const Foo = /* @refresh local-granular */ function() {
          return <Example.Provider>Foo</Example.Provider>;
        }
        `)).toMatchSnapshot();
      });
    });
    describe('ArrowFunctionExpression', () => {
      it('should transform VariableDeclarator w/ ArrowFunctionExpression with valid Component name and params', async () => {
        expect(await transform(`
        const Foo = () => {
          return <h1>Foo</h1>;
        }
        `)).toMatchSnapshot();
        expect(await transform(`
        const Foo = (props) => {
          return <h1>Foo</h1>;
        }
        `)).toMatchSnapshot();
      });
      it('should skip VariableDeclarator w/ ArrowFunctionExpression with valid Component name and >1 params', async () => {
        expect(await transform(`
        const Foo = (a, b) => {
          return <h1>Foo</h1>;
        }
        `)).toMatchSnapshot();
      });
      it('should skip VariableDeclarator w/ ArrowFunctionExpression with invalid Component name', async () => {
        expect(await transform(`
        const foo = () => {
          return <h1>Foo</h1>;
        }
        `)).toMatchSnapshot();
      });
      it('should skip VariableDeclarator w/ ArrowFunctionExpression with @refresh skip', async () => {
        expect(await transform(`
        // @refresh skip
        const Foo = () => {
          return <h1>Foo</h1>;
        }
        `)).toMatchSnapshot();
      });
      it('should skip VariableDeclarator w/ ArrowFunctionExpression with @refresh local-skip', async () => {
        expect(await transform(`
        const Foo = /* @refresh local-skip */ () => {
          return <h1>Foo</h1>;
        }
        `)).toMatchSnapshot();
      });
      it('should skip VariableDeclarator w/ ArrowFunctionExpression with @refresh reload', async () => {
        expect(await transform(`
        // @refresh reload
        const Foo = () => {
          return <h1>Foo</h1>;
        }
        `)).toMatchSnapshot();
      });
      it('should transform VariableDeclarator w/ ArrowFunctionExpression with @refresh local-reload', async () => {
        expect(await transform(`
        const Foo = /* @refresh local-reload */  () => {
          return <h1>Foo</h1>;
        }
        `)).toMatchSnapshot();
      });
      it('should transform VariableDeclarator w/ ArrowFunctionExpression with @refresh granular', async () => {
        expect(await transform(`
        // @refresh granular
        const Foo = () => {
          return <h1>Foo</h1>;
        }
        `)).toMatchSnapshot();
        expect(await transform(`
        // @refresh granular
        const example = 'Foo';
        const Foo = () => {
          return <h1>{example}</h1>;
        }
        `)).toMatchSnapshot();
        expect(await transform(`
        // @refresh granular
        const Example = createContext();
        const Foo = () => {
          return <Example.Provider>Foo</Example.Provider>;
        }
        `)).toMatchSnapshot();
      });
      it('should transform VariableDeclarator w/ ArrowFunctionExpression with @refresh local-granular', async () => {
        expect(await transform(`
        const Foo = /* @refresh local-granular */ () => {
          return <h1>Foo</h1>;
        }
        `)).toMatchSnapshot();
        expect(await transform(`
        const example = 'Foo';
        const Foo = /* @refresh local-granular */ () => {
          return <h1>{example}</h1>;
        }
        `)).toMatchSnapshot();
        expect(await transform(`
        const Example = createContext();
        const Foo = /* @refresh local-granular */ () => {
          return <Example.Provider>Foo</Example.Provider>;
        }
        `)).toMatchSnapshot();
      });
    });
  });
  describe('ExportNamedDeclaration w/ FunctionExpression', () => {
    it('should transform ExportNamedDeclaration w/ FunctionExpression with valid Component name and params', async () => {
      expect(await transform(`
      export function Foo() {
        return <h1>Foo</h1>;
      }
      `)).toMatchSnapshot();
      expect(await transform(`
      export function Foo(props) {
        return <h1>Foo</h1>;
      }
      `)).toMatchSnapshot();
    });
    it('should skip ExportNamedDeclaration w/ FunctionExpression with valid Component name and >1 params', async () => {
      expect(await transform(`
      export function Foo(a, b) {
        return <h1>Foo</h1>;
      }
      `)).toMatchSnapshot();
    });
    it('should skip ExportNamedDeclaration w/ FunctionExpression with invalid Component name', async () => {
      expect(await transform(`
      export function Foo() {
        return <h1>Foo</h1>;
      }
      `)).toMatchSnapshot();
    });
    it('should skip ExportNamedDeclaration w/ FunctionExpression with @refresh skip', async () => {
      expect(await transform(`
      // @refresh skip
      export function Foo() {
        return <h1>Foo</h1>;
      }
      `)).toMatchSnapshot();
    });
    it('should skip ExportNamedDeclaration w/ FunctionExpression with @refresh local-skip', async () => {
      expect(await transform(`
      export /* @refresh local-skip */ function Foo() {
        return <h1>Foo</h1>;
      }
      `)).toMatchSnapshot();
    });
    it('should skip ExportNamedDeclaration w/ FunctionExpression with @refresh reload', async () => {
      expect(await transform(`
      // @refresh reload
      export function Foo() {
        return <h1>Foo</h1>;
      }
      `)).toMatchSnapshot();
    });
    it('should transform ExportNamedDeclaration w/ FunctionExpression with @refresh local-reload', async () => {
      expect(await transform(`
      export /* @refresh local-reload */ function Foo() {
        return <h1>Foo</h1>;
      }
      `)).toMatchSnapshot();
    });
    it('should transform ExportNamedDeclaration w/ FunctionExpression with @refresh granular', async () => {
      expect(await transform(`
      // @refresh granular
      export function Foo() {
        return <h1>Foo</h1>;
      }
      `)).toMatchSnapshot();
      expect(await transform(`
      // @refresh granular
      const example = 'Foo';
      export function Foo() {
        return <h1>{example}</h1>;
      }
      `)).toMatchSnapshot();
      expect(await transform(`
      // @refresh granular
      const Example = createContext();
      export function Foo() {
        return <Example.Provider>Foo</Example.Provider>;
      }
      `)).toMatchSnapshot();
    });
    it('should transform ExportNamedDeclaration w/ FunctionExpression with @refresh local-granular', async () => {
      expect(await transform(`
      export /* @refresh local-granular */ function Foo() {
        return <h1>Foo</h1>;
      }
      `)).toMatchSnapshot();
      expect(await transform(`
      const example = 'Foo';
      export /* @refresh local-granular */ function Foo() {
        return <h1>{example}</h1>;
      }
      `)).toMatchSnapshot();
      expect(await transform(`
      const Example = createContext();
      export /* @refresh local-granular */ function Foo() {
        return <Example.Provider>Foo</Example.Provider>;
      }
      `)).toMatchSnapshot();
    });
  });
  describe('ExportDefaultDeclaration w/ FunctionExpression', () => {
    it('should transform ExportDefaultDeclaration w/ FunctionExpression with valid Component name and params', async () => {
      expect(await transform(`
      export default function Foo() {
        return <h1>Foo</h1>;
      }
      `)).toMatchSnapshot();
      expect(await transform(`
      export default function Foo(props) {
        return <h1>Foo</h1>;
      }
      `)).toMatchSnapshot();
    });
    it('should transform ExportDefaultDeclaration w/ FunctionExpression with anonymous name and props params', async () => {
      expect(await transform(`
      export default function (props) {
        return <h1>Foo</h1>;
      }
      `)).toMatchSnapshot();
    });
    it('should skip ExportDefaultDeclaration w/ FunctionExpression with valid Component name and >1 params', async () => {
      expect(await transform(`
      export default function Foo(a, b) {
        return <h1>Foo</h1>;
      }
      `)).toMatchSnapshot();
    });
    it('should skip ExportDefaultDeclaration w/ FunctionExpression with invalid Component name', async () => {
      expect(await transform(`
      export default function Foo() {
        return <h1>Foo</h1>;
      }
      `)).toMatchSnapshot();
    });
    it('should skip ExportDefaultDeclaration w/ FunctionExpression with @refresh skip', async () => {
      expect(await transform(`
      // @refresh skip
      export default function Foo() {
        return <h1>Foo</h1>;
      }
      `)).toMatchSnapshot();
    });
    it('should skip ExportDefaultDeclaration w/ FunctionExpression with @refresh local-skip', async () => {
      expect(await transform(`
      export default /* @refresh local-skip */ function Foo() {
        return <h1>Foo</h1>;
      }
      `)).toMatchSnapshot();
    });
    it('should skip ExportDefaultDeclaration w/ FunctionExpression with @refresh reload', async () => {
      expect(await transform(`
      // @refresh reload
      export default function Foo() {
        return <h1>Foo</h1>;
      }
      `)).toMatchSnapshot();
    });
    it('should transform ExportDefaultDeclaration w/ FunctionExpression with @refresh local-reload', async () => {
      expect(await transform(`
      export default /* @refresh local-reload */ function Foo() {
        return <h1>Foo</h1>;
      }
      `)).toMatchSnapshot();
    });
    it('should transform ExportDefaultDeclaration w/ FunctionExpression with @refresh granular', async () => {
      expect(await transform(`
      // @refresh granular
      export default function Foo() {
        return <h1>Foo</h1>;
      }
      `)).toMatchSnapshot();
      expect(await transform(`
      // @refresh granular
      const example = 'Foo';
      export default function Foo() {
        return <h1>{example}</h1>;
      }
      `)).toMatchSnapshot();
      expect(await transform(`
      // @refresh granular
      const Example = createContext();
      export default function Foo() {
        return <Example.Provider>Foo</Example.Provider>;
      }
      `)).toMatchSnapshot();
    });
    it('should transform ExportDefaultDeclaration w/ FunctionExpression with @refresh local-granular', async () => {
      expect(await transform(`
      export default /* @refresh local-granular */ function Foo() {
        return <h1>Foo</h1>;
      }
      `)).toMatchSnapshot();
      expect(await transform(`
      const example = 'Foo';
      export default /* @refresh local-granular */ function Foo() {
        return <h1>{example}</h1>;
      }
      `)).toMatchSnapshot();
      expect(await transform(`
      const Example = createContext();
      export default /* @refresh local-granular */ function Foo() {
        return <Example.Provider>Foo</Example.Provider>;
      }
      `)).toMatchSnapshot();
    });
  });
});
