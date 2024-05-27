import { homedir } from "os";
import path from "path";
import fs from "fs";

export function readConfig(filePath) {
  // const configPath = path.join(homedir(), filePath);
  const configPath = filePath;

  if (!fs.existsSync(configPath)) {
    console.log(`No "${configPath}" found, create one!`);
    process.exit(1);
  }

  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch (e) {
    console.log(`Couldn't parse "${configPath}" ${e}`);
    process.exit(1);
  }

  return config;
}

export function getConfig(config, exampleConfig) {
  let anyKeyMissing = false;
  Object.keys(exampleConfig).forEach((requiredKey) => {
    if (!config.hasOwnProperty(requiredKey)) {
      const defaultValue = exampleConfig[requiredKey];
      if (defaultValue) {
        console.log(`Defaulting value "${requiredKey}" to "${defaultValue}" in config`);
        config[requiredKey] = defaultValue;
      } else {
        console.log(`Value for "${requiredKey}" missing in config`);
        anyKeyMissing = true;
      }
    }
  });

  if (anyKeyMissing) {
    process.exit(1);
  }

  return config;
}
