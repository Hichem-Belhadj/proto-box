import express from "express";
import request from "supertest";
import path from "path";
import os from "os";
import { promises as fs } from "fs";

import { uploadZip } from "../../../api/middleware/uploadZip";

const buildApp = () => {
    const app = express();
    app.post("/mw", (req, res) => {
        uploadZip(req as any, res as any, (err: any) => {
            if (err) {
                return res.status(400).json({ code: err.code, message: err.message });
            }
            return res.status(200).json({ file: (req as any).file ?? null });
        });
    });
    return app;
};

describe("uploadZip middleware", () => {

    it("should accept a valid zip (by mimetype), store it in tmpdir and rename to *.zip", async () => {
        // GIVEN
        const app = buildApp();
        const buf = Buffer.from("dummy zip content");

        // WHEN
        const res = await request(app)
            .post("/mw")
            .attach("file", buf, { filename: "protos.zip", contentType: "application/zip" })
            .expect(200);

        // THEN
        expect(res.body.file).toBeTruthy();
        expect(res.body.file.originalname).toBe("protos.zip");
        expect(res.body.file.mimetype).toBe("application/zip");

        const savedPath: string = res.body.file.path;
        expect(savedPath.startsWith(path.resolve(os.tmpdir()))).toBe(true);

        expect(res.body.file.filename).toMatch(/\.zip$/);

        const stat = await fs.stat(savedPath);
        expect(stat.isFile()).toBe(true);
        expect(stat.size).toBe(buf.length);

        await fs.unlink(savedPath);
    });

    it("should accept a zip by extension even with a generic mimetype", async () => {
        // GIVEN
        const app = buildApp();
        const buf = Buffer.from("x");

        // WHEN
        const res = await request(app)
            .post("/mw")
            .attach("file", buf, { filename: "any.zip", contentType: "application/octet-stream" })
            .expect(200);

        expect(res.body.file).toBeTruthy();
        expect(res.body.file.originalname).toBe("any.zip");

        // THEN
        await fs.unlink(res.body.file.path);
    });

    it("should reject a non-zip file with LIMIT_UNEXPECTED_FILE", async () => {
        // GIVEN
        const app = buildApp();
        const buf = Buffer.from("not a zip");

        // WHEN
        const res = await request(app)
            .post("/mw")
            .attach("file", buf, { filename: "note.txt", contentType: "text/plain" })
            .expect(400);

        // THEN
        expect(res.body).toEqual({
            code: "LIMIT_UNEXPECTED_FILE",
            message: expect.any(String),
        });
    });

    it("should reject an oversized zip with LIMIT_FILE_SIZE", async () => {
        // GIVEN
        const app = buildApp();
        const big = Buffer.alloc(25 * 1024 * 1024 + 1, 1); // > 25MB

        // WHEN
        const res = await request(app)
            .post("/mw")
            .attach("file", big, { filename: "huge.zip", contentType: "application/zip" })
            .expect(400);

        // THEN
        expect(res.body).toEqual({
            code: "LIMIT_FILE_SIZE",
            message: expect.any(String),
        });
    });

    it("should pass through with 200 and null file when no file is sent (middleware alone)", async () => {
        // GIVEN
        const app = buildApp();

        // WHEN
        const res = await request(app)
            .post("/mw")
            .expect(200);

        // THEN
        expect(res.body.file).toBeNull();
    });
});
