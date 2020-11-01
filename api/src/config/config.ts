import convict from "convict";
import { defaults } from "./defaults";
import { existsSync } from "fs";

const config = convict(defaults);

const env = config.get("env");

const filePath = `${__dirname}/${env}.json`;

if (existsSync(filePath)) {
  config.loadFile(filePath);
}

config.validate();

export default config;
