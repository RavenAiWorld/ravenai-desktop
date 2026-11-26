import apiClient from './client'

export type ImageTier = '1K' | '2K' | '4K'
export type ImageRatio = '1:1' | '3:2' | '2:3' | '16:9' | '9:16'
export type ImageQuality = 'auto' | 'low' | 'medium' | 'high'
export interface ImageStudioGroup {
  id: number
  name: string
  models: string[]
  prices: Partial<Record<ImageTier, number>>
}
export interface ImageStudioCatalog { groups: ImageStudioGroup[]; max_images: number; max_references: number }
export interface ImageStudioInput {
  group_id: number
  model: string
  prompt: string
  tier: ImageTier
  ratio: ImageRatio
  quality: ImageQuality
  n: number
  expected_price: number
  request_id: string
  references?: string[]
}
export interface ImageStudioResult {
  created?: number
  data: Array<{ b64_json?: string; url?: string; revised_prompt?: string }>
}

export async function getImageStudioCatalog() {
  return (await apiClient.get<ImageStudioCatalog>('/image-studio/catalog')).data
}

export async function generateStudioImage(input: ImageStudioInput) {
  // The request ID stays the same if the shared client refreshes an expired JWT.
  // There is no retry on a timeout, network failure or upstream error.
  return (await apiClient.post<ImageStudioResult>('/image-studio/generations', input, { timeout: 300000 })).data
}
