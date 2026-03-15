import { Router, Request, Response } from "express";
import { rankDetails } from "../logic/ranker";

const router = Router();

interface SearchRequestBody {
  query?: string;
  host_element?: string;
  adjacent_element?: string;
  exposure?: string;
}

/**
 * POST /search
 * Body: { query?, host_element?, adjacent_element?, exposure? }
 * All fields optional.
 */
router.post("/", (req: Request<{}, {}, SearchRequestBody>, res: Response) => {
  const { query, host_element, adjacent_element, exposure } = req.body;

  if (req.body === null || typeof req.body !== "object") {
    return res.status(400).json({ error: "Request body must be a JSON object." });
  }

  const hasAnyInput = query || host_element || adjacent_element || exposure;
  if (!hasAnyInput) {
    return res.status(400).json({
      error: "Provide at least one of: query, host_element, adjacent_element, exposure.",
    });
  }

  const context = { host_element, adjacent_element, exposure };
  const response = rankDetails(query, context);

  return res.json(response);
});

export default router;
