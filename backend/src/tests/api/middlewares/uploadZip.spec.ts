import express from "express";
import request from "supertest";
import path from "path";
import os from "os";
import { promises as fs } from "fs";

import { zipOnlyMiddleware } from "../../../api/middleware/uploadZip";

const buildApp = () => {
    const app = express();
    app.post("/mw", (req, res) => {
        zipOnlyMiddleware(req as any, res as any, (err: any) => {
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

    it("should reject a non-zip file with 'Only .zip files are allowed'", async () => {
        // GIVEN
        const app = buildApp();
        const buf = Buffer.from("not a zip");

        // WHEN
        const res = await request(app)
            .post("/mw")
            .attach("file", buf, { filename: "note.txt", contentType: "text/plain" })
            .expect(500);

        // THEN
        expect(res.body).toEqual({ error: "Only .zip files are allowed" });
    });

    it("should reject an oversized zip with 'File too large'", async () => {
        // GIVEN
        const app = buildApp();
        const big = Buffer.alloc(25 * 1024 * 1024 + 1, 1); // > 25MB

        // WHEN
        const res = await request(app)
            .post("/mw")
            .attach("file", big, { filename: "huge.zip", contentType: "application/zip" })
            .expect(400);

        // THEN
        expect(res.body).toEqual({ error: "File too large" });
    });

    it("should reject an empty file with 'No file uploaded'", async () => {
        // GIVEN
        const app = buildApp();

        // WHEN
        const res = await request(app)
            .post("/mw")
            .expect(400);

        // THEN
        expect(res.body).toEqual({ error: "No file uploaded" });
    });

    it("should pass through with 200", async () => {
        // GIVEN
        const app = buildApp();
        const buf = Buffer.from("zip file");

        // WHEN
        const res = await request(app)
            .post("/mw")
            .attach("file", buf, { filename: "huge.zip", contentType: "application/zip" })
            .expect(200);

        // THEN
        expect(res.body.file).toBeTruthy();
    });
});
