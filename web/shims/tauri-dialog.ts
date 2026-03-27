/**
 * Web shim for @tauri-apps/plugin-dialog
 * Uses native browser file input and download prompts
 */

import { storeFileForUpload } from './tauri-core';

interface OpenOptions {
  multiple?: boolean;
  directory?: boolean;
  title?: string;
}

interface SaveOptions {
  defaultPath?: string;
}

export async function open(options: OpenOptions = {}): Promise<string | string[] | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    if (options.multiple) input.multiple = true;
    // directory selection not supported in standard browser file input
    input.style.display = 'none';
    document.body.appendChild(input);

    input.onchange = () => {
      const files = Array.from(input.files || []);
      document.body.removeChild(input);

      if (files.length === 0) {
        resolve(null);
        return;
      }

      // Store file objects and return generated IDs as "paths"
      const paths = files.map((file) => {
        const id = `web-file-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        storeFileForUpload(id, file);
        return id;
      });

      resolve(options.multiple ? paths : paths[0]);
    };

    // Handle cancel (user closes dialog without selecting)
    input.addEventListener('cancel', () => {
      document.body.removeChild(input);
      resolve(null);
    });

    input.click();
  });
}

export async function save(_options: SaveOptions = {}): Promise<string | null> {
  // In web, we just return a non-null value to indicate "proceed with download"
  // The actual download is triggered by the invoke shim for cmd_download_file
  return _options.defaultPath || 'download';
}
