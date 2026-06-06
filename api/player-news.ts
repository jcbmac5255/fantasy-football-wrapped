import {
  ApiRequest,
  ApiResponse,
  rejectWrongMethod,
  sendJson,
} from "./_lib/http";

// GET /api/player-news?keywords=name1,name2 -> NewsItem[]
//
// The original instance backed this with a paid NFL news provider. There is no
// free drop-in source, so this returns an empty list (the Start/Sit UI handles
// "no news" gracefully). To enable news, plug a provider in here and map its
// response to the array shape the frontend expects. See SETUP.md.
export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (rejectWrongMethod(req, res, "GET")) return;
  res.setHeader("Cache-Control", "public, max-age=600");
  sendJson(res, 200, []);
}
