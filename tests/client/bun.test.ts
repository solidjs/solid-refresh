import { describe, it, expect } from 'vitest';
import { transform } from '../transform';

describe('bun (client, non-hydratable)', () => {
  describe('FunctionDeclaration', () => {
    it('should generate inline HMR code for Bun', async () => {
      const result = await transform(
        `
      function Foo(props) {
        return <h1>Foo</h1>;
      }
      `,
        'bun',
        'client',
        false,
      );

      // Verify that import.meta.hot is NOT passed as an argument
      expect(result).not.toContain('_$$refresh("bun", import.meta.hot');
      expect(result).toContain('import.meta.hot.data["solid-refresh"]');
      expect(result).toContain('import.meta.hot.data["solid-refresh-prev"]');
      expect(result).toContain('import.meta.hot.accept');

      // Verify that window.location.reload() is used instead of import.meta.hot.invalidate()
      // (Bun doesn't support invalidate)
      expect(result).toContain('window.location.reload');
      expect(result).not.toContain('import.meta.hot.invalidate');

      expect(result).toMatchSnapshot();
    });

    it('should transform FunctionDeclaration with valid Component name', async () => {
      expect(
        await transform(
          `
      function Foo() {
        return <h1>Foo</h1>;
      }
      `,
          'bun',
          'client',
          false,
        ),
      ).toMatchSnapshot();
    });

    it('should handle external dependencies', async () => {
      expect(
        await transform(
          `
      const example = 'Foo';
      function Foo() {
        return <h1>{example}</h1>;
      }
      `,
          'bun',
          'client',
          false,
        ),
      ).toMatchSnapshot();
    });

    it('should handle createContext', async () => {
      expect(
        await transform(
          `
      const Example = createContext();
      function Foo() {
        return <Example.Provider>Foo</Example.Provider>;
      }
      `,
          'bun',
          'client',
          false,
        ),
      ).toMatchSnapshot();
    });
  });

  describe('VariableDeclarator', () => {
    describe('ArrowFunctionExpression', () => {
      it('should transform VariableDeclarator w/ ArrowFunctionExpression', async () => {
        expect(
          await transform(
            `
        const Foo = (props) => {
          return <h1>Foo</h1>;
        }
        `,
            'bun',
            'client',
            false,
          ),
        ).toMatchSnapshot();

        expect(
          await transform(
            `
        const Foo = () => {
          return <h1>Foo</h1>;
        }
        `,
            'bun',
            'client',
            false,
          ),
        ).toMatchSnapshot();
      });
    });
  });

  describe('ExportNamedDeclaration', () => {
    it('should transform ExportNamedDeclaration', async () => {
      expect(
        await transform(
          `
      export function Foo(props) {
        return <h1>Foo</h1>;
      }
      `,
          'bun',
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
          'bun',
          'client',
          false,
        ),
      ).toMatchSnapshot();
    });
  });

  describe('fix render', () => {
    it('should work with render + dispose', async () => {
      expect(
        await transform(
          `
          import { render } from 'solid-js/web';

          render(() => <App />, root);
        `,
          'bun',
          'client',
          false,
        ),
      ).toMatchSnapshot();
    });
  });
});
