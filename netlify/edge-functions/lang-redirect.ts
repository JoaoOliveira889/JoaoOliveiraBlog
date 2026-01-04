import type { Config, Context } from "@netlify/edge-functions";

export default async (request: Request, context: Context) => {
  const url = new URL(request.url);

  // Só decide na home. Outras URLs ficam explícitas (/en/...)
  if (url.pathname !== "/") return;

  const country = context.geo.country?.code; // ex.: "BR"
  const target = country === "BR" ? "/" : "/en/";

  // Evita loop
  if (url.pathname === target) return;

  return Response.redirect(new URL(target, url.origin), 302);
};

export const config: Config = {
  path: "/",
};
