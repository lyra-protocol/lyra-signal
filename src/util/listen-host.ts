/**
 * Some hosts (e.g. Railway) inject `HOST=[::]` which is not a valid bind address for
 * `http.Server.listen()` — Node tries to resolve it as a DNS name and throws ENOTFOUND.
 * Use bare `::` for dual-stack / IPv6 all interfaces, or `0.0.0.0` for IPv4 all interfaces.
 */
export function resolveListenHost(): string {
  const raw = process.env.HOST?.trim();
  if (!raw) return "0.0.0.0";

  // Bracketed IPv6 literals are invalid as the `hostname` argument to listen()
  if (raw === "[::]" || raw === "[::0]" || raw === "[0:0:0:0:0:0:0:0]") {
    return "::";
  }
  if (raw.startsWith("[") && raw.endsWith("]")) {
    return raw.slice(1, -1);
  }

  return raw;
}
