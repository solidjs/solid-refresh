
// For HMRs that follows Snowpack's spec
// https://github.com/FredKSchott/esm-hmr
export type ESMRuntimeType =
  | 'esm'
  | 'vite';

// For HMRs that follow Webpack's design
export type StandardRuntimeType =
  | 'standard'
  | 'webpack5'
  | 'rspack';

export type RuntimeType =
  | ESMRuntimeType
  | StandardRuntimeType;