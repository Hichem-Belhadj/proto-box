import axios from "axios";
import {ProxyService} from "../../services/proxy.service";

jest.spyOn(axios, "post");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("ProxyService.forwardBinary", () => {
    let service: ProxyService;

    beforeEach(() => {
        service = new ProxyService();
        jest.spyOn(axios, "post").mockResolvedValue({
            status: 200,
            data: new ArrayBuffer(0),
            headers: {},
        } as any);
    });

    afterEach(() => {
        jest.restoreAllMocks();
        delete process.env.PROXY_MODE;
    });

    it("should POST payload as binary with default Content-Type and return buffer + normalized headers", async () => {
        // GIVEN
        const url = "http://svc.local/echo";
        const payload = Buffer.from([1, 2, 3]);

        mockedAxios.post.mockResolvedValue({
            status: 200,
            data: new Uint8Array([9, 8, 7]).buffer,
            headers: {
                "X-Foo": "Bar",
                "set-cookie": ["a", "b"],
                "x-null": null,
            },
        });

        // WHEN
        const res = await service.forwardBinary(url, payload);

        // THEN
        expect(mockedAxios.post).toHaveBeenCalledTimes(1);
        const call = mockedAxios.post.mock.calls[0];
        const [calledUrl, calledBody, config] = call;

        expect(calledUrl).toBe(url);
        expect(Buffer.isBuffer(calledBody)).toBe(true);
        expect(Buffer.compare(calledBody as Buffer, payload)).toBe(0);

        expect(config).toBeDefined();
        expect((config?.headers as any).get("content-type")).toBe("application/x-protobuf");
        expect(config?.responseType).toBe("arraybuffer");
        expect(typeof config?.validateStatus).toBe("function");
        expect(config?.validateStatus?.(500)).toBe(true);

        expect(res.status).toBe(200);
        expect(Buffer.isBuffer(res.data)).toBe(true);
        expect(Buffer.compare(res.data, Buffer.from([9, 8, 7]))).toBe(0);
        expect(res.headers).toEqual({
            "x-foo": "Bar",
            "set-cookie": "a, b",
        });
    });

    it("should allow overriding Content-Type and stringify custom headers", async () => {
        // GIVEN
        mockedAxios.post.mockResolvedValue({
            status: 204,
            data: new ArrayBuffer(0),
            headers: {},
        } as any);

        const payload = Buffer.from([0xaa]);
        const out = await service.forwardBinary("http://svc/pb", payload, {
            "Content-Type": "application/octet-stream",
            "X-Id": 123,
            "X-Flag": true,
            foo: "bar",
        });

        // WHEN
        const call = mockedAxios.post.mock.calls[0];
        const config = call[2] as {
            headers?: { get: (k: string) => string | undefined };
        };

        // THEN
        expect(config).toBeDefined();
        expect(config.headers?.get("content-type")).toBe("application/octet-stream");
        expect(config.headers?.get("x-id")).toBe("123");
        expect(config.headers?.get("x-flag")).toBe("true");
        expect(config.headers?.get("foo")).toBe("bar");

        expect(out.status).toBe(204);
        expect(Buffer.isBuffer(out.data)).toBe(true);
    });

    it("should return non-2xx status without throwing (validateStatus always true)", async () => {
        // GIVEN
        mockedAxios.post.mockResolvedValue({
            status: 415,
            data: new Uint8Array([0x01]).buffer,
            headers: { "Content-Length": 1 } as any,
        });

        // WHEN
        const res = await service.forwardBinary("http://svc/fail", Buffer.from([0x01]));

        // THEN
        expect(res.status).toBe(415);
        expect(Buffer.compare(res.data, Buffer.from([0x01]))).toBe(0);
        expect(res.headers["content-length"]).toBe("1");
    });

    it("should handle Buffer data returned by axios as well", async () => {
        // GIVEN
        const buf = Buffer.from([5, 4, 3]);
        mockedAxios.post.mockResolvedValue({
            status: 200,
            data: buf,
            headers: {},
        } as any);

        // WHEN
        const res = await service.forwardBinary("http://svc/buf", Buffer.alloc(0));

        // THEN
        expect(Buffer.compare(res.data, buf)).toBe(0);
    });

    it("should allow localhost in local mode", async () => {
        // GIVEN
        process.env.PROXY_MODE = "local";
        service = new ProxyService();

        // WHEN
        const res = await service.forwardBinary("http://localhost:8080/test", Buffer.from([]));

        // THEN
        expect(res.status).toBe(200);
        expect(mockedAxios.post).toHaveBeenCalledWith(
            "http://localhost:8080/test",
            expect.any(Buffer),
            expect.any(Object),
        );
    });

    it("should reject localhost in saas mode", async () => {
        // GIVEN
        process.env.PROXY_MODE = "saas";
        service = new ProxyService();

        // WHEN THEN
        await expect(
            service.forwardBinary("http://localhost:8080/test", Buffer.from([]))
        ).rejects.toThrow(/Forbidden host/i);
    });

    it("should reject private IP in saas mode", async () => {
        // GIVEN
        process.env.PROXY_MODE = "saas";
        service = new ProxyService();

        // WHEN THEN
        await expect(
            service.forwardBinary("http://192.168.1.10/api", Buffer.from([]))
        ).rejects.toThrow(/Forbidden host/i);
    });

    it("should allow external host in saas mode", async () => {
        // GIVEN
        process.env.PROXY_MODE = "saas";
        service = new ProxyService();

        // WHEN
        const res = await service.forwardBinary("http://example.com/api", Buffer.from([]));

        // THEN
        expect(res.status).toBe(200);
        expect(mockedAxios.post).toHaveBeenCalledWith(
            "http://example.com/api",
            expect.any(Buffer),
            expect.any(Object),
        );
    });
});
