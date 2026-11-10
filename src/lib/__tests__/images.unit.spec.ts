import { sniffImageType } from "../images"

describe("sniffImageType", () => {
  it("recognises jpeg, png, webp, avif, gif and nothing else", () => {
    expect(sniffImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg")
    expect(sniffImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]))).toBe("image/png")
    expect(sniffImageType(Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBPVP8 ")]))).toBe("image/webp")
    expect(sniffImageType(Buffer.concat([Buffer.alloc(4), Buffer.from("ftypavif"), Buffer.alloc(4)]))).toBe("image/avif")
    expect(sniffImageType(Buffer.from("GIF89a......"))).toBe("image/gif")
    expect(sniffImageType(Buffer.from("<svg xmlns=..."))).toBeNull()
    expect(sniffImageType(Buffer.from("MZ\u0090\u0000"))).toBeNull()
  })
})
