import { displayName, maskEmail, pickLocale, sanitizeText, splitName } from "../text"

describe("sanitizeText", () => {
  it("strips tags, control characters and tidies whitespace", () => {
    expect(sanitizeText("<b>Great</b>   chopping\u0000 board<script>alert(1)</script>", 100)).toBe("Great chopping board")
    expect(sanitizeText("line1\r\n\r\n\r\n\r\nline2", 100)).toBe("line1\n\nline2")
  })
  it("caps the length by characters, not bytes", () => {
    expect(sanitizeText("ééééé", 3)).toBe("ééé")
    expect(sanitizeText(12 as unknown as string, 10)).toBe("")
  })
})

describe("displayName", () => {
  it("short: first name + initial of the last name", () => {
    expect(displayName("Anto", "Rahman")).toBe("Anto R.")
    expect(displayName("Anto", "Rahman Saputra")).toBe("Anto S.")
    expect(displayName("Anto", "")).toBe("Anto")
    expect(displayName("Anto Rahman", null)).toBe("Anto R.")
    expect(displayName("", "Rahman")).toBe("Rahman")
  })
  it("initials and full", () => {
    expect(displayName("Anto", "Rahman", "initials")).toBe("A. R.")
    expect(displayName("Anto", "Rahman", "full")).toBe("Anto Rahman")
  })
  it("never leaks an e-mail and never returns empty", () => {
    expect(displayName(null, null)).toBe("Customer")
    expect(displayName("<img src=x>", "", "full")).toBe("Customer")
    expect(displayName("a".repeat(100), "b", "full").length).toBeLessThanOrEqual(40)
  })
  it("splitName", () => {
    expect(splitName("Anto Rahman")).toEqual(["Anto", "Rahman"])
    expect(splitName("Anto")).toEqual(["Anto", ""])
    expect(splitName("Ni Luh Putu Ayu")).toEqual(["Ni Luh Putu", "Ayu"])
  })
})

describe("maskEmail / pickLocale", () => {
  it("masks the local part", () => {
    expect(maskEmail("anto@hauskayu.com")).toBe("a***@hauskayu.com")
    expect(maskEmail("nonsense")).toBe("***")
  })
  it("prefers the explicit locale, then Accept-Language", () => {
    expect(pickLocale("id-ID", "en-US,en;q=0.9")).toBe("id-ID")
    expect(pickLocale(undefined, "en-US,en;q=0.9")).toBe("en-US")
    expect(pickLocale("<x>", "*")).toBeNull()
  })
})
