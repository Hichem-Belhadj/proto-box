import { Router, Request, Response } from "express";
import { ProxyService } from "../services/proxy.service";
import Logger from "../utils/errors/logger";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
    const { url, headers } = req.query;

    if (!url || typeof url !== "string") {
        Logger.warn("Proxy rejected: missing 'url' query param");
        return res.status(400).json({ error: "Missing url query param" });
    }

    if (!req.body || !Buffer.isBuffer(req.body)) {
        Logger.warn("Proxy rejected: protobuf payload is missing or not binary");
        return res.status(400).json({ error: "Missing protobuf payload" });
    }

    let parsedHeaders: Record<string, string | number | boolean> | undefined;
    if (typeof headers === "string") {
        try {
            parsedHeaders = JSON.parse(headers) as Record<string, string | number | boolean>;
        } catch {
            Logger.warn("Proxy rejected: headers is not valid JSON");
            return res.status(400).json({ error: "Invalid headers format" });
        }
    }

    try {
        Logger.info(`Proxying request to ${url}`);
        const result = await ProxyService.forwardBinary(url, req.body, parsedHeaders);

        res.status(result.status);
        res.setHeader("Content-Type", "application/octet-stream");
        res.send(result.data);

        Logger.info(`Proxy success <- ${url} status=${result.status}`);
    } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        Logger.error(`Proxy error <- ${url}: ${errorMessage}`);
        return res.status(500).json({ error: errorMessage });
    }
});


export default router;
