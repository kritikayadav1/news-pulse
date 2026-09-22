const base = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
export async function request(route, options = {}) {
  const response = await fetch(`${base}${route}`, options);
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      "The news service returned an unexpected response. Please try again.",
    );
  }
  if (!response.ok)
    throw Object.assign(new Error(data.error || "Request failed."), {
      status: response.status,
      data,
      retryAfter: Number(response.headers.get("Retry-After")) || 0,
    });
  return data;
}
