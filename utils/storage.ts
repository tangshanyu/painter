import { TabData, ToolSettings } from '../types';

const DB_NAME = 'painter-workspace';
const STORE_NAME = 'workspace';
const WORKSPACE_KEY = 'current';

export interface StoredWorkspace {
  version: 1;
  savedAt: number;
  tabs: TabData[];
  activeTabId: string;
  tabCounter: number;
  stampCounter: number;
  darkMode: boolean;
  toolSettings: ToolSettings;
}

const openDatabase = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, 1);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME);
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

export const loadWorkspace = async (): Promise<StoredWorkspace | null> => {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).get(WORKSPACE_KEY);
      request.onsuccess = () => resolve((request.result as StoredWorkspace | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
};

export const saveWorkspace = async (workspace: StoredWorkspace): Promise<void> => {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(workspace, WORKSPACE_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
};
