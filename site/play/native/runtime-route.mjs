// SPDX-License-Identifier: AGPL-3.0-only
// Use the compiler reported by the actual app, not guessed Wasm-GC support.
export function usesWebKitCompatibility(compiler,userAgent) {
  return compiler==='dart2js/CanvasKit' && /AppleWebKit\//.test(userAgent)
    && !/Android|Chrome\/|Chromium\/|Edg\/|OPR\//.test(userAgent);
}
