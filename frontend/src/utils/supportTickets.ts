import type { TicketFileInput } from '@/api/supportTickets'

export const MAX_TICKET_FILE_BYTES = 2 * 1024 * 1024
export const MAX_TICKET_FILES = 3

export function validateTicketFiles(files: File[]): 'count' | 'type' | 'size' | null {
  if (files.length > MAX_TICKET_FILES) return 'count'
  if (files.some(file => !['image/png', 'image/jpeg'].includes(file.type))) return 'type'
  if (files.some(file => file.size === 0 || file.size > MAX_TICKET_FILE_BYTES)) return 'size'
  return null
}

export async function encodeTicketFiles(files: File[]): Promise<TicketFileInput[]> {
  if (validateTicketFiles(files)) throw new Error('Invalid ticket attachments')
  return Promise.all(files.map(file => new Promise<TicketFileInput>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const value = String(reader.result)
      resolve({ name: file.name, data: value.slice(value.indexOf(',') + 1) })
    }
    reader.onerror = () => reject(new Error('Cannot read attachment'))
    reader.onabort = () => reject(new Error('Attachment reading canceled'))
    reader.readAsDataURL(file)
  })))
}
