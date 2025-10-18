export const TableName = "auto_delete"

export interface Table {
  user_id: string
  delete_before_hours: number
  created_at: Date
}

export type InsertData = Omit<Table, "created_at">
