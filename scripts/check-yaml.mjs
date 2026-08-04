import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { parse } from "yaml";

const root = process.cwd();
const githubDirectory = join(root, ".github");
const allowedFormTypes = new Set(["input", "textarea", "dropdown", "checkboxes", "markdown"]);

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? walk(path) : [path];
      }),
    )
  ).flat();
}

const yamlFiles = (await walk(githubDirectory)).filter((path) =>
  [".yml", ".yaml"].includes(extname(path)),
);
const errors = [];

for (const path of yamlFiles) {
  const displayPath = relative(root, path);
  try {
    const document = parse(await readFile(path, "utf8"));
    if (displayPath.includes("ISSUE_TEMPLATE") && !displayPath.endsWith("config.yml")) {
      if (!document?.name || !document?.description || !Array.isArray(document?.body)) {
        errors.push(`${displayPath}: formulaire incomplet`);
        continue;
      }
      const ids = new Set();
      for (const field of document.body) {
        if (!allowedFormTypes.has(field.type))
          errors.push(`${displayPath}: type ${field.type} inconnu`);
        if (field.id) {
          if (ids.has(field.id)) errors.push(`${displayPath}: identifiant ${field.id} dupliqué`);
          ids.add(field.id);
        }
      }
    }
  } catch (error) {
    errors.push(`${displayPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`${yamlFiles.length} fichiers YAML valides.`);
}
