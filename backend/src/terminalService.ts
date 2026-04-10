import os from 'os';
import path from 'path';
import fs from 'fs';
import * as pty from 'node-pty';
import { WebSocket } from 'ws';

const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';

export function setupTerminal(ws: WebSocket, analysisId: string) {
  const cwd = path.resolve(`./temp-clones/${analysisId}`);

  if (!fs.existsSync(cwd)) return;

  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-color',
    cols: 80,
    rows: 24,
    cwd: cwd,
    env: process.env as { [key: string]: string },
  });

  const dataListener = ptyProcess.onData(data => {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    } catch (err) {
    }
  });

  ptyProcess.onExit(() => {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    } catch (err) {}
  });

  ws.on('message', (data) => {
    try {
      ptyProcess.write(data.toString());
    } catch (err) {
    }
  });

  ws.on('close', () => {
    try {
      dataListener.dispose();
      ptyProcess.kill();
    } catch (err) {
    }
  });
}