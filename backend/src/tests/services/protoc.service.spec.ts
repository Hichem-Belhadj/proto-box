import path from "path";
import tmp from "tmp";
import {promises as fs} from "fs";
import {ProtocService} from "../../services/protoc.service";

async function mkdtemp(prefix = "protoc-svc-"): Promise<string> {
    return tmp.dirSync({ prefix, unsafeCleanup: true }).name;
}

describe("ProtocService.buildDescriptor", () => {
    let service: ProtocService;

    beforeEach(() => service = new ProtocService());

    afterEach(async () =>  jest.restoreAllMocks());

    it("should throw when no .proto files are found", async () => {
        const root = await mkdtemp();
        await expect(service.buildDescriptor(root))
            .rejects.toThrow("Aucun fichier .proto trouvé");
        await fs.rm(root, { recursive: true, force: true });
    });

    it("should invoke protoc with correct args and return the descriptor buffer", async () => {
        // GIVEN
        const root = await mkdtemp();
        await fs.mkdir(path.join(root, "a", "b"), { recursive: true });
        await fs.writeFile(path.join(root, "a", "b", "x.proto"), 'syntax = "proto3";');
        await fs.writeFile(path.join(root, "ROOT.PROTO"), 'syntax = "proto3";');
        await fs.writeFile(path.join(root, "notes.txt"), "ignore");

        let capturedCmd = "";
        let capturedArgs: string[] = [];
        let capturedCwd = "";

        const fakeDescriptor = Buffer.from([0xde, 0xad, 0xbe, 0xef]);

        const runSpy = jest.spyOn(service as any, "run") as jest.SpyInstance<
            Promise<void>,
            [string, string[], { cwd: string }]
        >;

        runSpy.mockImplementation(
            async (cmd: string, args: string[], opts: { cwd: string }) => {
                capturedCmd = cmd;
                capturedArgs = args;
                capturedCwd = opts.cwd;

                const outFlag = args.find(a => a.startsWith("--descriptor_set_out="));
                const outPath = outFlag?.split("=", 2)[1];
                if (!outPath) throw new Error("missing --descriptor_set_out");

                await fs.writeFile(outPath, fakeDescriptor);
            }
        );

        // WHEN
        const res = await service.buildDescriptor(root);

        // THEN
        expect(capturedCmd).toBe("protoc");
        expect(capturedCwd).toBe(root);

        expect(capturedArgs).toEqual(expect.arrayContaining([
            `--proto_path=${root}`,
            "--include_imports",
            "--include_source_info",
            `--descriptor_set_out=${path.join(root, "descriptor.pb")}`,
        ]));

        // Vérifie que les .proto trouvés sont bien passés à protoc
        const protoArgs = capturedArgs.filter(
            a => !a.startsWith("--") && a.toLowerCase().endsWith(".proto")
        );
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

        jest.spyOn(service as any, "run")
            .mockRejectedValue(new Error("protoc exit 1: missing import"));

        // WHEN THEN
        await expect(service.buildDescriptor(root))
            .rejects.toThrow(/protoc exit 1: missing import/);

        await fs.rm(root, { recursive: true, force: true });
    });

    it("should honor custom outName", async () => {
        // GIVEN
        const root = await mkdtemp();
        await fs.writeFile(path.join(root, "x.proto"), 'syntax = "proto3";');

        const runSpy = jest.spyOn(service as any, "run") as jest.SpyInstance<
            Promise<void>,
            [string, string[], { cwd: string }]
        >;

        runSpy.mockImplementation(
            async (_cmd: string, args: string[], _opts: { cwd: string }) => {
                const outFlag = args.find(a => a.startsWith("--descriptor_set_out="))!;
                const outPath = outFlag.split("=", 2)[1];
                await fs.writeFile(outPath, Buffer.from([1, 2, 3]));
            }
        );

        // WHEN
        const out = await service.buildDescriptor(root, "out.desc");

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
