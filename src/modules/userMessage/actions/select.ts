import { UserMessage } from "~/modules"
import { Context } from "~/types"

export interface SelectOptions {
  pagination?: {
    limit: number
    offset: number
  }
  filter?: {
    userId?: string
    channelId?: string
    notChannelId?: string
    gtCreatedAt?: Date
    lteCreatedAt?: Date
  }
}

const getSelectQb = (
  context: Context,
  { pagination, filter }: SelectOptions = {},
) => {
  const qb = context.db(UserMessage.db.TableName)

  if (filter?.userId) {
    qb.where("user_id", filter.userId)
  }

  if (filter?.channelId) {
    qb.where("channel_id", filter.channelId)
  }

  if (filter?.notChannelId) {
    qb.whereNot("channel_id", filter.notChannelId)
  }

  if (filter?.lteCreatedAt) {
    qb.where("created_at", "<=", filter.lteCreatedAt)
  }

  if (filter?.gtCreatedAt) {
    qb.where("created_at", ">", filter.gtCreatedAt)
  }

  if (pagination) {
    qb.limit(pagination.limit).offset(pagination.offset)
  }

  return qb
}

export const select = async (
  context: Context,
  options?: SelectOptions,
): Promise<UserMessage.db.Table[]> => {
  return await getSelectQb(context, options)
}

export const count = async (
  context: Context,
  filter?: SelectOptions["filter"],
): Promise<number> => {
  const qb = getSelectQb(context, { filter })

  const [result] = await qb.count("message_id", {
    as: "count",
  })

  return Number(result?.count ?? 0)
}
