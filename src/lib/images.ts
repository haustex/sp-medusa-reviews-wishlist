import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import type { IFileModuleService } from "@medusajs/framework/types"
import { randomBytes } from "node:crypto"
import type { Readable } from "node:stream"

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif", "image/gif": "gif" }

/** Signature check on the first bytes, so a renamed file cannot pass as an image. */
export function sniffImageType(head: Buffer): string | null {
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "image/jpeg"
  if (head.length >= 8 && head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png"
  if (head.length >= 12 && head.subarray(0, 4).toString("ascii") === "RIFF" && head.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp"
  if (head.length >= 12 && head.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = head.subarray(8, 12).toString("ascii")
    if (brand.startsWith("avi")) return "image/avif"
  }
  if (head.length >= 6 && ["GIF87a", "GIF89a"].includes(head.subarray(0, 6).toString("ascii"))) return "image/gif"
  return null
}

export function imageFileName(mime: string, prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${randomBytes(6).toString("hex")}.${EXT[mime] ?? "bin"}`
}

const fileService = (container: MedusaContainer) => container.resolve<IFileModuleService>(Modules.FILE)

/** Stores a review photo as a private file (no public URL) and returns the File Module id. */
export async function storePrivateImage(container: MedusaContainer, content: Buffer, mime: string): Promise<string> {
  const file = await fileService(container).createFiles({
    filename: imageFileName(mime, "review-pending"),
    mimeType: mime,
    content: content.toString("binary"),
    access: "private",
  })
  return file.id
}

async function collect(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  return Buffer.concat(chunks)
}

/** Copies a private file to a public one; returns the public id and URL. The private file is left to the caller. */
export async function publishImage(container: MedusaContainer, privateFileId: string, mime: string): Promise<{ id: string; url: string }> {
  const files = fileService(container)
  const content = await collect(await files.getDownloadStream(privateFileId))
  const file = await files.createFiles({ filename: imageFileName(mime, "review"), mimeType: mime, content: content.toString("binary"), access: "public" })
  if (!file.url) throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "The File Module returned no public URL for the review photo")
  return { id: file.id, url: file.url }
}

/** Deletes files, ignoring ones that are already gone. */
export async function deleteFilesQuietly(container: MedusaContainer, ids: (string | null | undefined)[]): Promise<void> {
  const files = fileService(container)
  for (const id of ids) {
    if (!id) continue
    try {
      await files.deleteFiles(id)
    } catch {
      // already deleted or provider gone: nothing to keep
    }
  }
}
