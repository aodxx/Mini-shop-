import { createHmac, randomUUID } from 'node:crypto';

export type PaymentRequest = {
  orderId: string;
  orderNumber: string;
  amountSatang: number;
  items: Array<{ productName: string; quantity: number; unitPriceSatang: number }>;
};

export type PaymentGateway = {
  requestPayment(input: PaymentRequest): Promise<{ transactionId: string; paymentUrl: string }>;
  confirmPayment(transactionId: string, amountSatang: number): Promise<void>;
};

function sign(secret: string, uri: string, body: string, nonce: string) {
  return createHmac('sha256', secret).update(`${secret}${uri}${body}${nonce}`).digest('base64');
}

export function createLinePayGateway(config: {
  channelId: string;
  channelSecret: string;
  merchantDeviceProfileId?: string;
  environment?: 'sandbox' | 'production';
  callbackUrl: string;
  cancelUrl: string;
  fetchImpl?: typeof fetch;
}): PaymentGateway {
  const fetchImpl = config.fetchImpl ?? fetch;
  const baseUrl = config.environment === 'production' ? 'https://api-pay.line.me' : 'https://sandbox-api-pay.line.me';
  async function call(path: string, payload: Record<string, unknown>, timeoutMs: number) {
    const body = JSON.stringify(payload);
    const nonce = randomUUID();
    const response = await fetchImpl(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-LINE-ChannelId': config.channelId,
        'X-LINE-Authorization-Nonce': nonce,
        'X-LINE-Authorization': sign(config.channelSecret, path, body, nonce),
        ...(config.merchantDeviceProfileId ? { 'X-LINE-MerchantDeviceProfileId': config.merchantDeviceProfileId } : {}),
      },
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const result = await response.json() as { returnCode?: string; returnMessage?: string; info?: Record<string, unknown> };
    if (!response.ok || result.returnCode !== '0000') throw new Error(result.returnMessage ?? `LINE Pay returned ${response.status}`);
    return result;
  }

  return {
    async requestPayment(input) {
      const result = await call('/v3/payments/request', {
        amount: Math.round(input.amountSatang / 100), currency: 'THB', orderId: input.orderNumber,
        packages: [{ id: input.orderId, amount: Math.round(input.amountSatang / 100), products: input.items.map((item) => ({ name: item.productName, quantity: item.quantity, price: Math.round(item.unitPriceSatang / 100) })) }],
        redirectUrls: { confirmUrl: config.callbackUrl, cancelUrl: config.cancelUrl },
      }, 10000);
      const info = result.info as { transactionId?: string | number; paymentUrl?: { web?: string } } | undefined;
      if (!info?.transactionId || !info.paymentUrl?.web) throw new Error('LINE Pay response did not include payment URL');
      return { transactionId: String(info.transactionId), paymentUrl: info.paymentUrl.web };
    },
    async confirmPayment(transactionId, amountSatang) {
      await call(`/v3/payments/${encodeURIComponent(transactionId)}/confirm`, { amount: Math.round(amountSatang / 100), currency: 'THB' }, 40000);
    },
  };
}
