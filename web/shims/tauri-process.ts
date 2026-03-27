/**
 * Web shim for @tauri-apps/plugin-process
 * Replaces desktop process control with web equivalents
 */

export async function relaunch() {
  window.location.reload();
}

export async function exit(_code?: number) {
  window.close();
}
