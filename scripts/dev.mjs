import { spawn } from "node:child_process";

const commands = [
  ["node", ["server/authServer.js"]],
  ["npx", ["vite", "--host", "127.0.0.1", "--port", process.env.WEB_PORT || "4173"]]
];

const children = commands.map(([command, args]) => {
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32"
  });
  child.on("exit", (code) => {
    if (code && code !== 0) {
      process.exitCode = code;
    }
  });
  return child;
});

const shutdown = () => {
  for (const child of children) {
    child.kill();
  }
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
