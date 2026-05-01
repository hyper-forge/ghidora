import tui from "../../pkg/ghidora.js";
import { getRuntime } from "../datatypes/validateDataTypes.js";
export const checkForUpdates = async (currentVersion: string) => {
  try {
    const res = await fetch(
      "https://registry.npmjs.org/@hyperforge/ghidora/latest",
    );
    if (!res.ok) return;

    const { version: latest } = await res.json();

    if (!latest || latest === currentVersion) {
      process.stdout.write(tui.ghidora_logo());
      console.log(`Congrats! You are on the Latest Version - ${latest}`);
      return;
    }

    console.log(
      `\n⚠ Update available: ${currentVersion} → ${latest}\n` +
        `Run: npm i -g @hyperforge/ghidora@latest\n` +
        `Or choose global install of your preferred runtime\n` +
        `Currently using ${getRuntime()}`,
    );
  } catch (err) {
    console.log(`Failed to fetch latest update..\n${err}`);
  }
};

export const getVersion = (name: string, version: string) => {
  console.log(`${name.replace("@hyperforge/ghidora", "ghidora")} -v${version}`);
};
