/**
 * Web shim for @tauri-apps/api/core
 * Maps Tauri invoke() calls to REST API fetch calls
 */

// Inject __TAURI_INTERNALS__ so AuthWizard's isBrowser check passes
if (typeof window !== 'undefined' && !('__TAURI_INTERNALS__' in window)) {
  (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = { webShim: true };
}

// Global file store for upload flow
const _pendingFiles = new Map<string, File>();

export function storeFileForUpload(id: string, file: File) {
  _pendingFiles.set(id, file);
}

export async function invoke<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  // Special handling for file upload
  if (cmd === 'cmd_upload_file') {
    const filePath = args?.path as string;
    const folderId = args?.folderId;
    const file = _pendingFiles.get(filePath);

    if (file) {
      _pendingFiles.delete(filePath);
      const formData = new FormData();
      formData.append('file', file, file.name);
      formData.append('folderId', String(folderId ?? 'null'));

      const res = await fetch('/api/cmd_upload_file', { method: 'POST', body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || 'Upload failed');
      }
      return (await res.json()) as T;
    }
    throw new Error('File not found in pending uploads');
  }

  // Special handling for file download — trigger browser download
  if (cmd === 'cmd_download_file') {
    const { messageId, folderId } = args as { messageId: number; savePath: string; folderId: number | null };
    const res = await fetch('/api/cmd_download_file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId, folderId }),
    });
    if (!res.ok) throw new Error('Download failed');

    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    const filename = match ? decodeURIComponent(match[1].replace(/['"]/g, '')) : `file_${messageId}`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return undefined as T;
  }

  // Generic API call for all other commands
  const res = await fetch(`/api/${cmd}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args || {}),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Command ${cmd} failed`);
  }

  return (await res.json()) as T;
}

/**
 * Web shim for convertFileSrc
 * In Tauri, this converts a file path to an asset:// protocol URL.
 * In web, we just return the path as-is (or a server URL).
 */
export function convertFileSrc(filePath: string, _protocol?: string): string {
  // If it looks like a relative or absolute path, return as-is
  return filePath;
}
