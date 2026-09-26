import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import geoRouter from "./geo";
import tripsRouter from "./trips";
import trackingRouter from "./tracking";
import messagesRouter from "./messages";
import pitstopsRouter from "./pitstops";
import safeZonesRouter from "./safeZones";
import itineraryRouter from "./itinerary";
import demoRouter from "./demo";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(geoRouter);
router.use(trackingRouter);
router.use(messagesRouter);
router.use(pitstopsRouter);
router.use(safeZonesRouter);
router.use(itineraryRouter);
router.use(demoRouter);
router.use(tripsRouter);

export default router;
