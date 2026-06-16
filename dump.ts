import fs from "fs";
import { EXTERNAL_LINKS, PROJECTS } from "./src/data";

const data = {
  EXTERNAL_LINKS,
  PROJECTS
};

fs.writeFileSync("src/data.json", JSON.stringify(data, null, 2));
console.log("data.json created!");
