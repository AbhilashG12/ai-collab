import os from 'os';
import path from 'path';
import * as pty from 'node-pty';
import { WebSocket } from 'ws'; 

const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';

export function setupTerminal(ws: WebSocket, analysisId: string) {
  const cwd = path.resolve(`./temp-clones/${analysisId}`);
  if (!cwd) return ws.close();
  
  console.log(`[Terminal] Spawning pty with shell '${shell}' in ${cwd}`);

  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-color',
    cols: 80,
    rows: 24,
    cwd: cwd,
    env: process.env as { [key: string]: string },
  });

  ptyProcess.onData(data => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  });


  ptyProcess.onExit(({ exitCode }) => {
    console.log(`[Terminal] Pty process exited with code: ${exitCode}`);
    ws.close();
  });

  ws.on('message', (data) => {
    ptyProcess.write(data.toString());
  });

  ws.on('close', () => {
    console.log('[Terminal] Connection closed, killing pty.');
    ptyProcess.kill();
  });

  console.log(`[Terminal] Pty spawned with PID: ${ptyProcess.pid}`);
}