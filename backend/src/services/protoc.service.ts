import {spawn} from "child_process";
import {promises as fs} from "fs";
import path from "path";

export class ProtocService {
    static async buildDescriptor(rootDir: string, outName = "descriptor.pb"): Promise<Buffer> {
        const protoFiles = await this.listProtoFiles(rootDir);
        if (protoFiles.length === 0) throw new Error("Aucun fichier .proto trouvé");

        const outPath = path.join(rootDir, outName);
        const args = [
            `--proto_path=${rootDir}`,
            "--include_imports",
            "--include_source_info",
            `--descriptor_set_out=${outPath}`,
            ...protoFiles.map(f => path.relative(rootDir, f).replace(/\\/g, "/")),
        ];

        await this.run("protoc", args, { cwd: rootDir });
        return fs.readFile(outPath);
    }

    private static async listProtoFiles(dir: string): Promise<string[]> {
        const out: string[] = [];
        async function walk(d: string) {
            const entries = await fs.readdir(d, { withFileTypes: true });
            for (const e of entries) {
                const p = path.join(d, e.name);
                if (e.isDirectory()) await walk(p);
                else if (e.isFile() && e.name.toLowerCase().endsWith(".proto")) out.push(p);
            }
        }
        await walk(dir);
        return out.sort();
    }

    private static run(cmd: string, args: string[], opts: { cwd: string }): Promise<void> {
        return new Promise((resolve, reject) => {
            const child = spawn(cmd, args, {
                cwd: opts.cwd,
                stdio: ["ignore", "pipe", "pipe"],
            });

            let stderr = "";

            child.stderr.on("data", (chunk: Buffer) => {
                stderr += chunk.toString("utf8");
            });

            child.on("error", (err: Error) => reject(err));
            child.on("close", (code: number | null) => {
                if (code === 0) resolve();
                else reject(new Error(`protoc exit ${code ?? "null"}: ${stderr.trim()}`));
            });
        });
    }
}
