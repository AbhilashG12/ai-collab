import { simpleGit } from 'simple-git';
import fs from 'fs-extra';
import path from 'path';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';

const git = simpleGit();

interface CodeNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  size: number;
  parent?: string;
}

const normalizePath = (p: string) => p.replace(/\\/g, '/');

async function cloneRepo(repoUrl: string, localPath: string): Promise<void> {
  if (await fs.pathExists(localPath)) {
    return;
  }
  await fs.ensureDir(localPath);
  await git.clone(repoUrl, localPath, { '--depth': 1 });
}

function getFileDependencies(filePath: string, projectRoot: string): string[] {
  const dependencies = new Set<string>();
  if (!/\.(js|ts|jsx|tsx)$/.test(filePath)) return [];
  
  try {
    const code = fs.readFileSync(filePath, 'utf-8');
    const ast = parse(code, { sourceType: 'module', plugins: ['typescript', 'jsx'], errorRecovery: true });
    traverse(ast, {
      ImportDeclaration({ node }) {
        const importPath = node.source.value;
        if (importPath.startsWith('.')) {
          const resolvedPath = path.resolve(path.dirname(filePath), importPath);
          const relativePath = path.relative(projectRoot, resolvedPath).replace(/\\/g, '/');
          dependencies.add(relativePath);
        }
      },
    });
  } catch (error) {}
  return Array.from(dependencies);
}

export function getFileContent(analysisId: string, filePath: string): string {
  const fullPath = path.resolve(`./temp-clones/${analysisId}/${filePath}`);
  if (!fs.existsSync(fullPath)) throw new Error("File not found.");
  return fs.readFileSync(fullPath, 'utf-8');
}

export async function analyzeRepository(repoUrl: string, analysisId: string) {
  const localPath = path.resolve(`./temp-clones/${analysisId}`);
  
  try {
    if (!(await fs.pathExists(localPath))) {
      console.log(`[Analyzer] Cloning ${repoUrl}...`);
      await fs.ensureDir(localPath);
      await git.clone(repoUrl, localPath, { '--depth': 1 });
    } else {
      console.log(`[Analyzer] Using existing clone for ${analysisId}`);
    }

    const allFiles = await getAllFiles(localPath);
    
    const nodes: CodeNode[] = [];
    const edges: { source: string; target: string }[] = [];
    const directorySet = new Set<string>();
    const directorySizes = new Map<string, number>();

    for (const file of allFiles) {
      const relativePath = path.relative(localPath, file).replace(/\\/g, '/');
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n').length;
      
      const parentDir = path.dirname(relativePath).replace(/\\/g, '/');
      nodes.push({ 
        id: relativePath, 
        name: path.basename(relativePath), 
        type: 'file', 
        size: lines, 
        parent: parentDir === '.' ? undefined : parentDir 
      });
      let segments = relativePath.split('/');
      segments.pop();

      let currentPath = "";
      for (const segment of segments) {
        currentPath = currentPath ? `${currentPath}/${segment}` : segment;
        directorySet.add(currentPath);
        directorySizes.set(currentPath, (directorySizes.get(currentPath) || 0) + lines);
      }


      const deps = getFileDependencies(file, localPath);
      for (const dep of deps) {
        const possiblePaths = [dep, `${dep}.ts`, `${dep}.tsx`, `${dep}.js`, `${dep}.jsx`, `${dep}/index.ts`, `${dep}/index.tsx`];
        const match = allFiles.find(f => {
          const fRel = path.relative(localPath, f).replace(/\\/g, '/');
          return possiblePaths.includes(fRel);
        });
        
        if (match) {
          edges.push({ 
            source: relativePath, 
            target: path.relative(localPath, match).replace(/\\/g, '/') 
          });
        }
      }
    }

    directorySet.forEach(dirPath => {
      const parentDir = path.dirname(dirPath).replace(/\\/g, '/');
      nodes.push({
        id: dirPath,
        name: path.basename(dirPath),
        type: 'folder',
        size: directorySizes.get(dirPath) || 0,
        parent: parentDir === '.' ? undefined : parentDir
      });
    });

    if (nodes.length > 0 && !nodes.find(n => n.id === '.')) {
      nodes.push({
        id: '.',
        name: 'root',
        type: 'folder',
        size: Array.from(directorySizes.values()).reduce((a, b) => a + b, 0)
      });
    }

    nodes.sort((a, b) => (a.type === 'folder' ? -1 : 1));

    console.log(`[Analyzer] Completed: ${nodes.length} nodes and ${edges.length} edges found.`);
    return { nodes, edges, analysisId };

  } catch (error: any) {
    console.error(`[Analyzer Error] ${error.message}`);
    throw new Error(`Analysis failed: ${error.message}`);
  }
}
async function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): Promise<string[]> {
  const files = fs.readdirSync(dirPath);
  
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    if (['node_modules', '.git', 'dist', 'build', '.next', '.vscode', '.github'].includes(file)) continue;
    
    if (fs.statSync(fullPath).isDirectory()) {
      await getAllFiles(fullPath, arrayOfFiles);
    } else {
      if (/\.(ts|js|tsx|jsx|json|py|go|rs|c|cpp|h|java|md|css|scss|html)$/.test(file)) {
        arrayOfFiles.push(fullPath);
      }
    }
  }
  return arrayOfFiles;
}