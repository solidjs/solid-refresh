// For HMRs that follows Snowpack's spec
// https://github.com/FredKSchott/esm-hmr
export type ESMRuntimeType = 'esm' | 'vite' | 'bun';

// For HMRs that follow Webpack's design
export type StandardRuntimeType = 'standard' | 'webpack5' | 'rspack-esm';

export type RuntimeType = ESMRuntimeType | StandardRuntimeType;
