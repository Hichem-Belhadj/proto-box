import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import parseRoute from "./api/parse.route";
import sendRoute from "./api/send.route";

class App {
    public app: Application;

    constructor() {
        this.app = express();
        this.initializeMiddlewares();
        this.initializeRoutes();
    }

    private initializeMiddlewares(): void {
        this.app.use(express.json({ limit: "10mb" }));
        this.app.use(express.urlencoded({ extended: true, limit: "10mb" }));
        this.app.use(express.raw({ type: "application/x-protobuf", limit: "10mb" }));

        this.app.use(cors());
        this.app.use(helmet());

        if (process.env.NODE_ENV !== "test") {
            this.app.use(morgan("dev"));
        }

        const publicDir = path.join(__dirname, "public");
        this.app.use(express.static(publicDir));
    }

    private initializeRoutes(): void {
        this.app.get("/health", (_req, res) => res.status(200).send("OK"));
        this.app.use("/parse", parseRoute);
        this.app.use("/send", sendRoute);
        this.app.post("/mock", express.raw({ type: "*/*" }), (req, res) => {
            console.log("Payload binaire reçu:", req.body);
            res.setHeader("Content-Type", "application/x-protobuf");
            res.send(req.body);
        });
    }
}

export default new App().app;