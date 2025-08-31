import axios, {AxiosHeaders, RawAxiosResponseHeaders,} from "axios";
import {injectable} from "inversify";
import ipaddr from "ipaddr.js";

type OutHeaders = Record<string, string>;
const toOutHeaders = (h: RawAxiosResponseHeaders): OutHeaders => {
    const out: OutHeaders = {};
    for (const [k, v] of Object.entries(h)) {
        if (v == null) continue;

        if (Array.isArray(v)) {
            out[k.toLowerCase()] = v.join(', ');
        } else if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
            out[k.toLowerCase()] = String(v);
        }
    }
    return out;
}

@injectable()
export class ProxyService {
    public forwardBinary = async (
        url: string,
        payload: Buffer,
        headers?: Record<string, string | number | boolean>
    ): Promise<{ status: number; data: Buffer; headers: OutHeaders }> => {
        const safeUrl = this.sanitizeUrl(url);

        const reqHeaders = new AxiosHeaders();
        reqHeaders.set("Content-Type", "application/x-protobuf");
        for (const [k, v] of Object.entries(headers ?? {})) {
            reqHeaders.set(k, String(v));
        }

        // copilot: ignore-start
        const res = await axios.post(safeUrl, payload, {
            headers: reqHeaders,
            responseType: "arraybuffer",
            validateStatus: () => true,
        });
        // copilot: ignore-end

        return {
            status: res.status,
            data: Buffer.from(res.data as ArrayBuffer),
            headers: toOutHeaders(res.headers as RawAxiosResponseHeaders),
        };
    };

    private sanitizeUrl(raw: string): string {
        const PROXY_MODE = process.env.PROXY_MODE ?? "local";

        let parsed: URL;
        try {
            parsed = new URL(raw);
        } catch {
            throw new Error("Invalid URL");
        }

        if (!["http:", "https:"].includes(parsed.protocol)) {
            throw new Error("Invalid protocol");
        }

        if (PROXY_MODE === "saas") {
            const host = parsed.hostname;
            if (
                host === "localhost" ||
                host === "127.0.0.1" ||
                host === "::1" ||
                this.isPrivateIp(host) ||
                host === "169.254.169.254"
            ) {
                throw new Error("Forbidden host in SaaS mode");
            }
        }

        return parsed.toString();
    }

    private isPrivateIp(hostname: string): boolean {
        try {
            const addr = ipaddr.parse(hostname);
            return addr.range() !== "unicast" || addr.range() === "private";
        } catch {
            return false;
        }
    }
}
