import AdmZip from "adm-zip";
import path from "path";
import {promises as fs} from "fs";
import {ZipService} from "../../services/zip.service";
import tmp from "tmp";

async function writeTempZip(zip: AdmZip): Promise<string> {
    const tmpFile = tmp.fileSync({ postfix: ".zip" });
    const filePath = tmpFile.name;
    await fs.writeFile(filePath, zip.toBuffer());

    return filePath;
}

function makeZip(entries: Array<{ name: string; data?: Buffer | string }>): AdmZip {
    const zip = new AdmZip();
    for (const e of entries) {
        if (e.name.endsWith("/")) {
            (zip as any).addFile(e.name, Buffer.alloc(0), "", 0o755 << 16); // force dir attr
        } else {
            const buf = Buffer.isBuffer(e.data) ? e.data : Buffer.from(e.data ?? "");
            zip.addFile(e.name, buf);
        }
    }
    return zip;
}

describe("ZipService.extractSafely", () => {
    let service: ZipService;

    beforeEach(() => service = new ZipService());

    afterEach(() => jest.restoreAllMocks());

    it("should extract files and return only normalized .proto entries", async () => {
        // GIVEN
        const zip = makeZip([
            { name: "a/" },
            { name: "a/b.proto", data: "syntax = \"proto3\";" },
            { name: "a/c.txt", data: "noop" },
            { name: "root.proto", data: "syntax = \"proto3\";" },
        ]);
        const zipPath = await writeTempZip(zip);

        // WHEN
        const res = await service.extractSafely(zipPath, { maxEntries: 10, maxUncompressed: 1024 * 1024 });

        // THEN
        const stat = await fs.stat(res.extractedTo);
        expect(stat.isDirectory()).toBe(true);

        await expect(fs.stat(path.join(res.extractedTo, "a", "b.proto"))).resolves.toBeDefined();
        await expect(fs.stat(path.join(res.extractedTo, "a", "c.txt"))).resolves.toBeDefined();
        await expect(fs.stat(path.join(res.extractedTo, "root.proto"))).resolves.toBeDefined();

        expect(res.protoFiles).toEqual(["a/b.proto", "root.proto"]);
    });

    it("should reject when the number of entries exceeds the limit", async () => {
        // GIVEN
        const zip = makeZip([
            { name: "one.proto", data: "x" },
            { name: "two.proto", data: "y" },
        ]);

        // ZHEN
        const zipPath = await writeTempZip(zip);

        // WHEN THEN
        await expect(service.extractSafely(zipPath, { maxEntries: 1 }))
            .rejects.toThrow("Too many zip entries");
    });

    it("should reject when the cumulative uncompressed size exceeds the limit", async () => {
        // GIVEN
        const big = Buffer.alloc(1024 * 1024, 1); // 1 MiB
        const zip = makeZip([
            { name: "big.proto", data: big },
            { name: "other.proto", data: big },
        ]);
        const zipPath = await writeTempZip(zip);

        // WHEN THEN
        await expect(service.extractSafely(zipPath, { maxUncompressed: 1024 * 1024 })) // 1 MiB
            .rejects.toThrow("Uncompressed size limit exceeded");
    });

    it("should detect and block Zip Slip attempts", async () => {
        // GIVEN
        const malicious: Partial<AdmZip.IZipEntry> = {
            entryName: "../evil.txt",
            isDirectory: false,
            getData: () => Buffer.from("pwned"),
        };

        jest
            .spyOn(service as any, "readEntries")
            .mockReturnValue([malicious as AdmZip.IZipEntry]);

        // WHEN THEN
        await expect(service.extractSafely("ignored.zip"))
            .rejects.toThrow("Zip Slip detected");
    });

    it("should support nested directories and create folders recursively", async () => {
        // GIVEN
        const zip = makeZip([
            { name: "deep/nested/" },
            { name: "deep/nested/file.proto", data: "syntax = \"proto3\";" },
        ]);
        const zipPath = await writeTempZip(zip);

        // WHEN
        const res = await service.extractSafely(zipPath);

        // THEN
        await expect(fs.stat(path.join(res.extractedTo, "deep", "nested", "file.proto"))).resolves.toBeDefined();
        expect(res.protoFiles).toEqual(["deep/nested/file.proto"]);
    });

    it("should not fail when no .proto files are present", async () => {
        // GIVEN
        const zip = makeZip([{ name: "README.md", data: "# ok" }]);
        const zipPath = await writeTempZip(zip);

        // WHEN
        const res = await service.extractSafely(zipPath);

        // THEN
        expect(res.protoFiles).toEqual([]);
    });
});