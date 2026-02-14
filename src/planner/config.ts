import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { Config } from './types.js';

export function loadConfig(configPath?: string): Config {
  const configFile = configPath || path.join(process.cwd(), 'config.yaml');
  
  if (!fs.existsSync(configFile)) {
    throw new Error(`Config file not found: ${configFile}`);
  }
  
  const fileContents = fs.readFileSync(configFile, 'utf8');
  const config = yaml.load(fileContents) as Config;
  
  return config;
}

