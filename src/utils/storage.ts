/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PapercutProject } from '../types/papercut';
import { normalizeProject } from './projectOps';

export const PROJECT_FILE_FORMAT = 'weave-papercut';
export const PROJECT_FILE_VERSION = 1;
export const PROJECT_FILE_EXT = '.weave.json';

export interface StoredDocument {
  id: string;
  name: string;
  project: PapercutProject;
  activeLayerId: string;
  zoom: number;
}

export interface WorkspaceSnapshot {
  documents: StoredDocument[];
  activeDocId: string;
  savedAt: number;
}

const DB_NAME = 'weave-papercut';
const STORE = 'workspace';
const LEGACY_KEY = 'current';
const META_KEY = 'meta';
const docKey = (id: string) => `doc:${id}`;

interface WorkspaceMeta {
  docIds: string[];
  activeDocId: string;
  savedAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

/** One connection for the whole session instead of opening and closing it on every save. */
function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => {
        const db = req.result;
        db.onclose = () => (dbPromise = null);
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };
      req.onerror = () => {
        dbPromise = null;
        reject(req.error);
      };
    });
  }
  return dbPromise;
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function get<T>(store: IDBObjectStore, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

/** What was last written per document, so unchanged documents are skipped. */
const written = new Map<string, StoredDocument>();
/** A pre-migration blob is only removed once its documents have been written as records. */
let legacyPending = false;

const sameDoc = (a: StoredDocument, b: StoredDocument) =>
  a.project === b.project && a.name === b.name && a.activeLayerId === b.activeLayerId && a.zoom === b.zoom;

/**
 * Writes the workspace as one small index plus a record per document. Only documents that
 * changed since the last save are rewritten, and records of closed documents are removed.
 */
export async function saveWorkspace(snapshot: WorkspaceSnapshot): Promise<{ written: number }> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  const ids = new Set(snapshot.documents.map((d) => d.id));
  let count = 0;
  snapshot.documents.forEach((d) => {
    const prev = written.get(d.id);
    if (prev && sameDoc(prev, d)) return;
    store.put(d, docKey(d.id));
    count++;
  });
  [...written.keys()].filter((id) => !ids.has(id)).forEach((id) => store.delete(docKey(id)));
  const meta: WorkspaceMeta = { docIds: snapshot.documents.map((d) => d.id), activeDocId: snapshot.activeDocId, savedAt: snapshot.savedAt };
  store.put(meta, META_KEY);
  if (legacyPending) store.delete(LEGACY_KEY);
  await done(tx);
  legacyPending = false;
  written.clear();
  snapshot.documents.forEach((d) => written.set(d.id, d));
  return { written: count };
}

export async function loadWorkspace(): Promise<WorkspaceSnapshot | null> {
  try {
    const db = await openDb();
    const store = db.transaction(STORE, 'readonly').objectStore(STORE);
    const meta = await get<WorkspaceMeta>(store, META_KEY);
    let result: WorkspaceSnapshot | null = null;
    if (meta) {
      const docs = await Promise.all(meta.docIds.map((id) => get<StoredDocument>(store, docKey(id))));
      result = { documents: docs.filter((d): d is StoredDocument => !!d), activeDocId: meta.activeDocId, savedAt: meta.savedAt };
    } else {
      // Workspaces saved before per-document records were one big blob; migrate it on first save.
      const legacy = await get<WorkspaceSnapshot>(store, LEGACY_KEY);
      if (legacy) {
        result = legacy;
        legacyPending = true;
      }
    }
    if (!result || !Array.isArray(result.documents) || result.documents.length === 0) return null;
    const documents = result.documents.map((d) => ({ ...d, project: normalizeProject(d.project, true) }));
    written.clear();
    // Records already on disk match what is loaded, so the first save can skip them.
    if (!legacyPending) documents.forEach((d) => written.set(d.id, d));
    return { ...result, documents };
  } catch {
    return null;
  }
}

/** Asks the browser not to evict the workspace under storage pressure; returns bytes used. */
export async function storageStatus(): Promise<{ usage: number; persisted: boolean } | null> {
  const nav = navigator.storage;
  if (!nav?.estimate) return null;
  let persisted = false;
  try {
    persisted = (await nav.persisted?.()) ?? false;
    if (!persisted && nav.persist) persisted = await nav.persist();
  } catch {
    /* not granted */
  }
  const { usage = 0 } = await nav.estimate();
  return { usage, persisted };
}

export function serializeProject(project: PapercutProject): string {
  return JSON.stringify(
    { format: PROJECT_FILE_FORMAT, version: PROJECT_FILE_VERSION, project },
    null,
    1
  );
}

export function parseProjectFile(text: string): PapercutProject {
  const data = JSON.parse(text);
  const project: PapercutProject | undefined =
    data?.format === PROJECT_FILE_FORMAT ? data.project : data?.layers ? data : undefined;
  if (!project || !project.layers || !project.rootOrder) {
    throw new Error('不是有效的 .weave.json 剪纸项目文件');
  }
  return normalizeProject(project);
}

export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] || null);
    input.click();
  });
}

export function readFileAsText(file: File): Promise<string> {
  return file.text();
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
