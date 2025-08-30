import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import routes from "./api/routes";

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
        this.app.use('/api', routes);
    }
}

export default new App().app;