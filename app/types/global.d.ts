declare global {
  interface Window {
    electronAPI?: import("./electron").ElectronAPI;
    showDirectoryPicker?: (options?: {
      mode?: "read" | "readwrite";
      startIn?: FileSystemHandle;
    }) => Promise<FileSystemDirectoryHandle>;
  }

  interface FileSystemDirectoryHandle {
    entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
  }
}

export {};