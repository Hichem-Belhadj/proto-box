import { Router, Request, Response } from "express";
import { promises as fs } from "fs";
import { ZipService } from "../services/zip.service";
import { uploadZip } from "../middleware/uploadZip";
import Logger from "../utils/errors/logger";
import { ProtocService } from "../services/protoc.service";

const router = Router();
interface UploadRequest extends Request {
    fileValidationError?: string;
}

router.post("/", uploadZip, async (req: UploadRequest, res: Response) => {
    if (req.fileValidationError) {
        Logger.warn(`Upload rejected: ${ req.fileValidationError }`);
        return res.status(400).json({ error: req.fileValidationError });
    }

    if (!req.file) {
        Logger.warn("Upload rejected: no file received");
        return res.status(400).json({ error: "No file received" });
    }

    Logger.info(`Received file: ${req.file.originalname} (${req.file.size} bytes)`);

    try {
        Logger.info(`Starting extraction of ${req.file.path}`);
        const result = await ZipService.extractSafely(req.file.path, {
            maxEntries: 3000,
            maxUncompressed: 300 * 1024 * 1024,
        });
        Logger.info(`Extraction complete: ${result.protoFiles.length} proto files found`);

        const descriptor = await ProtocService.buildDescriptor(result.extractedTo);
        Logger.info(`Descriptor generated successfully`);

        res.setHeader("Content-Type", "application/octet-stream");
        res.setHeader("X-Proto-Files", encodeURIComponent(JSON.stringify(result.protoFiles)));
        res.send(descriptor);
        Logger.info(`Response sent successfully`);

    } catch (e: unknown) {
        const err = e as Error;
        const errMessage =  err.message ?? "Invalid ZIP";
        Logger.error(`ZIP extraction error: ${errMessage}`);
        return res.status(400).json({ error: errMessage });
    } finally {
        try {
            await fs.unlink(req.file.path);
            Logger.debug(`Temporary file deleted: ${req.file.path}`);
        } catch (e: unknown) {
            const err = e as Error;
            Logger.warn(`Unable to delete ${req.file.path}: ${err.message}`);
        }
    }
});

export default router;
