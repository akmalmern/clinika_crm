import { MetricsService } from './metrics.service';

function build(enabled: boolean): MetricsService {
  const config = {
    getOrThrow: jest.fn().mockReturnValue({ metricsEnabled: enabled }),
  };
  return new MetricsService(config as never);
}

describe('MetricsService', () => {
  it('yoqilganda HTTP so`rovni qayd etadi va /metrics matnida ko`rinadi', async () => {
    const svc = build(true);
    expect(svc.enabled).toBe(true);
    svc.observe('GET', '/clinic/patients/:id', 200, 0.123);
    const text = await svc.metrics();
    expect(text).toContain('http_requests_total');
    expect(text).toContain('http_request_duration_seconds');
    expect(text).toContain('method="GET"');
    expect(text).toContain('status="200"');
  });

  it('o`chirilganda observe no-op (default metrikalar yig`ilmaydi)', async () => {
    const svc = build(false);
    expect(svc.enabled).toBe(false);
    svc.observe('GET', '/x', 200, 0.1);
    const text = await svc.metrics();
    // Counter ro'yxatdan o'tgan, lekin namuna yozilmagan -> qiymat yo'q.
    expect(text).not.toContain('method="GET"');
  });
});
