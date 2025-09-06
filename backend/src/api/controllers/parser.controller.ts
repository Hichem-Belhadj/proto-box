import {inject, injectable} from "inversify";
import {ZipService} from "../../services/zip.service";
import Logger from "../../utils/errors/logger";
import {ProtocService} from "../../services/protoc.service";
import {promises as fs} from "fs";
import { Request, Response } from 'express';
import path from "path";
import os from "os";
import {ErrorModel} from "../../models/error";

interface UploadRequest extends Request {
    fileValidationError?: string;
}

@injectable()
export class ParserController {
    private readonly TMP_DIR = path.resolve(os.tmpdir());

    constructor(
        @inject('ZipService') private zipService: ZipService,
        @inject('ProtocService') private protocService: ProtocService
    ) { }

    parseProto = async (req: UploadRequest, res: Response) => {
        if (req.fileValidationError) {
            Logger.warn(`Upload rejected: ${ req.fileValidationError }`);
            return res.status(400).json({
                code: "INVALID_ZIP_FILE",
                message: req.fileValidationError
            } as ErrorModel);
        }

        if (!req.file) {
            Logger.warn("Upload rejected: no file received");
            return res.status(400).json({
                code: "EMPTY_ZIP_FILE",
                message: "No file received"
            } as ErrorModel);
        }

        try {
            const sanitizedPath = (req.file.path ?? "").replace(/[\r\n]/g, "");
            Logger.info(`Starting extraction of ${sanitizedPath}`);
            const result = await this.zipService.extractSafely(req.file.path, {
                maxEntries: 3000,
                maxUncompressed: 300 * 1024 * 1024,
            });
            Logger.info(`Extraction complete: ${result.protoFiles.length} proto files found`);

            const descriptor = await this.protocService.buildDescriptor(result.extractedTo);
            Logger.info(`Descriptor generated successfully`);

            res.setHeader("Content-Type", "application/octet-stream");
            res.setHeader("X-Proto-Files", encodeURIComponent(JSON.stringify(result.protoFiles)));
            res.send(descriptor);
            Logger.info(`Response sent successfully`);

        } catch (e: unknown) {
            const errMessage =  (e as Error).message ?? "Invalid ZIP";
            Logger.error(`ZIP extraction error: ${errMessage}`);
            return res.status(400).json({
                code: "INVALID_ZIP_FILE",
                message: errMessage
            } as ErrorModel);
        } finally {
            if (req.file?.path) {
                await this.safeDelete(req.file.path);
            }
        }
    };

    private async safeDelete(filePath: string): Promise<void> {
        if (!filePath) return;

        const resolved = path.resolve(filePath);
        const safeResolved = resolved.replace(/[\r\n]/g, '');

        if (!resolved.startsWith(this.TMP_DIR)) {
            Logger.warn(`Refused to delete outside of temp dir: ${safeResolved}`);
            return;
        }

        try {
            await fs.unlink(resolved);
            Logger.debug(`Temporary file deleted: ${safeResolved}`);
        } catch (e) {
            Logger.warn(`Unable to delete ${safeResolved}: ${(e as Error).message}`);
        }
    }
}