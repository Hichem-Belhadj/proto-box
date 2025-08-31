import multer from "multer";
import os from "os";
import {randomUUID} from "crypto";

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
    if (!isZip(file)) return cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", "file"));
    cb(null, true);
};

export const uploadZip = multer({
    storage,
    limits: { files: 1, fileSize: 25 * 1024 * 1024 }, // 25MB
    fileFilter
}).single("file");
