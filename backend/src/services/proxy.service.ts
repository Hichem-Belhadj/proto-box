import axios, {AxiosHeaders, RawAxiosResponseHeaders,} from "axios";
import {injectable} from "inversify";

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
        const reqHeaders = new AxiosHeaders();
        reqHeaders.set("Content-Type", "application/x-protobuf");
        for (const [k, v] of Object.entries(headers ?? {})) reqHeaders.set(k, String(v));

        const res = await axios.post(url, payload, {
            headers: reqHeaders,
            responseType: "arraybuffer",
            validateStatus: () => true,
        });

        return {
            status: res.status,
            data: Buffer.from(res.data as ArrayBuffer),
            headers: toOutHeaders(res.headers as RawAxiosResponseHeaders),
        };
    }
}
