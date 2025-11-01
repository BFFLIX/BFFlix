
type Env = {
  NODE_ENV: "development" | "test" | "production";
  PORT: number;
  MONGODB_URI: string;
  JWT_SECRET: string;
  CORS_ORIGIN: string[] | true;
};

function parseCors(val?: string): string[] | true {
  if (!val || val.trim() === "*") return true;
  return val.split(",").map(s => s.trim()).filter(Boolean);
}

function required(name: string, v?: string) {
  if (!v || !v.trim()) throw new Error(`Missing required env: ${name}`);
  return v;
}

export const env: Env = {
  NODE_ENV: (process.env.NODE_ENV as Env["NODE_ENV"]) || "development",
  PORT: Number(process.env.PORT || 8080),
  MONGODB_URI: required("MONGODB_URI", process.env.MONGODB_URI),
  JWT_SECRET: required("JWT_SECRET", process.env.JWT_SECRET),
  CORS_ORIGIN: parseCors(process.env.CORS_ORIGIN),
};