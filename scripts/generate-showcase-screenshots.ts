import { createServer, type Server } from "node:http";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";
import { landingShowcaseCollections } from "../lib/showcase";

const publicDir = resolve(process.cwd(), "public");
const outputDir = join(publicDir, "showcase-screenshots");
const host = "127.0.0.1";

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

function startStaticServer(): Promise<{ server: Server; origin: string }> {
  return new Promise((resolveServer, reject) => {
    const server = createServer((request, response) => {
      const pathname = decodeURIComponent(new URL(request.url ?? "/", `http://${host}`).pathname);
      const requestedPath = resolve(publicDir, `.${normalize(pathname)}`);

      if (!requestedPath.startsWith(publicDir) || !existsSync(requestedPath)) {
        response.writeHead(404);
        response.end("Not found");
        return;
      }

      response.writeHead(200, {
        "Content-Type": contentTypes[extname(requestedPath).toLowerCase()] ?? "application/octet-stream",
        "Cache-Control": "no-store",
      });
      response.end(readFileSync(requestedPath));
    });

    server.once("error", reject);
    server.listen(0, host, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Unable to determine screenshot server port."));
        return;
      }
      resolveServer({ server, origin: `http://${host}:${address.port}` });
    });
  });
}

async function main() {
  mkdirSync(outputDir, { recursive: true });
  const { server, origin } = await startStaticServer();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  try {
    for (const collection of landingShowcaseCollections) {
      const collectionDir = join(outputDir, collection.id);
      mkdirSync(collectionDir, { recursive: true });

      for (const screen of collection.screens) {
        const sourcePath = join(publicDir, screen.src.replace(/^\//, ""));
        if (!existsSync(sourcePath)) {
          throw new Error(`Missing source screen: ${sourcePath}`);
        }

        const outputPath = join(collectionDir, `${screen.id}.webp`);
        console.log(`Capturing ${collection.name} / ${screen.label}`);

        await page.goto(`${origin}${screen.src}`, {
          waitUntil: "networkidle",
          timeout: 45_000,
        });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(500);

        const png = await page.screenshot({ type: "png", fullPage: false });
        await sharp(png).webp({ quality: 90, effort: 6 }).toFile(outputPath);

        const metadata = await sharp(outputPath).metadata();
        if (metadata.width !== 780 || metadata.height !== 1688 || metadata.format !== "webp") {
          throw new Error(
            `Invalid screenshot ${outputPath}: ${metadata.width}x${metadata.height} ${metadata.format}`,
          );
        }
      }
    }
  } finally {
    await browser.close();
    await new Promise<void>((resolveClose, reject) =>
      server.close((error) => (error ? reject(error) : resolveClose())),
    );
  }

  console.log(`Generated ${landingShowcaseCollections.flatMap((item) => item.screens).length} WebP screenshots.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
