export const TABLE_NAME = "user_message_entity"

export interface Table {
  message_id: string
  user_id: string
  channel_id: string
  created_at: Date
}
