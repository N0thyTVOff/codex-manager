import { access, readFile, readdir } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";

const root = process.cwd();
const ignoredDirectories = new Set([".git", ".next", "coverage", "node_modules"]);

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries
        .filter((entry) => !ignoredDirectories.has(entry.name))
        .map((entry) => {
          const path = join(directory, entry.name);
          return entry.isDirectory() ? walk(path) : [path];
        }),
    )
  ).flat();
}

const markdownFiles = (await walk(root)).filter((path) => extname(path) === ".md");
const errors = [];
const linkPattern = /!?(?:\[[^\]]*\])\(([^)]+)\)/gu;

for (const file of markdownFiles) {
  const content = await readFile(file, "utf8");
  for (const match of content.matchAll(linkPattern)) {
    const rawTarget = match[1]?.trim().replace(/^<|>$/gu, "");
    if (!rawTarget || /^(?:https?:|mailto:|#)/u.test(rawTarget)) continue;
    const [pathPart] = rawTarget.split("#", 1);
    if (!pathPart) continue;
    const target = resolve(dirname(file), decodeURIComponent(pathPart));
    if (!target.startsWith(root)) {
      errors.push(`${relative(root, file)}: lien hors dépôt ${rawTarget}`);
      continue;
    }
    try {
      await access(target);
    } catch {
      errors.push(`${relative(root, file)}: cible absente ${rawTarget}`);
    }
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`${markdownFiles.length} fichiers Markdown vérifiés.`);
}
