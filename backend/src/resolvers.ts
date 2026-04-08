
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

export const resolvers = {
  Query: {
    getAiAnalysisForFile: async (
      _: any,
      { analysisId, filePath }: { analysisId: string, filePath: string }
    ) => {
      const content = getFileContent(analysisId, filePath);
      const MAX_CHARS = 16000;
      let suggestion;
      if (content.length > MAX_CHARS) {
        const truncatedContent = content.substring(0, MAX_CHARS);
        const truncatedSuggestion = await getAISuggestion(truncatedContent);
        suggestion = `---
File is too large for full analysis (${content.length} characters). Analyzing the first ${MAX_CHARS} characters.
---\n\n${truncatedSuggestion}`;
      } else {
        suggestion = await getAISuggestion(content);
      }
      
      return { content, suggestion };
    }
  },
  Mutation: {
    saveFile: async (_: any, { analysisId, filePath, content }: { analysisId: string, filePath: string, content: string }) => {
      const fullPath = path.resolve(`./temp-clones/${analysisId}/${filePath}`);
      console.log(`[File Save] Saving content to ${fullPath}`);
      try {
        await fs.writeFile(fullPath, content);
        return true;
      } catch (error) {
        console.error(`[File Save] Error: ${error}`);
        return false;
      }
    },
    analyzeRepository: async (_: any, { url }: { url: string }) => {
      return await analyzeRepository(url);
    },
    getSuggestionForSnippet: async (_: any, { code }: { code: string }) => {
      return await getAISuggestion(code);
    },
    executeCommand: async (_: any, { analysisId, command }: { analysisId: string, command: string }) => {
      const cwd = path.resolve(`./temp-clones/${analysisId}`);
      try {
        const { stdout, stderr } = await execPromise(command, { cwd, shell: 'powershell.exe' });
        if (stderr) return stderr;
        return stdout;
      } catch (error: any) {
        return error.message;
      }
    },
  },
};