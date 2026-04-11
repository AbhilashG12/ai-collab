import "dotenv/config";
import http from "http";
import express from "express";
import { ApolloServer } from "apollo-server-express";
import { WebSocketServer } from "ws";
import { PrismaClient } from "@prisma/client";
import cors from "cors";
import url from "url";
import fs from 'fs-extra'; 
import path from 'path';
import { typeDefs } from "./schema";
import { resolvers } from "./resolvers";
import { setupTerminal } from "./terminalService";

process.on('uncaughtException', (err: any) => {
  if (err.code === 'EPIPE') return;
  console.error('Uncaught Exception:', err);
});

const PORT = 4000;
const prisma = new PrismaClient();

async function cleanupTempClones() {
  const tempDir = path.resolve('./temp-clones');
  try {
    console.log('[Cleanup] Deleting old temporary clones...');
    await fs.emptyDir(tempDir);
    console.log('[Cleanup] Temporary clones directory is clean.');
  } catch (error) {
    console.error('[Cleanup] Failed to clean temporary clones:', error);
  }
}

async function startServer() {
  // await cleanupTempClones();
  const app = express();
  app.use(cors());
  const httpServer = http.createServer(app);

  const notificationWss = new WebSocketServer({ noServer: true });
  const terminalWss = new WebSocketServer({ noServer: true });

  notificationWss.on("connection", () => {
    console.log("✅ WebSocket connected: /websocket");
  });

  terminalWss.on("connection", (ws, req) => {
    const analysisId = req.url?.split("/").pop();
    if (analysisId) {
      setupTerminal(ws, analysisId);
      console.log(`✅ Terminal connected: ${analysisId}`);
    } else {
      ws.close();
    }
  });

  httpServer.on("upgrade", (request, socket, head) => {
    const pathname = request.url ? url.parse(request.url).pathname : undefined;

    if (pathname === "/websocket") {
      notificationWss.handleUpgrade(request, socket, head, (ws) => {
        notificationWss.emit("connection", ws, request);
      });
    } else if (pathname?.startsWith("/terminal/")) {
      terminalWss.handleUpgrade(request, socket, head, (ws) => {
        terminalWss.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: { prisma, wss: notificationWss },
  });

  await server.start();
  server.applyMiddleware({ app: app as any });

  httpServer.listen(PORT, () => {
    console.log(`🚀 GraphQL ready at http://localhost:${PORT}${server.graphqlPath}`);
    console.log(`🚀 Terminal ready at ws://localhost:${PORT}/terminal/:analysisId`);
  });
}

startServer().catch((err) => console.error("Server failed to start:", err));