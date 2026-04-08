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


async function cloneRepo(repoUrl: string, localPath: string): Promise<void> {
  console.log(`Cloning ${repoUrl} to ${localPath}...`);
  await fs.ensureDir(localPath);
  await git.clone(repoUrl, localPath, { '--depth': 1 });
  console.log('Cloning complete.');
}


function getFileDependencies(filePath: string, projectRoot: string): string[] {
  const dependencies = new Set<string>();

  if (!/\.(js|ts|jsx|tsx)$/.test(filePath)) {
    return [];
  }
  const code = fs.readFileSync(filePath, 'utf-8');
  try {
    const ast = parse(code, { sourceType: 'module', plugins: ['typescript', 'jsx'], errorRecovery: true });
    traverse(ast, {
      ImportDeclaration({ node }) {
        const importPath = node.source.value;
        const resolvedPath = path.resolve(path.dirname(filePath), importPath);
        const relativePath = path.relative(projectRoot, resolvedPath).replace(/\\/g, '/');
        dependencies.add(relativePath);
      },
    });
  } catch (error) { console.warn(`Could not parse ${filePath}. Skipping.`); }
  return Array.from(dependencies);
}

// Function to get a specific file's content from a cloned repo
export function getFileContent(analysisId: string, filePath: string): string {
  const fullPath = path.resolve(`./temp-clones/${analysisId}/${filePath}`);
  if (!fs.existsSync(fullPath)) {
    throw new Error("File not found in the specified analysis.");
  }
  return fs.readFileSync(fullPath, 'utf-8');
}

// Main function to analyze the entire project directory
export async function analyzeRepository(repoUrl: string) {
  const analysisId = Date.now().toString();
  const localPath = path.resolve(`./temp-clones/${analysisId}`);
  
  try {
    await cloneRepo(repoUrl, localPath);
    const allFiles = await getAllFiles(localPath);
    const nodes: CodeNode[] = [];
    const edges: { source: string; target: string }[] = [];
    const directoryMap = new Map<string, number>();

    for (const file of allFiles) {
      const relativePath = path.relative(localPath, file).replace(/\\/g, '/');
      const lines = fs.readFileSync(file, 'utf-8').split('\n').length;
      const parentDir = path.dirname(relativePath);
      nodes.push({ id: relativePath, name: path.basename(relativePath), type: 'file', size: lines, parent: parentDir === '.' ? undefined : parentDir });
      let currentDir = parentDir;
      while (currentDir && currentDir !== '.') {
        directoryMap.set(currentDir, (directoryMap.get(currentDir) || 0) + lines);
        currentDir = path.dirname(currentDir);
      }
      const dependencies = getFileDependencies(file, localPath);
      for (const dep of dependencies) {
          const potentialDepPaths = [`${dep}.js`, `${dep}.ts`, `${dep}.tsx`, `${dep}/index.js`, `${dep}/index.ts`, `${dep}/index.tsx`];
          const foundDep = allFiles.find(f => {
              const fRelative = path.relative(localPath!, f).replace(/\\/g, '/');
              return potentialDepPaths.includes(fRelative);
          });
          if (foundDep) {
              const targetId = path.relative(localPath, foundDep).replace(/\\/g, '/');
              edges.push({ source: relativePath, target: targetId });
          }
      }
    }

    for (const [dirPath, totalSize] of directoryMap.entries()) {
        const parentDir = path.dirname(dirPath);
        nodes.push({ id: dirPath, name: path.basename(dirPath), type: 'folder', size: totalSize, parent: parentDir === '.' ? undefined : parentDir });
    }
    return { nodes, edges, analysisId };
  } catch (error: any) {
    if (fs.existsSync(localPath)) { await fs.remove(localPath); }
    throw new Error(`Failed to clone or analyze repository. Original error: ${error.message}`);
  }
}

// Helper function to recursively get all relevant files from a directory
async function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): Promise<string[]> {
  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    // Continue to ignore common large/irrelevant directories
    if (['node_modules', '.git', 'dist', 'build', '.next', '.vscode'].includes(file)) continue;
    
    if (fs.statSync(fullPath).isDirectory()) {
      await getAllFiles(fullPath, arrayOfFiles);
    } else {
      // THE FIX IS HERE: The filter that checked for specific file extensions has been removed.
      // Now, we add every file we find.
      arrayOfFiles.push(fullPath);
    }
  }
  return arrayOfFiles;
}