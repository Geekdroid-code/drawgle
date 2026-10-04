// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, rpc } = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser } }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc }) }));
import { POST } from "./route";

const userId = "44444444-4444-4444-8444-444444444444";
const redeem = (body: unknown) =>
  POST(new Request("http://localhost/api/credits/redeem", { method: "POST", body: JSON.stringify(body) }));
const redeemCalls = () => rpc.mock.calls.filter(([name]) => name === "redeem_credit_code");

describe("credit code redemption route", () => {
  let redeemResult: { data: unknown; error: unknown };
  let allowed: boolean;

  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    allowed = true;
    redeemResult = { data: { status: "redeemed", credits: 200, balance: 250 }, error: null };
    rpc.mockImplementation(async (name: string) =>
      name === "consume_rate_limit"
        ? { data: { allowed, retryAfterSeconds: allowed ? 0 : 1800 }, error: null }
        : redeemResult,
    );
  });

  it("needs a signed-in person", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const response = await redeem({ code: "DG-7K2M4P" });
    expect(response.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("redeems the canonical code for the caller and reports the new balance", async () => {
    const response = await redeem({ code: "  dg-7k2m4p " });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "redeemed",
      credits: 200,
      balance: 250,
      message: "200 credits added. That's enough for 10 screens.",
    });
    expect(redeemCalls()).toEqual([["redeem_credit_code", { input_user_id: userId, input_code: "DG-7K2M4P" }]]);
  });

  it.each([
    ["already_redeemed", 409],
    ["exhausted", 410],
    ["expired", 410],
    ["not_found", 404],
  ])("answers %s with %i and a message", async (status, httpStatus) => {
    redeemResult = { data: { status }, error: null };
    const response = await redeem({ code: "DG-7K2M4P" });
    expect(response.status).toBe(httpStatus);
    const body = await response.json();
    expect(body.status).toBe(status);
    expect(body.message).toEqual(expect.any(String));
    expect(body.credits).toBeUndefined();
  });

  it.each([{ code: "x" }, { code: "DG 7K2M4P" }, { code: 42 }, {}, "not json"])(
    "treats a malformed code (%j) as unknown without looking it up",
    async (body) => {
      const response = await redeem(body);
      expect(response.status).toBe(404);
      expect(redeemCalls()).toEqual([]);
    },
  );

  it("counts every attempt, so guessing codes runs into the limit", async () => {
    allowed = false;
    const response = await redeem({ code: "DG-7K2M4P" });
    expect(response.status).toBe(429);
    expect(redeemCalls()).toEqual([]);
    expect(rpc.mock.calls.map(([name, args]) => [name, args.input_bucket])).toEqual([["consume_rate_limit", "redeem:hour"]]);
  });

  it("does not claim success when the database fails", async () => {
    redeemResult = { data: null, error: { message: "boom" } };
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await redeem({ code: "DG-7K2M4P" });
    expect(response.status).toBe(500);
    expect((await response.json()).status).toBeUndefined();
  });
});
