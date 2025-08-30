import {Router} from "express";
import {uploadZip} from "../middleware/uploadZip";
import {ParserController} from "../controllers/parser.controller";
import {container} from "../../config/container";

const router = Router();

router.post(
    "/",
    uploadZip,
    (req, res) =>
        container.get<ParserController>("ParserController").parseProto(req, res)
);

export default router;
