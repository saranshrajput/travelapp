import { Router, type IRouter } from "express";
import {
  SearchPlacesQueryParams,
  SearchPlacesResponse,
  ReverseGeocodeQueryParams,
  ReverseGeocodeResponse,
  GetRouteOptionsQueryParams,
  GetRouteOptionsResponse,
} from "@workspace/api-zod";
import { authRequired } from "../lib/auth";
import { searchPlaces, reverseGeocode, routeAlternatives } from "../lib/external";

const router: IRouter = Router();

router.get("/geo/search", authRequired, async (req, res): Promise<void> => {
  const parsed = SearchPlacesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const results = await searchPlaces(parsed.data.q);
    res.json(SearchPlacesResponse.parse(results));
  } catch (err) {
    req.log.warn({ err }, "place search failed");
    res.status(502).json({ error: "Address search is unavailable right now. Try again." });
  }
});

router.get("/geo/reverse", authRequired, async (req, res): Promise<void> => {
  const parsed = ReverseGeocodeQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const place = await reverseGeocode(parsed.data.lat, parsed.data.lng);
  if (!place) {
    res.status(502).json({ error: "Could not look up that location." });
    return;
  }
  res.json(ReverseGeocodeResponse.parse(place));
});

router.get("/geo/routes", authRequired, async (req, res): Promise<void> => {
  const parsed = GetRouteOptionsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { fromLat, fromLng, toLat, toLng } = parsed.data;
  try {
    const routes = await routeAlternatives(
      { lat: fromLat, lng: fromLng },
      { lat: toLat, lng: toLng },
    );
    res.json(GetRouteOptionsResponse.parse(routes));
  } catch (err) {
    req.log.warn({ err }, "routing failed");
    res.status(502).json({
      error: "Could not fetch routes between these points. Check the locations and try again.",
    });
  }
});

export default router;
