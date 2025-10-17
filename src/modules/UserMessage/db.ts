export const TableName = "user_messages"

export interface Table {
  message_id: string
  user_id: string
  channel_id: string
  created_at: Date
}

export type InsertData = Table
