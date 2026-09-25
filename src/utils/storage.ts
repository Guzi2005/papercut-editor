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
const KEY = 'current';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveWorkspace(snapshot: WorkspaceSnapshot): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(snapshot, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function loadWorkspace(): Promise<WorkspaceSnapshot | null> {
  try {
    const db = await openDb();
    const result = await new Promise<WorkspaceSnapshot | null>((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve((req.result as WorkspaceSnapshot) || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (!result || !Array.isArray(result.documents) || result.documents.length === 0) return null;
    return {
      ...result,
      documents: result.documents.map((d) => ({ ...d, project: normalizeProject(d.project) })),
    };
  } catch {
    return null;
  }
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
