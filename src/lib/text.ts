/** Plain text only: tags removed, control characters dropped, whitespace tidied, length capped. */
export function sanitizeText(input: unknown, max: number): string {
  if (typeof input !== "string") return ""
  let s = input.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ").replace(/<[^>]*>/g, " ")
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
  s = s.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim()
  return Array.from(s).slice(0, max).join("")
}

export type DisplayNameStyle = "short" | "initials" | "full"

const MAX_NAME = 40

function words(value: string | null | undefined): string[] {
  return sanitizeText(value ?? "", 200).replace(/\n/g, " ").split(" ").filter(Boolean)
}

function initial(word: string): string {
  return `${Array.from(word)[0].toLocaleUpperCase()}.`
}

/**
 * The name shown next to a review. "short": first name + initial of the last name ("Anto R."), "initials": "A. R.",
 * "full": the full name. Never the e-mail; an empty name becomes "Customer".
 */
export function displayName(first: string | null | undefined, last: string | null | undefined, style: DisplayNameStyle = "short"): string {
  const f = words(first)
  const l = words(last)
  let out: string
  if (!f.length && !l.length) return "Customer"
  if (style === "full") out = [...f, ...l].join(" ")
  else if (style === "initials") out = [f[0], l[l.length - 1]].filter(Boolean).map(initial).join(" ")
  else out = [f[0] ?? l[0], l.length && f.length ? initial(l[l.length - 1]) : f.length > 1 ? initial(f[f.length - 1]) : ""].filter(Boolean).join(" ")
  return Array.from(out).slice(0, MAX_NAME).join("")
}

/** Splits a single "name" string into first and last for displayName(). */
export function splitName(name: string | null | undefined): [string, string] {
  const w = words(name)
  if (w.length < 2) return [w[0] ?? "", ""]
  return [w.slice(0, -1).join(" "), w[w.length - 1]]
}

/** "a***@example.com" — enough for the reviewer to recognise the address, useless to anyone else. */
export function maskEmail(email: string): string {
  const [user, domain] = email.split("@")
  if (!domain) return "***"
  return `${Array.from(user)[0] ?? ""}***@${domain}`
}

/** BCP-47-ish locale from a body value or an Accept-Language header; null when unusable. */
export function pickLocale(explicit: unknown, acceptLanguage: string | undefined): string | null {
  const candidates = [typeof explicit === "string" ? explicit : "", ...(acceptLanguage ?? "").split(",").map((p) => p.split(";")[0])]
  for (const c of candidates) {
    const v = c.trim()
    if (/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(v)) return v.length > 35 ? v.slice(0, 35) : v
  }
  return null
}
