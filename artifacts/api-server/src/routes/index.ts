import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import geoRouter from "./geo";
import tripsRouter from "./trips";
import trackingRouter from "./tracking";
import messagesRouter from "./messages";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(geoRouter);
router.use(trackingRouter);
router.use(messagesRouter);
router.use(tripsRouter);

export default router;
