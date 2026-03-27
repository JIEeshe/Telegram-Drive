/**
 * Web shim for @tauri-apps/plugin-updater
 * No-op: web apps don't need a desktop update mechanism
 */

export async function check() {
  return null;
}

export class Update {
  available = false;
  version = '';
  body = '';

  async downloadAndInstall() {
    // No-op
  }
}
