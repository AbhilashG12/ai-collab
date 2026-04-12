import { exec } from 'child_process';
import path from 'path';
import util from 'util';
import fs from "fs-extra";
import { getAISuggestion } from './aiService'; 
import { analyzeRepository, getFileContent } from './repoAnalyzer';
import { PrismaClient } from '@prisma/client';
import { WebSocketServer } from 'ws';

const execPromise = util.promisify(exec);

interface GraphQLContext {
  prisma: PrismaClient;  
  wss: WebSocketServer;
}

const getRepoName = (url: string) => {
  const name = url.replace(/\/$/, '').replace(/\.git$/, '').split('/').pop();
  return name || 'unknown-repo';
};

export const resolvers = {
  Query: {
    workspaces: async (_: any, __: any, { prisma }: GraphQLContext) => {
      return await prisma.workspace.findMany({ orderBy: { createdAt: 'desc' } });
    },
    getAiAnalysisForFile: async (
      _: any,
      { analysisId, filePath }: { analysisId: string, filePath: string }
    ) => {
      const content = getFileContent(analysisId, filePath);
      const MAX_CHARS = 16000;
      let suggestion;
      if (content.length > MAX_CHARS) {
        const truncatedContent = content.substring(0, MAX_CHARS);
        const suggestionRaw = await getAISuggestion(truncatedContent);
        suggestion = `--- Truncated ---\n${suggestionRaw}`;
      } else {
        suggestion = await getAISuggestion(content);
      }
      return { content, suggestion };
    }
  },
  Mutation: {
    saveFile: async (_: any, { analysisId, filePath, content }: { analysisId: string, filePath: string, content: string }) => {
      const fullPath = path.resolve(`./temp-clones/${analysisId}/${filePath}`);
      try {
        await fs.writeFile(fullPath, content);
        return true;
      } catch (error) {
        return false;
      }
    },
    analyzeRepository: async (_: any, { url }: { url: string }, { prisma }: any) => {
  const analysisId = `${url.split('/').pop()}-${Date.now()}`;
  const result = await analyzeRepository(url, analysisId);
  const workspace = await prisma.workspace.create({
    data: {
      name: url.split('/').pop() || "New Project",
      repoUrl: url,
      analysisId: analysisId,
      nodes: result.nodes, 
      edges: result.edges,
    }
  });

  return result;
},
    deleteWorkspace: async (_: any, { analysisId }: { analysisId: string }, { prisma }: GraphQLContext) => {
      const targetPath = path.resolve(`./temp-clones/${analysisId}`);
      try {
        if (await fs.pathExists(targetPath)) {
          await fs.remove(targetPath);
        }
        await prisma.workspace.delete({ where: { analysisId } });
        return true;
      } catch (error) {
        return false;
      }
    },
    getSuggestionForSnippet: async (_: any, { code }: { code: string }) => {
      return await getAISuggestion(code);
    },
    executeCommand: async (_: any, { analysisId, command }: { analysisId: string, command: string }) => {
      const cwd = path.resolve(`./temp-clones/${analysisId}`);
      try {
        const { stdout, stderr } = await execPromise(command, { cwd, shell: 'powershell.exe' });
        return stderr || stdout;
      } catch (error: any) {
        return error.message;
      }
    },
  },
};