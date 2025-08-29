import express from "express";
import request from "supertest";
import path from "path";
import os from "os";
import { promises as fs } from "fs";

import router from "../../api/parse.route";
import { ZipService } from "../../services/zip.service";
import { ProtocService } from "../../services/protoc.service";
import { uploadZip } from "../../middleware/uploadZip";

jest.mock("../../middleware/uploadZip", () => ({
    uploadZip: jest.fn(),
}));

jest.mock("../../utils/errors/logger", () => ({
    __esModule: true,
    default: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

const buildApp = () => {
    const app = express();
    app.use("/parse", router);
    return app;
};

describe("POST /parse", () => {
    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    it("should return 400 when upload middleware sets a validation error", async () => {
        // GIVEN
        (uploadZip as jest.Mock).mockImplementation((req: any, _res: any, next: any) => {
            req.fileValidationError = "Invalid mime type";
            next();
        });
        const app = buildApp();

        // WHEN
        const res = await request(app).post("/parse");

        // THEN
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: "Invalid mime type" });
    });

    it("should return 400 when no file is received", async () => {
        // GIVEN
        (uploadZip as jest.Mock).mockImplementation((_req: any, _res: any, next: any) => next());
        const app = buildApp();

        // WHEN
        const res = await request(app).post("/parse");

        // THEN
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: "No file received" });
    });

    it("should process zip, return octet-stream and X-Proto-Files on success", async () => {
        // GIVEN
        const tmpUpload = path.join(os.tmpdir(), `up-${Date.now()}.zip`);

        (uploadZip as jest.Mock).mockImplementation((req: any, _res: any, next: any) => {
            req.file = { originalname: "protos.zip", size: 123, path: tmpUpload };
            next();
        });

        jest.spyOn(ZipService, "extractSafely").mockResolvedValue({
            extractedTo: path.join(os.tmpdir(), "proto-xxxx"),
            protoFiles: ["a/b.proto", "root.proto"],
        });

        const descriptor = Buffer.from([1, 2, 3, 4]);
        jest.spyOn(ProtocService, "buildDescriptor").mockResolvedValue(descriptor);

        const unlinkSpy = jest.spyOn(fs, "unlink").mockResolvedValue();

        const app = buildApp();

        // WHEN
        const res = await request(app).post("/parse");

        // THEN
        expect(res.status).toBe(200);
        expect(res.headers["content-type"]).toMatch(/application\/octet-stream/);
        expect(res.headers["x-proto-files"]).toBe(encodeURIComponent(JSON.stringify(["a/b.proto", "root.proto"])));
        expect(Buffer.from(res.body).equals(descriptor)).toBe(true);

        expect(ZipService.extractSafely).toHaveBeenCalledWith(tmpUpload, {
            maxEntries: 3000,
            maxUncompressed: 300 * 1024 * 1024,
        });
        expect(ProtocService.buildDescriptor).toHaveBeenCalledWith(expect.stringContaining("proto-"));

        expect(unlinkSpy).toHaveBeenCalledWith(tmpUpload);
    });

    it("should return 400 when ZipService throws and still unlink temp file", async () => {
        // GIVEN
        const tmpUpload = path.join(os.tmpdir(), `up-${Date.now()}.zip`);

        (uploadZip as jest.Mock).mockImplementation((req: any, _res: any, next: any) => {
            req.file = { originalname: "protos.zip", size: 123, path: tmpUpload };
            next();
        });

        jest.spyOn(ZipService, "extractSafely").mockRejectedValue(new Error("bad zip"));
        const protoSpy = jest.spyOn(ProtocService, "buildDescriptor").mockResolvedValue(Buffer.from([9]));
        const unlinkSpy = jest.spyOn(fs, "unlink").mockResolvedValue();
        const app = buildApp();

        // WHEN
        const res = await request(app).post("/parse");

        // THEN
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: "bad zip" });

        expect(protoSpy).not.toHaveBeenCalled();
        expect(unlinkSpy).toHaveBeenCalledWith(tmpUpload);
    });

    it("should warn if unlink fails but still respond", async () => {
        // GIVEN
        const tmpUpload = path.join(os.tmpdir(), `up-${Date.now()}.zip`);

        (uploadZip as jest.Mock).mockImplementation((req: any, _res: any, next: any) => {
            req.file = { originalname: "protos.zip", size: 123, path: tmpUpload };
            next();
        });

        jest.spyOn(ZipService, "extractSafely").mockResolvedValue({
            extractedTo: path.join(os.tmpdir(), "proto-xxxx"),
            protoFiles: [],
        });
        jest.spyOn(ProtocService, "buildDescriptor").mockResolvedValue(Buffer.from([0]));
        jest.spyOn(fs, "unlink").mockRejectedValue(new Error("perm denied"));

        const app = buildApp();

        // WHEN
        const res = await request(app).post("/parse");

        // THEN
        expect(res.status).toBe(200);
        expect(res.headers["content-type"]).toMatch(/application\/octet-stream/);
    });
});
