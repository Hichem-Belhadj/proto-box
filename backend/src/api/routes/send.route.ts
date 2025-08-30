import {Router} from "express";
import {container} from "../../config/container";
import {SenderController} from "../controllers/sender.controller";

const router = Router();

router.post("/",
    (req, res) =>
    container.get<SenderController>('SenderController').send(req, res));

export default router;
