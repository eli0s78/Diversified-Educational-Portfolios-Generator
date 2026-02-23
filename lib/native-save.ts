// Native file system save utility

export async function nativeSaveFile(
    blob: Blob,
    fileName: string,
    extensions: string[],
    description: string
): Promise<void> {
    // If the modern File System Access API is supported
    if ('showSaveFilePicker' in window) {
        try {
            // @ts-ignore - TS doesn't know about the newer File System Access API
            const handle = await window.showSaveFilePicker({
                suggestedName: fileName,
                types: [
                    {
                        description,
                        accept: { [blob.type]: extensions },
                    },
                ],
            });
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            return;
        } catch (err: any) {
            if (err.name === 'AbortError') {
                // User cancelled the prompt. That's fine, return early
                return;
            }
            console.warn("Native file save failed or was aborted, falling back to traditional download:", err);
            // Fall through to traditional object URL download
        }
    }

    // Fallback to traditional anchor-tag download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
