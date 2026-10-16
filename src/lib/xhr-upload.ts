/** PUTs a file to a signed Storage upload URL, reporting progress (fetch cannot). */
export function putFile(
  url: string,
  body: Blob,
  contentType: string,
  onProgress?: (fraction: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open("PUT", url)
    request.setRequestHeader("content-type", contentType)
    request.setRequestHeader("x-upsert", "false")
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total)
    }
    request.onload = () =>
      request.status >= 200 && request.status < 300
        ? resolve()
        : reject(new Error(`upload failed: ${request.status}`))
    request.onerror = () => reject(new Error("upload failed: network"))
    request.onabort = () => reject(new Error("upload aborted"))
    request.send(body)
  })
}
