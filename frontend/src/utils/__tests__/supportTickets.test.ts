import { describe, expect, it } from 'vitest'
import { encodeTicketFiles, MAX_TICKET_FILE_BYTES, validateTicketFiles } from '../supportTickets'

describe('support ticket screenshots', () => {
  const file = (type = 'image/png', bytes = 3) => new File([new Uint8Array(bytes)], 'capture.png', { type })

  it('accepts PNG/JPEG screenshots and an empty list', () => {
    expect(validateTicketFiles([])).toBeNull()
    expect(validateTicketFiles([file(), file('image/jpeg')])).toBeNull()
    expect(validateTicketFiles([file('image/png', MAX_TICKET_FILE_BYTES)])).toBeNull()
  })

  it('rejects extra, empty, oversized or non-raster files', () => {
    expect(validateTicketFiles([file(), file(), file(), file()])).toBe('count')
    expect(validateTicketFiles([file('image/svg+xml')])).toBe('type')
    expect(validateTicketFiles([file('image/png', 0)])).toBe('size')
    expect(validateTicketFiles([file('image/png', MAX_TICKET_FILE_BYTES + 1)])).toBe('size')
  })

  it('encodes only base64 data and the original filename', async () => {
    const encoded = await encodeTicketFiles([new File(['abc'], 'capture.png', { type: 'image/png' })])
    expect(encoded).toEqual([{ name: 'capture.png', data: 'YWJj' }])
  })

  it('does not read invalid files', async () => {
    await expect(encodeTicketFiles([file('text/html')])).rejects.toThrow('Invalid ticket attachments')
  })
})
