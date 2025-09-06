import multer, {MulterError} from "multer";
import os from "os";
import {randomUUID} from "crypto";
import {NextFunction, Request, Response} from "express";
import Logger from "../../utils/errors/logger";

function isZip(file: Express.Multer.File): boolean {
    const mt = (file.mimetype || "").toLowerCase();
    const name = (file.originalname || "").toLowerCase();
    return mt === "application/zip" || mt === "application/x-zip-compressed" || name.endsWith(".zip");
}

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, os.tmpdir()),
    filename: (_req, _file, cb) => cb(null, `${randomUUID()}.zip`),
});

const fileFilter: multer.Options["fileFilter"] = (req, file, cb) => {
    if (!isZip(file)) return cb(new Error("Only .zip files are allowed"));
    cb(null, true);
};

const upload = multer({
    storage,
    limits: { files: 1, fileSize: 25 * 1024 * 1024 }, // 25MB
    fileFilter
});

const isMulterError = (e: unknown): e is MulterError => e instanceof MulterError;
const getMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

export const zipOnlyMiddleware = (req: Request, res: Response, next: NextFunction) => {
    upload.single("file")(req, res, (err?: unknown): void => {
        if (err) {
            const status = isMulterError(err) ? 400 : 500;
            Logger.error(`ZIP extraction error: ${getMessage(err)}`);
            res.status(status).json({ error: getMessage(err) });
            return;
        }

        if (!req.file) {
            Logger.error(`ZIP extraction error: "No file uploaded"`);
            res.status(400).json({ error: "No file uploaded" });
            return;
        }

        next();
    });
}
