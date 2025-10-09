import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { KnowledgeBundle } from '@shared/types';

const KNOWLEDGE_ROOT = path.resolve(process.cwd(), 'knowledge');

async function loadDirectoryEntries(dir: string): Promise<Record<string, string>> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const result: Record<string, string> = {};
  await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map(async (entry) => {
        const filePath = path.join(dir, entry.name);
        const content = await fs.readFile(filePath, 'utf-8');
        result[entry.name] = content;
      })
  );
  return result;
}

export async function loadKnowledge(): Promise<KnowledgeBundle> {
  const permanentDir = path.join(KNOWLEDGE_ROOT, 'permanent');
  const projectDir = path.join(KNOWLEDGE_ROOT, 'project');
  const [permanent, project] = await Promise.all([
    loadDirectoryEntries(permanentDir),
    loadDirectoryEntries(projectDir)
  ]);
  return { permanent, project };
}
