import { NextResponse } from "next/server";

// GPT Actions 需要能 GET 到这个 schema
export async function GET() {
  const schema = {
    openapi: "3.1.0",
    info: {
      title: "PulseFeed API",
      description:
        "PulseFeed 是 Web3 行业动态聚合平台。通过此 API 你可以查看系统状态、管理关注列表、触发抓取、查看推送历史。",
      version: "1.0.0",
    },
    servers: [
      {
        url: "https://{domain}",
        description: "PulseFeed server",
        variables: {
          domain: {
            default: "your-pulsefeed-domain.com",
            description: "Your PulseFeed deployment domain",
          },
        },
      },
    ],
    paths: {
      "/api/gpt/status": {
        get: {
          operationId: "getStatus",
          summary: "获取系统状态",
          description:
            "返回 PulseFeed 的系统资源使用情况（CPU/内存/磁盘）、今日抓取和推送统计、活跃监控数量。",
          responses: {
            "200": {
              description: "系统状态",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      system: {
                        type: "object",
                        properties: {
                          cpu: { type: "string", example: "15%" },
                          memory: {
                            type: "string",
                            example: "800 MB / 2 GB (40%)",
                          },
                          uptime: { type: "string", example: "2d 5h 30m" },
                          db_size: { type: "string", example: "1.2 MB" },
                        },
                      },
                      today: {
                        type: "object",
                        properties: {
                          fetches: { type: "integer" },
                          pushes_success: { type: "integer" },
                          pushes_failed: { type: "integer" },
                        },
                      },
                      active_monitors: { type: "integer" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/gpt/watchlist": {
        get: {
          operationId: "getWatchlist",
          summary: "获取关注列表",
          description:
            "返回所有 Twitter KOL 和新闻关键词监控项，包含 ID、类型、目标、标签、轮询间隔、启用状态。",
          responses: {
            "200": {
              description: "关注列表",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      watchlist: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            id: { type: "integer" },
                            type: { type: "string", enum: ["Twitter KOL", "News Keyword"] },
                            target: { type: "string" },
                            tags: { type: "array", items: { type: "string" } },
                            interval: { type: "string" },
                            enabled: { type: "boolean" },
                          },
                        },
                      },
                      total: { type: "integer" },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          operationId: "addWatchlistItem",
          summary: "添加关注项",
          description:
            "添加新的 Twitter KOL 或新闻关键词到关注列表。添加后调度器会自动按间隔抓取。",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["type", "target"],
                  properties: {
                    type: {
                      type: "string",
                      enum: ["twitter_kol", "news_keyword"],
                      description: "监控类型",
                    },
                    target: {
                      type: "string",
                      description: "Twitter 用户名（不带@）或新闻关键词",
                    },
                    tags: {
                      type: "array",
                      items: { type: "string" },
                      description: "分类标签",
                    },
                    interval_minutes: {
                      type: "integer",
                      default: 15,
                      description: "轮询间隔（分钟）",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "201": {
              description: "添加成功",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean" },
                      id: { type: "integer" },
                      message: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/gpt/trigger": {
        post: {
          operationId: "triggerFetch",
          summary: "手动触发抓取",
          description:
            "立即对指定的关注项执行一次抓取 → AI 摘要 → 飞书推送的完整流程，返回摘要结果。",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["watchlist_id"],
                  properties: {
                    watchlist_id: {
                      type: "integer",
                      description: "关注列表项 ID（从 getWatchlist 获取）",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "触发结果",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean" },
                      target: { type: "string" },
                      summary: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/gpt/history": {
        get: {
          operationId: "getHistory",
          summary: "查看推送历史",
          description: "返回最近的飞书推送记录，包含 AI 摘要、来源、状态。",
          parameters: [
            {
              name: "limit",
              in: "query",
              schema: { type: "integer", default: 10, maximum: 20 },
              description: "返回条数（最多20）",
            },
          ],
          responses: {
            "200": {
              description: "推送历史",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      history: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            time: { type: "string" },
                            status: { type: "string" },
                            source: { type: "string" },
                            target: { type: "string" },
                            summary: { type: "string" },
                          },
                        },
                      },
                      count: { type: "integer" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };

  return NextResponse.json(schema, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
