import { apiClient } from './client'

export type TicketStatus = 'open' | 'waiting' | 'resolved' | 'closed'
export type TicketPriority = 'low' | 'normal' | 'high'
export type TicketCategory = 'account' | 'billing' | 'api' | 'image' | 'other'

export interface SupportTicket {
  id: number
  user_id: number
  title: string
  category: TicketCategory
  priority: TicketPriority
  status: TicketStatus
  request_id: string
  last_message_id: number
  last_message_preview: string
  unread: boolean
  customer_email?: string
  customer_name?: string
  created_at: string
  updated_at: string
}

export interface TicketAttachment {
  id: number
  name: string
  content_type: string
  byte_size: number
}

export interface TicketMessage {
  id: number
  author_role: 'user' | 'admin'
  kind: 'reply' | 'status' | 'priority'
  content: string
  created_at: string
  attachments: TicketAttachment[]
}

export interface TicketDetail {
  ticket: SupportTicket
  messages: TicketMessage[]
}

export interface TicketSummary {
  total: number
  open: number
  waiting: number
  resolved: number
  closed: number
  unread: number
}

export interface TicketList {
  items: SupportTicket[]
  total: number
  page: number
  page_size: number
  pages: number
}

export interface TicketFileInput {
  name: string
  data: string
}

export interface TicketCreateInput {
  title: string
  category: TicketCategory
  priority: TicketPriority
  request_id: string
  content: string
  attachments: TicketFileInput[]
}

const root = (admin = false) => `${admin ? '/admin' : ''}/support-tickets`

export const supportTicketsAPI = {
  async list(admin: boolean, params: {
    page: number
    page_size?: number
    status?: string
    category?: string
    priority?: string
    search?: string
    unread_only?: boolean
  }): Promise<TicketList> {
    return (await apiClient.get<TicketList>(root(admin), { params })).data
  },
  async summary(admin = false): Promise<TicketSummary> {
    return (await apiClient.get<TicketSummary>(`${root(admin)}/summary`)).data
  },
  async create(input: TicketCreateInput): Promise<{ id: number }> {
    return (await apiClient.post<{ id: number }>(root(), input)).data
  },
  async detail(admin: boolean, id: number): Promise<TicketDetail> {
    return (await apiClient.get<TicketDetail>(`${root(admin)}/${id}`)).data
  },
  async reply(admin: boolean, id: number, input: { content: string; status?: string; attachments: TicketFileInput[] }): Promise<void> {
    await apiClient.post(`${root(admin)}/${id}/replies`, input)
  },
  async update(admin: boolean, id: number, input: { status?: TicketStatus; priority?: TicketPriority }): Promise<void> {
    await apiClient.patch(`${root(admin)}/${id}`, input)
  },
  async markRead(admin: boolean, id: number, throughID: number): Promise<void> {
    await apiClient.post(`${root(admin)}/${id}/read`, { through_id: throughID })
  },
  async attachment(admin: boolean, id: number, attachmentID: number): Promise<Blob> {
    return (await apiClient.get<Blob>(`${root(admin)}/${id}/attachments/${attachmentID}`, { responseType: 'blob' })).data
  }
}
