// Servidor HTTP para o Render.
// O preset "node" do TanStack Start gera um handler em dist/server/server.js
// mas não inicia um servidor HTTP — este arquivo faz isso.
import { createServer } from "node:http";
import { createReadStream, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PORT = parseInt(process.env.PORT || "10000", 10);

// Importa o handler gerado pelo TanStack Start
const { default: handler } = await import("./dist/server/server.js");

const MIME_TYPES = {
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".html": "text/html",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    // Servir arquivos estáticos do client
    const staticPath = join(__dirname, "dist/client", url.pathname);
    if (existsSync(staticPath) && !url.pathname.endsWith("/")) {
      const ext = extname(staticPath);
      const contentType = MIME_TYPES[ext] || "application/octet-stream";
      const isImmutable = url.pathname.startsWith("/assets/");
      res.setHeader("Content-Type", contentType);
      if (isImmutable) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
      createReadStream(staticPath).pipe(res);
      return;
    }

    // Passar para o handler SSR do TanStack Start
    const headers = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) headers[key] = Array.isArray(value) ? value.join(", ") : value;
    }

    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;

    const request = new Request(`http://localhost:${PORT}${req.url}`, {
      method: req.method,
      headers,
      body: body && body.length > 0 ? body : undefined,
    });

    const response = await handler.fetch(request);

    res.statusCode = response.status;
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    }
    res.end();
  } catch (err) {
    console.error(err);
    res.statusCode = 500;
    res.end("Internal Server Error");
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
