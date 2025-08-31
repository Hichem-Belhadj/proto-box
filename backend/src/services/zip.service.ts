import AdmZip from "adm-zip";
import {promises as fs} from "fs";
import path from "path";
import {injectable} from "inversify";
import tmp from "tmp";

export type ExtractOptions = { maxEntries?: number; maxUncompressed?: number };
export type ExtractResult = {
    extractedTo: string;
    protoFiles: string[];
};

@injectable()
export class ZipService {

    public extractSafely = async (zipPath: string, opts?: ExtractOptions): Promise<ExtractResult> => {
        const limits = this.normalizeLimits(opts);
        const outDir = await this.makeOutDir();
        const entries = this.readEntries(zipPath);
        this.checkEntryCount(entries.length, limits.maxEntries);
        return this.extractAll(entries, outDir, limits);
    }

    private normalizeLimits = (opts?: ExtractOptions) => {
        return {
            maxEntries: opts?.maxEntries ?? 2000,
            maxUncompressed: opts?.maxUncompressed ?? 200 * 1024 * 1024,
        };
    }

    // When we want to delete the temporary file, we will need to add the callback `cleanupCallback`
    private makeOutDir = async (): Promise<string> => {
        return new Promise((resolve, reject) => {
            tmp.dir({ prefix: "proto", unsafeCleanup: true }, (err, dirPath) => {
                if (err) return reject(err);
                resolve(dirPath);
            });
        });
    }

    private readEntries = (zipPath: string) => {
        return new AdmZip(zipPath).getEntries();
    }

    private checkEntryCount = (count: number, max: number): void => {
        if (count > max) throw new Error("Too many zip entries");
    }

    private extractAll = async (
        entries: AdmZip.IZipEntry[],
        outDir: string,
        limits: { maxUncompressed: number }
    )=> {
        const ctx = { total: 0, protos: [] as string[] };
        for (const e of entries) await this.handleEntry(e, outDir, limits, ctx);
        return this.result(outDir, ctx.protos);
    }

    private handleEntry = async (
        e: AdmZip.IZipEntry,
        outDir: string,
        limits: { maxUncompressed: number },
        ctx: { total: number; protos: string[] }
    )=> {
        const name = e.entryName;
        const dest = this.safeJoin(outDir, name);
        if (e.isDirectory) return this.ensureDir(dest);

        ctx.total = this.addAndCheckSize(ctx.total, this.uncompressedSize(e), limits.maxUncompressed);
        await this.writeFile(dest, e.getData());
        this.maybeCollectProto(name, outDir, dest, ctx.protos);
    }

    private safeJoin = (base: string, rel: string) => {
        const dest = path.resolve(base, rel);
        const baseResolved = path.resolve(base) + path.sep;
        if (!dest.startsWith(baseResolved)) throw new Error("Zip Slip detected");
        return dest;
    }

    private ensureDir = async (dir: string) => {
        await fs.mkdir(dir, { recursive: true });
    }

    private uncompressedSize = (e: AdmZip.IZipEntry): number => {
        return e.getData().length;
    }

    private addAndCheckSize = (total: number, add: number, max: number): number => {
        const next = total + add;
        if (next > max) throw new Error("Uncompressed size limit exceeded");
        return next;
    }

    private writeFile = async (dest: string, data: Buffer)=> {
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.writeFile(dest, data, { flag: "wx" });
    }

    private maybeCollectProto = (name: string, base: string, abs: string, acc: string[]) => {
        if (name.toLowerCase().endsWith(".proto")) {
            acc.push(path.relative(base, abs).replaceAll("\\", "/"));
        }
    }

    private result = (
        extractedTo: string,
        protos: string[]
    ): ExtractResult => {
        return { extractedTo, protoFiles: protos.sort() };
    }
}
