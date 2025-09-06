import {inject, injectable} from "inversify";
import {Request, Response} from "express";
import Logger from "../../utils/errors/logger";
import {ProxyService} from "../../services/proxy.service";
import {ErrorModel} from "../../models/error";

@injectable()
export class SenderController {
    constructor(
        @inject('ProxyService') private proxyService: ProxyService
    ) { }

    public send = async (req: Request, res: Response) => {
        const { url, headers } = req.query;

        if (!url || typeof url !== "string") {
            Logger.warn("Proxy rejected: missing 'url' query param");
            return res.status(400).json({
                code: "SEND_INVALID_URL",
                message: "Missing url query param"
            } as ErrorModel);
        }

        if (!req.body || !Buffer.isBuffer(req.body)) {
            Logger.warn("Proxy rejected: protobuf payload is missing or not binary");
            return res.status(400).json({
                code: "SEND_INVALID_PAYLOAD",
                message: "Missing protobuf payload"
            } as ErrorModel);
        }

        let parsedHeaders: Record<string, string | number | boolean> | undefined;
        const sanitizedUrl = url.replace(/[\r\n]/g, "");

        if (typeof headers === "string") {
            try {
                parsedHeaders = JSON.parse(headers) as Record<string, string | number | boolean>;
            } catch {
                Logger.warn("Proxy rejected: headers is not valid JSON");
                return res.status(400).json({
                    code: "SEND_INVALID_HEADER",
                    message: "Invalid headers format"
                } as ErrorModel);
            }
        }

        try {
            Logger.info(`Proxying request to ${sanitizedUrl}`);
            const result = await this.proxyService.forwardBinary(url, req.body, parsedHeaders);

            res.status(result.status);
            res.setHeader("Content-Type", "application/octet-stream");
            res.send(result.data);

            Logger.info(`Proxy success <- "${sanitizedUrl}" status=${result.status}`);
        } catch (e: unknown) {
            const errorMessage = e instanceof Error ? e.message : String(e);

            Logger.error(`Proxy error <- ${sanitizedUrl}: ${errorMessage}`);
            return res.status(500).json({
                code: "SEND_PROXY_ERROR",
                message: errorMessage
            } as ErrorModel);
        }
    }
}