import app from "./app";
import dotenv from "dotenv";

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

const shutdown = (signal: string) => () => {
    console.log(`${signal} received. Closing server...`);
    server.close(() => {
        console.log("Server closed. Bye.");
        process.exit(0);
    });
};
process.on("SIGINT", shutdown("SIGINT"));
process.on("SIGTERM", shutdown("SIGTERM"));

process.on("unhandledRejection", (err) => {
    console.error("Unhandled Rejection:", err);
});
process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception:", err);
    process.exit(1);
});
