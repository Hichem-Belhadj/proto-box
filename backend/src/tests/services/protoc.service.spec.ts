import path from "path";
import os from "os";
import { promises as fs } from "fs";
import { ProtocService } from "../../services/protoc.service";

type RunSig = (cmd: string, args: string[], opts: { cwd: string }) => Promise<void>;

async function mkdtemp(prefix = "protoc-svc-"): Promise<string> {
    const dir = path.join(os.tmpdir(), `${prefix}${Date.now()}-${Math.random().toString(16).slice(2)}`);
    await fs.mkdir(dir, { recursive: true });
    return dir;
}

describe("ProtocService.buildDescriptor", () => {
    afterEach(async () => {
        jest.restoreAllMocks();
    });

    it("should throw when no .proto files are found", async () => {
        const root = await mkdtemp();
        await expect(ProtocService.buildDescriptor(root))
            .rejects.toThrow("Aucun fichier .proto trouvé");
        await fs.rm(root, { recursive: true, force: true });
    });

    it("should invoke protoc with correct args and return the descriptor buffer", async () => {
        // GIVEN
        const root = await mkdtemp();
        await fs.mkdir(path.join(root, "a", "b"), { recursive: true });
        await fs.writeFile(path.join(root, "a", "b", "x.proto"), 'syntax = "proto3";');
        await fs.writeFile(path.join(root, "ROOT.PROTO"), 'syntax = "proto3";'); // casse différente
        await fs.writeFile(path.join(root, "notes.txt"), "ignore");

        let capturedCmd = "";
        let capturedArgs: string[] = [];
        let capturedCwd = "";

        const fakeDescriptor = Buffer.from([0xde, 0xad, 0xbe, 0xef]);
        const svc = ProtocService as unknown as { run: RunSig };

        const runSpy = jest.spyOn(svc, "run") as jest.SpyInstance<
            Promise<void>,
            [string, string[], { cwd: string }]
        >;

        runSpy.mockImplementation(async (cmd, args, opts) => {
            capturedCmd = cmd;
            capturedArgs = args;
            capturedCwd = opts.cwd;

            const outFlag = args.find(a => a.startsWith("--descriptor_set_out="));
            const outPath = outFlag?.split("=", 2)[1];
            if (!outPath) throw new Error("missing --descriptor_set_out");

            await fs.writeFile(outPath, fakeDescriptor);
        });

        // WHEN
        const res = await ProtocService.buildDescriptor(root); // default outName: descriptor.pb

        // THEN
        expect(capturedCmd).toBe("protoc");
        expect(capturedCwd).toBe(root);

        expect(capturedArgs).toEqual(expect.arrayContaining([
            `--proto_path=${root}`,
            "--include_imports",
            "--include_source_info",
            `--descriptor_set_out=${path.join(root, "descriptor.pb")}`,
        ]));

        const protoArgs = capturedArgs.filter(a => !a.startsWith("--") && a.toLowerCase().endsWith(".proto"));
        const normalized = protoArgs.map(p => p.replace(/\\/g, "/").toLowerCase());

        expect(normalized).toHaveLength(2);
        expect(normalized).toEqual(expect.arrayContaining(["a/b/x.proto", "root.proto"]));

        expect(Buffer.isBuffer(res)).toBe(true);
        expect(Buffer.compare(res, fakeDescriptor)).toBe(0);

        await fs.rm(root, { recursive: true, force: true });
        runSpy.mockRestore();
    });

    it("should propagate protoc failure with stderr", async () => {
        // GIVEN
        const root = await mkdtemp();
        await fs.writeFile(path.join(root, "a.proto"), 'syntax = "proto3";');

        jest
            .spyOn(ProtocService as any, "run")
            .mockRejectedValue(new Error("protoc exit 1: missing import"));

        // WHEN THEN
        await expect(ProtocService.buildDescriptor(root))
            .rejects.toThrow(/protoc exit 1: missing import/);

        await fs.rm(root, { recursive: true, force: true });
    });

    it("should honor custom outName", async () => {
        // GIVEN
        const root = await mkdtemp();
        await fs.writeFile(path.join(root, "x.proto"), 'syntax = "proto3";');

        const svc = ProtocService as unknown as { run: RunSig };

        const runSpy = jest.spyOn(svc, "run") as jest.SpyInstance<
            Promise<void>,
            [string, string[], { cwd: string }]
        >;

        runSpy.mockImplementation(async (_cmd, args, _opts) => {
            const outFlag = args.find(a => a.startsWith("--descriptor_set_out="))!;
            const outPath = outFlag.split("=", 2)[1];
            await fs.writeFile(outPath, Buffer.from([1, 2, 3]));
        });

        // WHEN
        const out = await ProtocService.buildDescriptor(root, "out.desc");

        // THEN
        expect(out.equals(Buffer.from([1, 2, 3]))).toBe(true);
        expect(runSpy).toHaveBeenCalledWith(
            "protoc",
            expect.arrayContaining([`--descriptor_set_out=${path.join(root, "out.desc")}`]),
            { cwd: root }
        );

        await fs.rm(root, { recursive: true, force: true });
        runSpy.mockRestore();
    });
});
