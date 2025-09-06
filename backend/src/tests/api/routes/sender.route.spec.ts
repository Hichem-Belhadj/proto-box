import express from "express";
import request from "supertest";
import {ProxyService} from "../../../services/proxy.service";
import router from "../../../api/routes/send.route";
import {container} from "../../../config/container";

jest.mock("../../../utils/errors/logger", () => ({
    __esModule: true,
    default: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

const parseAsBuffer = (res: any, cb: any) => {
    const chunks: Buffer[] = [];
    res.on("data", (c: Buffer) => chunks.push(c));
    res.on("end", () => cb(null, Buffer.concat(chunks)));
};

const buildAppRaw = () => {
    const app = express();
    app.use(express.raw({type: "*/*"}));
    app.use("/send", router);
    return app;
};

const buildAppNoParser = () => {
    const app = express();
    app.use("/send", router);
    return app;
};

const buildAppJson = () => {
    const app = express();
    app.use(express.json());
    app.use("/send", router);
    return app;
};

describe("POST /send", () => {

    let proxyServiceMock: Partial<ProxyService>;

    beforeEach(() => {
        proxyServiceMock = {forwardBinary: jest.fn()};

        container.rebindSync<ProxyService>("ProxyService").toConstantValue(proxyServiceMock as ProxyService);
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.clearAllMocks();
    });

    it("should return 400 when url query param is missing", async () => {
        // GIVEN
        const app = buildAppRaw();

        // WHEN
        const res = await request(app)
            .post("/send")
            .set("Content-Type", "application/x-protobuf")
            .send(Buffer.from([0x01, 0x02]));

        // THEN
        expect(res.status).toBe(400);
        expect(res.body).toEqual({
            "code": "SEND_INVALID_URL",
            "message": "Missing url query param"
        });
    });

    it("should return 400 when payload is missing", async () => {
        // GIVEN
        const app = buildAppNoParser();

        // WHEN
        const res = await request(app)
            .post("/send")
            .query({url: "http://backend/pb"});

        // THEN
        expect(res.status).toBe(400);
        expect(res.body).toEqual({
            "code": "SEND_INVALID_PAYLOAD",
            "message": "Missing protobuf payload"
        });
    });

    it("should return 400 when payload is not a Buffer", async () => {

        // GIVEN
        const app = buildAppJson();

        // WHEN
        const res = await request(app)
            .post("/send")
            .query({url: "http://backend/pb"})
            .send({a: 1});


        // THEN
        expect(res.status).toBe(400);
        expect(res.body).toEqual({
            "code": "SEND_INVALID_PAYLOAD",
            "message": "Missing protobuf payload"
        });
    });

    it("should proxy binary payload and return octet-stream with upstream status", async () => {
        // GIVEN
        const app = buildAppRaw();

        proxyServiceMock.forwardBinary = jest.fn().mockResolvedValue({
            status: 206,
            data: Buffer.from([9, 8, 7]),
            headers: {"x-up": "y"},
        });

        // WHEN
        const res = await request(app)
            .post("/send")
            .query({
                url: "http://backend/pb",
                headers: JSON.stringify({"X-Trace": "abc"}),
            })
            .set("Content-Type", "application/x-protobuf")
            .parse(parseAsBuffer)
            .send(Buffer.from([0xaa, 0xbb]));

        // THEN
        expect(res.status).toBe(206);
        expect(res.headers["content-type"]).toMatch(/application\/octet-stream/);
        expect(Buffer.isBuffer(res.body)).toBe(true);
        expect(Buffer.compare(res.body, Buffer.from([9, 8, 7]))).toBe(0);

        expect(proxyServiceMock.forwardBinary).toHaveBeenCalledTimes(1);
        const [calledUrl, calledPayload, calledHeaders] = (proxyServiceMock.forwardBinary as jest.Mock).mock.calls[0];
        expect(calledUrl).toBe("http://backend/pb");
        expect(Buffer.isBuffer(calledPayload)).toBe(true);
        expect(Buffer.compare(calledPayload, Buffer.from([0xaa, 0xbb]))).toBe(0);
        expect(calledHeaders).toEqual({"X-Trace": "abc"});
    });

    it("should return 500 with error json when ProxyService throws", async () => {
        // GIVEN
        const app = buildAppRaw();

        proxyServiceMock.forwardBinary = jest.fn().mockRejectedValue(new Error("upstream unavailable"));

        // WHEN
        const res = await request(app)
            .post("/send")
            .query({url: "http://backend/pb"})
            .set("Content-Type", "application/x-protobuf")
            .send(Buffer.from([0x01, 0x02]));

        // THEN
        expect(res.status).toBe(500);
        expect(res.body).toEqual({
            "code": "SEND_PROXY_ERROR",
            "message": "upstream unavailable"
        });
    });
});
