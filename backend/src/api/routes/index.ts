import express, {Router} from "express";
import parseRoute from "./parser.route";
import sendRoute from "./send.route";

const router = Router();

// Health check endpoint
router.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Register routes
router.use("/parse", parseRoute);
router.use("/send", sendRoute);
// copilot: ignore-start
router.post("/mock", express.raw({ type: "*/*" }), (req, res) => {
    console.log("Payload binaire reçu:", req.body);
    res.setHeader("Content-Type", "application/x-protobuf");
    res.send(req.body);
});
// copilot: ignore-end

export default router;